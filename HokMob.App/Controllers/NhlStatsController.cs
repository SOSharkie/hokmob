using System.Text.Json.Nodes;
using HokMob.App.Services;
using Microsoft.AspNetCore.Mvc;

namespace HokMob.App.Controllers
{
    /// <summary>
    /// Per-player, leaderboard and per-team stats from the NHL stats API (https://api.nhle.com/stats/rest/en/), which
    /// sends no CORS header. Every upstream query is built here, so a client can't pass its own cayenneExp or sort.
    /// The parts of one page are merged into a single response, so the browser makes one request.
    /// </summary>
    [ApiController]
    [Route("api/nhl-stats")]
    public class NhlStatsController : ControllerBase
    {
        /// <summary>The realtime fields merged into a skater's rows, by season and by game.</summary>
        private static readonly string[] SkaterRealtimeFields =
            {"hits", "blockedShots", "takeaways", "giveaways", "missedShots"};

        /// <summary>The saves by strength fields merged into a goalie's per game rows.</summary>
        private static readonly string[] GoalieSavesByStrengthFields =
            {"evSaves", "evShotsAgainst", "ppSaves", "ppShotsAgainst", "shSaves", "shShotsAgainst"};

        /// <summary>The score fields merged into a player's recent games from the game report.</summary>
        private static readonly string[] GameScoreFields =
            {"homeTeamId", "visitingTeamId", "homeScore", "visitingScore"};

        private const int RecentGameCount = 10;

        private const int MaxLeaderLimit = 25;

        private readonly NhlStatsApiClient _nhlStatsApiClient;

        public NhlStatsController(NhlStatsApiClient nhlStatsApiClient)
        {
            _nhlStatsApiClient = nhlStatsApiClient;
        }

        /// <summary>
        /// Returns a player's NHL stats by season and for their last 10 games, as
        /// { regularSeasons, playoffSeasons, recentGames }. A skater's rows include the realtime stats (hits, blocks,
        /// takeaways and giveaways), a goalie's per game rows the saves by strength. Recent games have the final
        /// score, and are newest first with playoff and regular season games mixed.
        /// </summary>
        /// <param name="id">The NHL player ID.</param>
        /// <param name="position">"skater" (the default) or "goalie", from the player landing's position.</param>
        [HttpGet("player/{id:int}")]
        public async Task<IActionResult> GetPlayerStats(int id, string? position, CancellationToken cancellationToken)
        {
            if (id <= 0 || (position != null && position != "skater" && position != "goalie"))
            {
                return BadRequest();
            }
            var isGoalie = position == "goalie";
            var summaryReport = isGoalie ? "goalie/summary" : "skater/summary";
            var gameExtrasReport = isGoalie ? "goalie/savesByStrength" : "skater/realtime";

            // Everything but the scores of the recent games, which need their game IDs, is asked for at once.
            var regularSeasonsTask = _nhlStatsApiClient.GetReportAsync(summaryReport, GetSeasonParameters(id, 2), cancellationToken);
            var playoffSeasonsTask = _nhlStatsApiClient.GetReportAsync(summaryReport, GetSeasonParameters(id, 3), cancellationToken);
            var recentGamesTask = _nhlStatsApiClient.GetReportAsync(summaryReport, GetRecentGameParameters(id), cancellationToken);
            var recentGameExtrasTask = _nhlStatsApiClient.GetReportAsync(gameExtrasReport, GetRecentGameParameters(id), cancellationToken);
            var regularSeasonExtrasTask = isGoalie
                ? Task.FromResult<List<JsonObject>?>(null)
                : _nhlStatsApiClient.GetReportAsync("skater/realtime", GetSeasonParameters(id, 2), cancellationToken);
            var playoffSeasonExtrasTask = isGoalie
                ? Task.FromResult<List<JsonObject>?>(null)
                : _nhlStatsApiClient.GetReportAsync("skater/realtime", GetSeasonParameters(id, 3), cancellationToken);

            await Task.WhenAll(regularSeasonsTask, playoffSeasonsTask, recentGamesTask, recentGameExtrasTask,
                regularSeasonExtrasTask, playoffSeasonExtrasTask);

            var regularSeasons = regularSeasonsTask.Result;
            var playoffSeasons = playoffSeasonsTask.Result;
            var recentGames = recentGamesTask.Result;
            if (regularSeasons == null || playoffSeasons == null || recentGames == null)
            {
                return StatusCode(StatusCodes.Status502BadGateway);
            }

            var seasonExtraFields = isGoalie ? Array.Empty<string>() : SkaterRealtimeFields;
            Merge(regularSeasons, regularSeasonExtrasTask.Result, "seasonId", seasonExtraFields);
            Merge(playoffSeasons, playoffSeasonExtrasTask.Result, "seasonId", seasonExtraFields);
            Merge(recentGames, recentGameExtrasTask.Result, "gameId",
                isGoalie ? GoalieSavesByStrengthFields : SkaterRealtimeFields);
            SortBySeason(regularSeasons);
            SortBySeason(playoffSeasons);
            await AddGameScores(recentGames, cancellationToken);

            return new JsonResult(new JsonObject
            {
                ["regularSeasons"] = ToJsonArray(regularSeasons),
                ["playoffSeasons"] = ToJsonArray(playoffSeasons),
                ["recentGames"] = ToJsonArray(recentGames)
            });
        }

        /// <summary>
        /// Returns a season's hits and shots leaders as { hits, shots }. The other leaderboards come from the NHL web
        /// API, which has no hits or shots categories.
        /// </summary>
        /// <param name="season">The season ID, like 20252026.</param>
        /// <param name="gameType">2 for the regular season, 3 for the playoffs.</param>
        /// <param name="limit">The number of leaders per category, capped at 25.</param>
        [HttpGet("leaders")]
        public async Task<IActionResult> GetLeaders(int season, int gameType, int? limit, CancellationToken cancellationToken)
        {
            if (!IsValidSeason(season) || !IsValidGameType(gameType))
            {
                return BadRequest();
            }
            var leaderLimit = Math.Clamp(limit ?? 5, 1, MaxLeaderLimit);

            var hitsTask = _nhlStatsApiClient.GetReportAsync("skater/realtime",
                GetLeaderParameters(season, gameType, leaderLimit, "hits"), cancellationToken);
            var shotsTask = _nhlStatsApiClient.GetReportAsync("skater/summary",
                GetLeaderParameters(season, gameType, leaderLimit, "shots"), cancellationToken);
            await Task.WhenAll(hitsTask, shotsTask);

            if (hitsTask.Result == null || shotsTask.Result == null)
            {
                return StatusCode(StatusCodes.Status502BadGateway);
            }

            return new JsonResult(new JsonObject
            {
                ["hits"] = ToJsonArray(hitsTask.Result),
                ["shots"] = ToJsonArray(shotsTask.Result)
            });
        }

        /// <summary>
        /// Returns every team's season stats (power play, penalty kill, goals and shots per game, faceoffs) as
        /// { teams }. All teams come back in one response, so a team page works out league ranks itself and every team
        /// page shares the same cached response.
        /// </summary>
        /// <param name="season">The season ID, like 20252026.</param>
        /// <param name="gameType">2 for the regular season, 3 for the playoffs. Defaults to the regular season.</param>
        [HttpGet("teams")]
        public async Task<IActionResult> GetTeamStats(int season, int? gameType, CancellationToken cancellationToken)
        {
            var teamGameType = gameType ?? 2;
            if (!IsValidSeason(season) || !IsValidGameType(teamGameType))
            {
                return BadRequest();
            }

            var teams = await _nhlStatsApiClient.GetReportAsync("team/summary", new[]
            {
                new KeyValuePair<string, string>("isAggregate", "false"),
                new KeyValuePair<string, string>("isGame", "false"),
                new KeyValuePair<string, string>("limit", "-1"),
                new KeyValuePair<string, string>("cayenneExp", $"seasonId={season} and gameTypeId={teamGameType}")
            }, cancellationToken);

            if (teams == null)
            {
                return StatusCode(StatusCodes.Status502BadGateway);
            }

            return new JsonResult(new JsonObject {["teams"] = ToJsonArray(teams)});
        }

        /// <summary>
        /// The query for a player's per season rows of one game type. Rows don't say which game type they are, so the
        /// regular season and the playoffs are asked for separately.
        /// </summary>
        private static KeyValuePair<string, string>[] GetSeasonParameters(int playerId, int gameType)
        {
            return new[]
            {
                new KeyValuePair<string, string>("isAggregate", "false"),
                new KeyValuePair<string, string>("isGame", "false"),
                new KeyValuePair<string, string>("limit", "-1"),
                new KeyValuePair<string, string>("cayenneExp", $"playerId={playerId} and gameTypeId={gameType}")
            };
        }

        /// <summary>
        /// The query for a player's last 10 games, newest first. Games of this season and the one before it are asked
        /// for, so a player who hasn't played yet this season still has games.
        /// </summary>
        private static KeyValuePair<string, string>[] GetRecentGameParameters(int playerId)
        {
            return new[]
            {
                new KeyValuePair<string, string>("isAggregate", "false"),
                new KeyValuePair<string, string>("isGame", "true"),
                new KeyValuePair<string, string>("limit", RecentGameCount.ToString()),
                new KeyValuePair<string, string>("sort",
                    "[{\"property\":\"gameDate\",\"direction\":\"DESC\"},{\"property\":\"gameId\",\"direction\":\"DESC\"}]"),
                new KeyValuePair<string, string>("cayenneExp", $"playerId={playerId} and seasonId>={GetPreviousSeason()}")
            };
        }

        /// <summary>
        /// The query for one leaderboard of a season, like the top skaters by hits.
        /// </summary>
        private static KeyValuePair<string, string>[] GetLeaderParameters(int season, int gameType, int limit, string field)
        {
            return new[]
            {
                new KeyValuePair<string, string>("isAggregate", "false"),
                new KeyValuePair<string, string>("isGame", "false"),
                new KeyValuePair<string, string>("limit", limit.ToString()),
                new KeyValuePair<string, string>("sort", "[{\"property\":\"" + field + "\",\"direction\":\"DESC\"}]"),
                new KeyValuePair<string, string>("cayenneExp", $"seasonId={season} and gameTypeId={gameType}")
            };
        }

        /// <summary>
        /// Adds the game type and the final score to a player's recent games, with one call for all of them. The games
        /// keep their other stats when that call fails.
        /// </summary>
        private async Task AddGameScores(List<JsonObject> games, CancellationToken cancellationToken)
        {
            var gameIds = new List<long>();
            foreach (var game in games)
            {
                var gameId = GetLongValue(game["gameId"]);
                if (gameId.HasValue)
                {
                    gameIds.Add(gameId.Value);
                    // Per game rows have no game type, but the 5th and 6th digit of a game ID hold it (2025030416).
                    game["gameType"] = JsonValue.Create((int)(gameId.Value / 10000 % 100));
                }
            }
            if (gameIds.Count == 0)
            {
                return;
            }

            var scores = await _nhlStatsApiClient.GetReportAsync("game", new[]
            {
                new KeyValuePair<string, string>("cayenneExp", $"id in ({string.Join(",", gameIds)})")
            }, cancellationToken);
            Merge(games, scores, "gameId", GameScoreFields, "id");
        }

        /// <summary>
        /// Merges fields of a second report into the rows of the first one, matched on a key like the season or game
        /// ID. Rows without a match, and a second report that failed, leave those fields out.
        /// </summary>
        /// <param name="rows">The rows to merge into.</param>
        /// <param name="extraRows">The second report's rows, or null when that call failed.</param>
        /// <param name="key">The field the reports are matched on.</param>
        /// <param name="fields">The fields to take from the second report.</param>
        /// <param name="extraKey">The matching field in the second report, when it isn't named like the first one.</param>
        private static void Merge(List<JsonObject> rows, List<JsonObject>? extraRows, string key, string[] fields,
            string? extraKey = null)
        {
            if (extraRows == null || fields.Length == 0)
            {
                return;
            }

            var extraRowsByKey = new Dictionary<long, JsonObject>();
            foreach (var extraRow in extraRows)
            {
                var extraRowKey = GetLongValue(extraRow[extraKey ?? key]);
                if (extraRowKey.HasValue)
                {
                    extraRowsByKey[extraRowKey.Value] = extraRow;
                }
            }

            foreach (var row in rows)
            {
                var rowKey = GetLongValue(row[key]);
                if (!rowKey.HasValue || !extraRowsByKey.TryGetValue(rowKey.Value, out var extraRow))
                {
                    continue;
                }
                foreach (var field in fields)
                {
                    if (extraRow.TryGetPropertyValue(field, out var value))
                    {
                        row[field] = value == null ? null : JsonNode.Parse(value.ToJsonString());
                    }
                }
            }
        }

        /// <summary>
        /// Sorts per season rows newest season first. The stats API doesn't return them in a useful order.
        /// </summary>
        private static void SortBySeason(List<JsonObject> rows)
        {
            rows.Sort((rowA, rowB) => (GetLongValue(rowB["seasonId"]) ?? 0).CompareTo(GetLongValue(rowA["seasonId"]) ?? 0));
        }

        /// <summary>
        /// Reads a number like a season or game ID, or null when the field is missing or isn't a number.
        /// </summary>
        private static long? GetLongValue(JsonNode? node)
        {
            return node is JsonValue value && value.TryGetValue(out long number) ? number : null;
        }

        /// <summary>
        /// The season before the current one, like 20252026 in the 2026-27 season. Recent games are looked for from
        /// that season on.
        /// </summary>
        private static int GetPreviousSeason()
        {
            var today = DateTime.UtcNow;
            // A season is named after the year it starts in, and its first games are played in September.
            var startYear = today.Month >= 9 ? today.Year : today.Year - 1;
            return (startYear - 1) * 10000 + startYear;
        }

        /// <summary>
        /// Whether a season ID is two consecutive years, like 20252026.
        /// </summary>
        private static bool IsValidSeason(int season)
        {
            return season >= 19171918 && season % 10000 - season / 10000 == 1;
        }

        private static bool IsValidGameType(int gameType)
        {
            return gameType is 2 or 3;
        }

        private static JsonArray ToJsonArray(List<JsonObject> rows)
        {
            return new JsonArray(rows.Cast<JsonNode>().ToArray());
        }
    }
}

using HokMob.App.Services;
using Microsoft.AspNetCore.Mvc;

namespace HokMob.App.Controllers
{
    /// <summary>
    /// Corsi and expected goals (xG) from Natural Stat Trick, which the NHL APIs don't have.
    /// </summary>
    [ApiController]
    [Route("api/nst")]
    public class NaturalStatTrickController : ControllerBase
    {
        /// <summary>The first season NST has games for.</summary>
        private const int FirstSeasonStartYear = 2007;

        private readonly NaturalStatTrickClient _naturalStatTrickClient;

        public NaturalStatTrickController(NaturalStatTrickClient naturalStatTrickClient)
        {
            _naturalStatTrickClient = naturalStatTrickClient;
        }

        /// <summary>
        /// Returns a game's all situations Corsi and xG for both teams and each skater, and each shot's xG, as
        /// { gameId, isFinal, period, timeInPeriod, homeTeam, awayTeam, shots }. A live game's stats are partial and a
        /// few minutes behind; period and timeInPeriod say how far they go. 404 when NST has no stats for the game
        /// (yet), 503 when NST can't be asked right now (no key configured, NST unreachable, or the usage tokens are
        /// running low).
        /// </summary>
        /// <param name="gameId">The NHL game ID of a regular season or playoff game, like 2026020110.</param>
        [HttpGet("game/{gameId:long}")]
        public async Task<IActionResult> GetGameStats(long gameId)
        {
            var startYear = gameId / 1_000_000;
            var gameType = gameId / 10_000 % 100;
            if (startYear < FirstSeasonStartYear || startYear > DateTime.UtcNow.Year || gameType is not (2 or 3))
            {
                return BadRequest();
            }

            var result = await _naturalStatTrickClient.GetGameStatsAsync(gameId);
            return result.Status switch
            {
                NstLookupStatus.Found => Ok(result.Stats),
                NstLookupStatus.NotFound => NotFound(),
                _ => StatusCode(StatusCodes.Status503ServiceUnavailable)
            };
        }

        /// <summary>
        /// Returns every team's games of a regular season with their 5v5 expected goals, as { season, teams: [names],
        /// games: { gameId, team, expectedGoalsFor, expectedGoalsAgainst } }: columns of equally long arrays, one row
        /// per team and game, where team is an index into teams. From NST's team game logs, kept for an hour. Teams are named as NST names them ("St Louis Blues"), with no ID. 404 when NST has no games for the
        /// season yet, 503 when NST can't be asked right now, as for a game.
        /// </summary>
        /// <param name="season">The season ID, like 20262027, from 2007-08 on.</param>
        [HttpGet("team-games")]
        public async Task<IActionResult> GetTeamGames(int season)
        {
            if (!IsValidSeason(season))
            {
                return BadRequest();
            }

            var result = await _naturalStatTrickClient.GetTeamGamesAsync(season);
            return result.Status switch
            {
                NstLookupStatus.Found => Ok(result.Games),
                NstLookupStatus.NotFound => NotFound(),
                _ => StatusCode(StatusCodes.Status503ServiceUnavailable)
            };
        }

        /// <summary>
        /// Returns every skater's individual stats of a regular season that the NHL's APIs don't have, as { season,
        /// players: { playerId, gamesPlayed, timeOnIce, expectedGoals, highDangerAttempts, rushAttempts, reboundsCreated,
        /// hitsTaken, onIceTimeOnIce, onIceExpectedGoalsFor, onIceExpectedGoalsAgainst } }: columns of equally long
        /// arrays, one row per skater, sorted by player ID. From NST's player season page, and its 5v5 on-ice page for
        /// the onIce columns (null when that page can't be had), each kept for an hour. 404 when NST has no skaters for
        /// the season yet, 503 when NST can't be asked right now, as for a game.
        /// </summary>
        /// <param name="season">The season ID, like 20262027, from 2007-08 on.</param>
        [HttpGet("players")]
        public async Task<IActionResult> GetPlayers(int season)
        {
            if (!IsValidSeason(season))
            {
                return BadRequest();
            }

            var result = await _naturalStatTrickClient.GetPlayersAsync(season);
            return result.Status switch
            {
                NstLookupStatus.Found => Ok(result.Players),
                NstLookupStatus.NotFound => NotFound(),
                _ => StatusCode(StatusCodes.Status503ServiceUnavailable)
            };
        }

        /// <summary>Whether a season ID is one NST can have, like 20262027: from 2007-08 to this year's.</summary>
        private static bool IsValidSeason(int season)
        {
            var startYear = season / 10000;
            return startYear >= FirstSeasonStartYear && startYear <= DateTime.UtcNow.Year &&
                   season % 10000 == startYear + 1;
        }
    }
}

using System.Globalization;
using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Memory;

namespace HokMob.App.Services
{
    /// <summary>
    /// Typed HttpClient for the public NHL web API (https://api-web.nhle.com/v1/).
    /// Responses are cached in memory so many site visitors share a single upstream request.
    /// </summary>
    public class NhlApiClient
    {
        public const string BaseUrl = "https://api-web.nhle.com/v1/";

        /// <summary>How long a future score/{date} day is cached: schedules and start times change rarely.</summary>
        private static readonly TimeSpan FutureScoreDayCacheDuration = TimeSpan.FromMinutes(30);

        /// <summary>
        /// How long a settled score/{date} day of the current regular season is kept, measured from the last time it
        /// was asked for (a sliding expiration), so only the days people actually open stay in memory. See the
        /// "Backend memory and restarts" section of the caching issue for why a fixed long TTL isn't used instead.
        /// </summary>
        private static readonly TimeSpan SettledScoreDaySlidingExpiration = TimeSpan.FromHours(24);

        /// <summary>A past game day settles at 1pm Eastern the day after it's played, leaving time for postgame
        /// updates (stats corrections, highlight clips, three stars).</summary>
        private static readonly TimeOnly SettledCutoffEasternTime = new(13, 0);

        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly NhlSeasonService _nhlSeasonService;
        private readonly ILogger<NhlApiClient> _logger;

        public NhlApiClient(HttpClient httpClient, IMemoryCache cache, NhlSeasonService nhlSeasonService,
            ILogger<NhlApiClient> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
            _nhlSeasonService = nhlSeasonService;
            _logger = logger;
        }

        /// <summary>
        /// Gets the raw JSON for an NHL API path (e.g. "score/now"), using the cache when possible.
        /// </summary>
        public async Task<NhlApiResponse> GetAsync(string path, string queryString, CancellationToken cancellationToken)
        {
            var relativeUrl = path + queryString;
            var cacheKey = "nhl:" + relativeUrl;

            if (_cache.TryGetValue(cacheKey, out NhlApiResponse? cached) && cached != null)
            {
                return cached;
            }

            using var response = await _httpClient.GetAsync(relativeUrl, cancellationToken);
            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = new NhlApiResponse(response.StatusCode, content);

            if (response.IsSuccessStatusCode)
            {
                var options = await BuildCacheEntryOptionsAsync(path, content, cancellationToken);
                _cache.Set(cacheKey, result, options);
            }
            else
            {
                _logger.LogWarning("NHL API returned {StatusCode} for {Url}", (int)response.StatusCode, relativeUrl);
            }

            return result;
        }

        /// <summary>
        /// Builds how long to keep a response cached and its size, for the cache's overall size limit (see
        /// Program.cs). Live data is cached briefly; slower-changing data is cached longer; a settled score/{date}
        /// day of the current regular season is cached the longest, with a sliding expiration.
        /// </summary>
        private async Task<MemoryCacheEntryOptions> BuildCacheEntryOptionsAsync(string path, string content,
            CancellationToken cancellationToken)
        {
            var options = new MemoryCacheEntryOptions().SetSize(content.Length);
            var segments = path.Split('/', 2);
            var root = segments[0].ToLowerInvariant();

            if (root == "score" && segments.Length > 1 &&
                DateOnly.TryParseExact(segments[1], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var gameDate))
            {
                return await ApplyScoreDayCacheAsync(options, gameDate, content, cancellationToken);
            }

            return options.SetAbsoluteExpiration(GetDefaultCacheDuration(root));
        }

        private async Task<MemoryCacheEntryOptions> ApplyScoreDayCacheAsync(MemoryCacheEntryOptions options,
            DateOnly gameDate, string content, CancellationToken cancellationToken)
        {
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, NhlSeasonService.EasternTimeZone).DateTime);

            if (gameDate > today)
            {
                return options.SetAbsoluteExpiration(FutureScoreDayCacheDuration);
            }
            if (gameDate == today)
            {
                return options.SetAbsoluteExpiration(GetDefaultCacheDuration("score"));
            }

            var settledAtUtc = TimeZoneInfo.ConvertTimeToUtc(
                gameDate.AddDays(1).ToDateTime(SettledCutoffEasternTime), NhlSeasonService.EasternTimeZone);
            if (DateTimeOffset.UtcNow < settledAtUtc)
            {
                return options.SetAbsoluteExpiration(GetDefaultCacheDuration("score"));
            }

            var currentSeasonId = await _nhlSeasonService.GetCurrentSeasonIdAsync(cancellationToken);
            if (!IsCurrentSeasonRegularDay(content, currentSeasonId))
            {
                return options.SetAbsoluteExpiration(GetDefaultCacheDuration("score"));
            }

            return options.SetSlidingExpiration(SettledScoreDaySlidingExpiration);
        }

        /// <summary>
        /// Whether every game in a score/{date} response is a regular season game of the current season (see the
        /// caching issue's rules). Checks only the first game: a day's games are never a mix of game types.
        /// </summary>
        private static bool IsCurrentSeasonRegularDay(string content, long? currentSeasonId)
        {
            if (currentSeasonId == null)
            {
                return false;
            }

            JsonNode? node;
            try
            {
                node = JsonNode.Parse(content);
            }
            catch (JsonException)
            {
                return false;
            }

            if (node is not JsonObject body || body["games"] is not JsonArray games || games.Count == 0 ||
                games[0] is not JsonObject firstGame)
            {
                return false;
            }

            var gameType = firstGame["gameType"] is JsonValue gameTypeValue && gameTypeValue.TryGetValue(out int gameTypeInt)
                ? gameTypeInt
                : (int?)null;
            var season = firstGame["season"] is JsonValue seasonValue && seasonValue.TryGetValue(out long seasonLong)
                ? seasonLong
                : (long?)null;
            return gameType == 2 && season == currentSeasonId;
        }

        private static TimeSpan GetDefaultCacheDuration(string root)
        {
            return root switch
            {
                "score" or "scoreboard" or "gamecenter" => TimeSpan.FromSeconds(10),
                "schedule" or "club-schedule" or "club-schedule-season" or "standings" or "playoff-series" => TimeSpan.FromMinutes(5),
                "player" or "roster" or "club-stats" or "skater-stats-leaders" or "goalie-stats-leaders" => TimeSpan.FromMinutes(30),
                _ => TimeSpan.FromMinutes(1)
            };
        }
    }

    public record NhlApiResponse(HttpStatusCode StatusCode, string Content);
}

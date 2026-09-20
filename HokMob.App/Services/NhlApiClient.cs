using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;
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

        private const string CacheKeyPrefix = "nhl:";

        /// <summary>Where the fallback copy of a response is kept, separate from the response cache so it outlives
        /// the short durations live data is cached for.</summary>
        private const string LastKnownGoodKeyPrefix = "nhl-last-known-good:";

        /// <summary>
        /// How long a successful response is kept as the fallback for a later failed call. A minute covers a burst
        /// of NHL API errors without letting a live scoreboard drift far behind the play.
        /// </summary>
        private static readonly TimeSpan LastKnownGoodDuration = TimeSpan.FromMinutes(1);

        /// <summary>
        /// The upstream call in flight for each URL, so concurrent callers share one. Static because the typed
        /// client is registered transient, giving every request its own NhlApiClient. The Lazy matters:
        /// GetOrAdd can run its factory more than once under contention, and calling an async method starts it,
        /// so handing it the method directly would fire off the extra calls this is meant to prevent.
        /// </summary>
        private static readonly ConcurrentDictionary<string, Lazy<Task<NhlApiResponse>>> InFlightRequests = new();

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
        ///
        /// When the call fails, the last response that succeeded in the last minute is served instead. The NHL API
        /// sends the current day's score/{date} with no-store, so every request reaches their origin, and when that
        /// origin is struggling it takes tens of seconds or answers 500 - which would otherwise empty the scoreboard.
        /// </summary>
        public async Task<NhlApiResponse> GetAsync(string path, string queryString, CancellationToken cancellationToken)
        {
            var relativeUrl = path + queryString;
            var cacheKey = CacheKeyPrefix + relativeUrl;

            if (_cache.TryGetValue(cacheKey, out NhlApiResponse? cached) && cached != null)
            {
                return cached;
            }

            // One upstream call per URL at a time: the current day's score can take 20 seconds, and without this
            // every visitor polling it would start a request of their own while that one was still running.
            var fetch = InFlightRequests.GetOrAdd(relativeUrl, _ => new Lazy<Task<NhlApiResponse>>(
                () => FetchAsync(path, relativeUrl, cacheKey), LazyThreadSafetyMode.ExecutionAndPublication));
            try
            {
                return await fetch.Value;
            }
            finally
            {
                InFlightRequests.TryRemove(
                    new KeyValuePair<string, Lazy<Task<NhlApiResponse>>>(relativeUrl, fetch));
            }
        }

        /// <summary>
        /// Fetches a path upstream and caches it, falling back to the last known good response when the NHL API
        /// times out, cannot be reached, or answers 5xx. Every caller waiting on this URL shares this one call, so
        /// it deliberately takes no single caller's cancellation token; HttpClient.Timeout bounds it instead.
        /// </summary>
        private async Task<NhlApiResponse> FetchAsync(string path, string relativeUrl, string cacheKey)
        {
            var lastKnownGoodKey = LastKnownGoodKeyPrefix + relativeUrl;
            try
            {
                using var response = await _httpClient.GetAsync(relativeUrl, CancellationToken.None);
                var content = await response.Content.ReadAsStringAsync(CancellationToken.None);
                var result = new NhlApiResponse(response.StatusCode, content);

                if (response.IsSuccessStatusCode)
                {
                    var options = await BuildCacheEntryOptionsAsync(path, content, CancellationToken.None);
                    _cache.Set(cacheKey, result, options);
                    _cache.Set(lastKnownGoodKey, result, new MemoryCacheEntryOptions()
                        .SetSize(content.Length)
                        .SetAbsoluteExpiration(LastKnownGoodDuration));
                    return result;
                }

                _logger.LogWarning("NHL API returned {StatusCode} for {Url}", (int)response.StatusCode, relativeUrl);
                // A 4xx is a real answer about this path. Only an outage on their side is worth papering over.
                if ((int)response.StatusCode >= 500 &&
                    TryGetLastKnownGood(lastKnownGoodKey, relativeUrl, out var afterError))
                {
                    return afterError;
                }
                return result;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                if (!TryGetLastKnownGood(lastKnownGoodKey, relativeUrl, out var afterFailure))
                {
                    throw;
                }
                _logger.LogWarning(ex, "NHL API request for {Url} failed", relativeUrl);
                return afterFailure;
            }
        }

        /// <summary>
        /// Gets the last response that succeeded for a URL, while one is still held.
        /// </summary>
        private bool TryGetLastKnownGood(string lastKnownGoodKey, string relativeUrl,
            [NotNullWhen(true)] out NhlApiResponse? lastKnownGood)
        {
            if (_cache.TryGetValue(lastKnownGoodKey, out NhlApiResponse? cached) && cached != null)
            {
                _logger.LogInformation("Serving the last known good response for {Url}", relativeUrl);
                lastKnownGood = cached;
                return true;
            }
            lastKnownGood = null;
            return false;
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
                // Picks only change during the draft, once a year (see docs/draft-page.md).
                "draft" => TimeSpan.FromHours(6),
                _ => TimeSpan.FromMinutes(1)
            };
        }
    }

    public record NhlApiResponse(HttpStatusCode StatusCode, string Content);
}

using System.Net;
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

        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly ILogger<NhlApiClient> _logger;

        public NhlApiClient(HttpClient httpClient, IMemoryCache cache, ILogger<NhlApiClient> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
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
                _cache.Set(cacheKey, result, GetCacheDuration(path));
            }
            else
            {
                _logger.LogWarning("NHL API returned {StatusCode} for {Url}", (int)response.StatusCode, relativeUrl);
            }

            return result;
        }

        /// <summary>
        /// Live data is cached briefly; slower-changing data is cached longer.
        /// </summary>
        private static TimeSpan GetCacheDuration(string path)
        {
            var root = path.Split('/', 2)[0].ToLowerInvariant();
            return root switch
            {
                "score" or "scoreboard" or "gamecenter" => TimeSpan.FromSeconds(10),
                "schedule" or "club-schedule" or "club-schedule-season" or "standings" or "playoff-series" => TimeSpan.FromMinutes(5),
                "player" or "roster" or "club-stats" or "skater-stats-leaders" or "goalie-stats-leaders" => TimeSpan.FromMinutes(30),
                // Picks only change during the draft, once a year (see docs/draft-page-plan.md, 5).
                "draft" => TimeSpan.FromHours(6),
                _ => TimeSpan.FromMinutes(1)
            };
        }
    }

    public record NhlApiResponse(HttpStatusCode StatusCode, string Content);
}

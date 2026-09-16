using Microsoft.Extensions.Caching.Memory;

namespace HokMob.App.Services
{
    /// <summary>
    /// Typed HttpClient for the NHL player search host (https://search.d3.nhle.com/api/v1/). It isn't part of the
    /// documented NHL API, and it's only called from here so the Angular app keeps using relative URLs.
    /// </summary>
    public class NhlSearchApiClient
    {
        public const string BaseUrl = "https://search.d3.nhle.com/api/v1/";

        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly ILogger<NhlSearchApiClient> _logger;

        public NhlSearchApiClient(HttpClient httpClient, IMemoryCache cache, ILogger<NhlSearchApiClient> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
            _logger = logger;
        }

        /// <summary>
        /// Searches for players by name. Returns the raw JSON array of results.
        /// </summary>
        /// <param name="query">The search text, like "mac".</param>
        /// <param name="limit">The maximum number of results.</param>
        /// <param name="active">Whether to only return active players.</param>
        /// <param name="culture">The culture, like "en-us".</param>
        public async Task<NhlApiResponse> SearchPlayersAsync(string query, int limit, bool? active, string culture,
            CancellationToken cancellationToken)
        {
            var parameters = new List<KeyValuePair<string, string>>
            {
                new("culture", culture),
                new("limit", limit.ToString()),
                new("q", query)
            };
            if (active.HasValue)
            {
                parameters.Add(new KeyValuePair<string, string>("active", active.Value ? "true" : "false"));
            }

            var relativeUrl = "search/player?" + string.Join('&',
                parameters.Select(parameter => Uri.EscapeDataString(parameter.Key) + "=" + Uri.EscapeDataString(parameter.Value)));
            var cacheKey = "nhl-search:" + relativeUrl.ToLowerInvariant();

            if (_cache.TryGetValue(cacheKey, out NhlApiResponse? cached) && cached != null)
            {
                return cached;
            }

            using var response = await _httpClient.GetAsync(relativeUrl, cancellationToken);
            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = new NhlApiResponse(response.StatusCode, content);

            if (response.IsSuccessStatusCode)
            {
                _cache.Set(cacheKey, result, CacheDuration);
            }
            else
            {
                _logger.LogWarning("NHL search API returned {StatusCode} for {Url}", (int)response.StatusCode, relativeUrl);
            }

            return result;
        }
    }
}

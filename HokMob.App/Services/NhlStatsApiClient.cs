using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Memory;

namespace HokMob.App.Services
{
    /// <summary>
    /// Typed HttpClient for the NHL stats API (https://api.nhle.com/stats/rest/en/), which sends no CORS header and so
    /// can only be called from the server. Every query is built here or by the controller, never forwarded from the
    /// browser, so the routes on top of this client aren't an open proxy.
    /// </summary>
    public class NhlStatsApiClient
    {
        public const string BaseUrl = "https://api.nhle.com/stats/rest/en/";

        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly ILogger<NhlStatsApiClient> _logger;

        public NhlStatsApiClient(HttpClient httpClient, IMemoryCache cache, ILogger<NhlStatsApiClient> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
            _logger = logger;
        }

        /// <summary>
        /// Gets the rows of a stats API report, like "skater/summary". Returns null when the upstream call fails or
        /// answers with something other than a { data: [...] } body, so the caller decides whether that part is
        /// required. Successful responses are cached for 5 minutes, so all visitors share one upstream request.
        /// </summary>
        /// <param name="report">The report path, like "skater/realtime" or "game".</param>
        /// <param name="parameters">The query parameters, like cayenneExp and sort.</param>
        public async Task<List<JsonObject>?> GetReportAsync(string report,
            IEnumerable<KeyValuePair<string, string>> parameters, CancellationToken cancellationToken)
        {
            var relativeUrl = report + "?" + string.Join('&', parameters.Select(parameter =>
                Uri.EscapeDataString(parameter.Key) + "=" + Uri.EscapeDataString(parameter.Value)));
            var cacheKey = "nhl-stats:" + relativeUrl;

            if (_cache.TryGetValue(cacheKey, out List<JsonObject>? cached) && cached != null)
            {
                return CopyRows(cached);
            }

            try
            {
                using var response = await _httpClient.GetAsync(relativeUrl, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("NHL stats API returned {StatusCode} for {Url}", (int)response.StatusCode, relativeUrl);
                    return null;
                }

                var content = await response.Content.ReadAsStringAsync(cancellationToken);
                var rows = ReadRows(content);
                if (rows == null)
                {
                    // A rejected query answers 200 with { "message": "..." } instead of { "data": [...] }.
                    _logger.LogWarning("NHL stats API returned no data for {Url}: {Content}", relativeUrl,
                        content.Length > 200 ? content[..200] : content);
                    return null;
                }

                _cache.Set(cacheKey, rows, CacheDuration);
                return CopyRows(rows);
            }
            catch (Exception ex) when ((ex is HttpRequestException or TaskCanceledException or JsonException) &&
                                       !cancellationToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Failed to reach the NHL stats API for {Url}", relativeUrl);
                return null;
            }
        }

        /// <summary>
        /// Reads the rows of a { data: [...], total } response, or null when the body has no data array.
        /// </summary>
        private static List<JsonObject>? ReadRows(string content)
        {
            if (JsonNode.Parse(content) is not JsonObject body || body["data"] is not JsonArray data)
            {
                return null;
            }
            return data.OfType<JsonObject>().ToList();
        }

        /// <summary>
        /// Copies cached rows, because callers merge fields into them.
        /// </summary>
        private static List<JsonObject> CopyRows(List<JsonObject> rows)
        {
            return rows.Select(row => (JsonObject)JsonNode.Parse(row.ToJsonString())!).ToList();
        }
    }
}

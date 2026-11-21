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

        /// <summary>
        /// The most rows the stats API returns per request, whatever the limit (it was 10,000 until 2026-11, and
        /// limit=-1 returned them all). GetAllReportRowsAsync asks for the rest page by page.
        /// </summary>
        public const int PageSize = 100;

        /// <summary>
        /// The most rows a query sees, even page by page: a query with more says its total is 10,000 and stops there,
        /// without an error, so it has to be split (by team, or by dates).
        /// </summary>
        public const int RowCap = 10000;

        /// <summary>
        /// The page requests in flight at once, across every report and visitor. A full season's six team reports are
        /// about 160 pages; the stats API answered 12 at once without a 429.
        /// </summary>
        private const int MaxConcurrentPages = 6;

        /// <summary>
        /// How many times a paged report is read again when its total changes between pages (a game went final while
        /// it was read), which would shift the rows and repeat or skip one.
        /// </summary>
        private const int MaxPagedAttempts = 3;

        private static readonly SemaphoreSlim PageRequests = new(MaxConcurrentPages);

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

            var page = await FetchPageAsync(relativeUrl, cancellationToken);
            if (page == null)
            {
                return null;
            }
            if (page.Rows.Count < page.Total && parameters.Any(parameter => parameter is {Key: "limit", Value: "-1"}))
            {
                // limit=-1 no longer returns every row, so the caller is missing some (see PageSize)
                _logger.LogWarning("NHL stats API returned {Count} of {Total} rows for {Url}; use GetAllReportRowsAsync",
                    page.Rows.Count, page.Total, relativeUrl);
            }

            _cache.Set(cacheKey, page.Rows, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = CacheDuration,
                Size = page.Size
            });
            return CopyRows(page.Rows);
        }

        /// <summary>
        /// Gets every row of a stats API report that can have more than PageSize rows, page by page in the given
        /// order, which must be unique per row (like game and team ID) so the pages don't overlap. Returns null when a
        /// page fails, when the query reaches RowCap, or when the rows keep changing while they're read. The rows are cached for 5 minutes as a whole.
        /// </summary>
        /// <param name="report">The report path, like "team/summary".</param>
        /// <param name="parameters">The query parameters, like cayenneExp, without limit, start or sort.</param>
        /// <param name="sortProperties">The fields to sort by, ascending, like gameId then teamId.</param>
        public async Task<List<JsonObject>?> GetAllReportRowsAsync(string report,
            IEnumerable<KeyValuePair<string, string>> parameters, IEnumerable<string> sortProperties,
            CancellationToken cancellationToken)
        {
            var sort = new JsonArray(sortProperties
                .Select(property => (JsonNode)new JsonObject {["property"] = property, ["direction"] = "ASC"})
                .ToArray());
            var baseUrl = report + "?" + string.Join('&', parameters
                .Append(new KeyValuePair<string, string>("sort", sort.ToJsonString()))
                .Append(new KeyValuePair<string, string>("limit", PageSize.ToString()))
                .Select(parameter => Uri.EscapeDataString(parameter.Key) + "=" + Uri.EscapeDataString(parameter.Value)));
            var cacheKey = "nhl-stats-all:" + baseUrl;

            if (_cache.TryGetValue(cacheKey, out List<JsonObject>? cached) && cached != null)
            {
                return CopyRows(cached);
            }

            for (var attempt = 1; attempt <= MaxPagedAttempts; attempt++)
            {
                var first = await FetchPagedAsync(baseUrl, 0, cancellationToken);
                if (first == null)
                {
                    return null;
                }
                if (first.Total >= RowCap)
                {
                    _logger.LogWarning("NHL stats API query has {Total} rows, at the {RowCap} row cap, so some are missing: {Url}",
                        first.Total, RowCap, baseUrl);
                    return null;
                }
                var starts = Enumerable.Range(1, Math.Max(0, (first.Total - 1) / PageSize))
                    .Select(index => index * PageSize);
                var pages = await Task.WhenAll(starts.Select(start => FetchPagedAsync(baseUrl, start, cancellationToken)));
                if (pages.Any(page => page == null))
                {
                    return null;
                }

                var allPages = pages.Prepend(first).Select(page => page!).ToList();
                var rows = allPages.SelectMany(page => page.Rows).ToList();
                if (allPages.All(page => page.Total == first.Total) && rows.Count == first.Total)
                {
                    _cache.Set(cacheKey, rows, new MemoryCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = CacheDuration,
                        Size = allPages.Sum(page => page.Size)
                    });
                    return CopyRows(rows);
                }
                _logger.LogInformation("NHL stats API rows changed while paging {Url} (attempt {Attempt})", baseUrl, attempt);
            }

            _logger.LogWarning("NHL stats API rows kept changing while paging {Url}", baseUrl);
            return null;
        }

        /// <summary>
        /// One page of a paged report, waiting its turn among the pages in flight (MaxConcurrentPages).
        /// </summary>
        private async Task<ReportPage?> FetchPagedAsync(string baseUrl, int start, CancellationToken cancellationToken)
        {
            await PageRequests.WaitAsync(cancellationToken);
            try
            {
                return await FetchPageAsync(baseUrl + "&start=" + start, cancellationToken);
            }
            finally
            {
                PageRequests.Release();
            }
        }

        /// <summary>
        /// One request to the stats API: its rows and total, or null when it fails or has no data array.
        /// </summary>
        private async Task<ReportPage?> FetchPageAsync(string relativeUrl, CancellationToken cancellationToken)
        {
            try
            {
                using var response = await _httpClient.GetAsync(relativeUrl, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("NHL stats API returned {StatusCode} for {Url}", (int)response.StatusCode, relativeUrl);
                    return null;
                }

                var content = await response.Content.ReadAsStringAsync(cancellationToken);
                var page = ReadPage(content);
                if (page == null)
                {
                    // A rejected query answers 200 with { "message": "..." } instead of { "data": [...] }.
                    _logger.LogWarning("NHL stats API returned no data for {Url}: {Content}", relativeUrl,
                        content.Length > 200 ? content[..200] : content);
                }
                return page;
            }
            catch (Exception ex) when ((ex is HttpRequestException or TaskCanceledException or JsonException) &&
                                       !cancellationToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Failed to reach the NHL stats API for {Url}", relativeUrl);
                return null;
            }
        }

        /// <summary>A response's rows, its total over every page, and its length, for the cache size.</summary>
        private record ReportPage(List<JsonObject> Rows, int Total, int Size);

        /// <summary>
        /// Reads the rows and total of a { data: [...], total } response, or null when the body has no data array. A
        /// missing total counts as the rows sent.
        /// </summary>
        private static ReportPage? ReadPage(string content)
        {
            if (JsonNode.Parse(content) is not JsonObject body || body["data"] is not JsonArray data)
            {
                return null;
            }
            var rows = data.OfType<JsonObject>().ToList();
            var total = body["total"] is JsonValue totalValue && totalValue.TryGetValue(out int count) ? count : rows.Count;
            return new ReportPage(rows, total, content.Length);
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

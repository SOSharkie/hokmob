using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Memory;

namespace HokMob.App.Services
{
    /// <summary>
    /// Works out the current NHL season on the server, the way the client's DateTimeUtils.getCurrentNhlSeason does
    /// from /api/nhl-stats/seasons: the newest season whose first game is at most 2 weeks away or already played.
    /// Used by NhlApiClient to decide whether a score/{date} day belongs to the current regular season, so it can be
    /// cached long-term once it's settled. Kept separate from NhlStatsController's own /seasons endpoint so the two
    /// don't have to agree on a cache lifetime.
    /// </summary>
    public class NhlSeasonService
    {
        /// <summary>How many days before a season's first game it's considered current (the client's
        /// DateTimeUtils.seasonStartLeadDays).</summary>
        private const int SeasonStartLeadDays = 14;

        private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(1);

        /// <summary>America/New_York, DST-aware. .NET resolves IANA IDs on Windows too (ICU-backed since .NET 6),
        /// so this works the same in Azure App Service and in CI.</summary>
        public static readonly TimeZoneInfo EasternTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

        private readonly NhlStatsApiClient _nhlStatsApiClient;
        private readonly IMemoryCache _cache;

        public NhlSeasonService(NhlStatsApiClient nhlStatsApiClient, IMemoryCache cache)
        {
            _nhlStatsApiClient = nhlStatsApiClient;
            _cache = cache;
        }

        /// <summary>
        /// Gets the current season ID (like 20262027), or null when the stats API call failed. Reused for an hour,
        /// like the client's NhlStatsApiService.getSeasonDates.
        /// </summary>
        public async Task<long?> GetCurrentSeasonIdAsync(CancellationToken cancellationToken)
        {
            const string cacheKey = "nhl:current-season";
            if (_cache.TryGetValue(cacheKey, out long? cached))
            {
                return cached;
            }

            var seasonId = await ResolveCurrentSeasonIdAsync(cancellationToken);
            if (seasonId.HasValue)
            {
                // A handful of bytes; not worth counting against the response cache's size limit.
                _cache.Set(cacheKey, seasonId, new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = CacheDuration,
                    Size = 0
                });
            }
            return seasonId;
        }

        private async Task<long?> ResolveCurrentSeasonIdAsync(CancellationToken cancellationToken)
        {
            // The newest season can be listed before any of its games are scheduled, so the one before it is needed too.
            var seasons = await _nhlStatsApiClient.GetReportAsync("season", new[]
            {
                new KeyValuePair<string, string>("sort", "[{\"property\":\"id\",\"direction\":\"DESC\"}]"),
                new KeyValuePair<string, string>("limit", "2")
            }, cancellationToken);
            var seasonIds = seasons?.Select(season => GetLongValue(season["id"])).OfType<long>().ToList();
            if (seasonIds == null || seasonIds.Count == 0)
            {
                return null;
            }

            var firstGameDateTasks = seasonIds.Select(id => GetFirstGameDateAsync(id, cancellationToken)).ToList();
            await Task.WhenAll(firstGameDateTasks);

            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, EasternTimeZone).DateTime);
            for (var i = 0; i < seasonIds.Count; i++)
            {
                if (IsOnOrAfterLeadDay(today, firstGameDateTasks[i].Result, SeasonStartLeadDays))
                {
                    return seasonIds[i];
                }
            }
            return seasonIds[^1];
        }

        /// <summary>
        /// Whether a day is on or after the day that is some days before a game day, comparing calendar days.
        /// False for a missing game day. Mirrors the client's DateTimeUtils.isOnOrAfterLeadDay.
        /// </summary>
        private static bool IsOnOrAfterLeadDay(DateOnly today, string? gameDate, int leadDays)
        {
            if (string.IsNullOrEmpty(gameDate) || !DateOnly.TryParse(gameDate, out var parsed))
            {
                return false;
            }
            return today >= parsed.AddDays(-leadDays);
        }

        /// <summary>
        /// Gets the local game day of a season's first preseason (or regular season, if there's no preseason) game,
        /// like "2026-09-19", or null when none is scheduled yet or the call fails.
        /// </summary>
        private async Task<string?> GetFirstGameDateAsync(long season, CancellationToken cancellationToken)
        {
            var games = await _nhlStatsApiClient.GetReportAsync("game", new[]
            {
                new KeyValuePair<string, string>("sort",
                    "[{\"property\":\"gameDate\",\"direction\":\"ASC\"},{\"property\":\"id\",\"direction\":\"ASC\"}]"),
                new KeyValuePair<string, string>("limit", "1"),
                new KeyValuePair<string, string>("cayenneExp", $"season={season} and gameType in (1,2)")
            }, cancellationToken);
            return games?.FirstOrDefault()?["gameDate"] is JsonValue value && value.TryGetValue(out string? gameDate)
                ? gameDate
                : null;
        }

        private static long? GetLongValue(JsonNode? node)
        {
            return node is JsonValue value && value.TryGetValue(out long number) ? number : null;
        }
    }
}

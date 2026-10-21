using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace HokMob.App.Services
{
    /// <summary>
    /// How a Natural Stat Trick lookup went.
    /// </summary>
    public enum NstLookupStatus
    {
        /// <summary>The game's stats were found.</summary>
        Found,
        /// <summary>NST has no stats for the game (yet).</summary>
        NotFound,
        /// <summary>No access key is configured, NST can't be reached, or the usage tokens are running low.</summary>
        Unavailable
    }

    public record NstLookupResult(NstLookupStatus Status, NstGameStats? Stats = null);

    /// <summary>
    /// Typed HttpClient for data.naturalstattrick.com, the bot mirror of Natural Stat Trick. Every request needs the
    /// access key (the "NaturalStatTrick:Key" setting, sent as the nst-key header) and spends 10 of each of two usage
    /// token pools: about 80 pages per 5 minutes and 180 per hour. Going over them can get the key blocked, so pages
    /// are cached for long, concurrent requests for a game share one, and requests stop for a while once NST reports
    /// few tokens left. See "Natural Stat Trick" in docs/nhl-api.md.
    /// </summary>
    public class NaturalStatTrickClient
    {
        public const string BaseUrl = "https://data.naturalstattrick.com/";

        public const string KeySetting = "NaturalStatTrick:Key";

        private const string CacheKeyPrefix = "nst-game:";

        /// <summary>
        /// How long a final game is kept. NST's numbers barely change once a game is over, and each page costs 10
        /// tokens of the 180 an hour, so it's kept for a day after it was last asked for.
        /// </summary>
        private static readonly TimeSpan FinalGameSlidingExpiration = TimeSpan.FromHours(24);

        /// <summary>
        /// How long a game that isn't final on NST yet (a live game, or one that just ended), or that NST has no page for
        /// yet, is kept. NST itself runs a few minutes behind a live game. A busy night's live games, each refetched
        /// every 3 minutes, take most of the standard pool (its 1800 tokens are full when the first game starts, and
        /// 1800 more come in every hour), so SlowPendingGameCacheDuration takes over once it's half spent.
        /// </summary>
        private static readonly TimeSpan PendingGameCacheDuration = TimeSpan.FromMinutes(3);

        /// <summary>
        /// How long a pending game is kept once fewer than LowStandardTokens are left, which cuts what live games spend
        /// to under a third, so finished games can still be fetched.
        /// </summary>
        private static readonly TimeSpan SlowPendingGameCacheDuration = TimeSpan.FromMinutes(10);

        /// <summary>Half the standard pool (1800 tokens).</summary>
        private const int LowStandardTokens = 900;

        /// <summary>
        /// The tokens kept in reserve in both pools. Below this, requests pause, so the key never goes over its limits
        /// however many visitors open games that aren't cached.
        /// </summary>
        private const int ReservedTokens = 100;

        /// <summary>How long requests pause when the tokens run low or NST rejects one. Tokens refill every 5 minutes.</summary>
        private static readonly TimeSpan PauseDuration = TimeSpan.FromMinutes(5);

        /// <summary>The size a cached game counts for against the memory cache limit, roughly its JSON size.</summary>
        private const long CachedGameSize = 16 * 1024;

        /// <summary>
        /// The page fetch in flight for each game, so concurrent visitors share one. Static because the typed client is
        /// transient; the Lazy keeps GetOrAdd from starting a fetch more than once (see NhlApiClient.InFlightRequests).
        /// </summary>
        private static readonly ConcurrentDictionary<long, Lazy<Task<NstLookupResult>>> InFlightRequests = new();

        /// <summary>Until when requests are paused (ticks of a UTC DateTime), shared by every instance.</summary>
        private static long _pausedUntilTicks;

        /// <summary>
        /// The standard tokens NST reported left on the last response, shared by every instance. The pool is the key's,
        /// so it also counts what other apps using the key (another environment) spend.
        /// </summary>
        private static int _standardTokensRemaining = int.MaxValue;

        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly ILogger<NaturalStatTrickClient> _logger;
        private readonly string? _key;

        public NaturalStatTrickClient(HttpClient httpClient, IMemoryCache cache, IConfiguration configuration,
            ILogger<NaturalStatTrickClient> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
            _logger = logger;
            _key = configuration[KeySetting];
        }

        /// <summary>
        /// Gets a game's Corsi and expected goals, from the cache when possible.
        /// </summary>
        /// <param name="gameId">The NHL game ID, like 2026020110.</param>
        public async Task<NstLookupResult> GetGameStatsAsync(long gameId)
        {
            var cacheKey = CacheKeyPrefix + gameId;
            if (_cache.TryGetValue(cacheKey, out NstLookupResult? cached) && cached != null)
            {
                return cached;
            }
            if (string.IsNullOrWhiteSpace(_key))
            {
                _logger.LogWarning("No Natural Stat Trick key is configured ({Setting})", KeySetting);
                return new NstLookupResult(NstLookupStatus.Unavailable);
            }

            var fetch = InFlightRequests.GetOrAdd(gameId, _ => new Lazy<Task<NstLookupResult>>(
                () => FetchAsync(gameId, cacheKey), LazyThreadSafetyMode.ExecutionAndPublication));
            try
            {
                return await fetch.Value;
            }
            finally
            {
                InFlightRequests.TryRemove(new KeyValuePair<long, Lazy<Task<NstLookupResult>>>(gameId, fetch));
            }
        }

        /// <summary>
        /// The game page's path: game.php?season=20262027&amp;game=20110 for game 2026020110 (the game ID without the
        /// season's first year).
        /// </summary>
        public static string GetGamePath(long gameId)
        {
            var startYear = gameId / 1_000_000;
            return "game.php?season=" + startYear + (startYear + 1) + "&game=" + gameId % 1_000_000;
        }

        /// <summary>
        /// Fetches and reads a game page, and caches the result. Every caller waiting on this game shares this call, so
        /// it takes no caller's cancellation token; HttpClient.Timeout bounds it instead.
        /// </summary>
        private async Task<NstLookupResult> FetchAsync(long gameId, string cacheKey)
        {
            if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _pausedUntilTicks))
            {
                return new NstLookupResult(NstLookupStatus.Unavailable);
            }

            var path = GetGamePath(gameId);
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, path);
                request.Headers.Add("nst-key", _key);
                using var response = await _httpClient.SendAsync(request, CancellationToken.None);
                CheckTokens(response);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Natural Stat Trick returned {StatusCode} for {Path}", (int)response.StatusCode, path);
                    if ((int)response.StatusCode is 401 or 403 or 429)
                    {
                        Pause();
                    }
                    return new NstLookupResult(NstLookupStatus.Unavailable);
                }

                var html = await response.Content.ReadAsStringAsync(CancellationToken.None);
                var stats = NaturalStatTrickGameParser.Parse(gameId, html);
                var result = stats == null
                    ? new NstLookupResult(NstLookupStatus.NotFound)
                    : new NstLookupResult(NstLookupStatus.Found, stats);
                var options = new MemoryCacheEntryOptions { Size = CachedGameSize };
                if (stats?.IsFinal == true)
                {
                    options.SlidingExpiration = FinalGameSlidingExpiration;
                }
                else
                {
                    options.AbsoluteExpirationRelativeToNow = Volatile.Read(ref _standardTokensRemaining) < LowStandardTokens
                        ? SlowPendingGameCacheDuration
                        : PendingGameCacheDuration;
                }
                _cache.Set(cacheKey, result, options);
                return result;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                _logger.LogError(ex, "Failed to reach Natural Stat Trick for {Path}", path);
                return new NstLookupResult(NstLookupStatus.Unavailable);
            }
        }

        /// <summary>
        /// Pauses requests when either token pool NST reports in its tokens-remaining and burst-remaining headers has
        /// fallen to the reserve.
        /// </summary>
        private void CheckTokens(HttpResponseMessage response)
        {
            var standard = ReadHeader(response, "tokens-remaining");
            var burst = ReadHeader(response, "burst-remaining");
            if (standard != null)
            {
                Volatile.Write(ref _standardTokensRemaining, standard.Value);
            }
            if ((standard ?? int.MaxValue) < ReservedTokens || (burst ?? int.MaxValue) < ReservedTokens)
            {
                _logger.LogWarning("Natural Stat Trick tokens are low ({Standard} standard, {Burst} burst), pausing",
                    standard, burst);
                Pause();
            }
        }

        private static int? ReadHeader(HttpResponseMessage response, string name)
        {
            return response.Headers.TryGetValues(name, out var values) &&
                   int.TryParse(values.FirstOrDefault(), out var value) ? value : null;
        }

        private static void Pause()
        {
            Interlocked.Exchange(ref _pausedUntilTicks, DateTime.UtcNow.Add(PauseDuration).Ticks);
        }
    }
}

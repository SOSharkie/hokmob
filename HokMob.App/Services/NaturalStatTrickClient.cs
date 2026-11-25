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

    /// <summary>How a team game logs lookup went, with the games when they were found.</summary>
    public record NstTeamGamesResult(NstLookupStatus Status, NstTeamGames? Games = null);

    /// <summary>How a player season lookup went, with the skaters when they were found.</summary>
    public record NstPlayersResult(NstLookupStatus Status, NstPlayers? Players = null);

    /// <summary>How a player season on-ice lookup went, with each skater's 5v5 on-ice stats when they were found.</summary>
    public record NstOnIceResult(NstLookupStatus Status, Dictionary<long, NstOnIceStats>? OnIce = null);

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

        /// <summary>
        /// The fetch in flight for each season page (the team game logs and the player season page), by cache key, like
        /// InFlightRequests for games.
        /// </summary>
        private static readonly ConcurrentDictionary<string, Lazy<Task<object>>> InFlightSeasonPages = new();

        private const string TeamGamesCacheKeyPrefix = "nst-team-games:";

        private const string PlayersCacheKeyPrefix = "nst-players:";

        /// <summary>
        /// How long a season page (the team game logs, or every skater's season) is kept. They only change as games end,
        /// and NST runs a few minutes behind, so an hour keeps them current enough at one page an hour per season asked
        /// for.
        /// </summary>
        private static readonly TimeSpan SeasonPageCacheDuration = TimeSpan.FromHours(1);

        /// <summary>
        /// How long a failed season page lookup is kept, so a page that can't be had isn't asked for again by every
        /// visitor: the power rating and the player page fall back to the NHL's stats meanwhile.
        /// </summary>
        private static readonly TimeSpan FailedSeasonPageCacheDuration = TimeSpan.FromMinutes(5);

        /// <summary>The size a season's cached team game logs count for against the memory cache limit, roughly their size.</summary>
        private const long CachedTeamGamesSize = 96 * 1024;

        /// <summary>The size a season's cached skaters count for, roughly their JSON size (about 1,000 skaters).</summary>
        private const long CachedPlayersSize = 64 * 1024;

        private const string PlayersOnIceCacheKeyPrefix = "nst-players-oi:";

        /// <summary>The size a season's cached on-ice stats count for (three numbers per skater).</summary>
        private const long CachedPlayersOnIceSize = 48 * 1024;

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
            var html = await GetPageAsync(GetGamePath(gameId));
            if (html == null)
            {
                return new NstLookupResult(NstLookupStatus.Unavailable);
            }

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

        /// <summary>
        /// Gets every team's games of a regular season with their 5v5 expected goals, from NST's team game logs: one
        /// page for the whole league and season, kept for an hour (SeasonPageCacheDuration), so it costs at most 24
        /// pages a day per season asked for.
        /// </summary>
        /// <param name="season">The season ID, like 20262027.</param>
        public Task<NstTeamGamesResult> GetTeamGamesAsync(int season)
        {
            return GetSeasonPageAsync(TeamGamesCacheKeyPrefix + season, GetTeamGamesPath(season), html =>
            {
                var games = NaturalStatTrickTeamGamesParser.Parse(season, html);
                return games == null
                    ? new NstTeamGamesResult(NstLookupStatus.NotFound)
                    : new NstTeamGamesResult(NstLookupStatus.Found, games);
            }, new NstTeamGamesResult(NstLookupStatus.Unavailable), CachedTeamGamesSize);
        }

        /// <summary>
        /// The team game logs path: every team and game of a regular season at 5v5, as counts (not per 60), home and
        /// road.
        /// </summary>
        public static string GetTeamGamesPath(int season)
        {
            return "games.php?fromseason=" + season + "&thruseason=" + season +
                   "&stype=2&sit=5v5&loc=B&team=All&rate=n";
        }

        /// <summary>
        /// Gets every skater's individual stats of a regular season that the NHL's APIs don't have (ixG, high danger
        /// attempts, rush attempts, rebounds created and hits taken), from NST's player season page, and his 5v5
        /// on-ice xG for and against, from its on-ice page. One page each for the whole league, each kept for an hour
        /// like the team game logs, so they cost at most 48 pages a day per season asked for. Never NST's page for one
        /// player, which would scale with visitors. The on-ice page is optional: without it the skaters come back with
        /// their on-ice columns null. They're joined on every call, so an on-ice page that failed once isn't left out
        /// for the individual page's hour.
        /// </summary>
        /// <param name="season">The season ID, like 20262027.</param>
        public async Task<NstPlayersResult> GetPlayersAsync(int season)
        {
            var individual = GetSeasonPageAsync(PlayersCacheKeyPrefix + season, GetPlayersPath(season), html =>
            {
                var players = NaturalStatTrickPlayersParser.Parse(season, html);
                return players == null
                    ? new NstPlayersResult(NstLookupStatus.NotFound)
                    : new NstPlayersResult(NstLookupStatus.Found, players);
            }, new NstPlayersResult(NstLookupStatus.Unavailable), CachedPlayersSize);
            var onIce = GetSeasonPageAsync(PlayersOnIceCacheKeyPrefix + season, GetPlayersOnIcePath(season), html =>
            {
                var stats = NaturalStatTrickPlayersParser.ParseOnIce(html);
                return stats == null
                    ? new NstOnIceResult(NstLookupStatus.NotFound)
                    : new NstOnIceResult(NstLookupStatus.Found, stats);
            }, new NstOnIceResult(NstLookupStatus.Unavailable), CachedPlayersOnIceSize);
            await Task.WhenAll(individual, onIce);

            var result = individual.Result;
            if (result.Players == null)
            {
                return result;
            }
            return result with { Players = NaturalStatTrickPlayersParser.WithOnIce(result.Players, onIce.Result.OnIce) };
        }

        /// <summary>
        /// The player season on-ice path: every skater of a regular season at 5v5, what happened while he was on the
        /// ice (stdoi=oi) as counts, with the same filters as GetPlayersPath.
        /// </summary>
        public static string GetPlayersOnIcePath(int season)
        {
            return "playerteams.php?fromseason=" + season + "&thruseason=" + season +
                   "&stype=2&sit=5v5&score=all&stdoi=oi&rate=n&team=ALL&pos=S&loc=B&toi=0&gpfilt=none&lines=single" +
                   "&draftteam=ALL";
        }

        /// <summary>
        /// The player season path: every skater of a regular season, all situations, individual stats (stdoi=std) as
        /// counts, with a traded skater's teams in one row and no minimum ice time.
        /// </summary>
        public static string GetPlayersPath(int season)
        {
            return "playerteams.php?fromseason=" + season + "&thruseason=" + season +
                   "&stype=2&sit=all&score=all&stdoi=std&rate=n&team=ALL&pos=S&loc=B&toi=0&gpfilt=none&lines=single" +
                   "&draftteam=ALL";
        }

        /// <summary>
        /// Gets a whole season's page, from the cache when possible: kept for an hour once read, or 5 minutes when it
        /// couldn't be had. Concurrent visitors share one fetch.
        /// </summary>
        /// <param name="cacheKey">The page's cache key, which also keys the fetch in flight.</param>
        /// <param name="path">The page's path.</param>
        /// <param name="parse">Reads the page into the result.</param>
        /// <param name="unavailable">The result when the page can't be had.</param>
        /// <param name="size">The size the result counts for against the memory cache limit.</param>
        private async Task<TResult> GetSeasonPageAsync<TResult>(string cacheKey, string path,
            Func<string, TResult> parse, TResult unavailable, long size) where TResult : class
        {
            if (_cache.TryGetValue(cacheKey, out TResult? cached) && cached != null)
            {
                return cached;
            }
            if (string.IsNullOrWhiteSpace(_key))
            {
                _logger.LogWarning("No Natural Stat Trick key is configured ({Setting})", KeySetting);
                return unavailable;
            }

            var fetch = InFlightSeasonPages.GetOrAdd(cacheKey, _ => new Lazy<Task<object>>(
                async () => await FetchSeasonPageAsync(cacheKey, path, parse, unavailable, size),
                LazyThreadSafetyMode.ExecutionAndPublication));
            try
            {
                return (TResult)await fetch.Value;
            }
            finally
            {
                InFlightSeasonPages.TryRemove(new KeyValuePair<string, Lazy<Task<object>>>(cacheKey, fetch));
            }
        }

        /// <summary>
        /// Fetches and reads a season page, and caches the result, or the failure for a few minutes. Every caller
        /// waiting on the page shares this call, so it takes no caller's cancellation token.
        /// </summary>
        private async Task<TResult> FetchSeasonPageAsync<TResult>(string cacheKey, string path,
            Func<string, TResult> parse, TResult unavailable, long size) where TResult : class
        {
            var html = await GetPageAsync(path);
            if (html == null)
            {
                _cache.Set(cacheKey, unavailable, new MemoryCacheEntryOptions
                {
                    Size = 1,
                    AbsoluteExpirationRelativeToNow = FailedSeasonPageCacheDuration
                });
                return unavailable;
            }

            var result = parse(html);
            _cache.Set(cacheKey, result, new MemoryCacheEntryOptions
            {
                Size = size,
                AbsoluteExpirationRelativeToNow = SeasonPageCacheDuration
            });
            return result;
        }

        /// <summary>
        /// Fetches one NST page with the key, or returns null when it can't be had: requests are paused, NST answered
        /// an error, or it can't be reached. Pauses requests when the tokens run low or NST rejects the key. Every caller
        /// waiting on a page shares the call, so it takes no caller's cancellation token; HttpClient.Timeout bounds it.
        /// </summary>
        private async Task<string?> GetPageAsync(string path)
        {
            if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _pausedUntilTicks))
            {
                return null;
            }

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
                    return null;
                }
                return await response.Content.ReadAsStringAsync(CancellationToken.None);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                _logger.LogError(ex, "Failed to reach Natural Stat Trick for {Path}", path);
                return null;
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

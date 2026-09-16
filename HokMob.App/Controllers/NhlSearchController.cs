using System.Text.RegularExpressions;
using HokMob.App.Services;
using Microsoft.AspNetCore.Mvc;

namespace HokMob.App.Controllers
{
    /// <summary>
    /// Player search for the header search box.
    /// Example: GET /api/nhl-search/player?q=mac -> https://search.d3.nhle.com/api/v1/search/player?...
    /// Only the query parameters below are forwarded; everything else the client sends is dropped.
    /// </summary>
    [ApiController]
    [Route("api/nhl-search")]
    public class NhlSearchController : ControllerBase
    {
        private const int MaxLimit = 20;

        private const string DefaultCulture = "en-us";

        private static readonly Regex CulturePattern = new("^[a-zA-Z]{2}-[a-zA-Z]{2}$", RegexOptions.Compiled);

        private readonly NhlSearchApiClient _nhlSearchApiClient;
        private readonly ILogger<NhlSearchController> _logger;

        public NhlSearchController(NhlSearchApiClient nhlSearchApiClient, ILogger<NhlSearchController> logger)
        {
            _nhlSearchApiClient = nhlSearchApiClient;
            _logger = logger;
        }

        /// <summary>
        /// Searches players by name.
        /// </summary>
        /// <param name="q">The search text. Required.</param>
        /// <param name="limit">The maximum number of results, capped at 20.</param>
        /// <param name="active">Whether to only return active players.</param>
        /// <param name="culture">The culture, like "en-us". Only a language-region code is accepted.</param>
        [HttpGet("player")]
        public async Task<IActionResult> SearchPlayers(string? q, int? limit, bool? active, string? culture,
            CancellationToken cancellationToken)
        {
            var query = q?.Trim();
            if (string.IsNullOrEmpty(query))
            {
                return BadRequest();
            }

            try
            {
                var response = await _nhlSearchApiClient.SearchPlayersAsync(query, Math.Clamp(limit ?? MaxLimit, 1, MaxLimit),
                    active, GetCulture(culture), cancellationToken);
                return new ContentResult
                {
                    StatusCode = (int)response.StatusCode,
                    Content = response.Content,
                    ContentType = "application/json"
                };
            }
            catch (Exception ex) when ((ex is HttpRequestException or TaskCanceledException) && !cancellationToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Failed to reach the NHL search API for {Query}", query);
                return StatusCode(StatusCodes.Status502BadGateway);
            }
        }

        /// <summary>
        /// Returns a culture like "en-us", or the default for anything else.
        /// </summary>
        private static string GetCulture(string? culture)
        {
            if (culture == null || !CulturePattern.IsMatch(culture))
            {
                return DefaultCulture;
            }
            return culture.ToLowerInvariant();
        }
    }
}

using HokMob.App.Services;
using Microsoft.AspNetCore.Mvc;

namespace HokMob.App.Controllers
{
    /// <summary>
    /// Proxies requests from the Angular app to the NHL web API, avoiding browser CORS restrictions.
    /// Example: GET /api/nhl/score/now -> https://api-web.nhle.com/v1/score/now
    /// </summary>
    [ApiController]
    [Route("api/nhl")]
    public class NhlController : ControllerBase
    {
        // Only these top-level NHL API paths may be proxied, so this can't be used as an open proxy.
        private static readonly HashSet<string> AllowedRoots = new(StringComparer.OrdinalIgnoreCase)
        {
            "score", "scoreboard", "schedule", "club-schedule", "club-schedule-season", "standings",
            "gamecenter", "player", "roster", "club-stats", "playoff-series", "playoff-bracket",
            "skater-stats-leaders", "goalie-stats-leaders", "draft"
        };

        private readonly NhlApiClient _nhlApiClient;
        private readonly ILogger<NhlController> _logger;

        public NhlController(NhlApiClient nhlApiClient, ILogger<NhlController> logger)
        {
            _nhlApiClient = nhlApiClient;
            _logger = logger;
        }

        [HttpGet("{**path}")]
        public async Task<IActionResult> Get(string path, CancellationToken cancellationToken)
        {
            var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length == 0 || !AllowedRoots.Contains(segments[0]) || segments.Any(s => s == "." || s == ".."))
            {
                return NotFound();
            }

            try
            {
                var response = await _nhlApiClient.GetAsync(string.Join('/', segments), Request.QueryString.Value ?? "", cancellationToken);
                return new ContentResult
                {
                    StatusCode = (int)response.StatusCode,
                    Content = response.Content,
                    ContentType = "application/json"
                };
            }
            catch (Exception ex) when ((ex is HttpRequestException or TaskCanceledException) && !cancellationToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Failed to reach NHL API for {Path}", path);
                return StatusCode(StatusCodes.Status502BadGateway);
            }
        }
    }
}

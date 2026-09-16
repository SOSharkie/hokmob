import {SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";

/**
 * Response of /api/nhl-stats/leaders?season={season}&gameType={2|3}. The NHL web API has no hits or shots
 * leaderboards, so these two come from the stats API. Rows have no headshot or logo: build them from the player ID
 * and the team abbreviation.
 */
export interface HitsAndShotsLeaders {
  /** Skaters with the most hits, best first. */
  hits: SkaterSeasonStats[];
  /** Skaters with the most shots, best first. */
  shots: SkaterSeasonStats[];
}

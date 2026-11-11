import {GoalieSeasonStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";

/**
 * Response of /api/nhl-stats/team-players?teamId={id}&season={season}&gameType={2|3}: a team's player stats for one
 * season, in no particular order. Only a traded player's games for this team count, but their teamAbbrevs still lists
 * every team of the season ("SJS,NYR"). A skater's rows include the realtime stats (hits, blocks, takeaways and
 * giveaways), missing when that call failed.
 */
export interface TeamPlayersResponse {
  skaters: SkaterSeasonStats[];
  goalies: GoalieSeasonStats[];
}

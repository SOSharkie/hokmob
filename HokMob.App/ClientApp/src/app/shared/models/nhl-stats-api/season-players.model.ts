import {GoalieSeasonStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";

/**
 * Response of /api/nhl-stats/season-players?season={season}&gameType={2|3}&position={skater|goalie}&ids={ids}: the
 * season stats of the players asked for, in no particular order. A skater's rows include the realtime stats (hits,
 * blocks, takeaways and giveaways). A player without games that season has no row.
 */
export interface SeasonPlayersResponse {
  players: SkaterSeasonStats[] | GoalieSeasonStats[];
}

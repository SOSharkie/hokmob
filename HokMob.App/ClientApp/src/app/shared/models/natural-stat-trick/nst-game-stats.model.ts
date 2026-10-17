/**
 * Response of /api/nst/game/{gameId}: a game's all situations Corsi (shot attempts: goals, saved, missed and blocked
 * shots) and expected goals (xG) from Natural Stat Trick, for both teams and each skater. Goalies aren't included.
 */
export interface NstGameStats {
  gameId: number;
  /** Whether NST marks the game final. A game in progress has partial numbers. */
  isFinal: boolean;
  homeTeam: NstTeamGameStats;
  awayTeam: NstTeamGameStats;
  /** Every skater's goals, shots on goal and missed shots, with each one's xG. */
  shots?: NstShot[];
}

/**
 * A skater's unblocked shot attempt, from the tooltip on his NST individual event map. The shootout isn't included,
 * and neither are goalies' shots. ShotMapUtils.getShots matches it to its play-by-play shot.
 */
export interface NstShot {
  /** The shooter's NHL player ID. */
  playerId: number;
  /** The period number: 4 for the first overtime. */
  period: number;
  /** The time elapsed in the period, like "7:05". */
  time: string;
  type: "goal" | "shot" | "miss";
  /** How far from the net it was taken, in feet. */
  distance: number;
  /** NST's xG for the shot, to two decimals. */
  expectedGoals: number;
}

/**
 * A team's game. Any number NST leaves out is null.
 */
export interface NstTeamGameStats {
  /** NST's team name, like "Rangers". */
  name: string;
  corsiFor: number;
  corsiAgainst: number;
  expectedGoalsFor: number;
  expectedGoalsAgainst: number;
  players: NstPlayerGameStats[];
}

/**
 * A skater's game. The Corsi and xG for/against are on-ice (everything that happened while he was on the ice); the
 * individual ones are his own shot attempts and the xG of his own shots.
 */
export interface NstPlayerGameStats {
  /** The NHL player ID, or null when NST's page doesn't link the name to one. */
  playerId: number;
  name: string;
  /** C, L, R or D. */
  position: string;
  /** In minutes, like 20.2. */
  timeOnIce: number;
  corsiFor: number;
  corsiAgainst: number;
  expectedGoalsFor: number;
  expectedGoalsAgainst: number;
  individualExpectedGoals: number;
  individualCorsiFor: number;
}

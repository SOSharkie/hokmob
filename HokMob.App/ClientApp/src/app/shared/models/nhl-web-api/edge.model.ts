/**
 * NHL EDGE's player tracking stats of a season, from api-web's edge/skater-detail/{playerId}/{season}/{gameType} and
 * edge/goalie-detail/{playerId}/{season}/{gameType}. Each stat has the player's value, the NHL's own percentile (0 to
 * 1, among a pool the NHL picks: its forwards, defensemen or goalies with enough games) and the league average, in
 * imperial and metric units where it has units. Only from 2021-22 on: an earlier season answers 404. Only the fields
 * the player page uses are typed.
 */
export interface EdgeSkaterDetail {
  player: EdgePlayer;
  seasonsWithEdgeStats: EdgeSeason[];
  /** His hardest shot, in mph (imperial) or km/h (metric). */
  topShotSpeed: EdgeMeasure;
  skatingSpeed: {
    /** His top skating speed. */
    speedMax: EdgeMeasure;
    /** How often he went over 20 mph. */
    burstsOver20: EdgeCount;
  };
  zoneTimeDetails: {
    /** The share of his ice time in the offensive zone, 0 to 1. */
    offensiveZonePctg: number;
    offensiveZonePercentile: number;
    offensiveZoneLeagueAvg: number;
    defensiveZonePctg: number;
    defensiveZonePercentile: number;
    defensiveZoneLeagueAvg: number;
  };
}

/** A goalie's NHL EDGE stats of a season (edge/goalie-detail). */
export interface EdgeGoalieDetail {
  player: EdgePlayer;
  seasonsWithEdgeStats: EdgeSeason[];
  stats: {
    goalsAgainstAvg: EdgeValue;
    /** The share of his games with a save percentage over .900, 0 to 1. */
    gamesAbove900: EdgeValue;
    goalDifferentialPer60: EdgeValue;
    goalSupportAvg: EdgeValue;
    pointPctg: EdgeValue;
  };
  /** His saves by where the shots came from: "all", "high" (high danger), "mid" and "long". */
  shotLocationSummary: EdgeGoalieShotLocation[];
}

export interface EdgePlayer {
  id: number;
  gamesPlayed: number;
}

/** A season with EDGE stats, and its game types (2, 3). */
export interface EdgeSeason {
  id: number;
  gameTypes: number[];
}

/** A stat with units: its value in each, the NHL's percentile (0 to 1) and the league average. */
export interface EdgeMeasure {
  imperial: number;
  metric: number;
  percentile: number;
  leagueAvg: {imperial: number, metric: number};
}

/** A count, with the NHL's percentile (0 to 1) and the league average. */
export interface EdgeCount {
  value: number;
  percentile: number;
  leagueAvg: {value: number};
}

/** A goalie stat, with the NHL's percentile (0 to 1) and the league average. */
export interface EdgeValue {
  value: number;
  percentile: number;
  leagueAvg: number;
}

export interface EdgeGoalieShotLocation {
  locationCode: "all" | "high" | "mid" | "long";
  goalsAgainst: number;
  saves: number;
  /** 0 to 1. */
  savePctg: number;
  /** The NHL's percentile of his save percentage from there, 0 to 1. */
  savePctgPercentile: number;
  savePctgLeagueAvg: number;
}

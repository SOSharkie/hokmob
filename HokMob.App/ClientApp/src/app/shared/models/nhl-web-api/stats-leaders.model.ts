import {LocalizedString} from "@shared/models/nhl-web-api/common.model";

/**
 * Responses of skater-stats-leaders/{season}/{gameType} and goalie-stats-leaders/{season}/{gameType}. Each category
 * holds the leaders of one stat, best first. The NHL applies its own qualification rules, so a category can be empty
 * (playoff leaders before the playoffs start).
 */
export interface SkaterStatsLeaders {
  goals?: StatsLeader[];
  assists?: StatsLeader[];
  points?: StatsLeader[];
  plusMinus?: StatsLeader[];
  goalsPp?: StatsLeader[];
  goalsSh?: StatsLeader[];
  penaltyMins?: StatsLeader[];
  faceoffLeaders?: StatsLeader[];
  /** Time on ice per game, in seconds (like 1664.2568). */
  toi?: StatsLeader[];
}

export interface GoalieStatsLeaders {
  wins?: StatsLeader[];
  shutouts?: StatsLeader[];
  /** 0 to 1. */
  savePctg?: StatsLeader[];
  goalsAgainstAverage?: StatsLeader[];
}

export interface StatsLeader {
  id: number;
  firstName: LocalizedString;
  lastName: LocalizedString;
  sweaterNumber?: number;
  headshot: string;
  teamAbbrev: string;
  /** The common name, like "Oilers". Prefer NhlTeamUtils for the full name. */
  teamName: LocalizedString;
  teamLogo: string;
  /** C, L, R, D or G. */
  position: string;
  value: number;
}

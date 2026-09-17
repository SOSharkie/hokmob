import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {NhlGameScheduleStateEnum} from "@shared/enums/nhl-game-schedule-state.enum";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {GameOutcome, LocalizedString, PeriodDescriptor} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of gamecenter/{id}/right-rail.
 */
export interface RightRail {
  seasonSeries: SeasonSeriesGame[];
  seasonSeriesWins: { awayTeamWins: number, homeTeamWins: number };
  linescore?: RightRailLinescore;
  shotsByPeriod?: PeriodTeamValues[];
  /** Missing for future games. */
  teamGameStats?: TeamGameStat[];
  gameInfo?: RightRailGameInfo;
}

/**
 * The game's officials and each team's head coach and scratches.
 */
export interface RightRailGameInfo {
  referees?: GameOfficial[];
  linesmen?: GameOfficial[];
  awayTeam?: GameInfoTeam;
  homeTeam?: GameInfoTeam;
}

export interface GameOfficial {
  fullName: LocalizedString;
  sweaterNumber?: number;
}

export interface GameInfoTeam {
  headCoach?: LocalizedString;
  scratches?: GameScratch[];
}

export interface GameScratch {
  id: number;
  firstName: LocalizedString;
  lastName: LocalizedString;
}

export interface SeasonSeriesGame {
  id: number;
  season: number;
  gameType: NhlGameTypeEnum;
  gameDate: string;
  startTimeUTC: string;
  gameState: NhlGameStateEnum;
  gameScheduleState: NhlGameScheduleStateEnum;
  homeTeam: SeasonSeriesTeam;
  awayTeam: SeasonSeriesTeam;
  gameCenterLink: string;
  periodDescriptor?: PeriodDescriptor;
  gameOutcome?: GameOutcome;
}

export interface SeasonSeriesTeam {
  id: number;
  abbrev: string;
  logo: string;
  score?: number;
}

export interface RightRailLinescore {
  byPeriod: PeriodTeamValues[];
  totals: { away: number, home: number };
}

export interface PeriodTeamValues {
  periodDescriptor: PeriodDescriptor;
  away: number;
  home: number;
}

/**
 * A team stat, like { category: "powerPlay", awayValue: "0/3", homeValue: "1/2" }.
 * Categories: sog, faceoffWinningPctg (0 to 1), powerPlay, powerPlayPctg, pim, hits, blockedShots, giveaways,
 * takeaways.
 */
export interface TeamGameStat {
  category: string;
  awayValue: number | string;
  homeValue: number | string;
}

import {NhlPlayerStatsModel} from "@shared/models/nhl-stats/nhl-player-stats.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlStatTeamModel} from "@shared/models/nhl-stats/nhl-stat-team.model";

export class NhlStatsSplitModel {

  public season: string;

  public league: any;

  public team: NhlTeamModel;

  public sequenceNumber: number;

  public stat: NhlPlayerStatsModel;

  public date: string;

  public isHome: boolean;

  public isWin: boolean;

  public isOT: boolean;

  public game: NhlGameModel;

  public opponent: NhlStatTeamModel;

}

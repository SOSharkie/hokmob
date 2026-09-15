import {Component, Input} from '@angular/core';
import * as dayjs from "dayjs";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {GameLanding} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {GamecenterTeam, SeriesStatus} from "@shared/models/nhl-web-api/common.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {PeriodUtils} from "@shared/utils/period-utils";

@Component({
  selector: 'app-game-header',
  templateUrl: './game-header.component.html',
  styleUrls: ['./game-header.component.scss']
})
export class GameHeaderComponent {

  @Input()
  public isDropdownHeader: boolean;

  @Input()
  public landing: GameLanding;

  /**
   * The playoff series status from the score response. Only loaded for playoff games.
   */
  @Input()
  public seriesStatus: SeriesStatus;

  @Input()
  public intermissionTimeRemaining: string;

  @Input()
  public homeTeamLogo: any;

  @Input()
  public awayTeamLogo: any;

  @Input()
  public isIntermission: boolean;

  public get liveGame(): boolean {
    return NhlGameInfoUtils.isLiveGame(this.landing?.gameState);
  }

  public get completedGame(): boolean {
    return NhlGameInfoUtils.isCompletedGame(this.landing?.gameState);
  }

  public get futureGame(): boolean {
    return NhlGameInfoUtils.isFutureGame(this.landing?.gameState);
  }

  public get homeTeamName(): string {
    if (this.landing) {
      return this.getTeamFullName(this.landing.homeTeam);
    }
    return "N/A";
  }

  public get awayTeamName(): string {
    if (this.landing) {
      return this.getTeamFullName(this.landing.awayTeam);
    }
    return "N/A";
  }

  public get homeTeamShortName(): string {
    return this.landing?.homeTeam.commonName?.default ?? "N/A";
  }

  public get awayTeamShortName(): string {
    return this.landing?.awayTeam.commonName?.default ?? "N/A";
  }

  public get homeTeamId(): number {
    return this.landing?.homeTeam.id ?? 0;
  }

  public get awayTeamId(): number {
    return this.landing?.awayTeam.id ?? 0;
  }

  public get gameTime(): string {
    if (this.landing) {
      return dayjs(this.landing.startTimeUTC).format("h:mm A");
    }
    return "N/A";
  }

  public get gameDay(): string {
    if (this.landing) {
      return DateTimeUtils.getDayDisplayValue(dayjs(this.landing.startTimeUTC).toDate());
    }
    return "N/A";
  }

  /**
   * The series status, like "CAR leads 3-1", or "Series (0-0)" before the first game.
   */
  public get playoffSeriesDetails(): string {
    let status = NhlGameInfoUtils.getSeriesStatusShort(this.seriesStatus);
    return status === "(0-0)" ? "Series (0-0)" : status;
  }

  public get isPlayoffGame(): boolean {
    return this.landing?.gameType === NhlGameTypeEnum.PLAYOFFS && !!this.seriesStatus;
  }

  public get gameScore(): string {
    if (this.landing) {
      return (this.landing.homeTeam.score ?? 0) + " - " + (this.landing.awayTeam.score ?? 0);
    }
    return "N/A"
  }

  /**
   * "Final", or "Final OT", "Final 2OT" or "Final SO".
   */
  public get completedGameStatus(): string {
    if (this.landing) {
      let label = PeriodUtils.getFinalLabel(this.landing.gameOutcome, this.landing.periodDescriptor);
      return label === "Final" ? label : "Final " + label;
    }
    return "N/A"
  }

  public get liveGameStatus(): string {
    if (this.landing) {
      return PeriodUtils.getLiveLabel(this.landing.periodDescriptor, this.landing.clock);
    }
    return "N/A"
  }

  public get homeTeamPP(): boolean {
    // TODO: Implement, optionally from the latest play's situationCode (see docs/nhl-api-migration-plan.md, 5.2)
    return false;
  }

  public get awayTeamPP(): boolean {
    // TODO: Implement, optionally from the latest play's situationCode (see docs/nhl-api-migration-plan.md, 5.2)
    return false;
  }

  /**
   * The gamecenter responses split the name into place and common name, like "Winnipeg" and "Jets".
   */
  private getTeamFullName(team: GamecenterTeam): string {
    return [team.placeName?.default, team.commonName?.default].filter(name => !!name).join(" ");
  }

}

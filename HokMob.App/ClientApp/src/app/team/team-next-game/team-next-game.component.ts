import {Component, Input} from '@angular/core';
import * as dayjs from "dayjs";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {ScoreGame, ScoreTeam} from "@shared/models/nhl-web-api/score.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {PeriodUtils} from "@shared/utils/period-utils";

/**
 * The team page's next game: the start time before it starts, the score and period while it's on, and the final score
 * once it's over. A live game's clock, period and series status come from score/{gameDate} (see
 * TeamComponent.retrieveLiveNextGame).
 */
@Component({
  selector: 'app-team-next-game',
  templateUrl: './team-next-game.component.html',
  styleUrls: ['./team-next-game.component.scss']
})
export class TeamNextGameComponent {

  /**
   * The team's first game that isn't over, from its club schedule.
   */
  @Input()
  public game: ScoreGame;

  public get header(): string {
    if (this.liveGame) {
      return "Ongoing Game";
    } else if (this.completedGame) {
      return "Latest Game";
    }
    return "Next Game";
  }

  public get liveGame(): boolean {
    return NhlGameInfoUtils.isLiveGame(this.game?.gameState);
  }

  public get completedGame(): boolean {
    return NhlGameInfoUtils.isCompletedGame(this.game?.gameState);
  }

  public get futureGame(): boolean {
    return NhlGameInfoUtils.isFutureGame(this.game?.gameState);
  }

  public get homeTeamLogo(): string {
    return NhlTeamLogoUtils.getTeamPrimaryLogo(this.game?.homeTeam?.id);
  }

  public get awayTeamLogo(): string {
    return NhlTeamLogoUtils.getTeamPrimaryLogo(this.game?.awayTeam?.id);
  }

  public get homeTeamShortName(): string {
    return TeamNextGameComponent.getShortName(this.game?.homeTeam);
  }

  public get awayTeamShortName(): string {
    return TeamNextGameComponent.getShortName(this.game?.awayTeam);
  }

  public get gameTime(): string {
    return this.game ? dayjs(this.game.startTimeUTC).format("h:mm A") : "N/A";
  }

  public get gameDay(): string {
    return this.game ? DateTimeUtils.getDayDisplayValue(dayjs(this.game.startTimeUTC).toDate(), true) : "N/A";
  }

  public get isPlayoffGame(): boolean {
    return this.game?.gameType === NhlGameTypeEnum.PLAYOFFS;
  }

  /**
   * The playoff series status, like "CAR leads 3-1" or "Series (0-0)" before the series starts. Empty without a
   * series status, which only the score response has.
   */
  public get playoffSeriesDetails(): string {
    const status = NhlGameInfoUtils.getSeriesStatusShort(this.game?.seriesStatus);
    return status === "(0-0)" ? "Series (0-0)" : status;
  }

  /**
   * A short label for a game that isn't part of the regular season, like "PRE" or "PLAYOFFS". A playoff game with a
   * known series status shows that instead, since it already says the game is a playoff game.
   */
  public get gameTypeLabel(): string {
    if (this.isPlayoffGame && this.playoffSeriesDetails) {
      return "";
    }
    return NhlGameInfoUtils.getGameTypeLabel(this.game?.gameType);
  }

  public get gameScore(): string {
    if (this.game?.homeTeam?.score == null || this.game?.awayTeam?.score == null) {
      return "N/A";
    }
    return this.game.homeTeam.score + " - " + this.game.awayTeam.score;
  }

  public get completedGameStatus(): string {
    return PeriodUtils.getFinalLabel(this.game?.gameOutcome, this.game?.periodDescriptor);
  }

  public get liveGameStatus(): string {
    return PeriodUtils.getLiveLabel(this.game?.periodDescriptor, this.game?.clock);
  }

  /**
   * The team's common name from the score response, like "Bruins", or from the team utils when it's missing.
   */
  private static getShortName(team: ScoreTeam): string {
    return team?.name?.default ?? NhlTeamUtils.getTeam(team?.id).teamName;
  }

}

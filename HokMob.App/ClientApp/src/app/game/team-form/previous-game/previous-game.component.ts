import {Component, Input} from '@angular/core';
import {ClubScheduleGame, ClubScheduleTeam} from "@shared/models/nhl-web-api/club-schedule.model";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";

@Component({
  selector: 'app-previous-game',
  templateUrl: './previous-game.component.html',
  styleUrls: ['./previous-game.component.scss']
})
export class PreviousGameComponent {

  /**
   * A finished game from the team's club schedule.
   */
  @Input()
  public game: ClubScheduleGame;

  /**
   * The team whose form the game is part of. Its wins are green and its losses red.
   */
  @Input()
  public teamId: number;

  @Input()
  public isLast: boolean;

  /** A little wider than it is tall, so the widest crests keep roughly the visual weight of the square ones. */
  public readonly logoSize: number = 30;

  public readonly logoMaxWidth: number = 39;

  public get homeTeamId(): number {
    return this.game?.homeTeam?.id;
  }

  public get awayTeamId(): number {
    return this.game?.awayTeam?.id;
  }

  public get homeTeamShortName(): string {
    return PreviousGameComponent.getShortName(this.game?.homeTeam);
  }

  public get awayTeamShortName(): string {
    return PreviousGameComponent.getShortName(this.game?.awayTeam);
  }

  /**
   * The score as "home - away", or "N/A" without a score.
   */
  public get score(): string {
    if (!this.hasScore) {
      return "N/A";
    }
    return this.game.homeTeam.score + " - " + this.game.awayTeam.score;
  }

  /**
   * A short label for a game that isn't part of the regular season, like "PRE" or "PLAYOFFS", shown above the score.
   */
  public get gameTypeLabel(): string {
    return NhlGameInfoUtils.getGameTypeLabel(this.game?.gameType);
  }

  /**
   * "green" when the team won, "red" when it lost, and empty without a score or when the team didn't play.
   */
  public get scoreColor(): string {
    if (!this.hasScore || this.game.homeTeam.score === this.game.awayTeam.score) {
      return "";
    }
    const homeTeamWon = this.game.homeTeam.score > this.game.awayTeam.score;
    if (this.teamId === this.game.homeTeam.id) {
      return homeTeamWon ? "green" : "red";
    }
    if (this.teamId === this.game.awayTeam.id) {
      return homeTeamWon ? "red" : "green";
    }
    return "";
  }

  private get hasScore(): boolean {
    return typeof this.game?.homeTeam?.score === "number" && typeof this.game?.awayTeam?.score === "number";
  }

  /**
   * The team's common name from the schedule, like "Bruins", or from the team utils when it's missing.
   */
  private static getShortName(team: ClubScheduleTeam): string {
    return team?.commonName?.default ?? NhlTeamUtils.getTeam(team?.id).teamName;
  }

}

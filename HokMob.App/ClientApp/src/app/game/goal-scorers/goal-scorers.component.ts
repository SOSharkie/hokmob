import {Component, EventEmitter, Input, Output} from '@angular/core';
import {GameLandingGoal, GameLandingScoringPeriod} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {PeriodUtils} from "@shared/utils/period-utils";
import {PlayerClick, PlayerHighlight} from "@shared/models/player-highlight.model";

@Component({
  selector: 'app-goal-scorers',
  templateUrl: './goal-scorers.component.html',
  styleUrls: ['./goal-scorers.component.scss']
})
export class GoalScorersComponent {

  /**
   * The landing's summary.scoring: every period played so far, including periods without goals.
   */
  @Input()
  public scoring: GameLandingScoringPeriod[];

  /**
   * Emits the clicked goal's scorer and event ID, to look up its highlight clip.
   */
  @Output()
  public scorerClicked = new EventEmitter<PlayerClick>();

  /**
   * Emits the hovered goal's scorer and goal index, and null when the mouse leaves it.
   */
  @Output()
  public playerHovered = new EventEmitter<PlayerHighlight>();

  /**
   * The periods to show, in order. Shootout goals aren't listed.
   */
  public get periods(): GameLandingScoringPeriod[] {
    return (this.scoring ?? []).filter(period => period.periodDescriptor?.periodType !== NhlPeriodTypeEnum.SHOOTOUT);
  }

  public getPeriodLabel(period: GameLandingScoringPeriod): string {
    return PeriodUtils.getLabel(period.periodDescriptor);
  }

  /**
   * Returns the home team's goals in the given period.
   *
   * @param period - The period to get home goals for.
   */
  public getHomeTeamGoals(period: GameLandingScoringPeriod): GameLandingGoal[] {
    return (period.goals ?? []).filter(goal => goal.isHome);
  }

  /**
   * Returns the away team's goals in the given period.
   *
   * @param period - The period to get away goals for.
   */
  public getAwayTeamGoals(period: GameLandingScoringPeriod): GameLandingGoal[] {
    return (period.goals ?? []).filter(goal => !goal.isHome);
  }

  /**
   * Returns the scorer's last name, like "Fleury".
   *
   * @param goal - The goal to label.
   */
  public getScorerName(goal: GameLandingGoal): string {
    return goal.lastName?.default ?? "";
  }

  /**
   * Returns the time in the period the goal was scored, like "2:31".
   *
   * @param goal - The goal to label.
   */
  public getGoalTime(goal: GameLandingGoal): string {
    return PeriodUtils.formatTimeRemaining(goal.timeInPeriod);
  }

  public clickScorer(goal: GameLandingGoal): void {
    this.scorerClicked.emit({playerId: goal.playerId, eventId: goal.eventId});
  }

  /**
   * Emits the goal's scorer and the goal's index among their goals in this game, in scoring order.
   *
   * @param goal - The hovered goal.
   */
  public hoverScorer(goal: GameLandingGoal): void {
    const scorerGoals = this.periods.flatMap(period => period.goals ?? []).filter(item => item.playerId === goal.playerId);
    const goalIndex = scorerGoals.indexOf(goal);
    this.playerHovered.emit({playerId: goal.playerId, goalIndex: goalIndex >= 0 ? goalIndex : undefined});
  }

  public leaveScorer(): void {
    this.playerHovered.emit(null);
  }
}

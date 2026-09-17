import {Component, EventEmitter, Input, Output} from '@angular/core';
import {GameLandingGoal, GameLandingScoringPeriod} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {PeriodUtils} from "@shared/utils/period-utils";

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

  @Output()
  public scorerClicked = new EventEmitter<number>();

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
    this.scorerClicked.emit(goal.playerId);
  }
}

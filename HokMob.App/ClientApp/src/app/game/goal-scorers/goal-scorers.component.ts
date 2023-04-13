import {Component, Input} from '@angular/core';
import {GoalModel} from "@shared/models/goal.model";

@Component({
  selector: 'app-goal-scorers',
  templateUrl: './goal-scorers.component.html',
  styleUrls: ['./goal-scorers.component.scss']
})
export class GoalScorersComponent {

  @Input()
  public homeTeamGoals: GoalModel[];

  @Input()
  public awayTeamGoals: GoalModel[];

  @Input()
  public numPeriods: number;

  /**
   * Returns true if the game currently is in or has past a certain period.
   *
   * @param period - The period number to check.
   */
  public hasPeriod(period: number): boolean {
    if (this.numPeriods) {
      return this.numPeriods >= period;
    }
    return false;
  }

  /**
   * Returns the string of home goalscorers with goal times for the given period.
   *
   * @param period - The period to get home goals for.
   */
  public getHomeTeamGoals(period: number): string {
    if (this.homeTeamGoals) {
      let periodGoals = this.homeTeamGoals.filter(goal => goal.period === period);
      let goalsDisplayString = "";
      periodGoals.forEach((goal, index) => {
        goalsDisplayString += goal.scorerLastName;
        goalsDisplayString += this.getGoalPeriodTime(goal.periodTime);
        if (index < periodGoals.length - 1) {
          goalsDisplayString += ", "
        }
      });
      return goalsDisplayString;
    }
    return "";
  }

  /**
   * Returns the string of away goalscorers with goal times for the given period.
   *
   * @param period - The period to get away goals for.
   */
  public getAwayTeamGoals(period: number): string {
    if (this.awayTeamGoals) {
      let periodGoals = this.awayTeamGoals.filter(goal => goal.period === period);
      let goalsDisplayString = "";
      periodGoals.forEach((goal, index) => {
        goalsDisplayString += goal.scorerLastName;
        goalsDisplayString += this.getGoalPeriodTime(goal.periodTime);
        if (index < periodGoals.length - 1) {
          goalsDisplayString += ", "
        }
      });
      return goalsDisplayString;
    }
    return "";
  }

  private getGoalPeriodTime(time: string): string {
    if (time.startsWith('0')) {
      return " (" + time.substring(1) + ")";
    }
    return " (" + time + ")";
  }
}

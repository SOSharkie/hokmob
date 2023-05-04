import {Component, EventEmitter, Input, Output} from '@angular/core';
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

  @Output()
  public scorerClicked = new EventEmitter<number>();

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
  public getHomeTeamGoals(period: number): string[] {
    if (this.homeTeamGoals) {
      let periodGoals = this.homeTeamGoals.filter(goal => goal.period === period);
      let goalStrings = [];
      periodGoals.forEach((goal, index) => {
        let goalDisplayString = "";
        goalDisplayString += goal.scorerLastName;
        goalDisplayString += this.getGoalPeriodTime(goal.periodTime);
        if (index < periodGoals.length - 1) {
          goalDisplayString += ", "
        }
        goalStrings.push(goalDisplayString);
      });
      return goalStrings;
    }
    return [];
  }

  /**
   * Returns the string of away goalscorers with goal times for the given period.
   *
   * @param period - The period to get away goals for.
   */
  public getAwayTeamGoals(period: number): string[] {
      if (this.awayTeamGoals) {
        let periodGoals = this.awayTeamGoals.filter(goal => goal.period === period);
        let goalStrings = [];
        periodGoals.forEach((goal, index) => {
          let goalDisplayString = "";
          goalDisplayString += goal.scorerLastName;
          goalDisplayString += this.getGoalPeriodTime(goal.periodTime);
          if (index < periodGoals.length - 1) {
            goalDisplayString += ", "
          }
          goalStrings.push(goalDisplayString);
        });
        return goalStrings;
      }
      return [];
    }

  private getGoalPeriodTime(time: string): string {
    if (time.startsWith('0')) {
      return "(" + time.substring(1) + ")";
    }
    return "(" + time + ")";
  }

  public clickHomeScorer(scoreString: string): void {
    let lastName = scoreString.slice(0, scoreString.indexOf('('));
    let playerId = this.homeTeamGoals.find(goal => goal.scorerLastName === lastName).scorerId;
    this.scorerClicked.emit(playerId);
  }

  public clickAwayScorer(scoreString: string): void {
    let lastName = scoreString.slice(0, scoreString.indexOf('('));
    let playerId = this.awayTeamGoals.find(goal => goal.scorerLastName === lastName).scorerId;
    this.scorerClicked.emit(playerId);
  }
}

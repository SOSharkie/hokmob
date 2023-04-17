import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, ViewEncapsulation} from '@angular/core';
import {MatDatepicker} from "@angular/material/datepicker";
import {NhlGameService} from "@shared/services/nhl-game.service";
import * as dayjs from 'dayjs'
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlLogoService} from "@shared/services/nhl-logo.service";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

@Component({
  selector: 'app-scores',
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ScoreboardComponent implements OnInit, OnDestroy {

  /**
   * The date picker component.
   */
  @ViewChild('datePicker')
  public datePicker: MatDatepicker<any>;

  /**
   * The current selected day of the scoreboard.
   */
  @Input()
  public selectedDayString: string;

  /**
   * Outputs the new date when the selected day is changed;
   */
  @Output()
  public selectedDayChange = new EventEmitter<Date>();

  /**
   * The current selected day of the scoreboard.
   */
  public selectedDay: Date = new Date();

  /**
   * The string to display for the currently selected day.
   */
  public displayDayLabel: string = "Today";

  /**
   * The list of NHL games for the currently selected day.
   */
  public currentDayGames: NhlGameModel[] = [];

  /**
   * The ID of the timer which runs a function to GET the latest NHL games.
   */
  private nhlGameUpdateTimerId: number;

  /**
   * The refresh time to get updates on NHL games, set to 10 seconds.
   */
  private readonly nhlGameRefreshTime = 10000;

  constructor(private nhlGameService: NhlGameService,
              private nhlLogoService: NhlLogoService) {
  }

  public ngOnInit() {
    this.selectedDay = dayjs(this.selectedDayString, "YYYYMMDD").toDate();
    this.handleDateChange();
  }

  public ngOnDestroy() {
    this.stopContinuousNhlGameUpdates();
  }

  /**
   * Method which runs on click of the date select container.
   */
  public onClickDate(): void {
    this.datePicker.open();
  }

  /**
   * Method which runs when a new date is selected in the date picker.
   *
   * @param $event - Event containing info including the newly selected date value.
   */
  public onDateSelect($event: any): void {
    this.selectedDay = dayjs($event.value).toDate();
    this.handleDateChange();
  }

  /**
   * Shifts the current selected day left 1 day.
   */
  public shiftDateLeft(): void {
    this.selectedDay = dayjs(this.selectedDay).subtract(1, 'day').toDate();
    this.handleDateChange();
  }

  /**
   * Shifts the current selected day right 1 day.
   */
  public shiftDateRight(): void {
    this.selectedDay = dayjs(this.selectedDay).add(1, 'day').toDate();
    this.handleDateChange();
  }

  private handleDateChange(): void {
    this.selectedDayChange.emit(this.selectedDay);
    this.updateDisplayDayLabel();
    this.retrieveNhlGames();
    if (this.displayDayLabel === "Today") {
      this.startContinuousNhlGameUpdates();
    } else {
      this.stopContinuousNhlGameUpdates();
    }
  }

  private retrieveNhlGames(): void {
    this.nhlGameService.getNhlGames(this.selectedDay).then(nhlGameDay => {
      if (nhlGameDay) {
        this.currentDayGames = nhlGameDay.games;
      } else {
        this.currentDayGames = [];
      }
    });
  }

  /**
   * Starts continuous timer updating of current day nhl games every 10 seconds. Should always call retrieveNhlGames once
   * before starting this timer.
   */
  private startContinuousNhlGameUpdates(): void {
    this.nhlGameUpdateTimerId = setInterval(() => {
      this.nhlGameService.getNhlGames(this.selectedDay).then(nhlGameDay => {
        if (nhlGameDay) {
          this.currentDayGames.forEach(existingGame  => {
            let updatedGame = nhlGameDay.games.find(item => item.gamePk === existingGame.gamePk);
            if (updatedGame) {
              existingGame.linescore = updatedGame.linescore;
              existingGame.teams = updatedGame.teams;
              existingGame.status = updatedGame.status;
            }
          });
        } else {
          console.log("Problem updating NHL games");
        }
      });
    }, this.nhlGameRefreshTime);
  }

  private stopContinuousNhlGameUpdates(): void {
    if (this.nhlGameUpdateTimerId) {
      clearInterval(this.nhlGameUpdateTimerId);
      this.nhlGameUpdateTimerId = null;
    }
  }

  private updateDisplayDayLabel(): void {
    this.displayDayLabel = DateTimeUtils.getDayDisplayValue(this.selectedDay)
  }
}

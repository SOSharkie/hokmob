import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {MatDatepicker} from "@angular/material/datepicker";
import {NhlGameService} from "@shared/services/nhl-game.service";
import * as dayjs from 'dayjs'
import {ScoreGame} from "@shared/models/nhl-web-api/score.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

@Component({
  selector: 'app-scores',
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ScoreboardComponent implements OnInit, OnChanges, OnDestroy {

  /**
   * The date picker component.
   */
  @ViewChild('datePicker')
  public datePicker: MatDatepicker<any>;

  /**
   * The selected day, like "20260315", from the URL. When it changes (the browser's back or forward button), the
   * scoreboard shows that day.
   */
  @Input()
  public selectedDayString: string;

  /**
   * Outputs the new date when the user changes the selected day. Not emitted for selectedDayString changes.
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
  public currentDayGames: ScoreGame[] = [];

  /**
   * The ID of the timer which runs a function to GET the latest NHL games.
   */
  private nhlGameUpdateTimerId: number;

  /**
   * The refresh time to get updates on NHL games, set to 10 seconds.
   */
  private readonly nhlGameRefreshTime = 10000;

  /**
   * Whether a day has been shown, so the first selectedDayString always loads.
   */
  private hasLoaded: boolean = false;

  constructor(private nhlGameService: NhlGameService) {
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDayString'] && this.selectedDayString) {
      const day = dayjs(this.selectedDayString, "YYYYMMDD");
      if (day.isValid() && !(this.hasLoaded && day.isSame(this.selectedDay, 'day'))) {
        this.selectedDay = day.toDate();
        this.showSelectedDay();
      }
    }
  }

  /**
   * Shows today when no day was given.
   */
  public ngOnInit() {
    if (!this.hasLoaded) {
      this.showSelectedDay();
    }
  }

  public ngOnDestroy() {
    this.stopContinuousNhlGameUpdates();
  }

  /**
   * Relabels the day when the window crosses the phone breakpoint, so the label keeps the month form that fits.
   */
  @HostListener("window:resize")
  public onWindowResize(): void {
    this.updateDisplayDayLabel();
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

  /**
   * Shows the day the user picked and outputs it, so the page can put it in the URL.
   */
  private handleDateChange(): void {
    this.selectedDayChange.emit(this.selectedDay);
    this.showSelectedDay();
  }

  /**
   * Loads the selected day's games, refreshing them while the day is today.
   */
  private showSelectedDay(): void {
    this.hasLoaded = true;
    this.updateDisplayDayLabel();
    this.retrieveNhlGames();
    this.stopContinuousNhlGameUpdates();
    if (this.displayDayLabel === "Today") {
      this.startContinuousNhlGameUpdates();
    }
  }

  private retrieveNhlGames(): void {
    const day = this.selectedDay;
    this.nhlGameService.getNhlGames(day).then(games => {
      if (day === this.selectedDay) {
        this.currentDayGames = games;
      }
    }).catch(() => {
      // The service logs the error. Show no games rather than another day's games
      if (day === this.selectedDay) {
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
      const day = this.selectedDay;
      this.nhlGameService.getNhlGames(day).then(games => {
        if (day !== this.selectedDay) {
          return;
        }
        this.currentDayGames.forEach(existingGame  => {
          let updatedGame = games.find(item => item.id === existingGame.id);
          if (updatedGame) {
            existingGame.homeTeam = updatedGame.homeTeam;
            existingGame.awayTeam = updatedGame.awayTeam;
            existingGame.clock = updatedGame.clock;
            existingGame.periodDescriptor = updatedGame.periodDescriptor;
            existingGame.gameState = updatedGame.gameState;
            existingGame.gameOutcome = updatedGame.gameOutcome;
          }
        });
      }).catch(() => {
        // The service logs the error. Keep the shown games until the next refresh
      });
    }, this.nhlGameRefreshTime);
  }

  private stopContinuousNhlGameUpdates(): void {
    if (this.nhlGameUpdateTimerId) {
      clearInterval(this.nhlGameUpdateTimerId);
      this.nhlGameUpdateTimerId = null;
    }
  }

  /**
   * Labels the selected day, abbreviating the month on phones, where the full month overflows the one line the label
   * gets. 700px is `$mobile-screen-breakpoint`.
   */
  private updateDisplayDayLabel(): void {
    const isPhone = window.matchMedia('(max-width: 700px)').matches;
    this.displayDayLabel = DateTimeUtils.getDayDisplayValue(this.selectedDay, isPhone);
  }
}

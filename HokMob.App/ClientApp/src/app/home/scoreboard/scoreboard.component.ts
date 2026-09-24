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
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";

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
   * The list of NHL games for the currently selected day, live games first (see orderGames).
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
   * The ID of the timer for the one retry a failed load gets, or null when none is pending.
   */
  private nhlGameRetryTimerId: number;

  /**
   * How long to wait before retrying a failed load, set to 3 seconds. The failed request has already cost the
   * backend its 10 second NHL API timeout, so this only waits out the tail of a brief upstream hiccup.
   */
  private readonly nhlGameRetryTime = 3000;

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
    this.stopPendingRetry();
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
    this.stopPendingRetry();
    this.retrieveNhlGames();
    this.stopContinuousNhlGameUpdates();
    if (this.displayDayLabel === "Today") {
      this.startContinuousNhlGameUpdates();
    }
  }

  /**
   * Loads the selected day's games. A failed load is retried once, unless this is the retry or the 10 second
   * refresh is already running: only today gets that refresh, so without a retry any other day would sit on
   * "No Games" until the user navigated away and back.
   *
   * @param allowRetry - Whether to retry once if the load fails.
   */
  private retrieveNhlGames(allowRetry: boolean = true): void {
    const day = this.selectedDay;
    this.nhlGameService.getNhlGames(day).then(games => {
      if (day === this.selectedDay) {
        this.currentDayGames = this.orderGames(games);
      }
    }).catch(() => {
      // The service logs the error. Show no games rather than another day's games
      if (day !== this.selectedDay) {
        return;
      }
      this.currentDayGames = [];
      if (allowRetry && !this.nhlGameUpdateTimerId) {
        this.nhlGameRetryTimerId = setTimeout(() => {
          this.nhlGameRetryTimerId = null;
          this.retrieveNhlGames(false);
        }, this.nhlGameRetryTime);
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
        if (day === this.selectedDay) {
          this.applyRefreshedGames(this.orderGames(games));
        }
      }).catch(() => {
        // The service logs the error. Keep the shown games until the next refresh
      });
    }, this.nhlGameRefreshTime);
  }

  /**
   * Applies a refresh to the shown games. The same games are updated in place, so their scorecards aren't rebuilt,
   * but a different set of games replaces the list. Without that, a day whose first load failed would poll forever
   * over an empty list and keep showing "No Games", and a day whose schedule changed would never pick it up.
   *
   * @param games - The games the refresh returned, already ordered.
   */
  private applyRefreshedGames(games: ScoreGame[]): void {
    if (!this.isSameGameList(games)) {
      this.currentDayGames = games;
      return;
    }
    this.currentDayGames.forEach((existingGame, index) => {
      const updatedGame = games[index];
      existingGame.homeTeam = updatedGame.homeTeam;
      existingGame.awayTeam = updatedGame.awayTeam;
      existingGame.clock = updatedGame.clock;
      existingGame.periodDescriptor = updatedGame.periodDescriptor;
      existingGame.gameState = updatedGame.gameState;
      existingGame.gameOutcome = updatedGame.gameOutcome;
    });
  }

  /**
   * Whether the given games are the same games, in the same order, as the ones currently shown.
   *
   * @param games - The games the refresh returned.
   */
  private isSameGameList(games: ScoreGame[]): boolean {
    return games.length === this.currentDayGames.length &&
        games.every((game, index) => game.id === this.currentDayGames[index].id);
  }

  /**
   * Moves live games to the top. Otherwise the games keep the API's order, which is by start time, so a game that
   * goes live moves up on the next refresh.
   *
   * @param games - The day's games, in the API's order.
   */
  private orderGames(games: ScoreGame[]): ScoreGame[] {
    const liveGames = games.filter(game => NhlGameInfoUtils.isLiveGame(game.gameState));
    const otherGames = games.filter(game => !NhlGameInfoUtils.isLiveGame(game.gameState));
    return [...liveGames, ...otherGames];
  }

  private stopContinuousNhlGameUpdates(): void {
    if (this.nhlGameUpdateTimerId) {
      clearInterval(this.nhlGameUpdateTimerId);
      this.nhlGameUpdateTimerId = null;
    }
  }

  /**
   * Cancels the retry of a failed load, when one is still pending.
   */
  private stopPendingRetry(): void {
    if (this.nhlGameRetryTimerId) {
      clearTimeout(this.nhlGameRetryTimerId);
      this.nhlGameRetryTimerId = null;
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

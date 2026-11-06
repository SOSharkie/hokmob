import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {Subscription} from "rxjs";
import * as dayjs from "dayjs";
import {RatedSeason} from "@shared/models/nhl-history/season-history.model";
import {HistorySeasonOption, SeasonHistoryService} from "@shared/services/season-history.service";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {PickerMenuUtils} from "@shared/utils/picker-menu-utils";
import {SeasonRatingStatsUtils} from "@app/history/season-rating-stats";

/**
 * The history page (`/history`): season-wide HokMob rating charts of a season, from the season's preloaded stat lines
 * (SeasonHistoryService), rated with the same formulas as the game and player pages. The season picker lists every
 * season with a file in src/assets/history, and the picked season is a query parameter, like `?season=20252026`, so a
 * reload or a shared link keeps it. A season in progress says how far its file goes.
 */
@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit, OnDestroy {

  public readonly seasonOptions: HistorySeasonOption[] = SeasonHistoryService.seasons;

  public selectedSeason: HistorySeasonOption;

  public ratedSeason: RatedSeason;

  /** The fewest games a player needs on the leaderboard of the season shown. */
  public minGames: number = SeasonRatingStatsUtils.fullSeasonMinGames;

  public isLoading: boolean = false;

  public hasError: boolean = false;

  /** Counts the loads, so a season picked before the last one can't replace it. */
  private loadId: number = 0;

  private queryParamSubscription: Subscription;

  constructor(private seasonHistoryService: SeasonHistoryService,
              private activatedRoute: ActivatedRoute,
              private router: Router) {
  }

  /**
   * How far a season in progress goes, like "Season in progress, through November 5", or null for a finished season.
   */
  public get progressNote(): string {
    const throughDate = this.ratedSeason?.throughDate;
    return throughDate ? "Season in progress, through " + dayjs(throughDate).format("MMMM D") : null;
  }

  /**
   * Loads the season in the query parameters, and again whenever they change to another season.
   */
  public ngOnInit(): void {
    this.queryParamSubscription = this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      const option = this.parseSeason(params);
      if (!this.isSelected(option)) {
        this.selectedSeason = option;
        this.loadSeason(option);
      }
    });
  }

  public ngOnDestroy(): void {
    this.queryParamSubscription?.unsubscribe();
  }

  /**
   * A season's picker label, like "2025-26 Regular Season".
   */
  public getSeasonLabel(option: HistorySeasonOption): string {
    const years = DateTimeUtils.getNhlSeasonDisplayValue(String(option.season));
    // 20252026 reads "2025-2026", shortened to "2025-26"
    const shortYears = years.substring(0, 5) + years.substring(7);
    return shortYears + (option.gameType === NhlGameTypeEnum.PLAYOFFS ? " Playoffs" : " Regular Season");
  }

  public isSelected(option: HistorySeasonOption): boolean {
    return option.season === this.selectedSeason?.season && option.gameType === this.selectedSeason?.gameType;
  }

  /**
   * Shows another season. The season is a query parameter, so it's loaded by the query parameter subscription rather
   * than here. The game type is left out for the regular season.
   */
  public selectSeason(option: HistorySeasonOption): void {
    if (!this.isSelected(option)) {
      const gameType = option.gameType === NhlGameTypeEnum.REGULAR_SEASON ? {} : {gameType: option.gameType};
      this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {season: option.season, ...gameType}});
    }
  }

  /**
   * Scrolls the opened season menu to the selected season.
   */
  public scrollToSelectedSeason(): void {
    PickerMenuUtils.scrollToSelectedOption("season-menu");
  }

  /**
   * The season of the query parameters, or the newest one without them or when the page doesn't have that season.
   */
  private parseSeason(params: ParamMap): HistorySeasonOption {
    const season = Number(params.get("season"));
    const gameType = Number(params.get("gameType") ?? NhlGameTypeEnum.REGULAR_SEASON);
    return this.seasonOptions.find(option => option.season === season && option.gameType === gameType) ??
        this.seasonOptions[0];
  }

  private loadSeason(option: HistorySeasonOption): void {
    const loadId = ++this.loadId;
    this.ratedSeason = undefined;
    this.hasError = false;
    this.isLoading = true;
    this.seasonHistoryService.getSeasonHistory(option.season, option.gameType).then(ratedSeason => {
      if (loadId === this.loadId) {
        this.ratedSeason = ratedSeason;
        this.minGames = SeasonRatingStatsUtils.getMinGames(ratedSeason);
        this.isLoading = false;
      }
    }).catch(() => {
      // The service logs the error
      if (loadId === this.loadId) {
        this.hasError = true;
        this.isLoading = false;
      }
    });
  }
}

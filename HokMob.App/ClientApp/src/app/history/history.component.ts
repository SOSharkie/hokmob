import {Component, OnDestroy, OnInit} from '@angular/core';
import {Location} from "@angular/common";
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {Subscription} from "rxjs";
import * as dayjs from "dayjs";
import {PositionGroup, RatedSeason} from "@shared/models/nhl-history/season-history.model";
import {HistorySeasonOption, SeasonHistoryService} from "@shared/services/season-history.service";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {PickerMenuUtils} from "@shared/utils/picker-menu-utils";
import {SeasonRatingStatsUtils} from "@app/history/season-rating-stats";

/**
 * The history page (`/history`): season-wide HokMob rating charts of a season, from the season's preloaded stat lines
 * (SeasonHistoryService), rated with the same formulas as the game and player pages. The season picker lists every
 * season with a file in src/assets/history, and the picked season is a query parameter, like `?season=20252026`, so a
 * reload or a shared link keeps it, and so are the cards' filters, like `?team=59&leaders=F`, until another season is
 * picked. A season in progress says how far its file goes.
 */
@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit, OnDestroy {

  /** The rating distribution's position when the URL doesn't name one. */
  private static readonly defaultDistributionPosition: PositionGroup = "F";

  public readonly seasonOptions: HistorySeasonOption[] = SeasonHistoryService.seasons;

  public selectedSeason: HistorySeasonOption;

  public ratedSeason: RatedSeason;

  /** The fewest games a player needs on the leaderboard of the season shown. */
  public minGames: number = SeasonRatingStatsUtils.fullSeasonMinGames;

  public distributionPosition: PositionGroup = HistoryComponent.defaultDistributionPosition;

  /** The leaderboard's position group, or null for every position. */
  public leadersPosition: PositionGroup = null;

  /** The leaderboard's team, or null for every team. */
  public leadersTeamId: number = null;

  /** The best games' position group, or null for every position. */
  public bestGamesPosition: PositionGroup = null;

  public isLoading: boolean = false;

  public hasError: boolean = false;

  /** Counts the loads, so a season picked before the last one can't replace it. */
  private loadId: number = 0;

  private queryParamSubscription: Subscription;

  constructor(private seasonHistoryService: SeasonHistoryService,
              private activatedRoute: ActivatedRoute,
              private router: Router,
              private location: Location) {
  }

  /**
   * How far a season in progress goes, like "Season in progress, through November 5", or null for a finished season.
   */
  public get progressNote(): string {
    const throughDate = this.ratedSeason?.throughDate;
    return throughDate ? "Season in progress, through " + dayjs(throughDate).format("MMMM D") : null;
  }

  /**
   * Shows the season and filters in the query parameters, and again whenever they change.
   */
  public ngOnInit(): void {
    this.queryParamSubscription = this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      const option = this.parseSeason(params);
      this.parseFilters(params);
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
   * Writes the cards' filters to the URL, leaving out the defaults, so a reload keeps them. It doesn't go through the
   * router, which would scroll to the top of the page and add a history entry for every click. The history state is
   * kept, because the back buttons and the scroll restoration need the router's page ID in it.
   */
  public saveFilters(): void {
    const [path, query] = this.location.path().split("?");
    const params = new URLSearchParams(query);
    const filters = {
      distribution: this.distributionPosition === HistoryComponent.defaultDistributionPosition
          ? null : this.distributionPosition,
      leaders: this.leadersPosition,
      team: this.leadersTeamId,
      best: this.bestGamesPosition
    };
    Object.entries(filters).forEach(([name, value]) => {
      if (value) {
        params.set(name, String(value));
      } else {
        params.delete(name);
      }
    });
    this.location.replaceState(path, params.toString(), this.location.getState());
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

  /**
   * The cards' filters in the query parameters. A missing or unknown one is the card's default.
   */
  private parseFilters(params: ParamMap): void {
    this.distributionPosition = HistoryComponent.parsePosition(params.get("distribution")) ??
        HistoryComponent.defaultDistributionPosition;
    this.leadersPosition = HistoryComponent.parsePosition(params.get("leaders"));
    this.leadersTeamId = Number(params.get("team")) || null;
    this.bestGamesPosition = HistoryComponent.parsePosition(params.get("best"));
  }

  private static parsePosition(value: string): PositionGroup {
    return value === "F" || value === "D" || value === "G" ? value : null;
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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {PlayoffBracketSeason} from "@shared/models/nhl-web-api/playoffs.model";
import {NhlPlayoffBracketUtils, PlayoffBracketSlots} from "@shared/utils/nhl-playoff-bracket-utils";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";

/**
 * A season in the season picker.
 */
export interface PlayoffSeasonOption {
  /** The season ID, like "20252026", which is also the query parameter. */
  value: string;
  /** Like "2025-26". */
  label: string;
}

/**
 * The playoffs page: one season's bracket from playoff-bracket/{year}. By default it's the latest bracket with series
 * (the last playoffs before the next ones start). The season picker covers 2013-14 on, the current divisional and wild
 * card era, and the season picked is the "season" query parameter.
 */
@Component({
  selector: 'app-playoffs',
  templateUrl: './playoffs.component.html',
  styleUrls: ['./playoffs.component.scss']
})
export class PlayoffsComponent implements OnInit, OnDestroy {

  /** The year the first season of the picker ends in (2013-14). */
  public static readonly firstYear = 2014;

  public bracket: PlayoffBracketSeason;

  /** The bracket's series by slot of the tree ("A" to "O"). */
  public slots: PlayoffBracketSlots = {};

  public isLoading: boolean = false;

  public hasError: boolean = false;

  /**
   * The year the latest season ends in: the current season's, until its bracket turns out to have no series yet.
   * Undefined until the season dates load.
   */
  public latestYear: number;

  /** The year of the last request, so a response of a season picked before is ignored. */
  private requestedYear: number;

  private queryParamSubscription: Subscription;

  private isDestroyed: boolean = false;

  /**
   * The picker's seasons, newest first.
   */
  public get seasonOptions(): PlayoffSeasonOption[] {
    const options: PlayoffSeasonOption[] = [];
    for (let year = this.latestYear; year >= PlayoffsComponent.firstYear; year--) {
      const value = String((year - 1) * 10000 + year);
      options.push({value: value, label: this.getSeasonLabel(year)});
    }
    return options;
  }

  /**
   * The season selected in the picker: the season shown, or the one loading.
   */
  public get selectedSeason(): string {
    const year = this.bracket?.year ?? this.requestedYear;
    return year ? String((year - 1) * 10000 + year) : "";
  }

  public get title(): string {
    const year = this.bracket?.year ?? this.requestedYear;
    return year ? this.getSeasonLabel(year) + " Playoffs" : "Playoffs";
  }

  public get qualifyingRoundNote(): string {
    return this.bracket?.hasQualifyingRound ? this.bracket.year + " also had a qualifying round." : "";
  }

  public get hasSeries(): boolean {
    return !!this.bracket?.series.length;
  }

  constructor(private nhlPlayoffService: NhlStandingAndPlayoffService,
              private nhlStatsApiService: NhlStatsApiService,
              private activatedRoute: ActivatedRoute,
              private router: Router) {
  }

  /**
   * Works out the latest year from the current season, then loads the season in the query parameter. When the season
   * dates fail, the latest year is the calendar year: the latest bracket with series always ends in it or before it.
   */
  public ngOnInit(): void {
    this.isLoading = true;
    this.nhlStatsApiService.getCurrentSeason().then(currentSeason => currentSeason.season % 10000).catch(() => {
      // The service logs the error
      return new Date().getFullYear();
    }).then(latestYear => {
      if (this.isDestroyed) {
        return;
      }
      this.latestYear = latestYear;
      this.queryParamSubscription = this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
        this.loadBracket(this.parseSeasonYear(params.get("season")));
      });
    });
  }

  public ngOnDestroy(): void {
    this.isDestroyed = true;
    this.queryParamSubscription?.unsubscribe();
  }

  /**
   * Shows another season. The season is a query parameter, so the bracket is loaded by the query parameter
   * subscription rather than here.
   *
   * @param season - The season ID, like "20222023".
   */
  public selectSeason(season: string): void {
    this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {season: season}});
  }

  /**
   * Shows the season picked in the season picker.
   */
  public onSeasonChange(event: Event): void {
    this.selectSeason((event.target as HTMLSelectElement).value);
  }

  public trackSeason(index: number, option: PlayoffSeasonOption): string {
    return option.value;
  }

  /**
   * Loads a season's bracket, clearing the one shown. The latest season falls back to the previous one while it has no
   * series, and is then dropped from the picker.
   */
  private loadBracket(year: number): void {
    this.requestedYear = year;
    this.bracket = undefined;
    this.slots = {};
    this.hasError = false;
    this.isLoading = true;
    const isLatest = year === this.latestYear;
    const request = isLatest
        ? this.nhlPlayoffService.getLatestNhlPlayoffBracket(year)
        : this.nhlPlayoffService.getNhlPlayoffBracket(year);
    request.then(result => {
      if (this.requestedYear !== year) {
        return;
      }
      if (isLatest && result.year < this.latestYear) {
        this.latestYear = result.year;
      }
      this.bracket = result;
      this.slots = NhlPlayoffBracketUtils.arrangeSeries(result.series);
      this.isLoading = false;
    }).catch(() => {
      // The service logs the error
      if (this.requestedYear === year) {
        this.hasError = true;
        this.isLoading = false;
      }
    });
  }

  /**
   * Gets the short label of the season ending in a year, like "2025-26" for 2026.
   */
  private getSeasonLabel(year: number): string {
    return (year - 1) + "-" + String(year).substring(2);
  }

  /**
   * Gets the year a "season" query parameter ends in, or the latest year when it's missing, invalid or out of range.
   */
  private parseSeasonYear(season: string): number {
    if (!/^\d{8}$/.test(season ?? "")) {
      return this.latestYear;
    }
    const startYear = Number(season.substring(0, 4));
    const endYear = Number(season.substring(4));
    const isValid = endYear === startYear + 1 && endYear >= PlayoffsComponent.firstYear && endYear <= this.latestYear;
    return isValid ? endYear : this.latestYear;
  }
}

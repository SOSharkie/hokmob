import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {DraftPick, DraftPicksResponse} from "@shared/models/nhl-web-api/draft-picks.model";
import {DraftPlayerStats} from "@shared/models/nhl-stats-api/draft-stats.model";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";

/**
 * A row of the picks table.
 */
export interface DraftPickRow {
  overallPick: number;
  /** The team's full name that year, like "Arizona Coyotes". */
  teamName: string;
  /** The team's logo that year. */
  teamLogo: string;
  /** Like "Connor McDavid", or "Forfeited". */
  playerName: string;
  isForfeited: boolean;
  /** Like "LW" or "C/RW", or "-" for a forfeited pick. */
  position: string;
  /** From the career stats, so undefined for a player without NHL games. */
  playerId?: number;
  /** The headshot URL, or undefined for a forfeited pick. */
  headshot?: string;
  /** A number, "-" without stats, or "" while the stats load. */
  assists: number | string;
  goals: number | string;
  points: number | string;
}

/**
 * The draft page: the picks of one draft round from draft/picks/{year}/{round}, with each player's regular season
 * career assists, goals and points from /api/nhl-stats/draft. The picks have no player IDs, so the two are matched by
 * overall pick (and last name). By default it's the latest draft's round 1. The year and round are the "year" and
 * "round" query parameters, from 2006 on (see docs/draft-page-plan.md).
 */
@Component({
  selector: 'app-draft',
  templateUrl: './draft.component.html',
  styleUrls: ['./draft.component.scss']
})
export class DraftComponent implements OnInit, OnDestroy {

  /** The first draft year in the year picker. */
  public static readonly firstDraftYear = 2006;

  public draft: DraftPicksResponse;

  public rows: DraftPickRow[] = [];

  public isLoading: boolean = false;

  public hasError: boolean = false;

  public isStatsLoading: boolean = false;

  /** Every draft year from 2006 on, newest first. Kept while another year loads, so the pickers stay filled. */
  public yearOptions: number[] = [];

  /** The rounds of the latest loaded draft. */
  public roundOptions: number[] = [];

  /** The year and round asked for. The year is undefined while the latest draft loads. */
  public requestedYear: number;

  public requestedRound: number = 1;

  private stats: DraftPlayerStats[];

  /** Counts the loads, so a response of a year or round picked before is ignored. */
  private loadId: number = 0;

  private queryParamSubscription: Subscription;

  public get selectedYear(): number {
    return this.draft?.draftYear ?? this.requestedYear;
  }

  public get title(): string {
    return this.selectedYear ? this.selectedYear + " NHL Draft" : "NHL Draft";
  }

  public get hasPicks(): boolean {
    return !!this.draft?.picks?.length;
  }

  constructor(private nhlGameService: NhlGameService,
              private nhlStatsApiService: NhlStatsApiService,
              private activatedRoute: ActivatedRoute,
              private router: Router) {
  }

  public ngOnInit(): void {
    this.queryParamSubscription = this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      this.loadDraft(this.parseYear(params.get("year")), this.parseRound(params.get("round")));
    });
  }

  public ngOnDestroy(): void {
    this.queryParamSubscription?.unsubscribe();
  }

  /**
   * Shows a year picked in the year menu, keeping the round when that year has it. The draft is loaded by the query
   * parameter subscription.
   */
  public selectYear(year: number): void {
    const round = this.roundOptions.includes(this.requestedRound) ? this.requestedRound : 1;
    this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {year: year, round: round}});
  }

  /**
   * Shows a round picked in the round menu, in the year shown.
   */
  public selectRound(round: number): void {
    this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {year: this.selectedYear, round: round}});
  }

  /**
   * Scrolls an opened picker menu to its selected option, so an older year is visible in the height-capped list. The
   * menu panel renders in the overlay after the opened event, hence the timeout. The menu is found by its own class,
   * because the other menu can still be in the overlay while its close animation runs.
   *
   * @param menuClass - The menu's class, "year-menu" or "round-menu".
   */
  public scrollToSelectedOption(menuClass: string): void {
    setTimeout(() => {
      document.querySelector('.draft-picker-menu.' + menuClass + ' .draft-picker-option.selected')
          ?.scrollIntoView({block: 'nearest'});
    });
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  public trackPick(index: number, row: DraftPickRow): number {
    return row.overallPick;
  }

  /**
   * Loads a round's picks, then shows them with the career stats. With a year, both requests start at once. Without
   * one, the latest draft's picks come first, because the stats need its year. A failed stats request leaves the picks
   * with "-" stats.
   */
  private loadDraft(year: number, round: number): void {
    const loadId = ++this.loadId;
    this.requestedYear = year;
    this.requestedRound = year ? round : 1;
    this.draft = undefined;
    this.stats = undefined;
    this.rows = [];
    this.hasError = false;
    this.isLoading = true;
    this.isStatsLoading = true;

    const stats = year ? this.getStats(year, this.requestedRound) : undefined;
    this.nhlGameService.getDraftPicks(year, this.requestedRound).then(draft => {
      if (loadId !== this.loadId) {
        return undefined;
      }
      this.draft = draft;
      this.requestedYear = draft.draftYear;
      this.yearOptions = (draft.draftYears ?? [])
          .filter(draftYear => draftYear >= DraftComponent.firstDraftYear)
          .sort((yearA, yearB) => yearB - yearA);
      this.roundOptions = draft.selectableRounds ?? [];
      this.isLoading = false;
      this.buildRows();
      return (stats ?? this.getStats(draft.draftYear, this.requestedRound)).then(players => {
        if (loadId === this.loadId) {
          this.stats = players;
          this.isStatsLoading = false;
          this.buildRows();
        }
      });
    }).catch(() => {
      // The service logs the error
      if (loadId === this.loadId) {
        this.hasError = !this.draft;
        this.isLoading = false;
        this.isStatsLoading = false;
        this.buildRows();
      }
    });
  }

  /**
   * Gets a round's career stats, resolving undefined when they fail, so the picks still show.
   */
  private getStats(year: number, round: number): Promise<DraftPlayerStats[]> {
    return this.nhlStatsApiService.getDraftStats(year, round).catch(() => {
      // The service logs the error
      return undefined;
    });
  }

  /**
   * Builds the table rows from the picks and, once loaded, the career stats.
   */
  private buildRows(): void {
    const statsByPick = new Map<number, DraftPlayerStats>();
    (this.stats ?? []).forEach(player => statsByPick.set(player.draftOverall, player));
    this.rows = (this.draft?.picks ?? []).map(pick => this.toRow(pick, statsByPick.get(pick.overallPick)));
  }

  private toRow(pick: DraftPick, stats: DraftPlayerStats): DraftPickRow {
    const isForfeited = !pick.firstName && !pick.positionCode;
    const player = !isForfeited && DraftComponent.isSamePlayer(pick, stats) ? stats : undefined;
    const noStat = this.isStatsLoading ? "" : "-";
    return {
      overallPick: pick.overallPick,
      teamName: pick.teamName?.default ?? pick.teamAbbrev,
      teamLogo: pick.teamLogoLight,
      playerName: isForfeited
          ? pick.lastName?.default ?? "Forfeited"
          : [pick.firstName?.default, pick.lastName?.default].filter(name => !!name).join(" "),
      isForfeited: isForfeited,
      position: isForfeited ? "-" : DraftComponent.getPosition(pick.positionCode, player?.positionCode),
      playerId: player?.playerId,
      headshot: isForfeited ? undefined : NhlPlayerHeadshotUtils.getLatestHeadshotUrl(player?.playerId),
      assists: isForfeited ? "-" : player?.assists ?? noStat,
      goals: isForfeited ? "-" : player?.goals ?? noStat,
      points: isForfeited ? "-" : player?.points ?? noStat
    };
  }

  /**
   * Whether a stats row is the pick's player: the same overall pick, and the same last name ignoring accents and case.
   * A player drafted twice only has stats for their last draft, so an earlier pick of theirs mustn't take another
   * player's row.
   */
  private static isSamePlayer(pick: DraftPick, stats: DraftPlayerStats): boolean {
    const normalize = (name: string) => (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return !!stats && normalize(pick.lastName?.default) === normalize(stats.lastName);
  }

  /**
   * The pick's position, like "LW" or "C/RW". Picks from 2006–2011 can be just "F", so the career stats' position
   * fills in when there is one ("L" and "R" become "LW" and "RW").
   */
  private static getPosition(pickPosition: string, statsPosition: string): string {
    if (pickPosition === "F" && statsPosition) {
      const wingPositions: Record<string, string> = {L: "LW", R: "RW"};
      return wingPositions[statsPosition] ?? statsPosition;
    }
    return pickPosition || statsPosition || "-";
  }

  /**
   * Gets the year of a "year" query parameter, or undefined (the latest draft) when it's missing, invalid, before 2006
   * or after this year.
   */
  private parseYear(year: string): number {
    if (!/^\d{4}$/.test(year ?? "")) {
      return undefined;
    }
    const value = Number(year);
    return value >= DraftComponent.firstDraftYear && value <= new Date().getFullYear() ? value : undefined;
  }

  /**
   * Gets the round of a "round" query parameter, or round 1 when it's missing or not 1 to 7.
   */
  private parseRound(round: string): number {
    return /^[1-7]$/.test(round ?? "") ? Number(round) : 1;
  }
}

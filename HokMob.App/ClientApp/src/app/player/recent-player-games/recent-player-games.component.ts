import {Component, Input, OnChanges, ChangeDetectionStrategy} from '@angular/core';
import dayjs from "dayjs";
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {StatsUtils} from "@shared/utils/stats-utils";
import {GoalieGameStats, SkaterGameStats} from "@shared/models/nhl-stats-api/player-stats.model";

/**
 * One row of the recent games table: a game with the player's stats in it and their HokMob rating.
 */
export interface RecentGameRow {
  gameId: number;
  /** Like "Jun 14". */
  date: string;
  opponentAbbrev: string;
  opponentLogo: string;
  /** The final score with the player's team first, like "(5 - 3)", or empty without scores. */
  score: string;
  /** Like "19:42". */
  timeOnIce: string;
  hokmobRating: number;
  ratingColor: string;
  goals?: number;
  assists?: number;
  shots?: number;
  hits?: number;
  plusMinus?: number;
  penaltyMinutes?: number;
  savePct?: number;
  goalsAgainstAverage?: number;
  shotsAgainst?: number;
  goalsAgainst?: number;
}

/**
 * The player's last 10 games, newest first, with regular season and playoff games mixed as the stats API returns
 * them (/api/nhl-stats/player/{id}). The ratings use the same formulas as the game page, through
 * StatsUtils.calculateSkaterGameRating / calculateGoalieGameRating, like the history page.
 */
@Component({
    selector: 'app-recent-player-games',
    templateUrl: './recent-player-games.component.html',
    styleUrls: ['./recent-player-games.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class RecentPlayerGamesComponent implements OnChanges {

  @Input()
  public games: SkaterGameStats[] | GoalieGameStats[];

  @Input()
  public teamColor: string;

  @Input()
  public isGoalie: boolean;

  /** Whether the games are still loading, so the card shows its skeleton at its size. */
  @Input()
  public loading: boolean = false;

  /** How many games the skeleton has rows for: the 10 the stats API asks for, or fewer for a newer player. */
  @Input()
  public loadingRows: number = 10;

  public rows: RecentGameRow[] = [];

  /** The width, in px, at and below which the table drops its extra columns and its rows get shorter. */
  public readonly skeletonBreakpoint: number = 950;

  /** The skeleton: one row per game, with the table's columns (10 for a skater, 8 for a goalie). */
  public skeletonLayout: SkeletonCardLayout;

  /** At and below the breakpoint: 6 columns, and shorter rows. */
  public skeletonMobileLayout: SkeletonCardLayout;

  public ngOnChanges(): void {
    const games: (SkaterGameStats | GoalieGameStats)[] = this.games ?? [];
    this.rows = games.map(game => this.isGoalie
        ? RecentPlayerGamesComponent.toGoalieRow(game as GoalieGameStats)
        : RecentPlayerGamesComponent.toSkaterRow(game as SkaterGameStats));
    this.skeletonLayout = {
      rows: this.loadingRows, rowHeight: 70.9, columns: this.isGoalie ? 8 : 10, headerHeight: 39, tableHeaderHeight: 49
    };
    this.skeletonMobileLayout = {rowHeight: 42.9, columns: 6, tableHeaderHeight: 28};
  }

  public getPlusMinusColor(plusMinus: number): string {
    return plusMinus > 0 ? '#84dc7b' : plusMinus < 0 ? '#e34d53' : 'white';
  }

  private static toSkaterRow(game: SkaterGameStats): RecentGameRow {
    const hokmobRating = StatsUtils.calculateSkaterGameRating(game);
    return {
      ...RecentPlayerGamesComponent.toGameRow(game, hokmobRating),
      timeOnIce: StatsUtils.formatSeconds(game.timeOnIcePerGame),
      goals: game.goals,
      assists: game.assists,
      shots: game.shots,
      hits: game.hits,
      plusMinus: game.plusMinus,
      penaltyMinutes: game.penaltyMinutes
    };
  }

  private static toGoalieRow(game: GoalieGameStats): RecentGameRow {
    const hokmobRating = StatsUtils.calculateGoalieGameRating(game);
    return {
      ...RecentPlayerGamesComponent.toGameRow(game, hokmobRating),
      timeOnIce: StatsUtils.formatSeconds(game.timeOnIce),
      savePct: game.savePct,
      goalsAgainstAverage: RecentPlayerGamesComponent.getGoalsAgainstAverage(game),
      shotsAgainst: game.shotsAgainst,
      goalsAgainst: game.goalsAgainst
    };
  }

  /**
   * The fields both a skater's and a goalie's row have.
   */
  private static toGameRow(game: SkaterGameStats | GoalieGameStats, hokmobRating: number): RecentGameRow {
    return {
      gameId: game.gameId,
      date: DateTimeUtils.getDateDisplayValue(dayjs(game.gameDate).toDate()),
      opponentAbbrev: game.opponentTeamAbbrev,
      opponentLogo: NhlTeamLogoUtils.getTeamPrimaryLogo(NhlTeamUtils.getTeamIdByAbbrev(game.opponentTeamAbbrev)),
      score: RecentPlayerGamesComponent.getScore(game),
      timeOnIce: "-",
      hokmobRating: hokmobRating,
      ratingColor: StatsUtils.getHokmobRatingColor(hokmobRating)
    };
  }

  /**
   * The final score with the player's team first, like "(5 - 3)". The game report's scores are by home and away, so
   * the row's own homeRoad says which one is the player's team. Empty when the scores are missing.
   */
  private static getScore(game: SkaterGameStats | GoalieGameStats): string {
    if (game.homeScore == null || game.visitingScore == null) {
      return "";
    }
    const isHome = game.homeRoad === "H";
    const teamScore = isHome ? game.homeScore : game.visitingScore;
    const opponentScore = isHome ? game.visitingScore : game.homeScore;
    return "(" + teamScore + " - " + opponentScore + ")";
  }

  /**
   * A goalie's goals against average for one game, from the goals against and the time played in seconds. A goalie
   * who played no time has none.
   */
  private static getGoalsAgainstAverage(game: GoalieGameStats): number {
    if (!game.timeOnIce) {
      return undefined;
    }
    return (game.goalsAgainst ?? 0) * 3600 / game.timeOnIce;
  }
}

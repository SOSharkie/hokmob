import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {LeaguePlayers} from "@shared/models/nhl-stats-api/league-players.model";
import {NstPlayerStats} from "@shared/models/natural-stat-trick/nst-players.model";
import {EdgeGoalieDetail, EdgeSkaterDetail} from "@shared/models/nhl-web-api/edge.model";
import {
  PlayerSeasonPerformanceUtils,
  SeasonPerformance,
  SeasonPerformanceGroup,
  SeasonPerformanceMode
} from "@shared/utils/player-season-performance-utils";
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {StatsUtils} from "@shared/utils/stats-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";

/**
 * The player page's season performance card, like FotMob's: the featured regular season's stats and advanced stats in
 * groups, each with its value, its rank among the players at his position with enough games in a pill, and a bar as
 * long as his percentile, colored only where it stands out (PlayerSeasonPerformanceUtils). A Total / Per 60 toggle
 * turns a skater's counting stats into rates of his ice time, and his ranks with them. Natural Stat Trick's stats show
 * when it answers, credited under the card, and NHL EDGE's with the NHL's own percentiles. Two columns of groups on a
 * desktop, one on a phone.
 */
@Component({
  selector: 'app-player-season-performance',
  templateUrl: './player-season-performance.component.html',
  styleUrls: ['./player-season-performance.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class PlayerSeasonPerformanceComponent implements OnChanges {

  /** A row's height: its 18px line, the 7px gap, the 4px bar and 14px of padding (the rating bar card's rows). */
  private static readonly rowHeight = 43;

  /** The first group's title in a column, and the space above it. */
  private static readonly firstGroupHeight = 22;

  /** Every other group's title, and the space above it. */
  private static readonly groupHeight = 46;

  /** The card's title, and the games and toggle line under it. */
  private static readonly headerHeight = 92;

  /** The skeleton's rows per column on a desktop (the taller one) and on a phone, and their groups: a center's card. */
  private static readonly skaterRows = {desktop: 16, desktopGroups: 3, mobile: 31, mobileGroups: 7};

  private static readonly goalieRows = {desktop: 6, desktopGroups: 2, mobile: 11, mobileGroups: 4};

  /** The player whose season it is. */
  @Input()
  public playerId: number;

  /** Every player of the season at his position (NhlStatsApiService.getLeaguePlayers). */
  @Input()
  public leaguePlayers: LeaguePlayers;

  /** Every skater's season on Natural Stat Trick, or undefined when it couldn't be loaded (or for a goalie). */
  @Input()
  public nstPlayers: NstPlayerStats[];

  /** The player's NHL EDGE stats of the season, or undefined without them (before 2021-22). */
  @Input()
  public edge: EdgeSkaterDetail | EdgeGoalieDetail;

  /** The season, like 20262027. */
  @Input()
  public season: number;

  /** Whether the player is a goalie, so the skeleton has a goalie card's size. */
  @Input()
  public isGoalie: boolean = false;

  @Input()
  public loading: boolean = false;

  public readonly title = "Season Performance";

  public mode: SeasonPerformanceMode = "total";

  public performance: SeasonPerformance;

  /** The left column's groups, then the right's. On a phone they stack in this order. */
  public columns: SeasonPerformanceGroup[][] = [[], []];

  /** The skeleton at a skater's or a goalie's size, with every group shown. */
  public get skeletonLayout(): SkeletonCardLayout {
    const rows = this.isGoalie ? PlayerSeasonPerformanceComponent.goalieRows : PlayerSeasonPerformanceComponent.skaterRows;
    return PlayerSeasonPerformanceComponent.getSkeletonLayout(rows.desktop, rows.desktopGroups, 56);
  }

  public get mobileSkeletonLayout(): SkeletonCardLayout {
    const rows = this.isGoalie ? PlayerSeasonPerformanceComponent.goalieRows : PlayerSeasonPerformanceComponent.skaterRows;
    return PlayerSeasonPerformanceComponent.getSkeletonLayout(rows.mobile, rows.mobileGroups, 84);
  }

  /** Like "26 games · 23:42 per game", or a goalie's "10 games · 9 starts". */
  public get subtitle(): string {
    const performance = this.performance;
    if (!performance) {
      return "";
    }
    const games = performance.gamesPlayed + (performance.gamesPlayed === 1 ? " game" : " games");
    if (performance.group === "G") {
      const starts = performance.gamesStarted ?? 0;
      return games + " · " + starts + (starts === 1 ? " start" : " starts");
    }
    return games + " · " + StatsUtils.formatSeconds(performance.timeOnIcePerGame) + " per game";
  }

  /** Natural Stat Trick's page of the season's skaters, credited under the card when its stats show. */
  public get nstUrl(): string {
    return NstStatsUtils.getPlayerSeasonUrl(this.season);
  }

  /** Whether the Total / Per 60 toggle shows: a goalie's stats don't change with it. */
  public get hasModes(): boolean {
    return this.performance?.group !== "G";
  }

  /** The note for a player under the minimum games, or empty. */
  public get smallSampleNote(): string {
    const performance = this.performance;
    if (!performance?.isSmallSample) {
      return "";
    }
    return "Only " + performance.gamesPlayed + (performance.gamesPlayed === 1 ? " game" : " games") +
        ", small sample: ranked against the " + PlayerSeasonPerformanceUtils.getGroupName(performance.group) + " with " +
        performance.minGames + "+ games";
  }

  /** What the ranks are, under the card. */
  public get rankNote(): string {
    const performance = this.performance;
    const season = this.season ? " in " + DateTimeUtils.getNhlSeasonDisplayValue(String(this.season)) : "";
    const pool = PlayerSeasonPerformanceUtils.describePool(performance?.poolSize ?? 0,
        PlayerSeasonPerformanceUtils.getGroupName(performance?.group), performance?.minGames ?? 0);
    return "Ranks among the " + pool + season + "." + (this.hasModes && this.mode === "per60" ?
        " Counting stats per 60 minutes on the ice." : "") +
        (performance?.hasEdge ? " NHL EDGE's stats show the NHL's own percentile." : "");
  }

  public ngOnChanges(): void {
    this.update();
  }

  /** Switches the counting stats between totals and per 60, and reranks them. */
  public selectMode(mode: SeasonPerformanceMode): void {
    if (mode === this.mode) {
      return;
    }
    this.mode = mode;
    this.update();
  }

  private update(): void {
    this.performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(this.leaguePlayers, this.playerId, this.mode,
        this.nstPlayers, this.edge);
    const groups = this.performance?.groups ?? [];
    this.columns = [groups.filter(group => group.column === 0), groups.filter(group => group.column === 1)];
  }

  /**
   * A skeleton of the card's size: the header, then the rows spread over the height they and their group titles take,
   * then the note.
   */
  private static getSkeletonLayout(rows: number, groups: number, paddingBottom: number): SkeletonCardLayout {
    const component = PlayerSeasonPerformanceComponent;
    const height = rows * component.rowHeight + component.firstGroupHeight + (groups - 1) * component.groupHeight;
    return {rows, rowHeight: height / rows, headerHeight: component.headerHeight, paddingBottom};
  }
}

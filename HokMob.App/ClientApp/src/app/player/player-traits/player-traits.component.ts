import {ChangeDetectionStrategy, Component, HostListener, Input, OnChanges} from '@angular/core';
import {PlayerTraits} from "@shared/utils/player-percentile-utils";
import {PositionGroup} from "@shared/models/nhl-history/season-history.model";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";
import dayjs from "dayjs";

/** Where a vertex's label sits: above the top vertex, below the bottom one, or beside a side one. */
type TraitLabelAnchor = "top" | "bottom" | "left" | "right";

/** A vertex's label, placed over the chart in % of its size. */
interface TraitLabel {
  key: string;
  label: string;
  /** Like "86%", or "-" without a percentile. */
  percentileText: string;
  /** The stat behind it, like "Goals per 60 minutes: 1.85 per 60". */
  title: string;
  left: number;
  top: number;
  anchor: TraitLabelAnchor;
}

/**
 * The player page's traits card, like FotMob's "Player traits": a hexagon of six season stats, each the player's
 * percentile among the players at his position with enough games (PlayerPercentileUtils.getPlayerTraits). The shape
 * is drawn in his team's color, lightened to stand out from the card, over dashed rings at 25, 50 and 75%. A player
 * under the minimum games is still charted, with a note that it's a small sample.
 */
@Component({
  selector: 'app-player-traits',
  templateUrl: './player-traits.component.html',
  styleUrls: ['./player-traits.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class PlayerTraitsComponent implements OnChanges {

  /** The chart's drawing size, in SVG units: the labels are placed over it in % of these. */
  public static readonly width = 340;

  /** Just tall enough for the hexagon and a two line label above and below it (about 33px each, and the gap). */
  public static readonly height = 258;

  /** The hexagon's center and its outer ring's radius. */
  private static readonly centerX = 170;

  private static readonly centerY = 129;

  private static readonly radius = 90;

  /** The gap between a vertex and its label. */
  private static readonly labelGap = 5;

  /** The dashed rings, as shares of the outer one. */
  private static readonly ringShares = [0.25, 0.5, 0.75];

  /** The shape's color for a player without a current team ($gray-04). */
  private static readonly defaultColor = "#A4A4A4";

  private static readonly groupNames: Record<PositionGroup, string> = {
    F: "forwards",
    D: "defensemen",
    G: "goalies"
  };

  /** The player's traits. Without them (and not loading) the card shows nothing. */
  @Input()
  public traits: PlayerTraits;

  /** The player's current team, whose color the shape is drawn in. */
  @Input()
  public teamId: number;

  /** The season the traits are for, like 20262027. */
  @Input()
  public season: number;

  @Input()
  public loading: boolean = false;

  /** Whether the player is a goalie, known before his traits: a skater's card has the Natural Stat Trick credit. */
  @Input()
  public isGoalie: boolean = false;

  /**
   * The card's size while it loads: the header, the chart (at its full 258px, which it has wherever the card is at
   * least 340px wide) and the padding under it, and for a skater the Natural Stat Trick credit's line
   * (PlayerTraitsComponent.creditHeight). A player under the minimum games has a note under the chart too, and a
   * skater without NST no credit, which aren't known before the data.
   */
  public get skeletonLayout(): SkeletonCardLayout {
    return this.isGoalie ? PlayerTraitsComponent.goalieSkeletonLayout : PlayerTraitsComponent.skaterSkeletonLayout;
  }

  /** The Natural Stat Trick credit's height under the chart: its 16px line and the 8px above it. */
  private static readonly creditHeight = 24;

  /** The skeletons, kept as they are so the binding doesn't change on every check. */
  private static readonly goalieSkeletonLayout: SkeletonCardLayout = {
    rows: 1, rowHeight: 258, headerHeight: 59, paddingBottom: 10
  };

  private static readonly skaterSkeletonLayout: SkeletonCardLayout = {
    ...PlayerTraitsComponent.goalieSkeletonLayout,
    paddingBottom: 10 + PlayerTraitsComponent.creditHeight
  };

  public readonly viewBox = "0 0 " + PlayerTraitsComponent.width + " " + PlayerTraitsComponent.height;

  /** The hexagon's center, where the spokes start. */
  public readonly center = {x: PlayerTraitsComponent.centerX, y: PlayerTraitsComponent.centerY};

  /** Whether the (?) explanation is open. */
  public helpOpen: boolean = false;

  public color: string = PlayerTraitsComponent.defaultColor;

  /** The outer ring's points, for an SVG polygon. */
  public outerRing: string;

  /** The dashed rings' points. */
  public rings: string[] = [];

  /** The lines from the center to each vertex. */
  public spokes: {x: number, y: number}[] = [];

  /** The player's shape's points, and each vertex as a dot. */
  public shape: string;

  public dots: {x: number, y: number}[] = [];

  public labels: TraitLabel[] = [];

  /** Like "Compared to other forwards". */
  public get subtitle(): string {
    return "Compared to other " + this.groupName;
  }

  /** The note under the chart for a player with too few games to be in the pool, or empty for one who is in it. */
  public get smallSampleNote(): string {
    if (!this.traits?.isSmallSample) {
      return "";
    }
    const games = this.traits.gamesPlayed;
    return "Only " + games + (games === 1 ? " game" : " games") + ", small sample";
  }

  /**
   * What the numbers are, for the (?) explanation: the pool, how each percentile is worked out, and for a skater where
   * the stats come from.
   */
  public get helpText(): string {
    const season = this.season ? " in " + DateTimeUtils.getNhlSeasonDisplayValue(String(this.season)) : "";
    const pool = "Among " + (this.traits?.poolSize ?? 0) + " " + this.groupName + " with at least " +
        (this.traits?.minGames ?? 0) + " games" + season + ". Each number is a percentile: the share of them this " +
        "player is ahead of. Counting stats are per 60 minutes on the ice.";
    return [pool, this.combinedAxesText, this.edgeText, this.nstText].filter(text => text).join(" ");
  }

  /** The Natural Stat Trick page the credit links to: its skaters of the season. */
  public get nstUrl(): string {
    return NstStatsUtils.getPlayerSeasonUrl(this.season);
  }

  /** A skater's axes of more than one stat, for the explanation. Nothing for a goalie. */
  private get combinedAxesText(): string {
    if (!this.isSkater) {
      return "";
    }
    return "An axis of several stats ranks each one and averages the percentiles" +
        (this.traits.usesEdge ? ", like Possession's shot attempts and 5v5 Corsi For %." : ".");
  }

  /** Where Speed comes from, for the explanation, or nothing without it. */
  private get edgeText(): string {
    if (!this.traits?.usesEdge) {
      return "";
    }
    return "Speed is NHL EDGE's bursts over 20 mph per 60, with top speed at half weight" + this.edgeThroughText + ".";
  }

  /** What comes from Natural Stat Trick, for the explanation, or nothing when it isn't used. */
  private get nstText(): string {
    return this.traits?.usesNst ? "Expected goals (ixG), hits taken and 5v5 expected goals against come from " +
        "Natural Stat Trick, each at half weight in its axis." : "";
  }

  /** Like ", through November 23" for an EDGE file of a season in progress, or nothing. */
  private get edgeThroughText(): string {
    const throughDate = this.traits?.edgeThroughDate;
    return throughDate ? ", through " + dayjs(throughDate).format("MMMM D") : "";
  }

  private get isSkater(): boolean {
    return !!this.traits && this.traits.group !== "G";
  }

  private get groupName(): string {
    return PlayerTraitsComponent.groupNames[this.traits?.group] ?? "players";
  }

  public ngOnChanges(): void {
    this.color = this.teamId ? NhlTeamColorUtils.getTeamColorOnCard(this.teamId) : PlayerTraitsComponent.defaultColor;
    const traits = this.traits?.traits ?? [];
    const count = traits.length;
    if (count < 3) {
      this.outerRing = undefined;
      this.rings = [];
      this.spokes = [];
      this.shape = undefined;
      this.dots = [];
      this.labels = [];
      return;
    }
    const outer = traits.map((_, index) => PlayerTraitsComponent.getPoint(index, count, 1));
    this.outerRing = PlayerTraitsComponent.toPoints(outer);
    this.spokes = outer;
    this.rings = PlayerTraitsComponent.ringShares.map(share =>
        PlayerTraitsComponent.toPoints(traits.map((_, index) => PlayerTraitsComponent.getPoint(index, count, share))));
    this.dots = traits.map((trait, index) =>
        PlayerTraitsComponent.getPoint(index, count, (trait.percentile ?? 0) / 100));
    this.shape = PlayerTraitsComponent.toPoints(this.dots);
    this.labels = traits.map((trait, index) => {
      const {x, y, anchor} = PlayerTraitsComponent.getLabelPosition(index, count);
      return {
        key: trait.key,
        label: trait.label,
        percentileText: trait.percentile == null ? "-" : Math.round(trait.percentile) + "%",
        title: trait.description + ": " + trait.formattedValue + (trait.key === "speed" ? this.edgeThroughText : ""),
        left: x / PlayerTraitsComponent.width * 100,
        top: y / PlayerTraitsComponent.height * 100,
        anchor
      };
    });
  }

  /**
   * Opens or closes the explanation. The click doesn't reach the document, which would close it again.
   */
  public toggleHelp(event: Event): void {
    event.stopPropagation();
    this.helpOpen = !this.helpOpen;
  }

  /** A click anywhere else closes the explanation. */
  @HostListener('document:click')
  public closeHelp(): void {
    this.helpOpen = false;
  }

  @HostListener('document:keydown.escape')
  public closeHelpOnEscape(): void {
    this.helpOpen = false;
  }

  /**
   * A point on the spoke of a vertex, at a share of the outer ring: the first vertex is at the top, and they go
   * clockwise.
   */
  private static getPoint(index: number, count: number, share: number): {x: number, y: number} {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
    const distance = PlayerTraitsComponent.radius * Math.max(0, Math.min(1, share));
    return {
      x: PlayerTraitsComponent.round(PlayerTraitsComponent.centerX + distance * Math.cos(angle)),
      y: PlayerTraitsComponent.round(PlayerTraitsComponent.centerY + distance * Math.sin(angle))
    };
  }

  /**
   * Where a vertex's label goes: just outside the outer ring, above or below a vertex on the vertical axis and beside
   * one on either side.
   */
  private static getLabelPosition(index: number, count: number): {x: number, y: number, anchor: TraitLabelAnchor} {
    const vertex = PlayerTraitsComponent.getPoint(index, count, 1);
    const gap = PlayerTraitsComponent.labelGap;
    const dx = vertex.x - PlayerTraitsComponent.centerX;
    if (Math.abs(dx) < 1) {
      const isTop = vertex.y < PlayerTraitsComponent.centerY;
      return {x: vertex.x, y: vertex.y + (isTop ? -gap : gap), anchor: isTop ? "top" : "bottom"};
    }
    return {x: vertex.x + (dx > 0 ? gap : -gap), y: vertex.y, anchor: dx > 0 ? "right" : "left"};
  }

  private static toPoints(points: {x: number, y: number}[]): string {
    return points.map(point => point.x + "," + point.y).join(" ");
  }

  private static round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

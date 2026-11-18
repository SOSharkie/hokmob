import {ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit} from '@angular/core';

/**
 * What a skeleton card's rows look like, to resemble the card it stands in for:
 * - "game": a game between two teams, a logo and abbreviation each side of a score (the team form, schedule and next
 *   game cards).
 * - "bar": a stat's name, value and rank on one line, and a bar below (the rating bar cards, like the team stats).
 * - "table": a table row of `columns` cells, the first one wider with a logo (the standings, recent games and career).
 * - "tiles": `columns` stat tiles side by side, a label over a value (the player bio and season stats).
 * - "block": one large area per row, like a chart's plot, under a row of `columns` toggles (the power rating chart).
 */
export type SkeletonRowShape = "game" | "bar" | "table" | "tiles" | "block";

/**
 * The size of a skeleton card, in px, so it's the same size as the card it stands in for and the page doesn't move
 * when the card loads. Its height is the header, the table header, the rows and the bottom padding.
 */
export interface SkeletonCardLayout {
  /** How many rows, like 5 games or 16 standings rows. */
  rows?: number;
  /** Each row's height. */
  rowHeight?: number;
  /** The table cells or the tiles in a row. */
  columns?: number;
  /** The card's title bar. 0 for a card without one. */
  headerHeight?: number;
  /**
   * A table's column header row, or a block's row of controls (like a chart's toggles, which wrap), between the title
   * and the rows. 0 for none.
   */
  tableHeaderHeight?: number;
  /** A headline under the title: a badge and two lines beside it, like a rating bar card's rating and rank. 0 for none. */
  summaryHeight?: number;
  /** The space under the last row. */
  paddingBottom?: number;
}

/**
 * A loading card: the title (or a placeholder for it) and rows of gray blocks shaped like the real card's, at the real
 * card's size. One component for every card: the shape and layout make it resemble each one. A card whose rows change
 * size on a phone gives its phone layout too, which replaces the layout's fields it sets below `mobileBreakpoint`.
 *
 * Screen readers hear "Loading" and the title, not the blocks.
 */
@Component({
    selector: 'app-skeleton-card',
    templateUrl: './skeleton-card.component.html',
    styleUrls: ['./skeleton-card.component.scss'],
    host: {
        'role': 'status',
        '[attr.aria-label]': 'ariaLabel'
    },
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SkeletonCardComponent implements OnInit, OnChanges, OnDestroy {

  /** The layout of a card without one: 5 table rows of 40px under a 40px title. */
  public static readonly defaultLayout: Required<SkeletonCardLayout> = {
    rows: 5,
    rowHeight: 40,
    columns: 4,
    headerHeight: 40,
    tableHeaderHeight: 0,
    summaryHeight: 0,
    paddingBottom: 0
  };

  /**
   * The card's title when it's known before the data, like "Team Form". Without one the title is a placeholder. Not
   * `title`, which would also give the element a native tooltip.
   */
  @Input()
  public cardTitle: string;

  @Input()
  public shape: SkeletonRowShape = "table";

  @Input()
  public layout: SkeletonCardLayout;

  /** The layout's fields that change at or below `mobileBreakpoint`, like taller rows. */
  @Input()
  public mobileLayout: SkeletonCardLayout;

  /** The width, in px, at and below which `mobileLayout` applies: the one the real card's own styles change at. */
  @Input()
  public mobileBreakpoint: number = 700;

  /** The layout for the current width, with the defaults filled in. */
  public current: Required<SkeletonCardLayout> = SkeletonCardComponent.defaultLayout;

  /** One entry per row, for the template's loop. */
  public rowIndexes: number[] = [];

  /** One entry per cell or tile of a row. */
  public columnIndexes: number[] = [];

  private mediaQuery: MediaQueryList;

  private readonly onMediaChange = () => this.updateLayout();

  public get ariaLabel(): string {
    return this.cardTitle ? "Loading " + this.cardTitle : "Loading";
  }

  /** Lays out a card without inputs too, which gets no ngOnChanges. */
  public ngOnInit(): void {
    this.watchBreakpoint();
    this.updateLayout();
  }

  public ngOnChanges(): void {
    this.watchBreakpoint();
    this.updateLayout();
  }

  public ngOnDestroy(): void {
    this.mediaQuery?.removeEventListener?.("change", this.onMediaChange);
  }

  /**
   * Follows the breakpoint, so the card switches to its phone layout when the window narrows, like the real card.
   */
  private watchBreakpoint(): void {
    const query = "(max-width: " + this.mobileBreakpoint + "px)";
    if (this.mediaQuery?.media === query || !window.matchMedia) {
      return;
    }
    this.mediaQuery?.removeEventListener?.("change", this.onMediaChange);
    this.mediaQuery = window.matchMedia(query);
    this.mediaQuery.addEventListener?.("change", this.onMediaChange);
  }

  private updateLayout(): void {
    const isMobile = !!this.mediaQuery?.matches;
    this.current = {
      ...SkeletonCardComponent.defaultLayout,
      ...SkeletonCardComponent.withoutUnset(this.layout),
      ...(isMobile ? SkeletonCardComponent.withoutUnset(this.mobileLayout) : {})
    };
    this.rowIndexes = Array.from({length: Math.max(0, this.current.rows)}, (_, i) => i);
    this.columnIndexes = Array.from({length: Math.max(1, this.current.columns)}, (_, i) => i);
  }

  /** A layout without its undefined and null fields, so they don't replace the defaults. */
  private static withoutUnset(layout: SkeletonCardLayout): SkeletonCardLayout {
    return Object.fromEntries(Object.entries(layout ?? {}).filter(([, value]) => value != null));
  }
}

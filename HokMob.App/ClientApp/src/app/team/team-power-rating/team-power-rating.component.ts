import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {
  TeamRankTier, TeamRating, TeamRatingPoint, TeamRatingUtils, TeamScoreBar
} from "@shared/utils/team-rating-utils";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {RatingColorUtils} from "@shared/utils/rating-color-utils";

/**
 * One part of the power rating: a rated stat, its share of the rating, and how it compares to the league, with its bar
 * from the league average.
 */
export interface PowerRatingPart extends TeamScoreBar {
  label: string;
  /** Like "Corsi %", for a narrow card. */
  shortLabel: string;
  description: string;
  /** Like "30%". */
  weight: string;
  value: string;
  rank: string;
  /** Where the rank stands in the league, for the color of its pill and bar. */
  rankTier: TeamRankTier;
}

/**
 * The team's HokMob power rating card: the rating in its color, its league rank and its change over the last 5 games,
 * and each rated stat with its weight, value, league rank in a pill and a bar from the league average, the pill and bar
 * colored at the ends of the league like the team stats cards' (TeamRatingUtils.getRankTier). The stats and weights are
 * the ones the rating was worked out with: with Natural Stat Trick's expected goals, credited under the card, or from
 * the NHL's stats alone when there are none. See TeamRatingUtils for how it's worked out.
 *
 * A page can put the card in a size container named `power-rating` (container: power-rating / inline-size on an
 * element around it, like TeamRatingCardComponent's), like each team's half of a future game's card. Under 340px wide it
 * then goes compact: the team's abbreviation for a title, the stats' short names without their weights, and a smaller
 * rating. An element with a `cardAction` attribute is shown in the header's top right corner.
 */
@Component({
    selector: 'app-team-power-rating',
    templateUrl: './team-power-rating.component.html',
    styleUrls: ['./team-power-rating.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamPowerRatingComponent implements OnChanges {

  @Input()
  public teamId: number;

  /** Every team's rating of the season, from TeamRatingUtils.getLeagueRatings. */
  @Input()
  public ratings: TeamRating[];

  /** The team's rating after each game (TeamRatingUtils.getTimeline), for its recent change. */
  @Input()
  public timeline: TeamRatingPoint[];

  /**
   * Whether the header names the team, with its logo, like "Sharks", for a card with both teams, like a future game's,
   * whose own title says it's the power rating.
   */
  @Input()
  public showTeam: boolean = false;

  /**
   * Whether the card is one team's half of a card with both teams, like a future game's (GamePowerRatingsComponent),
   * so it has no background or padding of its own, and its header, with showTeam, names the team on the left.
   */
  @Input()
  public embedded: boolean = false;

  /**
   * Whether the card notes the league average and credits Natural Stat Trick under its stats. A page with more than one
   * card can turn it off and note it once under them.
   */
  @Input()
  public showNote: boolean = true;

  /** Whether the ratings are still loading, so the card shows its skeleton at its size. */
  @Input()
  public loading: boolean = false;

  /**
   * The skeleton: the rating and rank under the title, then a bar row per rated stat (6 with expected goals, which most
   * seasons have) spread over the height the rows and their group title take, and the note's space below.
   */
  public readonly skeletonLayout: SkeletonCardLayout = {
    rows: 6, headerHeight: 48, summaryHeight: 72, rowHeight: 50, paddingBottom: 42
  };

  /** On a phone the rating is a little smaller. */
  public readonly skeletonMobileLayout: SkeletonCardLayout = {summaryHeight: 64};

  /** The games the recent change is over. */
  public static readonly trendGames = 5;

  public readonly nstUrl: string = NstStatsUtils.teamTableUrl;

  public team: TeamRating;

  public parts: PowerRatingPart[] = [];

  /** The change in rating over the last 5 games, or null before the team has played 6. */
  public change: number = null;

  /** "Power Rating", or the team's name, like "Sharks", with showTeam. */
  public get title(): string {
    const teamName = this.showTeam ? NhlTeamUtils.getTeam(this.teamId)?.teamName : null;
    return teamName || "Power Rating";
  }

  /** The compact card's title: like "SJS" with showTeam, the logo beside it, or else the title. */
  public get shortTitle(): string {
    const triCode = this.showTeam ? NhlTeamUtils.getTeam(this.teamId)?.triCode : null;
    return triCode || this.title;
  }

  public get teamLogo(): string {
    return NhlTeamLogoUtils.getTeamPrimaryLogo(this.teamId);
  }

  public get rating(): string {
    return TeamRatingUtils.formatRating(this.team?.rating);
  }

  public get ratingColor(): string {
    return RatingColorUtils.getColor(this.team?.rating, "team");
  }

  /** The rating's rank, like "8th", shown before "of 32". */
  public get rankOrdinal(): string {
    return TeamRatingUtils.getOrdinal(this.team?.rank);
  }

  /** How many teams are rated, like 32. */
  public get teamCount(): number {
    return (this.ratings ?? []).length;
  }

  /** Like "Through 22 games", shown on hover over the rating and its rank. */
  public get gamesLabel(): string {
    const games = this.team?.gamesPlayed ?? 0;
    return "Through " + games + (games === 1 ? " game" : " games");
  }

  /** Like "4.2", without a sign: the arrow beside it (and, for a screen reader, "Up" or "Down") gives the direction. */
  public get changeLabel(): string {
    return this.change == null ? "" : Math.abs(this.change).toFixed(1);
  }

  public get changeDirection(): "up" | "down" | "flat" {
    const rounded = Math.round((this.change ?? 0) * 10);
    return rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  }

  public get trendGames(): number {
    return TeamPowerRatingComponent.trendGames;
  }

  /**
   * Whether the rating counts Natural Stat Trick's expected goals, so the card credits it. Without them the rating is
   * worked out from the NHL's stats alone, and the card says so.
   */
  public get hasExpectedGoals(): boolean {
    return !!this.team?.hasExpectedGoals;
  }

  public ngOnChanges(): void {
    this.team = (this.ratings ?? []).find(rating => rating.teamId === this.teamId);
    this.parts = this.team ? TeamRatingUtils.getRatedMetrics(this.team.weights).map(metric => {
      const value = this.team.values[metric.id];
      return {
        label: metric.label,
        shortLabel: metric.shortLabel ?? metric.label,
        description: metric.description,
        weight: Math.round(this.team.weights[metric.id] * 100) + "%",
        value: value == null ? "-" : metric.format(value),
        rank: TeamRatingUtils.getOrdinal(this.team.ranks[metric.id]),
        rankTier: TeamRatingUtils.getRankTier(this.team.ranks[metric.id], this.teamCount),
        ...TeamRatingUtils.getScoreBar(this.team.scores[metric.id])
      };
    }) : [];
    const points = this.timeline ?? [];
    const trendGames = TeamPowerRatingComponent.trendGames;
    this.change = points.length > trendGames
        ? points[points.length - 1].rating - points[points.length - 1 - trendGames].rating
        : null;
  }
}

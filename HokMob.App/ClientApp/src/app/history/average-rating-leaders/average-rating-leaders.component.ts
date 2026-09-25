import {Component, Input, OnChanges} from '@angular/core';
import {PositionGroup, RatedSeason} from "@shared/models/nhl-history/season-history.model";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {PickerMenuUtils} from "@shared/utils/picker-menu-utils";
import {StatsUtils} from "@shared/utils/stats-utils";
import {PositionOption, SeasonRatingStatsUtils} from "@app/history/season-rating-stats";

/** A team of the team picker. */
export interface TeamOption {
  id: number;
  /** Like "Winnipeg Jets". */
  name: string;
}

/** A row of the leaderboard. */
export interface AverageRatingRow {
  rank: number;
  playerId: number;
  name: string;
  /** C, L, R, D or G. */
  position: string;
  teamId: number;
  headshot: string;
  gamesPlayed: number;
  /** Like "7.12". */
  averageRating: string;
  ratingColor: string;
}

/**
 * The top average rating card: the players with the season's best average HokMob rating, among those with at least
 * minGames games, so a one-game call-up doesn't top it. Filtered by position group and by team; with a team, only a
 * player's games for that team count.
 */
@Component({
  selector: 'app-average-rating-leaders',
  templateUrl: './average-rating-leaders.component.html',
  styleUrls: ['./average-rating-leaders.component.scss']
})
export class AverageRatingLeadersComponent implements OnChanges {

  /** The fewest games a player needs to be listed. */
  public static readonly defaultMinGames = 20;

  public static readonly leaderCount = 20;

  public readonly positionOptions: PositionOption[] = SeasonRatingStatsUtils.positionFilterOptions;

  @Input()
  public ratedSeason: RatedSeason;

  @Input()
  public minGames: number = AverageRatingLeadersComponent.defaultMinGames;

  /** The position group shown, or null for every position. */
  public position: PositionGroup = null;

  /** The team shown, or null for every team. */
  public teamId: number = null;

  /** The season's teams, by name. */
  public teamOptions: TeamOption[] = [];

  public rows: AverageRatingRow[] = [];

  public get selectedTeamName(): string {
    return this.teamOptions.find(team => team.id === this.teamId)?.name ?? "All teams";
  }

  public ngOnChanges(): void {
    const teamIds = new Set((this.ratedSeason?.games ?? []).flatMap(game => [game.homeTeamId, game.awayTeamId]));
    this.teamOptions = [...teamIds]
        .map(id => ({id, name: NhlTeamUtils.getTeam(id)?.name ?? String(id)}))
        .sort((teamA, teamB) => teamA.name.localeCompare(teamB.name));
    if (this.teamId && !teamIds.has(this.teamId)) {
      this.teamId = null;
    }
    this.buildRows();
  }

  public selectPosition(position: PositionGroup): void {
    this.position = position;
    this.buildRows();
  }

  /**
   * Shows one team's players, or every team's with null.
   */
  public selectTeam(teamId: number): void {
    this.teamId = teamId;
    this.buildRows();
  }

  /**
   * Scrolls the opened team menu to the selected team.
   */
  public scrollToSelectedTeam(): void {
    PickerMenuUtils.scrollToSelectedOption("team-menu");
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  public trackRow(index: number, row: AverageRatingRow): number {
    return row.playerId;
  }

  private buildRows(): void {
    const leaders = SeasonRatingStatsUtils.getAverageLeaders(this.ratedSeason?.ratedGames, {
      position: this.position,
      teamId: this.teamId,
      minGames: this.minGames,
      limit: AverageRatingLeadersComponent.leaderCount
    });
    this.rows = leaders.map((leader, index) => {
      // Rounded once, so the badge color matches the number shown
      const averageRating = leader.averageRating.toFixed(2);
      return {
        rank: index + 1,
        playerId: leader.player.id,
        name: leader.player.name,
        position: leader.player.position,
        teamId: leader.teamId,
        headshot: NhlPlayerHeadshotUtils.getHeadshotUrl(this.ratedSeason.season,
            NhlTeamUtils.getTeam(leader.teamId)?.triCode, leader.player.id),
        gamesPlayed: leader.gamesPlayed,
        averageRating,
        ratingColor: StatsUtils.getHokmobRatingColor(Number(averageRating))
      };
    });
  }
}

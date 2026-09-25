import {Component, Input, OnChanges} from '@angular/core';
import * as dayjs from "dayjs";
import {PositionGroup, RatedGame, RatedSeason} from "@shared/models/nhl-history/season-history.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {StatsUtils} from "@shared/utils/stats-utils";
import {PositionOption, SeasonRatingStatsUtils} from "@app/history/season-rating-stats";

/** A row of the best games list. */
export interface BestGameRow {
  rank: number;
  gameId: number;
  playerId: number;
  name: string;
  /** C, L, R, D or G. */
  position: string;
  teamId: number;
  opponentId: number;
  isHome: boolean;
  headshot: string;
  /** Like "Apr 7". */
  date: string;
  /** The final score with the player's team first, like "6 - 5". */
  score: string;
  rating: number;
  ratingColor: string;
  /** For a game capped at 10, like "Capped at 10, from 11.4", as the ratings page words it. */
  ratingNote?: string;
}

/**
 * The best single games card: the season's highest rated individual games, filtered by position group. A row links
 * to the player page and to the game page.
 */
@Component({
  selector: 'app-best-games',
  templateUrl: './best-games.component.html',
  styleUrls: ['./best-games.component.scss']
})
export class BestGamesComponent implements OnChanges {

  public static readonly gameCount = 20;

  public readonly positionOptions: PositionOption[] = SeasonRatingStatsUtils.positionFilterOptions;

  @Input()
  public ratedSeason: RatedSeason;

  /** The position group shown, or null for every position. */
  public position: PositionGroup = null;

  public rows: BestGameRow[] = [];

  public ngOnChanges(): void {
    this.buildRows();
  }

  public selectPosition(position: PositionGroup): void {
    this.position = position;
    this.buildRows();
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  public trackRow(index: number, row: BestGameRow): string {
    return row.gameId + "-" + row.playerId;
  }

  private buildRows(): void {
    const bestGames = SeasonRatingStatsUtils.getBestGames(this.ratedSeason?.ratedGames, this.position,
        BestGamesComponent.gameCount);
    this.rows = bestGames.map((ratedGame, index) => this.toRow(ratedGame, index + 1));
  }

  private toRow(ratedGame: RatedGame, rank: number): BestGameRow {
    const game = ratedGame.game;
    const isHome = ratedGame.teamId === game.homeTeamId;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const opponentScore = isHome ? game.awayScore : game.homeScore;
    return {
      rank,
      gameId: game.id,
      playerId: ratedGame.player.id,
      name: ratedGame.player.name,
      position: ratedGame.player.position,
      teamId: ratedGame.teamId,
      opponentId: ratedGame.opponentId,
      isHome,
      headshot: NhlPlayerHeadshotUtils.getHeadshotUrl(this.ratedSeason.season,
          NhlTeamUtils.getTeam(ratedGame.teamId)?.triCode, ratedGame.player.id),
      date: DateTimeUtils.getDateDisplayValue(dayjs(game.date).toDate()),
      score: teamScore + " - " + opponentScore,
      rating: ratedGame.rating,
      ratingColor: StatsUtils.getHokmobRatingColor(ratedGame.rating),
      ratingNote: ratedGame.uncappedRating > ratedGame.rating
          ? "Capped at " + ratedGame.rating + ", from " + ratedGame.uncappedRating.toFixed(1)
          : undefined
    };
  }
}

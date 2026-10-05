import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {ClubStats, ClubStatsGoalie, ClubStatsSkater} from "@shared/models/nhl-web-api/club-stats.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {NhlStarPlayerUtils} from "@shared/utils/nhl-star-player-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {StatsUtils} from "@shared/utils/stats-utils";
import {SavePercentagePipe} from "@shared/pipes/save-percentage.pipe";
import {GoalsAgainstAveragePipe} from "@shared/pipes/goals-against-average.pipe";
import {RinkComponent, RinkSpot} from "@app/game/rink/rink.component";

/**
 * A player on the season leaders rink, with his season totals for the team.
 */
export interface SeasonLeader {
  playerId: number;
  name: string;
  headshot: string;
  isGoalie: boolean;
  /** Like "77 GP · 29-71-100" for a skater, or "31-18-4 · .908 · 2.71" for a goalie. */
  statLine: string;
  /** The stat line spelled out, like "77 games played, 29 goals, 71 assists, 100 points". */
  statLabel: string;
}

/**
 * A future game's preview of each team's key players on the rink: its top three forwards and two defensemen by
 * points and its top goalie by wins, with their season totals (NhlGameService.getSeasonLeaderStats). The star lineup
 * switches the skaters to the team's stars (NhlStarPlayerUtils). A player opens his player page.
 */
@Component({
  selector: 'app-game-season-leaders',
  templateUrl: './game-season-leaders.component.html',
  styleUrls: ['./game-season-leaders.component.scss']
})
export class GameSeasonLeadersComponent implements OnChanges {

  private static readonly forwardPositions = ['C', 'L', 'R'];

  private static readonly savePercentagePipe = new SavePercentagePipe();

  private static readonly goalsAgainstAveragePipe = new GoalsAgainstAveragePipe();

  /**
   * The home team's season totals. Both teams' come from the same season and game type.
   */
  @Input()
  public homeStats: ClubStats;

  @Input()
  public awayStats: ClubStats;

  /**
   * The teams' IDs, for their star players.
   */
  @Input()
  public homeTeamId: number;

  @Input()
  public awayTeamId: number;

  public homeSpots: RinkSpot<SeasonLeader>[] = [];

  public awaySpots: RinkSpot<SeasonLeader>[] = [];

  /**
   * Whether the card shows each team's star skaters (NhlStarPlayerUtils) instead of its leading scorers. The goalie
   * is the wins leader in both lineups, since no goalie is a star.
   */
  public showStarLineup = false;

  public readonly numForwardsToShow = 3;

  public readonly numDefenseToShow = 2;

  public ngOnChanges(changes: SimpleChanges): void {
    this.buildSpots();
  }

  /**
   * Switches between the leading scorers and each team's stars, and fills the rink again.
   */
  public toggleStarLineup(): void {
    this.showStarLineup = !this.showStarLineup;
    this.buildSpots();
  }

  /**
   * The card's title, naming the lineup it is showing.
   */
  public get cardTitle(): string {
    return this.showStarLineup ? 'Star Players' : 'Season Leaders';
  }

  /**
   * Which totals the card shows, like "2026-27 Regular Season" or "2025-26 Playoffs". Early in a season they're the
   * previous season's, so this tells them apart. Empty without totals.
   */
  public get seasonLabel(): string {
    const stats = this.homeStats ?? this.awayStats;
    const season = String(stats?.season ?? '');
    if (season.length !== 8) {
      return '';
    }
    const gameType = stats.gameType === NhlGameTypeEnum.PLAYOFFS ? 'Playoffs' : 'Regular Season';
    return season.substring(0, 4) + '-' + season.substring(6) + ' ' + gameType;
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  public trackBySpot(index: number, spot: RinkSpot<SeasonLeader>): number {
    return spot.player.playerId;
  }

  private buildSpots(): void {
    this.homeSpots = this.getSpots(this.homeStats, this.homeTeamId);
    this.awaySpots = this.getSpots(this.awayStats, this.awayTeamId);
  }

  /**
   * Returns a team's goalie, two defensemen and three forwards, placed on the rink: the leaders of the players who
   * played, or the team's stars in the star lineup, topped up with the leaders when a star hasn't played. A line with
   * fewer players than it holds shows the ones there are.
   */
  private getSpots(stats: ClubStats, teamId: number): RinkSpot<SeasonLeader>[] {
    const skaters = (stats?.skaters ?? []).filter(skater => skater.gamesPlayed > 0)
        .sort(GameSeasonLeadersComponent.sortSkaters);
    const goalies = (stats?.goalies ?? []).filter(goalie => goalie.gamesPlayed > 0)
        .sort(GameSeasonLeadersComponent.sortGoalies);
    const defense = skaters.filter(skater => skater.positionCode === 'D');
    const forwards = skaters.filter(skater =>
        GameSeasonLeadersComponent.forwardPositions.includes(skater.positionCode));
    return [
      ...RinkComponent.placeLine('goalies', goalies.slice(0, 1).map(GameSeasonLeadersComponent.toGoalieLeader)),
      ...RinkComponent.placeLine('defense', this.pickLine(defense, NhlStarPlayerUtils.getStarDefenseIds(teamId),
          this.numDefenseToShow).map(GameSeasonLeadersComponent.toSkaterLeader)),
      ...RinkComponent.placeLine('forwards', this.pickLine(forwards, NhlStarPlayerUtils.getStarForwardIds(teamId),
          this.numForwardsToShow).map(GameSeasonLeadersComponent.toSkaterLeader))
    ];
  }

  private pickLine(skaters: ClubStatsSkater[], starPlayerIds: number[], count: number): ClubStatsSkater[] {
    return this.showStarLineup ? NhlStarPlayerUtils.pickStarLine(skaters, starPlayerIds, count) : skaters.slice(0, count);
  }

  /**
   * Sorts skaters by points, most first. A tie goes to the one with more goals, then to the one who needed fewer
   * games, then to the bigger star (StatsUtils.sortByStarPlayer).
   */
  private static sortSkaters(skaterA: ClubStatsSkater, skaterB: ClubStatsSkater): number {
    return (skaterB.points ?? 0) - (skaterA.points ?? 0) ||
        (skaterB.goals ?? 0) - (skaterA.goals ?? 0) ||
        (skaterA.gamesPlayed ?? 0) - (skaterB.gamesPlayed ?? 0) ||
        StatsUtils.sortByStarPlayer(skaterA, skaterB);
  }

  /**
   * Sorts goalies by wins, most first. Wins are often tied early in a season, so a tie goes to the one with more
   * starts, then to the better save percentage.
   */
  private static sortGoalies(goalieA: ClubStatsGoalie, goalieB: ClubStatsGoalie): number {
    return (goalieB.wins ?? 0) - (goalieA.wins ?? 0) ||
        (goalieB.gamesStarted ?? 0) - (goalieA.gamesStarted ?? 0) ||
        (goalieB.savePercentage ?? 0) - (goalieA.savePercentage ?? 0);
  }

  private static toSkaterLeader(skater: ClubStatsSkater): SeasonLeader {
    const {gamesPlayed, goals, assists, points} = skater;
    return {
      playerId: skater.playerId,
      name: GameSeasonLeadersComponent.getName(skater),
      headshot: skater.headshot,
      isGoalie: false,
      statLine: `${gamesPlayed} GP · ${goals}-${assists}-${points}`,
      statLabel: [
        GameSeasonLeadersComponent.count(gamesPlayed, 'game played', 'games played'),
        GameSeasonLeadersComponent.count(goals, 'goal', 'goals'),
        GameSeasonLeadersComponent.count(assists, 'assist', 'assists'),
        GameSeasonLeadersComponent.count(points, 'point', 'points')
      ].join(', ')
    };
  }

  private static toGoalieLeader(goalie: ClubStatsGoalie): SeasonLeader {
    const {wins, losses, overtimeLosses} = goalie;
    const savePercentage = GameSeasonLeadersComponent.savePercentagePipe.transform(goalie.savePercentage);
    const goalsAgainstAverage = GameSeasonLeadersComponent.goalsAgainstAveragePipe.transform(goalie.goalsAgainstAverage);
    return {
      playerId: goalie.playerId,
      name: GameSeasonLeadersComponent.getName(goalie),
      headshot: goalie.headshot,
      isGoalie: true,
      statLine: `${wins}-${losses}-${overtimeLosses} · ${savePercentage} · ${goalsAgainstAverage}`,
      statLabel: [
        GameSeasonLeadersComponent.count(wins, 'win', 'wins'),
        GameSeasonLeadersComponent.count(losses, 'loss', 'losses'),
        GameSeasonLeadersComponent.count(overtimeLosses, 'overtime loss', 'overtime losses'),
        savePercentage + ' save percentage',
        goalsAgainstAverage + ' goals against average'
      ].join(', ')
    };
  }

  private static getName(player: ClubStatsSkater | ClubStatsGoalie): string {
    return [player.firstName?.default, player.lastName?.default].filter(name => !!name).join(' ');
  }

  private static count(value: number, singular: string, plural: string): string {
    return value + ' ' + (value === 1 ? singular : plural);
  }

}

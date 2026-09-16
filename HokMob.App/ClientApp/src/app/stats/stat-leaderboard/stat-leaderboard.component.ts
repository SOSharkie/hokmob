import {Component, Input, OnChanges} from '@angular/core';
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {StatsUtils} from "@shared/utils/stats-utils";
import {SavePercentagePipe} from "@shared/pipes/save-percentage.pipe";
import {GoalsAgainstAveragePipe} from "@shared/pipes/goals-against-average.pipe";

/**
 * How a leaderboard's values are shown: whole numbers, a save percentage (".921"), a goals against average ("2.02")
 * or a time on ice in seconds ("27:44").
 */
export type LeaderboardFormat = "number" | "savePctg" | "gaa" | "toi";

/**
 * One leader of a leaderboard, built by the stats page from either source. The team name, logo and color come from
 * the team ID, so both sources only need the team the player leads for.
 */
export interface LeaderboardEntry {
  playerId: number;
  /** The full name, like "Connor McDavid". */
  name: string;
  /** The NHL team ID, or undefined for an abbreviation NhlTeamUtils doesn't know. */
  teamId: number;
  headshot: string;
  value: number;
}

/**
 * A leaderboard entry with everything the template shows, worked out once per change.
 */
export interface LeaderboardRow {
  playerId: number;
  name: string;
  headshot: string;
  teamName: string;
  teamLogo: string;
  teamColor: string;
  /** The value as shown, like "138", ".921", "2.02" or "27:44". */
  value: string;
}

/**
 * One stat's top 5 players, the leader first. An empty leaderboard (a playoff category before the playoffs start, or
 * a request that failed) shows that there are no stats yet.
 */
@Component({
  selector: 'app-stat-leaderboard',
  templateUrl: './stat-leaderboard.component.html',
  styleUrls: ['./stat-leaderboard.component.scss']
})
export class StatLeaderboardComponent implements OnChanges {

  @Input()
  public statTitle: string;

  @Input()
  public entries: LeaderboardEntry[];

  @Input()
  public format: LeaderboardFormat = "number";

  public rows: LeaderboardRow[] = [];

  private static readonly leaderCount = 5;

  private static readonly savePercentagePipe = new SavePercentagePipe();

  private static readonly goalsAgainstAveragePipe = new GoalsAgainstAveragePipe();

  /** The leader, or undefined for an empty leaderboard. */
  public get statLeader(): LeaderboardRow {
    return this.rows[0];
  }

  /** The players behind the leader, up to 4 of them. */
  public get statRunnerUps(): LeaderboardRow[] {
    return this.rows.slice(1);
  }

  public ngOnChanges(): void {
    this.rows = (this.entries ?? []).slice(0, StatLeaderboardComponent.leaderCount)
        .map(entry => this.toRow(entry));
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  private toRow(entry: LeaderboardEntry): LeaderboardRow {
    return {
      playerId: entry.playerId,
      name: entry.name,
      headshot: entry.headshot || NhlPlayerHeadshotUtils.blankHeadshot,
      teamName: NhlTeamUtils.getTeam(entry.teamId).name,
      teamLogo: NhlTeamLogoUtils.getTeamPrimaryLogo(entry.teamId),
      teamColor: NhlTeamColorUtils.getTeamPrimaryColor(entry.teamId),
      value: this.formatValue(entry.value)
    };
  }

  /**
   * Formats a value for the board's stat. Save percentages and goals against averages use the same pipes as the rest
   * of the site, and a time on ice comes in seconds (1664.2568 for 27:44).
   */
  private formatValue(value: number): string {
    if (value == null) {
      return "-";
    }
    switch (this.format) {
      case "savePctg":
        return StatLeaderboardComponent.savePercentagePipe.transform(value);
      case "gaa":
        return StatLeaderboardComponent.goalsAgainstAveragePipe.transform(value);
      case "toi":
        return StatsUtils.formatSeconds(value);
      default:
        return String(value);
    }
  }
}

import {Component, Input, OnChanges} from '@angular/core';
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {LeaderboardEntry, StatCategoryUtils, StatFormat} from "@shared/utils/stat-category-utils";

/**
 * A leaderboard entry with everything the template shows, worked out once per change.
 */
export interface LeaderboardRow {
  playerId: number;
  name: string;
  headshot: string;
  teamName: string;
  /** The NHL team ID, or undefined for an abbreviation NhlTeamUtils doesn't know. */
  teamId: number;
  teamColor: string;
  /** The value as shown, like "138", ".921", "2.02" or "27:44". */
  value: string;
}

/**
 * One stat's top 5 players, the leader first. An empty leaderboard (a playoff category before the playoffs start, or
 * a request that failed) shows that there are no stats yet. The title links to the stat's top 25 table, keeping the
 * page's game type.
 */
@Component({
  selector: 'app-stat-leaderboard',
  templateUrl: './stat-leaderboard.component.html',
  styleUrls: ['./stat-leaderboard.component.scss']
})
export class StatLeaderboardComponent implements OnChanges {

  /** The logo boxes, a little wider than they are tall so the widest crests keep the weight of the square ones. */
  public readonly leaderLogoSize: number = 30;

  public readonly leaderLogoMaxWidth: number = 39;

  public readonly playerLogoSize: number = 25;

  public readonly playerLogoMaxWidth: number = 33;

  @Input()
  public statTitle: string;

  /** The category's id, like "points", which its top 25 table is routed by. */
  @Input()
  public categoryId: string;

  @Input()
  public entries: LeaderboardEntry[];

  @Input()
  public format: StatFormat = "number";

  public rows: LeaderboardRow[] = [];

  private static readonly leaderCount = 5;

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
      teamId: entry.teamId,
      teamColor: NhlTeamColorUtils.getTeamPrimaryColor(entry.teamId),
      value: StatCategoryUtils.formatValue(entry.value, this.format)
    };
  }
}

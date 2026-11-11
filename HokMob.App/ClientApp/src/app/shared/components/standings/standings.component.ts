import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {StandingsGroup, StandingsTeam} from "@shared/models/nhl-web-api/standings.model";

/** The columns the standings can be sorted by, both most first. */
export type StandingsSortColumn = "points" | "pointPctg";

@Component({
  selector: 'app-standings',
  templateUrl: './standings.component.html',
  styleUrls: ['./standings.component.scss']
})
export class StandingsComponent implements OnChanges {

  @Input()
  public defaultStandingsType: NhlStandingsTypeEnum = NhlStandingsTypeEnum.BY_LEAGUE;

  @Input()
  public standings: StandingsGroup[];

  @Input()
  public selectedTeamId: number;

  @Input()
  public showFormAndNext: boolean = true;

  @Input()
  public miniStandings: boolean = false;

  /**
   * Adds a points percentage column, shown only when the card is wide enough, and makes the points and points
   * percentage headers sort the rows.
   */
  @Input()
  public showPointsPercentage: boolean = false;

  /** The column the rows are sorted by. By points, the rows keep the NHL's order, with its tiebreakers. */
  public sortColumn: StandingsSortColumn = "points";

  /** The standings groups with their teams in the rows' order, which follows sortColumn. */
  public sortedStandings: StandingsGroup[] = [];

  /**
   * Team IDs by group and row of sortedStandings. Standings rows have no team ID, so they're looked up from the team
   * abbreviation.
   */
  public teamIds: number[][];

  /** Matches $logo-size in the stylesheet, which sizes the column the logo sits in. */
  public readonly logoSize: number = 24;

  public get seasonString(): string {
    const seasonId = this.standings[0]?.teams[0]?.seasonId;
    if (seasonId) {
      return DateTimeUtils.getNhlSeasonDisplayValue(seasonId.toString());
    }
    return "";
  }

  public get selectedTeamColor(): string {
    if (this.selectedTeamId) {
      return NhlTeamColorUtils.getTeamPrimaryColor(this.selectedTeamId);
    }
    return "";
  }

  /** The text color on the selected team's points pill: white, or near-black on a light team color. */
  public get selectedTeamTextColor(): string {
    return this.selectedTeamId ? NhlTeamColorUtils.getTeamTextColor(this.selectedTeamId) : "";
  }

  public ngOnChanges(changes: SimpleChanges) {
    if (changes['showPointsPercentage'] && !this.showPointsPercentage) {
      this.sortColumn = "points";
    }
    if (changes['standings'] || changes['showPointsPercentage']) {
      this.sortRows();
    }
  }

  /** Sorts the rows by a column. Only the points percentage column needs sorting; by points it's the NHL's order. */
  public sortBy(column: StandingsSortColumn): void {
    if (column === this.sortColumn) {
      return;
    }
    this.sortColumn = column;
    this.sortRows();
  }

  /** The header's aria-sort: descending on the sorted column, none on the others. */
  public getAriaSort(column: StandingsSortColumn): string {
    return this.sortColumn === column ? "descending" : null;
  }

  /**
   * The rank shown in a row. By points it's the NHL's rank for the standings type; by points percentage it's the row's
   * place in its group, since the NHL has no rank for that order.
   */
  public getRowRank(team: StandingsTeam, rowIndex: number): number {
    return this.sortColumn === "pointPctg" ? rowIndex + 1 : this.getTeamRank(team);
  }

  /** A points percentage the way the NHL shows it, like ".738", or "1.000" for a team that hasn't lost. */
  public formatPointPctg(pointPctg: number): string {
    if (pointPctg === null || pointPctg === undefined) {
      return "-";
    }
    return pointPctg.toFixed(3).replace(/^0/, "");
  }

  public standingsTableTitle(group: StandingsGroup): string {
    return (group ? group.title : "NHL") + " " + this.seasonString;
  }

  public getTeamRank(team: StandingsTeam): number {
    switch (this.defaultStandingsType) {
      case NhlStandingsTypeEnum.BY_LEAGUE:
        return team.leagueSequence;
      case NhlStandingsTypeEnum.BY_CONFERENCE:
        return team.conferenceSequence;
      case NhlStandingsTypeEnum.BY_DIVISION:
        return team.divisionSequence;
      case NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS:
        // Division leaders have no wild card rank, so show their division rank instead
        return team.wildcardSequence || team.divisionSequence;
      default:
        return team.leagueSequence;
    }
  }

  public isPlayoffPosition(team: StandingsTeam): boolean {
    return ['x', 'y', 'z', 'p'].includes(team.clinchIndicator);
  }

  public isEliminated(team: StandingsTeam): boolean {
    return team.clinchIndicator === 'e';
  }

  /** Whether any team has clinched a playoff spot, so the legend explains the green bar. */
  public get hasPlayoffPositions(): boolean {
    return this.standings?.some(group => group.teams.some(team => this.isPlayoffPosition(team))) ?? false;
  }

  /** Whether any team is eliminated, so the legend explains the red bar. */
  public get hasEliminatedTeams(): boolean {
    return this.standings?.some(group => group.teams.some(team => this.isEliminated(team))) ?? false;
  }

  /**
   * Orders each group's teams by sortColumn and looks up their team IDs. The sort is stable, so teams with the same
   * points percentage keep the NHL's order (fewer games played, then its tiebreakers). A missing percentage goes last.
   */
  private sortRows(): void {
    this.sortedStandings = (this.standings ?? []).map(group => {
      if (this.sortColumn !== "pointPctg") {
        return group;
      }
      const teams = [...(group.teams ?? [])].sort((teamA, teamB) => (teamB.pointPctg ?? -1) - (teamA.pointPctg ?? -1));
      return {...group, teams};
    });
    this.teamIds = this.sortedStandings.map(group =>
        (group.teams ?? []).map(team => NhlTeamUtils.getTeamIdByAbbrev(team.teamAbbrev?.default)));
  }
}

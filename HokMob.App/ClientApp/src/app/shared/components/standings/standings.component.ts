import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {StandingsGroup, StandingsTeam} from "@shared/models/nhl-web-api/standings.model";

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

  public teamLogos: any[][];

  /**
   * Team IDs by group and row. Standings rows have no team ID, so they're looked up from the team abbreviation.
   */
  public teamIds: number[][];

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

  public ngOnChanges(changes: SimpleChanges) {
    if (changes['standings'] && this.standings && this.standings[0]) {
      this.teamIds = this.standings.map(group =>
          group.teams.map(team => NhlTeamUtils.getTeamIdByAbbrev(team.teamAbbrev.default)));
      this.teamLogos = this.teamIds.map(groupIds => groupIds.map(teamId => NhlTeamLogoUtils.getTeamPrimaryLogo(teamId)));
    }
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
}

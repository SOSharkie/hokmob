import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStandingsModel} from "@shared/models/nhl-general/nhl-standings.model";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlTeamRecordModel} from "@shared/models/nhl-general/nhl-team-record.model";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

@Component({
  selector: 'app-standings',
  templateUrl: './standings.component.html',
  styleUrls: ['./standings.component.scss']
})
export class StandingsComponent implements OnChanges {

  @Input()
  public defaultStandingsType: NhlStandingsTypeEnum = NhlStandingsTypeEnum.BY_LEAGUE;

  @Input()
  public standings: NhlStandingsModel[];

  @Input()
  public selectedTeamId: number;

  @Input()
  public showFormAndNext: boolean = true;

  @Input()
  public miniStandings: boolean = false;

  public teamLogos: any[][];

  public get seasonString(): string {
    if (this.standings[0].season) {
      return this.standings[0].season.slice(0, 4) + "-" + this.standings[0].season.slice(4);
    }
    return "";
  }

  public get selectedTeamColor(): string {
    if (this.selectedTeamId) {
      return NhlTeamColorUtils.getTeamPrimaryColor(this.selectedTeamId);
    }
    return "";
  }

  constructor(private nhlImageService: NhlImageService) {}

  public ngOnChanges(changes: SimpleChanges) {
    if (changes['standings'] && this.standings && this.standings[0]) {
      this.teamLogos = [];
      this.standings.forEach((division, divisionIndex) => {
        this.teamLogos.push([]);
        division.teamRecords.forEach((team, teamIndex) => {
          this.teamLogos[divisionIndex].push([]);
          this.teamLogos[divisionIndex][teamIndex] = NhlTeamLogoUtils.getTeamPrimaryLogo(team.team.id);
        });
      })
    }
  }

  public standingsTableTitle(standingModel: NhlStandingsModel): string {
    if (standingModel) {
      switch (this.defaultStandingsType) {
        case NhlStandingsTypeEnum.BY_LEAGUE:
          return "NHL " + this.seasonString;
        case NhlStandingsTypeEnum.BY_CONFERENCE:
          return (standingModel.conference ? standingModel.conference.name : "") + " Conference " + this.seasonString;
        case NhlStandingsTypeEnum.BY_DIVISION:
          return (standingModel.division ? standingModel.division.name : "") + " Division " + this.seasonString;
        case NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS:
          if (standingModel.division) {
            return standingModel.division.name + " Leaders " + this.seasonString;
          } else if (standingModel.conference) {
            return standingModel.conference.name + " Wild Card " + this.seasonString;
          } else {
            return "Wild Card " + this.seasonString;
          }
      }
    }
    return "NHL " + this.seasonString;
  }

  public getTeamRank(teamRecord: NhlTeamRecordModel): string {
    switch (this.defaultStandingsType) {
      case NhlStandingsTypeEnum.BY_LEAGUE:
        return teamRecord.leagueRank;
      case NhlStandingsTypeEnum.BY_CONFERENCE:
        return teamRecord.conferenceRank;
      case NhlStandingsTypeEnum.BY_DIVISION:
        return teamRecord.divisionRank;
      case NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS:
        return teamRecord.wildCardRank;
      default:
        return teamRecord.leagueRank;
    }
  }

  public getTeamShortName(name: string): string {
    if (name.startsWith('New') || name.startsWith('San') || name.startsWith('Tampa') || name.startsWith('Los') || name.startsWith('St.')) {
      return name.slice(0, name.lastIndexOf(' '));
    }
    return name.slice(0, name.indexOf(' '));
  }

  public isPlayoffPosition(teamRecord: NhlTeamRecordModel): boolean {
    return ['x', 'y', 'z', 'p'].includes(teamRecord.clinchIndicator);
  }
}

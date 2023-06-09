import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStandingsModel} from "@shared/models/nhl-general/nhl-standings.model";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlTeamRecordModel} from "@shared/models/nhl-general/nhl-team-record.model";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";

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

  public teamStandings: NhlTeamRecordModel[];

  public teamLogos: any[];

  public imagesLoaded = false;

  public get standingsTableTitle(): string {
    if (this.standings[0]) {
      switch (this.defaultStandingsType) {
        case NhlStandingsTypeEnum.BY_LEAGUE:
          return "NHL " + this.seasonString;
        case NhlStandingsTypeEnum.BY_CONFERENCE:
          return this.standings[0].conference.name + " Conference " + this.seasonString;
        case NhlStandingsTypeEnum.BY_DIVISION:
          return this.standings[0].division.name + this.seasonString;
        case NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS:
          return this.standings[0].division.name + " Wild Card " + this.seasonString;
      }
    }
    return "NHL " + this.seasonString;
  }

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
      this.teamStandings = this.standings[0].teamRecords;
      this.teamLogos = [];
      for (let i = 0; i < this.standings[0].teamRecords.length; i++) {
        this.teamLogos.push('assets/nhl_logo.png');
      }
      this.standings[0].teamRecords.forEach((team, index) => {
        this.nhlImageService.getNhlTeamLogo(team.team.id).then(data => {
          let reader = new FileReader();
          reader.addEventListener("load", () => {
            this.teamLogos[index] = reader.result;
          }, false);
          reader.readAsDataURL(data);
        });
      });
    }
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

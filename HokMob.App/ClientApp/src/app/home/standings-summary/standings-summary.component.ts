import {Component, Input, OnInit} from '@angular/core';
import {NhlStandingsModel} from "@shared/models/nhl-general/nhl-standings.model";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";

@Component({
  selector: 'app-standings-summary',
  templateUrl: './standings-summary.component.html',
  styleUrls: ['./standings-summary.component.scss']
})
export class StandingsSummaryComponent implements OnInit{

  @Input()
  public standingsType: NhlStandingsTypeEnum = NhlStandingsTypeEnum.BY_LEAGUE;

  public standings: NhlStandingsModel[];

  constructor(private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService) {}

  public ngOnInit() {
    this.nhlStandingAndPlayoffService.getNhlStandings(DateTimeUtils.getCurrentNhlSeason(), this.standingsType).then(result => {
        this.standings = result;
    });
  }
}

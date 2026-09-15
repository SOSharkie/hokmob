import {Component, Input, OnInit} from '@angular/core';
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {StandingsGroup} from "@shared/models/nhl-web-api/standings.model";

@Component({
  selector: 'app-standings-summary',
  templateUrl: './standings-summary.component.html',
  styleUrls: ['./standings-summary.component.scss']
})
export class StandingsSummaryComponent implements OnInit{

  @Input()
  public standingsType: NhlStandingsTypeEnum = NhlStandingsTypeEnum.BY_LEAGUE;

  public standings: StandingsGroup[];

  constructor(private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService) {}

  public ngOnInit() {
    this.nhlStandingAndPlayoffService.getNhlStandings(this.standingsType).then(result => {
        this.standings = result;
    });
  }
}

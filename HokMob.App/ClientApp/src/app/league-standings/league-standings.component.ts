import {Component, OnInit} from '@angular/core';
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlStandingsModel} from "@shared/models/nhl-general/nhl-standings.model";

@Component({
  selector: 'app-league-standings',
  templateUrl: './league-standings.component.html',
  styleUrls: ['./league-standings.component.scss']
})
export class LeagueStandingsComponent implements OnInit {

  public standings: NhlStandingsModel[];

  constructor(private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService) {
  }

  public ngOnInit() {
    this.nhlStandingAndPlayoffService.getNhlStandings(DateTimeUtils.getCurrentNhlSeason(), NhlStandingsTypeEnum.BY_LEAGUE).then(result => {
      this.standings = result;
    });
  }

  protected readonly NhlStandingsTypeEnum = NhlStandingsTypeEnum;
}

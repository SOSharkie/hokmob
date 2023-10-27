import {Component, OnInit} from '@angular/core';
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlStandingsModel} from "@shared/models/nhl-general/nhl-standings.model";
import {ActivatedRoute, ParamMap, Router} from "@angular/router";

@Component({
  selector: 'app-league-standings',
  templateUrl: './league-standings.component.html',
  styleUrls: ['./league-standings.component.scss']
})
export class LeagueStandingsComponent implements OnInit {

  public standings: NhlStandingsModel[];

  public currentStandingsType: NhlStandingsTypeEnum = NhlStandingsTypeEnum.BY_LEAGUE;

  constructor(private activatedRoute: ActivatedRoute,
              private router: Router,
              private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService) {
  }

  public ngOnInit() {
    this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      if (params.has("standingsType")) {
        switch (params.get("standingsType")) {
          case (NhlStandingsTypeEnum.BY_LEAGUE.toString()):
            this.currentStandingsType = NhlStandingsTypeEnum.BY_LEAGUE;
            break;
          case (NhlStandingsTypeEnum.BY_CONFERENCE.toString()):
            this.currentStandingsType = NhlStandingsTypeEnum.BY_CONFERENCE;
            break;
          case (NhlStandingsTypeEnum.BY_DIVISION.toString()):
            this.currentStandingsType = NhlStandingsTypeEnum.BY_DIVISION;
            break;
          case (NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS.toString()):
            this.currentStandingsType = NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS;
            break;
        }
      }
      this.updateStandings();
    });
  }

  public updateStandingsType(type: NhlStandingsTypeEnum): void {
    this.currentStandingsType = type;
    this.router.navigate([],
        {
          relativeTo: this.activatedRoute,
          queryParams: {standingsType: this.currentStandingsType},
        }
    );
    this.updateStandings();
  }

  protected readonly NhlStandingsTypeEnum = NhlStandingsTypeEnum;

  private updateStandings(): void {
    this.nhlStandingAndPlayoffService.getNhlStandings(DateTimeUtils.getCurrentNhlSeason(), this.currentStandingsType).then(result => {
      this.standings = result;
      if (this.currentStandingsType === NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS) {
        this.standings = result.reverse();
        this.standings.splice(2,0, this.standings[this.standings.length - 2]);
        this.standings.splice(this.standings.length - 2, 1);
      }
    });
  }
}

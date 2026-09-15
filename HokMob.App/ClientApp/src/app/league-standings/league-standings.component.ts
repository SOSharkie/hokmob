import {Component, OnInit} from '@angular/core';
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {StandingsGroup} from "@shared/models/nhl-web-api/standings.model";

@Component({
  selector: 'app-league-standings',
  templateUrl: './league-standings.component.html',
  styleUrls: ['./league-standings.component.scss']
})
export class LeagueStandingsComponent implements OnInit {

  public standings: StandingsGroup[];

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
    this.nhlStandingAndPlayoffService.getNhlStandings(this.currentStandingsType).then(result => {
      this.standings = result;
    }).catch(() => {
      // The service logs the error. Show no standings rather than those of another standings type
      this.standings = undefined;
    });
  }
}

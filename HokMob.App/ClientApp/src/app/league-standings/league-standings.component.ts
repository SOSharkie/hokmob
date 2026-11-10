import {Component, OnInit} from '@angular/core';
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {StandingsGroup} from "@shared/models/nhl-web-api/standings.model";
import {StandingsTypeFilter, StandingsTypeUtils} from "@shared/utils/standings-type-utils";

@Component({
  selector: 'app-league-standings',
  templateUrl: './league-standings.component.html',
  styleUrls: ['./league-standings.component.scss']
})
export class LeagueStandingsComponent implements OnInit {

  public standings: StandingsGroup[];

  public currentStandingsType: NhlStandingsTypeEnum = NhlStandingsTypeEnum.BY_LEAGUE;

  /** The filter buttons. Their types are the only ones the URL can select. */
  public readonly filters: StandingsTypeFilter[] = StandingsTypeUtils.filters;

  constructor(private activatedRoute: ActivatedRoute,
              private router: Router,
              private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService) {
  }

  /**
   * Loads the standings whenever the standingsType query parameter changes, including with the browser's back and
   * forward buttons. Without the parameter (or with an unknown one), it's the league standings.
   */
  public ngOnInit() {
    this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      const standingsType = StandingsTypeUtils.fromQueryParam(params.get("standingsType"));
      this.currentStandingsType = standingsType ?? NhlStandingsTypeEnum.BY_LEAGUE;
      this.updateStandings();
    });
  }

  /**
   * Shows another standings type. The type is a query parameter, so the standings are loaded by the query parameter
   * subscription rather than here.
   */
  public updateStandingsType(type: NhlStandingsTypeEnum): void {
    if (type === this.currentStandingsType) {
      return;
    }
    this.currentStandingsType = type;
    this.router.navigate([],
        {
          relativeTo: this.activatedRoute,
          queryParams: {standingsType: this.currentStandingsType},
        }
    );
  }

  private updateStandings(): void {
    const standingsType = this.currentStandingsType;
    this.nhlStandingAndPlayoffService.getNhlStandings(standingsType).then(result => {
      if (standingsType === this.currentStandingsType) {
        this.standings = result;
      }
    }).catch(() => {
      // The service logs the error. Show no standings rather than those of another standings type
      if (standingsType === this.currentStandingsType) {
        this.standings = undefined;
      }
    });
  }
}

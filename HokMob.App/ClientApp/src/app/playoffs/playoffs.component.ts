import {Component, OnInit} from '@angular/core';
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {PlayoffCarousel} from "@shared/models/nhl-web-api/playoffs.model";

// TODO: Playoffs page is not yet migrated to the new NHL API (see docs/nhl-api-migration-plan.md). It compiles against
//  the playoff carousel, which only lists series whose teams are known, so unset series in later rounds stay empty. Fix:
//  load playoff-bracket/{year} for the full bracket (seeds, TBD series, series titles) and pick the season instead of
//  hard-coding it.
@Component({
  selector: 'app-playoffs',
  templateUrl: './playoffs.component.html',
  styleUrls: ['./playoffs.component.scss']
})
export class PlayoffsComponent implements OnInit {

  public playoffSeason: string = "20222023";

  public playoffsData: PlayoffCarousel;

  constructor(private nhlPlayoffService: NhlStandingAndPlayoffService) {
  }

  public ngOnInit(): void {
    this.nhlPlayoffService.getNhlPlayoffs(this.playoffSeason).then(result => {
      this.playoffsData = result;
    })
  }
}

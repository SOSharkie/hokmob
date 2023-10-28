import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStatsSplitModel} from "@shared/models/nhl-stats/nhl-stats-split.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

@Component({
  selector: 'app-player-career',
  templateUrl: './player-career.component.html',
  styleUrls: ['./player-career.component.scss']
})
export class PlayerCareerComponent implements OnChanges {

  @Input()
  public careerRegularSeasonStats: NhlStatsSplitModel[];

  @Input()
  public isGoalie: boolean;

  @Input()
  public teamLogo: any;

  public careerTeamLogos: any[];

  public imagesLoaded: boolean = false;

  protected readonly DateTimeUtils = DateTimeUtils;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['careerRegularSeasonStats'] && this.careerRegularSeasonStats && this.careerRegularSeasonStats.length > 1 && !this.imagesLoaded) {
      this.careerTeamLogos = [];
      this.careerRegularSeasonStats.forEach((statSplit, index) => {
        this.careerTeamLogos[index] = NhlTeamLogoUtils.getTeamPrimaryLogo(statSplit.team.id);
      });
      this.imagesLoaded = true;
    }
  }
}

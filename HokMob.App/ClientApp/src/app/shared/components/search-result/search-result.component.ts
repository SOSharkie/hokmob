import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {SearchResultModel} from "@shared/models/search-result.model";
import {NhlImageService} from "@shared/services/nhl-image.service";

@Component({
  selector: 'app-search-result',
  templateUrl: './search-result.component.html',
  styleUrls: ['./search-result.component.scss']
})
export class SearchResultComponent implements OnChanges {

  @Input()
  public searchResult: SearchResultModel;

  public teamLogo: any;

  public playerHeadshot: any;

  constructor(private nhlImageService: NhlImageService) {
  }

  public ngOnChanges(changes: SimpleChanges) {
    if (changes['searchResult'] && this.searchResult) {
      if (this.searchResult.isPlayer) {
        this.loadPlayerImage();
      } else {
        this.loadTeamLogo();
      }
    }
  }

  public loadPlayerImage(): void {
    this.playerHeadshot = 'assets/blank_headshot.png';
    this.nhlImageService.getNhlPlayerHeadshot(Number(this.searchResult.playerId)).then(data => {
      let reader = new FileReader();
      reader.addEventListener("load", () => {
        this.playerHeadshot = reader.result;
      }, false);
      reader.readAsDataURL(data);
    });
  }

  public loadTeamLogo(): void {
    this.teamLogo = 'assets/nhl_logo.png';
    this.nhlImageService.getNhlTeamLogo(Number(this.searchResult.teamId)).then(data => {
      let reader = new FileReader();
      reader.addEventListener("load", () => {
        this.teamLogo = reader.result;
      }, false);
      reader.readAsDataURL(data);
    });
  }
}

import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {SearchResultModel} from "@shared/models/search-result.model";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {SearchResultTypeEnum} from "@shared/enums/search-result-type.enum";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

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

  public get isPlayer(): boolean {
    if (this.searchResult) {
      return this.searchResult.resultType === SearchResultTypeEnum.PLAYER;
    }
    return false;
  }
  public get isTeam(): boolean {
    if (this.searchResult) {
      return this.searchResult.resultType === SearchResultTypeEnum.TEAM;
    }
    return false;
  }

  constructor(private nhlImageService: NhlImageService) {
  }

  public ngOnChanges(changes: SimpleChanges) {
    if (changes['searchResult'] && this.searchResult) {
      if (this.isPlayer) {
        this.loadPlayerImage();
      } else if (this.isTeam) {
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
    this.teamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(Number(this.searchResult.teamId));
  }
}

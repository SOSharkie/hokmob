import {Component, Input} from '@angular/core';
import {SearchResultModel} from "@shared/models/search-result.model";
import {SearchResultTypeEnum} from "@shared/enums/search-result-type.enum";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";

/**
 * One header search result: a team with its logo, or a player with their headshot and position.
 */
@Component({
  selector: 'app-search-result',
  templateUrl: './search-result.component.html',
  styleUrls: ['./search-result.component.scss']
})
export class SearchResultComponent {

  @Input()
  public searchResult: SearchResultModel;

  public get isPlayer(): boolean {
    return this.searchResult?.resultType === SearchResultTypeEnum.PLAYER;
  }

  public get isTeam(): boolean {
    return this.searchResult?.resultType === SearchResultTypeEnum.TEAM;
  }

  /** A little wider than it is tall, so the widest crests keep roughly the visual weight of the square ones. */
  public readonly logoSize: number = 25;

  public readonly logoMaxWidth: number = 33;

  public get teamId(): number {
    return Number(this.searchResult?.teamId);
  }

  public get playerHeadshot(): string {
    return this.searchResult?.headshot || NhlPlayerHeadshotUtils.blankHeadshot;
  }

  /**
   * Replaces a headshot that failed to load with the blank headshot.
   */
  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }
}

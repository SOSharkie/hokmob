import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {NhlSearchService} from "@shared/services/nhl-search.service";
import {SearchResultModel} from "@shared/models/search-result.model";

/**
 * The header search box. Once the user stops typing, it shows the matching teams right away, then adds the players
 * the search proxy finds: teams first, 10 results in total.
 */
@Component({
  selector: 'app-search-input',
  templateUrl: './search-input.component.html',
  styleUrls: ['./search-input.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SearchInputComponent implements OnDestroy {

  public searchValue: string = "";

  public filterResults: SearchResultModel[] = [];

  public typingTimer: ReturnType<typeof setTimeout>;

  public readonly doneTypingInterval = 500;

  public readonly maxSearchItems = 10;

  public readonly minSearchLength = 2;

  /** The number of the latest search, so a response of an older search is ignored. */
  private searchCount = 0;

  constructor(private nhlSearchService: NhlSearchService) {
  }

  public ngOnDestroy(): void {
    clearTimeout(this.typingTimer);
  }

  /**
   * Waits 500ms after the last change (typing, pasting or clearing) before searching, to make sure the user is done
   * typing.
   */
  public onInput(): void {
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.searchNew(), this.doneTypingInterval);
  }

  /**
   * Searches for the current value. A failed player search keeps the team matches; the service logs the error.
   */
  public searchNew(): void {
    const query = this.searchValue?.trim() ?? "";
    const searchNumber = ++this.searchCount;
    if (query.length < this.minSearchLength) {
      this.filterResults = [];
      return;
    }
    const teams = this.nhlSearchService.searchTeams(query).slice(0, this.maxSearchItems);
    this.filterResults = teams;
    const playerLimit = this.maxSearchItems - teams.length;
    if (playerLimit === 0) {
      return;
    }
    this.nhlSearchService.searchPlayers(query, playerLimit).then(players => {
      if (searchNumber === this.searchCount) {
        this.filterResults = teams.concat(players.slice(0, playerLimit));
      }
    }).catch(() => {
      // The service logs the error. The team matches stay
    });
  }
}

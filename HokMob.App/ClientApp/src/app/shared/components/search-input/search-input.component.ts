import {Component, OnInit, ViewEncapsulation} from '@angular/core';
import {NhlSearchService} from "@shared/services/nhl-search.service";
import {SearchResultModel} from "@shared/models/search-result.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

@Component({
  selector: 'app-search-input',
  templateUrl: './search-input.component.html',
  styleUrls: ['./search-input.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SearchInputComponent implements OnInit {

  public searchValue: string = "";

  public searchResults: SearchResultModel[];

  public filterResults: SearchResultModel[];

  public typingTimer;

  public doneTypingInterval = 500;

  constructor(private nhlSearchService: NhlSearchService) {
  }

  public ngOnInit(): void {
    this.searchResults = [];
    this.nhlSearchService.getNhlTeams().then(result => {
      this.searchResults = this.searchResults.concat(result);
    });
    this.nhlSearchService.getNhlPlayers(DateTimeUtils.getCurrentNhlSeason()).then(result => {
      this.searchResults = this.searchResults.concat(result);
    });
  }

  /**
   * Wait half a second before searching to make sure user is done typing.
   */
  public onKeyUp() {
    clearTimeout(this.typingTimer);
    if (this.searchValue && this.searchValue.length > 1) {
      this.typingTimer = setTimeout(() => this.searchNew(), this.doneTypingInterval);
    }
  }

  public searchNew() {
    this.filterResults = this.searchResults.filter(value => value.displayValue.toLowerCase().includes(this.searchValue.toLowerCase()));
  }
}

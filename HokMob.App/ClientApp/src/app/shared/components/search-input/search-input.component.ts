import {Component, OnInit, ViewEncapsulation} from '@angular/core';
import {NhlSearchService} from "@shared/services/nhl-search.service";
import {Observable, of} from "rxjs";
import {SearchResultModel} from "@shared/models/search-result.model";

@Component({
  selector: 'app-search-input',
  templateUrl: './search-input.component.html',
  styleUrls: ['./search-input.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SearchInputComponent implements OnInit {

  public searchValue: string = "";

  public searchResults: SearchResultModel[] = [];

  public filterResults: Observable<SearchResultModel[]> = of(this.searchResults);

  constructor(private nhlSearchService: NhlSearchService) {
  }

  public ngOnInit(): void {

  }

  public search($event: Event) {
    this.nhlSearchService.searchNhlTeamsAndPlayers(this.searchValue).then(results => {
      if (this.newResultsHasNewItems(results)) {
        this.searchResults = results;
        this.filterResults = of(this.searchResults);
      }
    });
  }

  private newResultsHasNewItems(newResults: SearchResultModel[]) {
    let hasNewItems = false;
    newResults.forEach(result => {
      if(!this.searchResults.includes(result)) {
        hasNewItems = true;
      }
    });
    return hasNewItems;
  }
}

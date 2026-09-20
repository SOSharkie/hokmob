import {Component, ViewChild} from '@angular/core';
import {SearchInputComponent} from "@shared/components/search-input/search-input.component";
import {LocalEnvironmentUtils} from "@shared/utils/local-environment-utils";

/**
 * The site header. On desktop it shows the search box; on phones the search is behind an icon that swaps the bar's
 * content for the search box and a Cancel button.
 */
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {

  @ViewChild('searchInput') public searchInput: SearchInputComponent;

  /** Whether the Dev page link is shown. It only exists while the app is served locally. */
  public readonly isRunningLocally = LocalEnvironmentUtils.isRunningLocally();

  /** Whether the phone search is open. Desktop always shows the search box. */
  public isSearchOpen = false;

  /**
   * Opens the phone search and focuses its input once it is shown.
   */
  public openSearch(): void {
    this.isSearchOpen = true;
    setTimeout(() => this.searchInput?.focus());
  }

  /**
   * Closes the phone search and clears what was typed.
   */
  public closeSearch(): void {
    this.isSearchOpen = false;
    this.searchInput?.clear();
  }

  /**
   * Closes the phone search after a result is picked, since the page changes.
   */
  public onResultSelected(): void {
    this.isSearchOpen = false;
  }
}

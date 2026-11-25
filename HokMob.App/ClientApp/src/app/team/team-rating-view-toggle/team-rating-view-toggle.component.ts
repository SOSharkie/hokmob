import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TeamRatingCardView} from "@app/team/team-rating-card/team-rating-card.component";

/**
 * The segmented pill that switches a card between the power rating and the season stats, in the top right corner of
 * the card's header (which has to be `position: relative`), so the title stays centered: the team page's power rating
 * card (TeamRatingCardComponent) and a future game's team stats card (GamePowerRatingsComponent).
 *
 * Its labels (Rating, Stats) show only in a `power-rating` size container at least 500px wide, and its icons alone
 * below. Under 340px wide it gets smaller, for a compact card's shorter header.
 */
@Component({
    selector: 'app-team-rating-view-toggle',
    templateUrl: './team-rating-view-toggle.component.html',
    styleUrls: ['./team-rating-view-toggle.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamRatingViewToggleComponent {

  /** The view shown, which the toggle marks as selected. */
  @Input()
  public view: TeamRatingCardView = "power";

  @Output()
  public viewChange = new EventEmitter<TeamRatingCardView>();

  /**
   * Picks a view and tells the card, unless it's already shown.
   */
  public selectView(view: TeamRatingCardView): void {
    if (view === this.view) {
      return;
    }
    this.view = view;
    this.viewChange.emit(view);
  }
}

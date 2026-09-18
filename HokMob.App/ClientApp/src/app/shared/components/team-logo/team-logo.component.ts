import {Component, HostBinding, Input} from '@angular/core';
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

/**
 * A team logo in a fixed box.
 *
 * Team crests are anywhere from 0.83:1 (Ottawa) to 1.79:1 (Anaheim), so sizing one by height alone leaves every logo a
 * different width, and pinning both sides without object-fit stretches it. This keeps the box the same everywhere it is
 * used, which lines up logo columns and the text beside them, and fits the logo inside the box undistorted.
 *
 * Pass either a `teamId` or, for callers that are already handed a URL, a `src`.
 */
@Component({
  selector: 'app-team-logo',
  templateUrl: './team-logo.component.html',
  styleUrls: ['./team-logo.component.scss']
})
export class TeamLogoComponent {

  /**
   * The team to show. Ignored when `src` is set.
   */
  @Input()
  public teamId: number;

  /**
   * An already resolved logo URL, for callers handed one instead of a team ID.
   */
  @Input()
  public src: string;

  /**
   * The box height in px, which is what most logos end up being sized by.
   */
  @Input()
  public size: number = 32;

  /**
   * The box width in px. Defaults to `size`, i.e. a square box. Set it wider than `size` to keep the wide crests close
   * to the visual weight of the square ones, and only cap the extremes.
   */
  @Input()
  public width: number;

  @Input()
  public alt: string = "";

  @HostBinding("style.width.px")
  public get boxWidth(): number {
    return this.width ?? this.size;
  }

  @HostBinding("style.height.px")
  public get boxHeight(): number {
    return this.size;
  }

  /**
   * The URL to render, or nothing when the team is still unknown (a TBD playoff seed), which leaves an empty box of the
   * same size so the layout does not jump once the team is decided.
   */
  public get logoSrc(): string {
    if (this.src) {
      return this.src;
    }
    return this.teamId != null ? NhlTeamLogoUtils.getTeamPrimaryLogo(this.teamId) : null;
  }
}

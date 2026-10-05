import {Component, HostBinding, Input} from '@angular/core';

/**
 * The loading spinner: a green arc that sweeps around a faint track. It is an inline SVG drawn with CSS, so it stays
 * sharp at any size and pixel density.
 */
@Component({
  selector: 'app-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['./loading-spinner.component.scss'],
  host: {
    'role': 'progressbar',
    'aria-label': 'Loading'
  }
})
export class LoadingSpinnerComponent {

  /**
   * The spinner's width and height in px.
   */
  @Input()
  public size: number = 56;

  @HostBinding("style.width.px")
  @HostBinding("style.height.px")
  public get boxSize(): number {
    return this.size;
  }
}

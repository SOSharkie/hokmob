import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class FooterComponent {

  /** The copyright year, which is the current year so it never goes out of date. */
  public readonly currentYear: number = new Date().getFullYear();
}

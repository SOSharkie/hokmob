import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { LUCIDE_ICONS } from '@shared/icons/lucide-icons';
import { firstValueFrom } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppTestingModule
      ],
      declarations: [
        AppComponent
      ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'hokmob'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('hokmob');
  });

  it('should render the mobile menu', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#games-item')?.textContent).toContain('Games');
  });

  it('should register the Lucide icons used by the menus', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const iconRegistry = TestBed.inject(MatIconRegistry);
    const mobileIcons = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.mobile-menu mat-icon'))
      .map(icon => icon.getAttribute('svgIcon'));

    expect(mobileIcons).toEqual(['lucide:calendar-days', 'lucide:list-ordered', 'lucide:chart-no-axes-column']);
    for (const name of Object.keys(LUCIDE_ICONS)) {
      const svg = await firstValueFrom(iconRegistry.getNamedSvgIcon(name, 'lucide'));
      expect(svg.getAttribute('viewBox')).withContext(name).toBe('0 0 24 24');
    }
  });
});

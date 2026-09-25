import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { LUCIDE_ICONS } from '@shared/icons/lucide-icons';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ScrollDirectionService } from '@shared/services/scroll-direction.service';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let scrollingUp: BehaviorSubject<boolean>;

  beforeEach(async () => {
    scrollingUp = new BehaviorSubject<boolean>(true);
    await TestBed.configureTestingModule({
      imports: [
        AppTestingModule
      ],
      declarations: [
        AppComponent
      ],
      providers: [
        {provide: ScrollDirectionService, useValue: {scrollingUp$: scrollingUp.asObservable()}}
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

  it('should link the History page as the mobile menu\'s 4th item, and select it there', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const items = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.mobile-menu .menu-item'));
    expect(items.map(item => item.textContent.trim())).toEqual(['Games', 'Standings', 'Stats', 'History']);

    const history = fixture.nativeElement.querySelector('#history-item') as HTMLElement;
    expect(history.classList).not.toContain('selected');
    fixture.componentInstance.menuUrl = '/history';
    fixture.detectChanges();
    expect(history.classList).toContain('selected');
  });

  it('should hide the mobile menu while the page scrolls down, and bring it back on the way up', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('.mobile-menu') as HTMLElement;
    expect(fixture.componentInstance.isMobileMenuShown).toBeTrue();
    expect(menu.classList).not.toContain('hidden');

    scrollingUp.next(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.isMobileMenuShown).toBeFalse();
    expect(menu.classList).toContain('hidden');

    scrollingUp.next(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.isMobileMenuShown).toBeTrue();
    expect(menu.classList).not.toContain('hidden');
  });

  it('should stop listening to the scroll direction when it is destroyed', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    fixture.destroy();

    scrollingUp.next(false);
    expect(fixture.componentInstance.isMobileMenuShown).toBeTrue();
  });

  it('should register the Lucide icons used by the menus', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const iconRegistry = TestBed.inject(MatIconRegistry);
    const mobileIcons = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.mobile-menu mat-icon'))
      .map(icon => icon.getAttribute('svgIcon'));

    expect(mobileIcons).toEqual(['lucide:calendar-days', 'lucide:list-ordered', 'lucide:chart-no-axes-column',
      'lucide:history']);
    for (const name of Object.keys(LUCIDE_ICONS)) {
      const svg = await firstValueFrom(iconRegistry.getNamedSvgIcon(name, 'lucide'));
      expect(svg.getAttribute('viewBox')).withContext(name).toBe('0 0 24 24');
    }
  });
});

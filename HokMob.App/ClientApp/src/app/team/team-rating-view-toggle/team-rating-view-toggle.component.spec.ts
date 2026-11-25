import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { TeamRatingCardView } from '@app/team/team-rating-card/team-rating-card.component';

import { TeamRatingViewToggleComponent } from './team-rating-view-toggle.component';

describe('TeamRatingViewToggleComponent', () => {
  let component: TeamRatingViewToggleComponent;
  let fixture: ComponentFixture<TeamRatingViewToggleComponent>;
  let views: TeamRatingCardView[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamRatingViewToggleComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamRatingViewToggleComponent);
    component = fixture.componentInstance;
    views = [];
    component.viewChange.subscribe(view => views.push(view));
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(view?: TeamRatingCardView): void {
    if (view) {
      fixture.componentRef.setInput('view', view);
    }
    fixture.detectChanges();
  }

  function option(title: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.toggle-option[title="' + title + '"]');
  }

  it('should mark the power rating as selected by default', () => {
    show();
    expect(option('Power rating').getAttribute('aria-pressed')).toBe('true');
    expect(option('Power rating').classList).toContain('selected');
    expect(option('Season stats').getAttribute('aria-pressed')).toBe('false');
  });

  it('should mark the view it\'s given', () => {
    show('stats');
    expect(option('Season stats').getAttribute('aria-pressed')).toBe('true');
    expect(option('Power rating').getAttribute('aria-pressed')).toBe('false');
  });

  it('should switch views and tell the card', () => {
    show();
    option('Season stats').click();
    fixture.detectChanges();
    expect(option('Season stats').classList).toContain('selected');
    option('Power rating').click();
    expect(views).toEqual(['stats', 'power']);
  });

  it('should not tell the card about the view already shown', () => {
    show('stats');
    option('Season stats').click();
    expect(views).toEqual([]);
  });

  it('should label each option, for a screen reader when only the icons show', () => {
    show();
    const labels = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.view-label'))
        .map(label => label.textContent.trim());
    expect(labels).toEqual(['Rating', 'Stats']);
    expect(fixture.nativeElement.querySelector('.card-view-toggle').getAttribute('role')).toBe('group');
  });

  it('should sit in the top right corner of the header around it', () => {
    show();
    const style = getComputedStyle(fixture.nativeElement);
    expect(style.position).toBe('absolute');
    expect(style.right).toBe('0px');
  });
});

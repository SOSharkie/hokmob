import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';

import { SkeletonCardComponent, SkeletonCardLayout, SkeletonRowShape } from './skeleton-card.component';

describe('SkeletonCardComponent', () => {
  let component: SkeletonCardComponent;
  let fixture: ComponentFixture<SkeletonCardComponent>;
  /** Whether the fake window is at or below the card's breakpoint. */
  let narrow: boolean;
  /** The media queries the card asked for, and the listener it gave each. */
  let queries: {media: string, listener: () => void, removed: boolean}[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ SkeletonCardComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    narrow = false;
    queries = [];
    spyOn(window, 'matchMedia').and.callFake((media: string) => {
      const query = {media, listener: null, removed: false};
      queries.push(query);
      return {
        media,
        get matches() {
          return narrow;
        },
        addEventListener: (type: string, listener: () => void) => query.listener = listener,
        removeEventListener: () => query.removed = true,
        // The older API, which other code in the page still uses
        addListener: () => {},
        removeListener: () => {}
      } as any;
    });
    fixture = TestBed.createComponent(SkeletonCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(inputs: {cardTitle?: string, shape?: SkeletonRowShape, layout?: SkeletonCardLayout,
                         mobileLayout?: SkeletonCardLayout, mobileBreakpoint?: number}): void {
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
  }

  function all(selector: string): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector));
  }

  function child(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector);
  }

  it('should show 5 table rows of 40px under a 40px title placeholder by default', () => {
    show({});
    const rows = all('.skeleton-row');
    expect(rows.length).toBe(5);
    expect(rows.every(row => row.style.height === '40px')).toBeTrue();
    expect(child('.skeleton-header').style.height).toBe('40px');
    expect(child('.skeleton-title-block')).not.toBeNull();
    expect(child('.skeleton-title')).toBeNull();
    expect(child('.skeleton-card').classList).toContain('shape-table');
  });

  it('should show the real title when it\'s known, and name it for screen readers', () => {
    show({cardTitle: 'Team Form'});
    expect(fixture.nativeElement.getAttribute('title')).toBeNull();
    expect(child('.skeleton-title').textContent.trim()).toBe('Team Form');
    expect(child('.skeleton-title-block')).toBeNull();
    expect(fixture.nativeElement.getAttribute('role')).toBe('status');
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Loading Team Form');
    // The blocks are only for the eye
    expect(child('.skeleton-card').getAttribute('aria-hidden')).toBe('true');
  });

  it('should say only "Loading" without a title', () => {
    show({});
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Loading');
  });

  it('should size the card from its layout', () => {
    show({layout: {rows: 16, rowHeight: 36, columns: 9, headerHeight: 39, tableHeaderHeight: 48, paddingBottom: 16}});
    expect(all('.skeleton-row:not(.skeleton-table-header)').length).toBe(16);
    expect(all('.skeleton-row:not(.skeleton-table-header)')[0].style.height).toBe('36px');
    expect(child('.skeleton-header').style.height).toBe('39px');
    expect(child('.skeleton-table-header').style.height).toBe('48px');
    expect(child('.skeleton-card').style.paddingBottom).toBe('16px');
    // A cell per column in the column names and in each row, the first one with a logo
    expect(child('.skeleton-table-header').querySelectorAll('.skeleton-cell').length).toBe(9);
    const firstRow = all('.skeleton-row:not(.skeleton-table-header)')[0];
    expect(firstRow.querySelectorAll('.skeleton-cell').length).toBe(9);
    expect(firstRow.querySelectorAll('.skeleton-logo').length).toBe(1);
  });

  it('should leave out the title and the column names when their height is 0', () => {
    show({layout: {headerHeight: 0, tableHeaderHeight: 0}});
    expect(child('.skeleton-header')).toBeNull();
    expect(child('.skeleton-table-header')).toBeNull();
  });

  it('should keep the defaults for the fields a layout leaves unset', () => {
    show({layout: {rows: 2, rowHeight: undefined, columns: null}});
    expect(component.current).toEqual({...SkeletonCardComponent.defaultLayout, rows: 2});
  });

  it('should draw a game in each row of the game shape: two teams either side of the score', () => {
    show({shape: 'game', layout: {rows: 1, rowHeight: 93}});
    const row = child('.skeleton-row');
    expect(row.querySelectorAll('.skeleton-team').length).toBe(2);
    expect(row.querySelectorAll('.skeleton-logo').length).toBe(2);
    expect(row.querySelectorAll('.skeleton-score').length).toBe(1);
  });

  it('should draw a stat\'s name, value, rank and bar in each row of the bar shape', () => {
    show({shape: 'bar', layout: {rows: 8, rowHeight: 48}});
    expect(all('.skeleton-row').length).toBe(8);
    const row = child('.skeleton-row');
    ['.skeleton-label', '.skeleton-value', '.skeleton-rank', '.skeleton-track']
        .forEach(selector => expect(row.querySelector(selector)).withContext(selector).not.toBeNull());
  });

  it('should draw a tile per column in each row of the tiles shape', () => {
    show({shape: 'tiles', layout: {rows: 2, rowHeight: 122, columns: 4}});
    expect(all('.skeleton-row').length).toBe(2);
    expect(child('.skeleton-row').querySelectorAll('.skeleton-tile').length).toBe(4);
  });

  it('should take the phone layout\'s fields at and below the breakpoint', () => {
    narrow = true;
    show({
      layout: {rows: 10, rowHeight: 70.9, columns: 10, tableHeaderHeight: 49},
      mobileLayout: {rowHeight: 42.9, columns: 6, tableHeaderHeight: 28},
      mobileBreakpoint: 950
    });
    expect(queries[queries.length - 1].media).toBe('(max-width: 950px)');
    // The rows stay, the rest is the phone's
    expect(component.current.rows).toBe(10);
    expect(all('.skeleton-row:not(.skeleton-table-header)')[0].style.height).toBe('42.9px');
    expect(child('.skeleton-table-header').style.height).toBe('28px');
    expect(child('.skeleton-table-header').querySelectorAll('.skeleton-cell').length).toBe(6);
  });

  it('should switch layouts when the window crosses the breakpoint, and stop following it when destroyed', () => {
    show({layout: {rowHeight: 69}, mobileLayout: {rowHeight: 77}});
    const query = queries[queries.length - 1];
    expect(query.media).toBe('(max-width: 700px)');
    expect(child('.skeleton-row').style.height).toBe('69px');

    narrow = true;
    query.listener();
    fixture.detectChanges();
    expect(child('.skeleton-row').style.height).toBe('77px');

    narrow = false;
    query.listener();
    fixture.detectChanges();
    expect(child('.skeleton-row').style.height).toBe('69px');

    fixture.destroy();
    expect(query.removed).toBeTrue();
  });

  it('should show a headline of a badge and two lines under the title, with its height', () => {
    show({shape: 'bar', layout: {summaryHeight: 70, rows: 6}});
    const summary = child('.skeleton-summary');
    expect(summary.style.height).toBe('70px');
    expect(summary.querySelectorAll('.skeleton-badge').length).toBe(1);
    expect(summary.querySelectorAll('.skeleton-summary-line').length).toBe(2);
    // Between the title and the rows
    expect(summary.previousElementSibling.classList).toContain('skeleton-header');
    expect(summary.nextElementSibling.classList).toContain('skeleton-row');
  });

  it('should show no headline by default', () => {
    show({});
    expect(child('.skeleton-summary')).toBeNull();
  });

  it('should draw a large area per row of the block shape, under a toggle per column', () => {
    show({shape: 'block', layout: {rows: 1, rowHeight: 351, columns: 10, tableHeaderHeight: 36}});
    expect(child('.skeleton-table-header').querySelectorAll('.skeleton-pill').length).toBe(10);
    expect(child('.skeleton-table-header').querySelectorAll('.skeleton-cell').length).toBe(0);
    const rows = all('.skeleton-row:not(.skeleton-table-header)');
    expect(rows.length).toBe(1);
    expect(rows[0].style.height).toBe('351px');
    expect(rows[0].querySelectorAll('.skeleton-area').length).toBe(1);
  });

  it('should show no rows for a layout of none', () => {
    show({layout: {rows: 0}});
    expect(all('.skeleton-row').length).toBe(0);
    expect(child('.skeleton-header')).not.toBeNull();
  });
});

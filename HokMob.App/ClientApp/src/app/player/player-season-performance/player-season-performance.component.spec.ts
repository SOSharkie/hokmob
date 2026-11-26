import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {AppTestingModule} from '@shared/testing/app-testing.module';
import {
  mockEdgeGoalieDetail,
  mockEdgeSkaterDetail,
  mockLeagueGoalies,
  mockLeaguePlayerRows,
  mockLeagueSkaters,
  mockNstPlayerRows
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import {PlayerSeasonPerformanceComponent} from './player-season-performance.component';

describe('PlayerSeasonPerformanceComponent', () => {
  let component: PlayerSeasonPerformanceComponent;
  let fixture: ComponentFixture<PlayerSeasonPerformanceComponent>;

  // Leon Draisaitl, a forward with 26 games of the captured 2026-27 season, where 32 forwards have the 7 games it takes
  const draisaitl = 8477934;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppTestingModule],
      declarations: [PlayerSeasonPerformanceComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerSeasonPerformanceComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  function showSkater(playerId: number = draisaitl, withNst: boolean = true, withEdge: boolean = true): void {
    fixture.componentRef.setInput('playerId', playerId);
    fixture.componentRef.setInput('leaguePlayers', mockLeaguePlayerRows(mockLeagueSkaters()));
    fixture.componentRef.setInput('nstPlayers', withNst ? mockNstPlayerRows() : undefined);
    fixture.componentRef.setInput('edge', withEdge ? mockEdgeSkaterDetail() : undefined);
    fixture.componentRef.setInput('season', 20262027);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  function text(selector: string): string {
    return element().querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  function rowText(label: string): string[] {
    const row = Array.from(element().querySelectorAll('.rating-part'))
        .find(item => item.querySelector('.part-name').textContent.trim() === label);
    return row ? [row.querySelector('.part-value').textContent.trim(), row.querySelector('.part-rank').textContent.trim()] :
        undefined;
  }

  function columnTitles(index: number): string[] {
    return Array.from(element().querySelectorAll('.performance-column')[index].querySelectorAll('.rating-group-title'))
        .map(title => title.textContent.replace(/\s+/g, ' ').trim());
  }

  function modeButton(label: string): HTMLButtonElement {
    return Array.from(element().querySelectorAll<HTMLButtonElement>('.performance-modes .toggle-option'))
        .find(button => button.textContent.trim() === label);
  }

  it('should show a skater\'s season in two columns of groups, with his games and ice time', () => {
    showSkater();
    expect(text('.rating-bar-card-title')).toBe('Season Performance');
    expect(text('.performance-games')).toBe('26 games · 22:00 per game');
    expect(columnTitles(0)).toEqual(['Scoring', 'Shooting', 'Possession']);
    expect(columnTitles(1)).toEqual(['Defense and physical', 'Discipline', 'Usage', 'Skating NHL EDGE']);
    expect(rowText('Goals')).toEqual(['23', '1st']);
    expect(rowText('Faceoffs')).toEqual(['57.2%', '2nd']);
    expect(rowText('Top speed')).toEqual(['22.3 mph', '66%']);
  });

  it('should color a rank\'s pill and bar by its tier, and size the bar by the percentile', () => {
    showSkater();
    const goals = Array.from(element().querySelectorAll('.rating-part'))
        .find(item => item.querySelector('.part-name').textContent.trim() === 'Goals');
    expect(goals.querySelector('.part-rank').classList).toContain('rank-elite');
    expect(goals.querySelector('.part-bar-fill').classList).toContain('rank-elite');
    expect((goals.querySelector('.part-bar-fill') as HTMLElement).style.width).toBe(31.5 / 32 * 100 + '%');
    expect(goals.getAttribute('title')).toBe('Goals. 1st of 32 forwards with 7+ games');
  });

  it('should switch the counting stats to per 60 and back, and rerank them', () => {
    showSkater();
    expect(modeButton('Total').getAttribute('aria-pressed')).toBe('true');
    const corsi = rowText('5v5 Corsi For %');
    modeButton('Per 60').click();
    fixture.detectChanges();
    expect(modeButton('Per 60').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton('Total').getAttribute('aria-pressed')).toBe('false');
    expect(rowText('Goals')).toEqual(['2.41', '2nd']);
    // Shares stay as they are
    expect(rowText('5v5 Corsi For %')).toEqual(corsi);
    expect(rowText('5v5 xGF%')).toEqual(['55.5%', '12th']);
    expect(text('.rating-bar-card-note')).toContain('Counting stats per 60 minutes on the ice.');

    modeButton('Total').click();
    fixture.detectChanges();
    expect(rowText('Goals')).toEqual(['23', '1st']);
  });

  it('should keep the mode when the data changes', () => {
    showSkater();
    component.selectMode('per60');
    fixture.componentRef.setInput('nstPlayers', undefined);
    fixture.detectChanges();
    expect(rowText('Goals')).toEqual(['2.41', '2nd']);
  });

  it('should credit Natural Stat Trick with a link to its page of the season', () => {
    showSkater();
    const link = element().querySelector<HTMLAnchorElement>('.performance-source');
    expect(link.textContent).toContain('Natural Stat Trick');
    expect(link.href).toContain('naturalstattrick.com/playerteams.php?fromseason=20262027&thruseason=20262027');
    expect(link.textContent).toContain('xGF%');
    expect(rowText('Expected goals')).toEqual(['13.6', '2nd']);
    expect(rowText('5v5 xGF%')).toEqual(['55.5%', '12th']);
    expect(text('.rating-bar-card-note')).toContain('Ranks among the 32 forwards with 7+ games in 2026-2027.');
  });

  it('should show the NHL\'s stats alone, with no credit, when NST fails', () => {
    showSkater(draisaitl, false);
    expect(element().querySelector('.performance-source')).toBeNull();
    expect(rowText('Expected goals')).toBeUndefined();
    expect(rowText('Hits taken')).toBeUndefined();
    expect(rowText('5v5 xGF%')).toBeUndefined();
    expect(rowText('Goals')).toEqual(['23', '1st']);
  });

  it('should leave the EDGE stats out without them, like a season before EDGE', () => {
    showSkater(draisaitl, true, false);
    expect(columnTitles(1)).toEqual(['Defense and physical', 'Discipline', 'Usage']);
    expect(rowText('Offensive zone time')).toBeUndefined();
    expect(text('.rating-bar-card-note')).not.toContain('NHL EDGE');
  });

  it('should note a small sample for a player under the minimum games', () => {
    showSkater(8476480);
    expect(text('.performance-small-sample'))
        .toBe('Only 6 games, small sample: ranked against the forwards with 7+ games');
  });

  it('should have no small sample note for a player with enough games', () => {
    showSkater();
    expect(element().querySelector('.performance-small-sample')).toBeNull();
  });

  it('should show a goalie\'s groups and starts, without the per 60 toggle', () => {
    fixture.componentRef.setInput('playerId', 8476945);
    fixture.componentRef.setInput('leaguePlayers', mockLeaguePlayerRows(mockLeagueGoalies()));
    fixture.componentRef.setInput('edge', mockEdgeGoalieDetail());
    fixture.componentRef.setInput('season', 20262027);
    fixture.componentRef.setInput('isGoalie', true);
    fixture.detectChanges();
    expect(text('.performance-games')).toBe('10 games · 10 starts');
    expect(element().querySelector('.performance-modes')).toBeNull();
    expect(columnTitles(0)).toEqual(['Goaltending', 'By strength']);
    expect(columnTitles(1)).toEqual(['Workload', 'Tracking NHL EDGE']);
    expect(rowText('Goals against average')).toEqual(['2.71', '6th']);
    expect(rowText('High danger save %')).toEqual(['.815', '65%']);
  });

  it('should show nothing for a player without a row in the season', () => {
    showSkater(1);
    expect(component.performance).toBeUndefined();
    expect(element().querySelector('section')).toBeNull();
  });

  describe('while loading', () => {
    it('should show a skater\'s skeleton at the card\'s size, a phone\'s too', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      const skeleton = element().querySelector('app-skeleton-card') as any;
      expect(skeleton.getAttribute('shape')).toBe('bar');
      expect(skeleton.cardTitle).toBe('Season Performance');
      // 17 rows in the taller column, under its 3 group titles
      expect(skeleton.layout.rows).toBe(17);
      expect(skeleton.layout.rows * skeleton.layout.rowHeight).toBe(17 * 43 + 22 + 2 * 46);
      expect(skeleton.mobileLayout.rows).toBe(32);
      expect(element().querySelector('section')).toBeNull();
    });

    it('should size a goalie\'s skeleton for his fewer rows', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.componentRef.setInput('isGoalie', true);
      fixture.detectChanges();
      const skeleton = element().querySelector('app-skeleton-card') as any;
      expect(skeleton.layout.rows).toBe(6);
      expect(skeleton.mobileLayout.rows).toBe(11);
    });
  });
});

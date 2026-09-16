import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import {
  GoalieSeasonStats,
  SkaterSeasonStats
} from '@shared/models/nhl-stats-api/player-stats.model';
import { mockPlayerStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayerStatsComponent } from './player-stats.component';

describe('PlayerStatsComponent', () => {
  let component: PlayerStatsComponent;
  let fixture: ComponentFixture<PlayerStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayerStatsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerStatsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(stats: SkaterSeasonStats | GoalieSeasonStats, isGoalie: boolean, statTitle: string = 'Stats'): void {
    fixture.componentRef.setInput('statTitle', statTitle);
    fixture.componentRef.setInput('stats', stats);
    fixture.componentRef.setInput('isGoalie', isGoalie);
    fixture.componentRef.setInput('teamColor', '#B4975A');
    fixture.detectChanges();
  }

  /** The stats grid as [title, value]. */
  function items(): string[][] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.stats-item')).map(item => [
      item.querySelector('.item-title').textContent.trim(),
      item.querySelector('.item-value').textContent.trim()
    ]);
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  it('should show the real regular season stats of a skater', () => {
    const season = mockPlayerStats(8477964).regularSeasons[0] as SkaterSeasonStats;
    show(season, false, '2025-2026 NHL Regular Season Stats');
    expect(text('.stats-header')).toBe('2025-2026 NHL Regular Season Stats');
    expect(items()).toEqual([
      ['Goals', '23'],
      ['Assists', '38'],
      ['Points', '61'],
      ['Games', '82'],
      ['+/-', '20'],
      ['Faceoff %', '24.1%'],
      ['Shots', '133'],
      ['Hits', '137']
    ]);
  });

  it('should show the real playoff stats of a skater', () => {
    const season = mockPlayerStats(8477964).playoffSeasons[0] as SkaterSeasonStats;
    show(season, false, '2026 NHL Playoffs Stats');
    expect(items()).toEqual([
      ['Goals', '6'],
      ['Assists', '8'],
      ['Points', '14'],
      ['Games', '22'],
      ['+/-', '0'],
      ['Faceoff %', '50.0%'],
      ['Shots', '38'],
      ['Hits', '110']
    ]);
  });

  it('should show a dash for a skater who took no faceoffs', () => {
    const season = mockPlayerStats(8477964).regularSeasons[0] as SkaterSeasonStats;
    season.faceoffWinPct = null;
    show(season, false);
    expect(items()[5]).toEqual(['Faceoff %', '-']);
  });

  it('should show the real stats of a goalie', () => {
    const season = mockPlayerStats(8476945).regularSeasons[0] as GoalieSeasonStats;
    show(season, true, '2025-2026 NHL Regular Season Stats');
    expect(items()).toEqual([
      ['Save %', '.895'],
      ['GAA', '2.86'],
      ['Shutouts', '0'],
      ['Shots Against', '1547'],
      ['Starts', '57'],
      ['Wins', '23'],
      ['Losses', '23'],
      ['OT Losses', '11']
    ]);
  });
});

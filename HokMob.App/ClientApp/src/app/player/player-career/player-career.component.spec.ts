import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import {
  GoalieSeasonStats,
  SkaterSeasonStats
} from '@shared/models/nhl-stats-api/player-stats.model';
import { mockPlayerStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayerCareerComponent } from './player-career.component';

describe('PlayerCareerComponent', () => {
  let component: PlayerCareerComponent;
  let fixture: ComponentFixture<PlayerCareerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayerCareerComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerCareerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(seasons: SkaterSeasonStats[] | GoalieSeasonStats[], isGoalie: boolean): void {
    fixture.componentRef.setInput('seasons', seasons);
    fixture.componentRef.setInput('isGoalie', isGoalie);
    fixture.detectChanges();
  }

  /** A season row as [season, ...stat cells]. */
  function row(index: number): string[] {
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.career-season-row'));
    return [rows[index].querySelector('.season-name').textContent.trim(),
      ...Array.from<Element>(rows[index].querySelectorAll('.stat-cell')).map(cell => cell.textContent.trim())];
  }

  /** The team logos of a season row. */
  function logos(index: number): string[] {
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.career-season-row'));
    return Array.from<Element>(rows[index].querySelectorAll('.player-team-logo'))
        .map(logo => logo.getAttribute('src'));
  }

  function headers(): string[] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.player-seasons-header th'))
        .map(header => header.textContent.trim());
  }

  it('should show the real NHL seasons of a skater, newest first', () => {
    const seasons = mockPlayerStats(8477496).regularSeasons as SkaterSeasonStats[];
    show(seasons, false);
    expect(fixture.nativeElement.querySelectorAll('.career-season-row').length).toBe(13);
    expect(headers()).toEqual(['Season', 'Games Played', 'Goals', 'Assists', 'Points']);
    // Lindholm's 2025-26 with Boston, and his first season with Carolina
    expect(row(0)).toEqual(['2025-2026', '69', '17', '31', '48']);
    expect(logos(0)).toEqual(['assets/logos/boston.png']);
    expect(row(12)).toEqual(['2013-2014', '58', '9', '12', '21']);
    expect(logos(12)).toEqual(['assets/logos/carolina.png']);
  });

  it('should show one logo per team of a traded season', () => {
    const seasons = mockPlayerStats(8477496).regularSeasons as SkaterSeasonStats[];
    show(seasons, false);
    const tradedSeason = seasons.findIndex(season => season.seasonId === 20232024);
    expect(row(tradedSeason)).toEqual(['2023-2024', '75', '15', '29', '44']);
    expect(logos(tradedSeason)).toEqual(['assets/logos/calgary.png', 'assets/logos/vancouver.png']);
  });

  it('should show the fallback logo for a team the utils do not know', () => {
    const seasons = mockPlayerStats(8477496).regularSeasons as SkaterSeasonStats[];
    seasons[0].teamAbbrevs = 'ATL,PHX';
    show(seasons, false);
    expect(logos(0)).toEqual(['assets/logos/team_fallback.png', 'assets/logos/team_fallback.png']);
  });

  it('should show the goalie columns of a real goalie', () => {
    const seasons = mockPlayerStats(8476945).regularSeasons as GoalieSeasonStats[];
    show(seasons, true);
    expect(headers()).toEqual(['Season', 'Games Played', 'Shutouts', 'GAA', 'SV %']);
    expect(row(0)).toEqual(['2025-2026', '57', '0', '2.86', '.895']);
    expect(logos(0)).toEqual(['assets/logos/winnipeg.png']);
  });

  it('should show no rows for a player without NHL seasons', () => {
    show([], false);
    expect(fixture.nativeElement.querySelectorAll('.career-season-row').length).toBe(0);
  });
});

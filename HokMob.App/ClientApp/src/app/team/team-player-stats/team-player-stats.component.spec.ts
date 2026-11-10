import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { SeasonHistoryService } from '@shared/services/season-history.service';
import { SeasonHistory } from '@shared/models/nhl-history/season-history.model';
import { PlayerSeasonRatingUtils } from '@shared/utils/player-season-rating-utils';
import {
  derivedSeasonHistoryInProgress,
  mockSeasonHistory,
  mockTeamPlayers
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { TeamPlayerStatsComponent } from './team-player-stats.component';

describe('TeamPlayerStatsComponent', () => {
  let component: TeamPlayerStatsComponent;
  let fixture: ComponentFixture<TeamPlayerStatsComponent>;
  let httpMock: HttpTestingController;

  const statsUrl = '/api/nhl-stats/team-players?teamId=6&season=20252026&gameType=2';
  const historyUrl = 'assets/history/20252026-2.json';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamPlayerStatsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamPlayerStatsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function setInputs(teamId: number, season: number): void {
    fixture.componentRef.setInput('teamId', teamId);
    fixture.componentRef.setInput('season', season);
    fixture.detectChanges();
  }

  /** Opens Boston's 2025-26 stats and answers with the real responses and the history fixture. */
  async function openBoston(history: SeasonHistory = mockSeasonHistory()): Promise<void> {
    setInputs(6, 20252026);
    httpMock.expectOne(statsUrl).flush(mockTeamPlayers());
    httpMock.expectOne(historyUrl).flush(history);
    await settle();
  }

  function card(tableId: string): HTMLElement {
    return fixture.nativeElement.querySelector('.' + tableId + '-table-card');
  }

  function headers(tableId: string): string[] {
    return Array.from(card(tableId).querySelectorAll('thead th'))
        .map((header: Element) => header.textContent.trim());
  }

  function names(tableId: string): string[] {
    return Array.from(card(tableId).querySelectorAll('.player-name'))
        .map((name: Element) => name.textContent.trim());
  }

  function cell(tableId: string, playerName: string, columnId: string): string {
    const row = Array.from(card(tableId).querySelectorAll('tbody tr'))
        .find((tableRow: Element) => tableRow.querySelector('.player-name').textContent.trim() === playerName);
    return row.querySelector('.' + columnId + '-column').textContent.trim();
  }

  function sortButton(tableId: string, label: string): HTMLButtonElement {
    return Array.from(card(tableId).querySelectorAll('.sort-button'))
        .find((button: Element) => button.textContent.trim() === label) as HTMLButtonElement;
  }

  it('should load nothing until it has a season', () => {
    fixture.componentRef.setInput('teamId', 6);
    fixture.detectChanges();
    httpMock.expectNone(() => true);
    expect(component.isLoading).toBeFalse();
  });

  it('should list the real skaters, most points first', async () => {
    await openBoston();
    expect(names('skaters').length).toBe(32);
    expect(names('skaters').slice(0, 3)).toEqual(['David Pastrnak', 'Morgan Geekie', 'Pavel Zacha']);
    expect(headers('skaters')).toEqual(['Player', 'GP', 'G', 'A', 'P', '+/-', 'S', 'HIT', 'FO%', 'Rating', 'CF%']);
    expect(cell('skaters', 'David Pastrnak', 'gp')).toBe('77');
    expect(cell('skaters', 'David Pastrnak', 'g')).toBe('29');
    expect(cell('skaters', 'David Pastrnak', 'a')).toBe('71');
    expect(cell('skaters', 'David Pastrnak', 'p')).toBe('100');
    expect(cell('skaters', 'David Pastrnak', 'hits')).toBe('86');
    expect(cell('skaters', 'David Pastrnak', 'fo')).toBe('22.2%');
    expect(card('skaters').querySelector('.table-season').textContent.trim()).toBe('2025-2026 Regular Season');
  });

  it('should show a dash for a skater who took no faceoffs', async () => {
    await openBoston();
    expect(cell('skaters', 'Charlie McAvoy', 'fo')).toBe('-');
  });

  it('should show a position and a headshot of the team and season', async () => {
    await openBoston();
    const firstRow = card('skaters').querySelector('tbody tr');
    expect(firstRow.querySelector('.player-position').textContent.trim()).toBe('RW');
    expect(firstRow.querySelector('img').getAttribute('src'))
        .toBe('https://assets.nhle.com/mugs/nhl/20252026/BOS/8477956.png');
    expect(firstRow.querySelector('.player-link').getAttribute('href')).toBe('/player/8477956');
    expect(cell('skaters', 'Charlie McAvoy', 'gp')).toBe('69');
    expect(Array.from(card('skaters').querySelectorAll('tbody tr'))
        .find((row: Element) => row.textContent.includes('Charlie McAvoy'))
        .querySelector('.player-position').textContent.trim()).toBe('D');
  });

  it('should list the real goalies, most starts first', async () => {
    await openBoston();
    expect(names('goalies')).toEqual(['Jeremy Swayman', 'Joonas Korpisalo', 'Michael DiPietro']);
    expect(headers('goalies')).toEqual(['Player', 'GS', 'W', 'L', 'OTL', 'SV%', 'GAA', 'SO', 'SA', 'Rating', 'GSAA']);
    expect(cell('goalies', 'Jeremy Swayman', 'gs')).toBe('54');
    expect(cell('goalies', 'Jeremy Swayman', 'w')).toBe('31');
    expect(cell('goalies', 'Jeremy Swayman', 'svp')).toBe('.908');
    expect(cell('goalies', 'Jeremy Swayman', 'gaa')).toBe('2.71');
    expect(cell('goalies', 'Michael DiPietro', 'svp')).toBe('1.000');
    expect(cell('goalies', 'Michael DiPietro', 'gaa')).toBe('0.00');
  });

  it('should rate the players from their games for the team in the history file', async () => {
    await openBoston();
    const ratedSeason = SeasonHistoryService.rateSeason(mockSeasonHistory());
    const ratings = PlayerSeasonRatingUtils.getTeamSeasonRatings(ratedSeason, 6);
    const pastrnak = ratings.get(8477956);
    expect(cell('skaters', 'David Pastrnak', 'rating'))
        .toBe(PlayerSeasonRatingUtils.formatAverageRating(pastrnak.averageRating));
    expect(cell('skaters', 'David Pastrnak', 'cf'))
        .toBe(PlayerSeasonRatingUtils.formatCorsiForPct(pastrnak.corsiForPct));
    expect(cell('goalies', 'Jeremy Swayman', 'gsaa')).toBe(
        PlayerSeasonRatingUtils.formatGoalsSavedAboveAverage(ratings.get(8480280).goalsSavedAboveAverage));
    const badge: HTMLElement = card('skaters').querySelector('tbody tr .rating-badge');
    expect(badge.style.backgroundColor).not.toBe('');
    // Michael DiPietro isn't in the 7 game file
    expect(cell('goalies', 'Michael DiPietro', 'rating')).toBe('-');
    expect(cell('goalies', 'Michael DiPietro', 'gsaa')).toBe('-');
  });

  it('should show the stats before the history file comes back', async () => {
    setInputs(6, 20252026);
    httpMock.expectOne(statsUrl).flush(mockTeamPlayers());
    await settle();
    expect(names('skaters')[0]).toBe('David Pastrnak');
    expect(cell('skaters', 'David Pastrnak', 'rating')).toBe('-');
    httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
    await settle();
    expect(cell('skaters', 'David Pastrnak', 'rating')).not.toBe('-');
  });

  it('should rate the players when the history file comes back first', async () => {
    setInputs(6, 20252026);
    httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
    await settle();
    httpMock.expectOne(statsUrl).flush(mockTeamPlayers());
    await settle();
    expect(cell('skaters', 'David Pastrnak', 'rating')).not.toBe('-');
  });

  it('should say through which day a season in progress is rated', async () => {
    await openBoston(derivedSeasonHistoryInProgress());
    expect(sortButton('skaters', 'Rating').title).toBe('Average HokMob rating, through Apr 14');
    expect(sortButton('skaters', 'G').title).toBe('Goals');
  });

  it('should leave out the rating columns when the history file fails', async () => {
    setInputs(6, 20252026);
    httpMock.expectOne(statsUrl).flush(mockTeamPlayers());
    httpMock.expectOne(historyUrl).flush('Not found', {status: 404, statusText: 'Not Found'});
    await settle();
    expect(headers('skaters')).not.toContain('Rating');
    expect(headers('goalies')).not.toContain('GSAA');
    expect(names('skaters').length).toBe(32);
  });

  it('should have no rating columns for a season without a history file', async () => {
    setInputs(6, 20232024);
    httpMock.expectOne('/api/nhl-stats/team-players?teamId=6&season=20232024&gameType=2').flush(mockTeamPlayers());
    httpMock.expectNone(request => request.url.startsWith('assets/history'));
    await settle();
    expect(headers('skaters')).not.toContain('CF%');
    expect(card('skaters').querySelector('.table-season').textContent.trim()).toBe('2023-2024 Regular Season');
  });

  describe('sorting', () => {
    beforeEach(async () => {
      await openBoston();
    });

    it('should sort by another column, most first, and reverse on a second click', () => {
      sortButton('skaters', 'G').click();
      fixture.detectChanges();
      expect(names('skaters')[0]).toBe('Morgan Geekie');
      const goalsHeader = sortButton('skaters', 'G').parentElement;
      expect(goalsHeader.getAttribute('aria-sort')).toBe('descending');
      expect(sortButton('skaters', 'P').parentElement.getAttribute('aria-sort')).toBeNull();

      sortButton('skaters', 'G').click();
      fixture.detectChanges();
      expect(goalsHeader.getAttribute('aria-sort')).toBe('ascending');
      expect(cell('skaters', names('skaters')[0], 'g')).toBe('0');
      expect(names('skaters')[31]).toBe('Morgan Geekie');
    });

    it('should keep players without a value at the bottom either way', () => {
      sortButton('skaters', 'FO%').click();
      fixture.detectChanges();
      const descending = names('skaters');
      expect(cell('skaters', descending[0], 'fo')).not.toBe('-');
      expect(cell('skaters', descending[31], 'fo')).toBe('-');

      sortButton('skaters', 'FO%').click();
      fixture.detectChanges();
      const ascending = names('skaters');
      expect(cell('skaters', ascending[0], 'fo')).not.toBe('-');
      expect(cell('skaters', ascending[31], 'fo')).toBe('-');
    });

    it('should sort a goals against average lowest first', () => {
      sortButton('goalies', 'GAA').click();
      fixture.detectChanges();
      expect(names('goalies')).toEqual(['Michael DiPietro', 'Jeremy Swayman', 'Joonas Korpisalo']);
      expect(sortButton('goalies', 'GAA').parentElement.getAttribute('aria-sort')).toBe('ascending');
    });

    it('should sort each table on its own', () => {
      sortButton('goalies', 'W').click();
      fixture.detectChanges();
      expect(names('skaters')[0]).toBe('David Pastrnak');
      expect(sortButton('skaters', 'P').parentElement.getAttribute('aria-sort')).toBe('descending');
    });

    it('should break ties by games played', () => {
      sortButton('skaters', 'G').click();
      fixture.detectChanges();
      const rows = names('skaters').map(name => ({
        goals: Number(cell('skaters', name, 'g')),
        gamesPlayed: Number(cell('skaters', name, 'gp'))
      }));
      const ties = rows.slice(1).filter((row, i) => row.goals === rows[i].goals);
      expect(ties.length).toBeGreaterThan(0);
      rows.slice(1).forEach((row, i) => {
        if (row.goals === rows[i].goals) {
          expect(rows[i].gamesPlayed).toBeGreaterThanOrEqual(row.gamesPlayed);
        }
      });
    });
  });

  it('should show a message when the stats fail', async () => {
    setInputs(6, 20252026);
    httpMock.expectOne(statsUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
    await settle();
    expect(card('skaters')).toBeNull();
    expect(fixture.nativeElement.querySelector('.team-player-stats-message').textContent.trim())
        .toBe('The player stats couldn\'t be loaded');
  });

  it('should show a message for a season the team hasn\'t played yet', async () => {
    fixture.componentRef.setInput('teamId', 6);
    fixture.componentRef.setInput('season', 20272028);
    fixture.detectChanges();
    httpMock.expectOne('/api/nhl-stats/team-players?teamId=6&season=20272028&gameType=2')
        .flush({skaters: [], goalies: []});
    await settle();
    expect(fixture.nativeElement.querySelector('.team-player-stats-message').textContent.trim())
        .toBe('No player stats yet');
  });

  it('should show a spinner while the stats load', () => {
    setInputs(6, 20252026);
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).not.toBeNull();
    httpMock.expectOne(statsUrl).flush(mockTeamPlayers());
    httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
  });

  it('should drop a slow response of the team it showed before', async () => {
    setInputs(6, 20252026);
    const bostonRequest = httpMock.expectOne(statsUrl);
    httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
    setInputs(28, 20252026);
    httpMock.expectOne('/api/nhl-stats/team-players?teamId=28&season=20252026&gameType=2')
        .flush({skaters: [], goalies: []});
    await settle();
    bostonRequest.flush(mockTeamPlayers());
    await settle();
    expect(card('skaters')).toBeNull();
    expect(fixture.nativeElement.querySelector('.team-player-stats-message').textContent.trim())
        .toBe('No player stats yet');
  });
});

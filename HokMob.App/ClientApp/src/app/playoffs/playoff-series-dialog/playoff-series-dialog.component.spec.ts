import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayoffSeriesSchedule } from '@shared/models/nhl-web-api/playoffs.model';
import { NhlGameInfoUtils } from '@shared/utils/nhl-game-info-utils';
import { NhlStatsApiService } from '@shared/services/nhl-stats-api.service';
import {
  derivedSeriesInProgress,
  mockPlayoffSeriesSchedule,
  mockRankedCarouselSeries
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayoffSeriesDialogComponent, PlayoffSeriesDialogData } from './playoff-series-dialog.component';

describe('PlayoffSeriesDialogComponent', () => {
  let component: PlayoffSeriesDialogComponent;
  let fixture: ComponentFixture<PlayoffSeriesDialogComponent>;
  let httpMock: HttpTestingController;
  let dialogRef: jasmine.SpyObj<MatDialogRef<PlayoffSeriesDialogComponent>>;

  const scheduleUrlA = '/api/nhl/schedule/playoff-series/20252026/a/';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayoffSeriesDialogComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Opens the dialog with the given data. Providers can only be overridden before the first inject. */
  function open(data: PlayoffSeriesDialogData): void {
    TestBed.overrideProvider(MAT_DIALOG_DATA, {useValue: data});
    TestBed.overrideProvider(MatDialogRef, {useValue: dialogRef});
    fixture = TestBed.createComponent(PlayoffSeriesDialogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  /** Answers the schedule request with the given schedule, or with an error for null. */
  async function loadSchedule(url: string, schedule: PlayoffSeriesSchedule | null): Promise<void> {
    const request = httpMock.expectOne(url);
    if (schedule) {
      request.flush(schedule);
    } else {
      request.flush('Server error', {status: 500, statusText: 'Internal Server Error'});
    }
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function title(): string {
    return fixture.nativeElement.querySelector('.series-title-text').textContent.trim();
  }

  function scorecards(): any[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-scorecard'));
  }

  it('should load the series games and show them as scorecards', async () => {
    open({series: mockRankedCarouselSeries('A'), season: 20252026});
    expect(title()).toBe('Round 1: BUF wins 4-2');
    await loadSchedule(scheduleUrlA, mockPlayoffSeriesSchedule('A'));
    expect(title()).toBe('East Round 1: BUF wins 4-2');
    expect(scorecards().length).toBe(6);
    expect(scorecards()[0].game).toBe(component.seriesGames[0]);
    expect(component.seriesGames.map(game => game.id))
        .toEqual(mockPlayoffSeriesSchedule('A').games.map(game => game.id));
  });

  it('should convert schedule games to the score game shape', async () => {
    open({series: mockRankedCarouselSeries('A'), season: 20252026});
    await loadSchedule(scheduleUrlA, mockPlayoffSeriesSchedule('A'));
    const firstGame = component.seriesGames[0];
    expect(firstGame.homeTeam).toEqual({id: 7, name: {default: 'Sabres'}, abbrev: 'BUF', score: 4, logo: undefined});
    expect(firstGame.awayTeam).toEqual({id: 6, name: {default: 'Bruins'}, abbrev: 'BOS', score: 3, logo: undefined});
    expect(firstGame.gameType).toBe(3);
    expect(firstGame.startTimeUTC).toBe('2026-04-19T23:30:00Z');
    expect(firstGame.seriesStatus).toEqual(jasmine.objectContaining({
      round: 1, seriesLetter: 'A', neededToWin: 4, topSeedTeamAbbrev: 'BUF', topSeedWins: 1,
      bottomSeedTeamAbbrev: 'BOS', bottomSeedWins: 0, gameNumberOfSeries: 1
    }));
    const statuses = component.seriesGames.map(game => NhlGameInfoUtils.getSeriesStatusShort(game.seriesStatus));
    expect(statuses).toEqual(['BUF leads 1-0', 'Tied 1-1', 'BUF leads 2-1', 'BUF leads 3-1', 'BUF leads 3-2', 'BUF wins 4-2']);
  });

  it('should title the Stanley Cup Final without a conference', async () => {
    open({series: mockRankedCarouselSeries('O'), season: 20252026});
    await loadSchedule('/api/nhl/schedule/playoff-series/20252026/o/', mockPlayoffSeriesSchedule('O'));
    expect(title()).toBe('Stanley Cup Finals: CAR wins 4-2');
  });

  it('should name later rounds and western series', async () => {
    const series = mockRankedCarouselSeries('A');
    series.roundNumber = 2;
    const westernSchedule = mockPlayoffSeriesSchedule('A');
    westernSchedule.topSeedTeam.conference.name = 'Western';
    open({series, season: 20252026});
    await loadSchedule(scheduleUrlA, westernSchedule);
    expect(title()).toBe('West Semifinals: BUF wins 4-2');

    component.data.series.roundNumber = 3;
    fixture.detectChanges();
    expect(title()).toBe('West Finals: BUF wins 4-2');
  });

  it('should use the current wins for games that have not been played', async () => {
    const {series, schedule} = derivedSeriesInProgress();
    open({series, season: 20252026});
    await loadSchedule(scheduleUrlA, schedule);
    expect(title()).toBe('East Round 1: BUF leads 3-1');
    expect(NhlGameInfoUtils.getSeriesStatusShort(component.seriesGames[4].seriesStatus)).toBe('BUF leads 3-1');
  });

  it('should show the matchup before the first game', async () => {
    const series = mockRankedCarouselSeries('A');
    series.topSeed.wins = 0;
    series.bottomSeed.wins = 0;
    delete series.winningTeamId;
    const schedule = mockPlayoffSeriesSchedule('A');
    schedule.games = [];
    open({series, season: 20252026});
    await loadSchedule(scheduleUrlA, schedule);
    expect(title()).toBe('East Round 1: BUF vs BOS');
    expect(scorecards().length).toBe(0);
  });

  it('should not load games for a series without both teams', () => {
    const series = mockRankedCarouselSeries('A');
    delete series.bottomSeed;
    open({series, season: 20252026});
    httpMock.expectNone(() => true);
    expect(title()).toBe('NHL Playoffs');
    expect(component.seriesGames).toBeUndefined();
  });

  it('should use the current season when none is given', async () => {
    // Spied on the prototype, because the dialog data can only be overridden before the first inject
    spyOn(NhlStatsApiService.prototype, 'getCurrentSeason').and.resolveTo({season: 20252026, isPlayoffMode: true});
    open({series: mockRankedCarouselSeries('A'), season: undefined});
    await new Promise(resolve => setTimeout(resolve));
    await loadSchedule(scheduleUrlA, mockPlayoffSeriesSchedule('A'));
    expect(scorecards().length).toBe(6);
  });

  it('should show no games when no season is given and the current season fails', async () => {
    spyOn(NhlStatsApiService.prototype, 'getCurrentSeason').and.rejectWith(new Error('Bad gateway'));
    open({series: mockRankedCarouselSeries('A'), season: undefined});
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
    httpMock.expectNone(() => true);
    expect(title()).toBe('Round 1: BUF wins 4-2');
    expect(scorecards().length).toBe(0);
  });

  it('should keep the title and show no games when the schedule fails', async () => {
    open({series: mockRankedCarouselSeries('A'), season: 20252026});
    await loadSchedule(scheduleUrlA, null);
    expect(title()).toBe('Round 1: BUF wins 4-2');
    expect(scorecards().length).toBe(0);
  });

  it('should close when the close button is clicked', async () => {
    open({series: mockRankedCarouselSeries('A'), season: 20252026});
    await loadSchedule(scheduleUrlA, mockPlayoffSeriesSchedule('A'));
    fixture.nativeElement.querySelector('.dialog-close-button').click();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('should close when a game is clicked', async () => {
    open({series: mockRankedCarouselSeries('A'), season: 20252026});
    await loadSchedule(scheduleUrlA, mockPlayoffSeriesSchedule('A'));
    fixture.debugElement.query(By.css('app-scorecard')).triggerEventHandler('scorecardClicked', true);
    expect(dialogRef.close).toHaveBeenCalled();
  });
});

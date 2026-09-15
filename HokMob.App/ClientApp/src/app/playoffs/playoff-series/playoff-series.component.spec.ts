import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayoffCarouselSeries } from '@shared/models/nhl-web-api/playoffs.model';
import { NhlGameScheduleStateEnum } from '@shared/enums/nhl-game-schedule-state.enum';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import { PlayoffSeriesDialogComponent } from '@app/playoffs/playoff-series-dialog/playoff-series-dialog.component';
import { derivedSeriesInProgress, mockRankedCarouselSeries } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayoffSeriesComponent } from './playoff-series.component';

describe('PlayoffSeriesComponent', () => {
  let component: PlayoffSeriesComponent;
  let fixture: ComponentFixture<PlayoffSeriesComponent>;
  let httpMock: HttpTestingController;

  const scheduleUrl = '/api/nhl/schedule/playoff-series/20252026/a/';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayoffSeriesComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
    createCard();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createCard(): void {
    fixture = TestBed.createComponent(PlayoffSeriesComponent);
    component = fixture.componentInstance;
  }

  function render(series: PlayoffCarouselSeries, smallerVersion = false, season = 20252026): void {
    fixture.componentRef.setInput('season', season);
    fixture.componentRef.setInput('smallerVersion', smallerVersion);
    fixture.componentRef.setInput('seriesData', series);
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function abbrevElements(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.team-abbr'));
  }

  function nextGameText(): string {
    return fixture.nativeElement.querySelector('.next-game')?.textContent.trim();
  }

  it('should show the teams, seed ranks, wins and logos of a finished series', () => {
    render(mockRankedCarouselSeries('A'), true);
    expect([component.teamAName, component.teamBName]).toEqual(['BUF', 'BOS']);
    expect([component.teamARank, component.teamBRank]).toEqual(['  1', '  4']);
    expect([component.teamAWins, component.teamBWins]).toEqual([4, 2]);
    expect(component.logoA).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(7));
    expect(component.logoB).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(6));
    expect(abbrevElements().map(element => element.textContent.trim())).toEqual(['BUF', 'BOS']);
    expect(nextGameText()).toBeUndefined();
  });

  it('should dim the team that lost the series, top or bottom seed', () => {
    render(mockRankedCarouselSeries('A'), true);
    expect([component.teamALost, component.teamBLost]).toEqual([false, true]);
    expect(abbrevElements()[1].classList).toContain('loser');
    expect(abbrevElements()[0].classList).not.toContain('loser');

    // Series B: MTL, the bottom seed, beat TBL 4-3
    createCard();
    render(mockRankedCarouselSeries('B'), true);
    expect([component.teamALost, component.teamBLost]).toEqual([true, false]);
  });

  it('should find the loser from wins when the winning team is missing', () => {
    const series = mockRankedCarouselSeries('A');
    delete series.winningTeamId;
    delete series.losingTeamId;
    render(series, true);
    expect(component.teamBLost).toBeTrue();
  });

  it('should not dim either team while the series is in progress', () => {
    render(derivedSeriesInProgress().series, true);
    expect([component.teamALost, component.teamBLost]).toEqual([false, false]);
  });

  it('should show Final without loading the schedule for a finished full-size series', () => {
    render(mockRankedCarouselSeries('A'));
    httpMock.expectNone(scheduleUrl);
    expect(nextGameText()).toBe('Final');
  });

  it('should show the next unplayed game date on full-size cards', async () => {
    const {series, schedule} = derivedSeriesInProgress();
    render(series);
    expect(nextGameText()).toBe('TBD');
    httpMock.expectOne(scheduleUrl).flush(schedule);
    await settle();
    expect(component.nextGame.gameNumber).toBe(5);
    expect(nextGameText()).toBe(dayjs('2026-04-28T23:30:00Z').format('MMM D'));
  });

  it('should not load the schedule for small cards or without a season', () => {
    render(derivedSeriesInProgress().series, true);
    httpMock.expectNone(scheduleUrl);

    createCard();
    render(derivedSeriesInProgress().series, false, null);
    httpMock.expectNone(scheduleUrl);
  });

  it('should show TBD when the next game has no start time yet', async () => {
    const {series, schedule} = derivedSeriesInProgress();
    schedule.games[4].gameScheduleState = NhlGameScheduleStateEnum.TBD;
    render(series);
    httpMock.expectOne(scheduleUrl).flush(schedule);
    await settle();
    expect(nextGameText()).toBe('TBD');
  });

  it('should show TBD when the schedule fails to load', async () => {
    render(derivedSeriesInProgress().series);
    httpMock.expectOne(scheduleUrl).flush('Server error', {status: 500, statusText: 'Internal Server Error'});
    await settle();
    expect(component.nextGame).toBeUndefined();
    expect(nextGameText()).toBe('TBD');
  });

  it('should handle a series whose teams are not known yet', () => {
    const series = mockRankedCarouselSeries('A');
    delete series.topSeed;
    delete series.bottomSeed;
    delete series.winningTeamId;
    delete series.losingTeamId;
    render(series, true);
    expect([component.teamAName, component.teamBName, component.teamARank]).toEqual(['', '', ' ']);
    expect([component.teamAWins, component.teamBWins]).toEqual([0, 0]);
    expect([component.teamALost, component.teamBLost]).toEqual([false, false]);
    expect(component.logoA).toBe('assets/team_fallback.png');
    expect(component.isLogoALoaded).toBeFalse();
  });

  it('should open the series dialog with the series and season', () => {
    const series = mockRankedCarouselSeries('A');
    render(series, true);
    spyOn(component.seriesDialog, 'open');
    fixture.nativeElement.querySelector('.series-container').click();
    expect(component.seriesDialog.open).toHaveBeenCalledWith(PlayoffSeriesDialogComponent,
        jasmine.objectContaining({data: {series, season: 20252026}}));
  });
});

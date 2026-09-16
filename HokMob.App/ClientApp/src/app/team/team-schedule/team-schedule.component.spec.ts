import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ScoreGame } from '@shared/models/nhl-web-api/score.model';
import { NhlGameInfoUtils } from '@shared/utils/nhl-game-info-utils';
import { mockClubScheduleSeason } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { TeamScheduleComponent } from './team-schedule.component';

describe('TeamScheduleComponent', () => {
  let component: TeamScheduleComponent;
  let fixture: ComponentFixture<TeamScheduleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamScheduleComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamScheduleComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** Boston's next 5 games, as the team page converts them for the scorecards. */
  function bostonSchedule(): ScoreGame[] {
    return NhlGameInfoUtils.getUpcomingGames(mockClubScheduleSeason('BOS', 20262027).games)
        .map(game => NhlGameInfoUtils.toScoreGame(game));
  }

  function show(games: ScoreGame[]): void {
    fixture.componentRef.setInput('games', games);
    fixture.detectChanges();
  }

  function scorecards(): any[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-scorecard'));
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  it('should show the team\'s real next 5 games as scorecards, soonest first', () => {
    show(bostonSchedule());
    expect(text('.team-schedule-header')).toBe('Team Schedule');
    expect(scorecards().map(scorecard => scorecard.game.id))
        .toEqual([2026010013, 2026010028, 2026010040, 2026010049, 2026020003]);
    expect(scorecards()[0].game.homeTeam.abbrev).toBe('BOS');
    expect(scorecards().every(scorecard => scorecard.smallerScorecard)).toBeTrue();
  });

  it('should mark only the last game\'s container', () => {
    show(bostonSchedule());
    const containers: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.future-game-container'));
    expect(containers.map(container => container.classList.contains('last-scorecard')))
        .toEqual([false, false, false, false, true]);
  });

  it('should show a message for a team without upcoming games', () => {
    show([]);
    expect(scorecards().length).toBe(0);
    expect(text('.no-games')).toBe('No upcoming games');
  });

  it('should show the message without games at all', () => {
    show(null);
    expect(text('.no-games')).toBe('No upcoming games');
  });
});

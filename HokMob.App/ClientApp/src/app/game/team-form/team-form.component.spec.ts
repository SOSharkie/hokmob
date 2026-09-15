import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ClubScheduleGame } from '@shared/models/nhl-web-api/club-schedule.model';
import { NhlGameInfoUtils } from '@shared/utils/nhl-game-info-utils';
import {
  MockClubScheduleTeam,
  mockClubScheduleSeason,
  mockGameLanding
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { TeamFormComponent } from './team-form.component';

describe('TeamFormComponent', () => {
  let component: TeamFormComponent;
  let fixture: ComponentFixture<TeamFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamFormComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamFormComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** A team's form before the future game 2026020056 (UTA @ BOS), filled in from 2025-26 like NhlGameService does. */
  function formBeforeFutureGame(teamAbbrev: MockClubScheduleTeam): ClubScheduleGame[] {
    const games = [...mockClubScheduleSeason(teamAbbrev, 20252026).games, ...mockClubScheduleSeason(teamAbbrev, 20262027).games];
    return NhlGameInfoUtils.getTeamFormGames(games, mockGameLanding(2026020056));
  }

  /** Shows the form of BOS (6, home) and UTA (68, away). */
  function show(homeTeamGames: ClubScheduleGame[], awayTeamGames: ClubScheduleGame[]): void {
    fixture.componentRef.setInput('homeTeamId', 6);
    fixture.componentRef.setInput('awayTeamId', 68);
    fixture.componentRef.setInput('homeTeamGames', homeTeamGames);
    fixture.componentRef.setInput('awayTeamGames', awayTeamGames);
    fixture.detectChanges();
  }

  function previousGames(side: 'home' | 'away'): any[] {
    return Array.from(fixture.nativeElement.querySelectorAll(`.${side}-games app-previous-game`));
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  it('should show the real last 5 games of each team, most recent first', () => {
    show(formBeforeFutureGame('BOS'), formBeforeFutureGame('UTA'));
    expect(text('.team-form-header')).toBe('Team Form');
    expect(previousGames('home').map(game => game.game.id))
        .toEqual([2025030116, 2025030115, 2025030114, 2025030113, 2025030112]);
    expect(previousGames('away').map(game => game.game.id))
        .toEqual([2025030176, 2025030175, 2025030174, 2025030173, 2025030172]);
    expect(previousGames('home').map(game => game.teamId)).toEqual([6, 6, 6, 6, 6]);
    expect(previousGames('away').map(game => game.teamId)).toEqual([68, 68, 68, 68, 68]);
    expect(previousGames('home').map(game => game.isLast)).toEqual([false, false, false, false, true]);
    expect(fixture.nativeElement.querySelector('.no-games')).toBeNull();
  });

  it('should show a message for a team without games', () => {
    show(formBeforeFutureGame('BOS'), []);
    expect(previousGames('home').length).toBe(5);
    expect(previousGames('away').length).toBe(0);
    expect(text('.home-games .no-games')).toBeUndefined();
    expect(text('.away-games .no-games')).toBe('No recent games');
  });

  it('should show the message for both teams without games', () => {
    fixture.componentRef.setInput('homeTeamGames', null);
    fixture.detectChanges();
    expect(component.awayTeamGames).toEqual([]);
    expect(fixture.nativeElement.querySelectorAll('.no-games').length).toBe(2);
    expect(previousGames('home').length).toBe(0);
  });
});

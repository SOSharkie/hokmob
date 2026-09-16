import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ClubScheduleGame } from '@shared/models/nhl-web-api/club-schedule.model';
import { NhlGameInfoUtils } from '@shared/utils/nhl-game-info-utils';
import { mockClubScheduleSeason } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { SingleTeamFormComponent } from './single-team-form.component';

describe('SingleTeamFormComponent', () => {
  let component: SingleTeamFormComponent;
  let fixture: ComponentFixture<SingleTeamFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ SingleTeamFormComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SingleTeamFormComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** Boston's last 5 finished games before the 2026-27 season, as the team page loads them. */
  function bostonForm(): ClubScheduleGame[] {
    const games = [...mockClubScheduleSeason('BOS', 20252026).games, ...mockClubScheduleSeason('BOS', 20262027).games];
    return NhlGameInfoUtils.getTeamFormGames(games, {season: 20262027, startTimeUTC: '2026-09-15T12:00:00Z'});
  }

  function show(teamId: number, games: ClubScheduleGame[]): void {
    fixture.componentRef.setInput('teamId', teamId);
    fixture.componentRef.setInput('games', games);
    fixture.detectChanges();
  }

  function previousGames(): any[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-previous-game'));
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  it('should show the team\'s real last 5 games, most recent first', () => {
    show(6, bostonForm());
    expect(text('.team-form-header')).toBe('Team Form');
    expect(previousGames().map(game => game.game.id))
        .toEqual([2025030116, 2025030115, 2025030114, 2025030113, 2025030112]);
    expect(previousGames().map(game => game.teamId)).toEqual([6, 6, 6, 6, 6]);
    expect(previousGames().map(game => game.isLast)).toEqual([false, false, false, false, true]);
    expect(fixture.nativeElement.querySelector('.no-games')).toBeNull();
  });

  it('should show a message for a team without recent games', () => {
    show(53, []);
    expect(previousGames().length).toBe(0);
    expect(text('.no-games')).toBe('No recent games');
  });

  it('should show the message without games at all', () => {
    show(6, null);
    expect(text('.no-games')).toBe('No recent games');
  });
});

import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {AppTestingModule} from '@shared/testing/app-testing.module';
import {mockSeasonHistory} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {SeasonHistoryService} from '@shared/services/season-history.service';
import {RatedSeason} from '@shared/models/nhl-history/season-history.model';

import {AverageRatingLeadersComponent} from './average-rating-leaders.component';

describe('AverageRatingLeadersComponent', () => {
  let component: AverageRatingLeadersComponent;
  let fixture: ComponentFixture<AverageRatingLeadersComponent>;
  let ratedSeason: RatedSeason;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppTestingModule],
      declarations: [AverageRatingLeadersComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AverageRatingLeadersComponent);
    component = fixture.componentInstance;
    ratedSeason = SeasonHistoryService.rateSeason(mockSeasonHistory());
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** Shows the 7 game fixture. Its players have at most 3 games, so the minimum is lowered for most tests. */
  function show(minGames?: number): void {
    fixture.componentRef.setInput('ratedSeason', ratedSeason);
    if (minGames != null) {
      fixture.componentRef.setInput('minGames', minGames);
    }
    fixture.detectChanges();
  }

  function rowElements(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.player-row'));
  }

  function clickPosition(label: string): void {
    (Array.from(fixture.nativeElement.querySelectorAll('.toggle-option')) as HTMLElement[])
        .find(button => button.textContent.trim() === label).click();
    fixture.detectChanges();
  }

  it('should need 20 games by default, which no player in 7 games has', () => {
    show();
    expect(component.minGames).toBe(20);
    expect(rowElements().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.list-message').textContent.trim()).toBe('No player has 20 games');
    expect(fixture.nativeElement.querySelector('.card-note').textContent.trim()).toBe('Minimum 20 games');
  });

  it('should list the players with the minimum games, best average first', () => {
    show(3);
    expect(component.rows.length).toBeGreaterThan(0);
    component.rows.forEach((row, index) => {
      expect(row.rank).toBe(index + 1);
      expect(row.gamesPlayed).toBe(3);
      // Carolina is the only team with 3 games
      expect(row.teamId).toBe(12);
    });
    const averages = component.rows.map(row => Number(row.averageRating));
    expect(averages).toEqual([...averages].sort((a, b) => b - a));
    expect(rowElements().length).toBe(component.rows.length);
    expect(component.rows.some(row => row.name === 'Nikolaj Ehlers')).toBeTrue();
  });

  it('should show each player\'s headshot, team, games and average, and link the player page', () => {
    show(3);
    const row = component.rows[0];
    const element = rowElements()[0];
    expect(element.querySelector('.player-name').textContent.trim()).toBe(row.name);
    expect(element.querySelector('.player-name').getAttribute('href')).toBe('/player/' + row.playerId);
    expect(element.querySelector('.player-headshot').getAttribute('src'))
        .toBe('https://assets.nhle.com/mugs/nhl/20252026/CAR/' + row.playerId + '.png');
    expect((element.querySelector('app-team-logo') as any).teamId).toBe(12);
    expect(element.querySelector('.games-played').textContent.trim()).toBe('3 GP');
    expect(element.querySelector('.rating-badge').textContent.trim()).toBe(row.averageRating);
    expect(row.averageRating).toMatch(/^\d+\.\d\d$/);
  });

  it('should filter by position', () => {
    show(1);
    clickPosition('G');
    expect(component.rows.length).toBe(13);
    expect(component.rows.every(row => row.position === 'G')).toBeTrue();

    clickPosition('D');
    expect(component.rows.every(row => row.position === 'D')).toBeTrue();

    clickPosition('All');
    expect(component.rows.length).toBe(AverageRatingLeadersComponent.leaderCount);
  });

  it('should list the season\'s teams by name, and filter by team', () => {
    show(1);
    expect(component.teamOptions.length).toBe(10);
    expect(component.teamOptions[0].name).toBe('Boston Bruins');
    expect(fixture.nativeElement.querySelector('.team-picker').textContent.trim()).toBe('All teams');

    component.selectTeam(54);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.team-picker').textContent.trim()).toBe('Vegas Golden Knights');
    expect(fixture.nativeElement.querySelector('.card-note').textContent.trim()).toBe('Minimum 1 games for the team');
    expect(component.rows.every(row => row.teamId === 54)).toBeTrue();
    // Nic Dowd's game for Vegas, not the one for Washington
    expect(component.rows.find(row => row.name === 'Nic Dowd').gamesPlayed).toBe(1);

    component.selectTeam(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.team-picker').textContent.trim()).toBe('All teams');
  });

  it('should combine the position and team filters', () => {
    show(1);
    component.selectTeam(6);
    clickPosition('G');
    expect(component.rows.length).toBeGreaterThan(0);
    expect(component.rows.every(row => row.position === 'G' && row.teamId === 6)).toBeTrue();
    // Swayman played both Boston games
    expect(component.rows.find(row => row.name === 'Jeremy Swayman').gamesPlayed).toBe(2);
  });

  it('should show nothing without a season', () => {
    fixture.componentRef.setInput('ratedSeason', undefined);
    fixture.detectChanges();
    expect(component.rows).toEqual([]);
    expect(component.teamOptions).toEqual([]);
    expect(fixture.nativeElement.querySelector('.list-message')).not.toBeNull();
  });
});

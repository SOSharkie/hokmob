import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {AppTestingModule} from '@shared/testing/app-testing.module';
import {mockSeasonHistory} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {SeasonHistoryService} from '@shared/services/season-history.service';
import {RatedSeason} from '@shared/models/nhl-history/season-history.model';
import {StatsUtils} from '@shared/utils/stats-utils';

import {BestGamesComponent} from './best-games.component';

describe('BestGamesComponent', () => {
  let component: BestGamesComponent;
  let fixture: ComponentFixture<BestGamesComponent>;
  let ratedSeason: RatedSeason;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppTestingModule],
      declarations: [BestGamesComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BestGamesComponent);
    component = fixture.componentInstance;
    ratedSeason = SeasonHistoryService.rateSeason(mockSeasonHistory());
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(season: RatedSeason = ratedSeason): void {
    fixture.componentRef.setInput('ratedSeason', season);
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

  it('should list the season\'s 20 best rated games, best first', () => {
    show();
    expect(rowElements().length).toBe(20);
    const ratings = component.rows.map(row => row.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    expect(ratings[0]).toBe(Math.max(...ratedSeason.ratedGames.map(game => game.rating)));
    expect(rowElements()[0].querySelector('.rating-badge').textContent.trim()).toBe(String(ratings[0]));
  });

  it('should link each game to the player and game pages, with the score from the player\'s side', () => {
    const lindholm = ratedSeason.ratedGames.find(game => game.player.name === 'Elias Lindholm');
    show({...ratedSeason, ratedGames: [lindholm]});
    // BOS 5 @ CAR 6, from Lindholm's side
    const [row] = component.rows;
    expect(row.score).toBe('5 - 6');
    expect(row.isHome).toBeFalse();
    expect(row.teamId).toBe(6);
    expect(row.opponentId).toBe(12);
    expect(row.date).toBe('Apr 7');

    const element = rowElements()[0];
    expect(element.querySelector('.player-name').textContent.trim()).toBe('Elias Lindholm');
    expect(element.querySelector('.player-name').getAttribute('href')).toBe('/player/8477496');
    expect(element.querySelector('.player-headshot').getAttribute('src'))
        .toBe('https://assets.nhle.com/mugs/nhl/20252026/BOS/8477496.png');
    expect(element.querySelector('.game-link').getAttribute('href')).toBe('/game/2025021237');
    expect(element.querySelector('.versus').textContent.trim()).toBe('@');
    expect((element.querySelector('.game-link app-team-logo') as any).teamId).toBe(12);
    expect(element.querySelector('.score').textContent.trim()).toBe('5 - 6');
    expect(element.querySelector('.rating-badge').textContent.trim()).toBe(String(lindholm.rating));
  });

  it('should filter by position', () => {
    show();
    clickPosition('G');
    expect(component.rows.length).toBe(15);
    expect(component.rows.every(row => row.position === 'G')).toBeTrue();

    clickPosition('D');
    expect(component.rows.every(row => row.position === 'D')).toBeTrue();
    expect(component.rows.length).toBe(20);
  });

  it('should rank the games capped at 10 by their uncapped rating, and say what it was', () => {
    const [first, second] = ratedSeason.ratedGames;
    Object.assign(first, {rating: 10, uncappedRating: 10.3});
    Object.assign(second, {rating: 10, uncappedRating: 12.36});
    show();
    expect(component.rows.slice(0, 2).map(row => row.playerId)).toEqual([second.player.id, first.player.id]);
    expect(rowElements()[0].querySelector('.rating-badge').getAttribute('title')).toBe('Capped at 10, from 12.4');
    expect(component.rows[0].ratingColor).toBe(StatsUtils.hokmobRatingBlue);
    expect(rowElements()[2].querySelector('.rating-badge').getAttribute('title')).toBeNull();
  });

  it('should show a message without games', () => {
    show({...ratedSeason, ratedGames: []});
    expect(rowElements().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.list-message').textContent.trim()).toBe('No games');
  });
});

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { GamePlayer } from '@shared/models/nhl-web-api/boxscore.model';
import { StatsUtils } from '@shared/utils/stats-utils';
import { PlayByPlayUtils } from '@shared/utils/play-by-play-utils';
import { MockGamecenterGameId, mockGameBoxscore, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { GameTopPlayersComponent } from './game-top-players.component';

describe('GameTopPlayersComponent', () => {
  let component: GameTopPlayersComponent;
  let fixture: ComponentFixture<GameTopPlayersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ GameTopPlayersComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameTopPlayersComponent);
    component = fixture.componentInstance;
  });

  /** A real game's rated players, as the game page builds them. */
  function gamePlayers(gameId: MockGamecenterGameId, isHome: boolean): GamePlayer[] {
    return StatsUtils.getGamePlayers(mockGameBoxscore(gameId), isHome,
        PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(gameId)));
  }

  function show(homePlayers: GamePlayer[], awayPlayers: GamePlayer[]): void {
    fixture.componentRef.setInput('homePlayers', homePlayers);
    fixture.componentRef.setInput('awayPlayers', awayPlayers);
    fixture.detectChanges();
  }

  function cards(side: 'home' | 'away'): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(`.${side}-players .top-player-list .top-player`));
  }

  function moreCards(side: 'home' | 'away'): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(`.${side}-players .more-player-list .top-player`));
  }

  function cardName(card: HTMLElement): string {
    return card.querySelector('.player-name').textContent.trim();
  }

  function names(side: 'home' | 'away'): string[] {
    return cards(side).map(cardName);
  }

  function expandButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.expand-button');
  }

  function rating(card: HTMLElement): string {
    return card.querySelector('.hokmob-score-container span').textContent.trim();
  }

  it('should show the six best rated players of each team of a real game', () => {
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    expect(names('home'))
        .toEqual(['Eric Comrie', 'Haydn Fleury', 'Mark Scheifele', 'Cole Koepke', 'Morgan Barron', 'Kyle Connor']);
    expect(cards('home').map(rating)).toEqual(['7.9', '7.8', '7', '6.7', '6.5', '6.4']);
  });

  it('should replace the last player with the goalie who played the most when no goalie is in the top six', () => {
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    // Binnington (4.1) played instead of Hofer, and replaces Pius Suter (5.7)
    expect(names('away'))
        .toEqual(['Dylan Holloway', 'Jimmy Snuggerud', 'Dalibor Dvorsky', 'Logan Mailloux', 'Colton Parayko', 'Jordan Binnington']);
    expect(rating(cards('away')[5])).toBe('4.1');
    expect(cards('away')[5].querySelector('.goalie-icon')).not.toBeNull();
    expect(cards('away')[0].querySelector('.goalie-icon')).toBeNull();
  });

  it('should star the best rated player of the game, preferring the home player in a tie', () => {
    show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
    expect(component.gameMvpPlayerId).toBe(8473533);
    const stars = fixture.nativeElement.querySelectorAll('.star-icon');
    expect(stars.length).toBe(1);
    expect(cards('away')[0].querySelector('.star-icon')).not.toBeNull();
    expect(names('away')[0]).toBe('Jordan Staal');

    const homePlayers = gamePlayers(2025030414, true);
    homePlayers[0].hokmobRating = 9.1;
    show(homePlayers, gamePlayers(2025030414, false));
    expect(component.gameMvpPlayerId).toBe(homePlayers[0].playerId);
  });

  it('should show a puck for each goal, up to three', () => {
    show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
    // Jordan Staal scored twice, Nikolaj Ehlers once, Jalen Chatfield didn't score
    const pucks = (card: HTMLElement) => card.querySelectorAll('.puck-icon').length;
    expect(cards('away').slice(0, 4).map(pucks)).toEqual([2, 1, 1, 0]);

    const awayPlayers = gamePlayers(2025030414, false);
    awayPlayers[0].skaterStats.goals = 4;
    show(gamePlayers(2025030414, true), awayPlayers);
    expect(pucks(cards('away')[0])).toBe(3);
  });

  it('should show the roster headshots and fall back to the blank headshot', () => {
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    const headshot: HTMLImageElement = cards('home')[2].querySelector('.player-headshot');
    expect(headshot.getAttribute('src')).toBe('https://assets.nhle.com/mugs/nhl/20252026/WPG/8476460.png');
    headshot.dispatchEvent(new Event('error'));
    expect(headshot.src).toMatch(/assets\/blank_headshot\.png$/);
  });

  it('should emit the player ID when a player is clicked', () => {
    const clickedIds: number[] = [];
    component.playerClicked.subscribe(playerId => clickedIds.push(playerId));
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    cards('home')[2].click();
    cards('away')[5].click();
    expect(clickedIds).toEqual([8476460, 8476412]);
  });

  it('should show no players and no star without player stats', () => {
    show(undefined, []);
    expect(cards('home').length).toBe(0);
    expect(cards('away').length).toBe(0);
    expect(component.gameMvpPlayerId).toBeUndefined();
  });

  it('should show a team with fewer than six players and add its goalie', () => {
    const homePlayers = gamePlayers(2025021057, true).filter(player => player.skaterStats).slice(0, 3);
    const goalie = gamePlayers(2025021057, true).find(player => player.playerId === 8477480);
    show([...homePlayers, goalie].reverse(), gamePlayers(2025021057, false));
    expect(names('home')).toEqual(['Eric Comrie', 'Haydn Fleury', 'Mark Scheifele', 'Cole Koepke']);
  });

  it('should keep the next best players collapsed until the expand button is clicked', () => {
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    const morePlayers: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.more-players'));
    expect(morePlayers.length).toBe(2);
    expect(morePlayers.every(section => section.hasAttribute('inert'))).toBeTrue();
    expect(morePlayers.some(section => section.classList.contains('expanded'))).toBeFalse();
    expect(expandButton().getAttribute('aria-expanded')).toBe('false');

    expandButton().click();
    fixture.detectChanges();
    expect(component.expanded).toBeTrue();
    expect(morePlayers.every(section => section.classList.contains('expanded') && !section.hasAttribute('inert'))).toBeTrue();
    expect(expandButton().getAttribute('aria-expanded')).toBe('true');
    expect(expandButton().getAttribute('aria-label')).toBe('Show fewer players');

    expandButton().click();
    fixture.detectChanges();
    expect(morePlayers.every(section => section.hasAttribute('inert'))).toBeTrue();
  });

  it('should show six more players per team, starting with the player the goalie replaced', () => {
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    expect(moreCards('home').length).toBe(6);
    expect(moreCards('away').length).toBe(6);
    expect(cardName(moreCards('away')[0])).toBe('Pius Suter');
    expect(rating(moreCards('away')[0])).toBe('5.7');
    const topAndMoreIds = [...component.topHomePlayers, ...component.moreHomePlayers].map(player => player.playerId);
    expect(new Set(topAndMoreIds).size).toBe(12);
    const moreRatings = component.moreHomePlayers.map(player => player.hokmobRating);
    expect(moreRatings).toEqual([...moreRatings].sort((a, b) => b - a));
  });

  it('should emit the player ID when an extra player is clicked', () => {
    const clickedIds: number[] = [];
    component.playerClicked.subscribe(playerId => clickedIds.push(playerId));
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    moreCards('away')[0].click();
    expect(clickedIds).toEqual([component.moreAwayPlayers[0].playerId]);
  });

  it('should hide the expand button when no team has more players', () => {
    const homePlayers = gamePlayers(2025021057, true).slice(0, 4);
    show(homePlayers, []);
    expect(moreCards('home').length).toBe(0);
    expect(expandButton()).toBeNull();
  });
});

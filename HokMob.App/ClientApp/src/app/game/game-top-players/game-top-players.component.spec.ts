import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { GamePlayer } from '@shared/models/nhl-web-api/boxscore.model';
import { PlayerHighlight } from '@shared/models/player-highlight.model';
import { StatsUtils } from '@shared/utils/stats-utils';
import { PlayByPlayUtils } from '@shared/utils/play-by-play-utils';
import { MockGamecenterGameId, mockGameBoxscore, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';

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

  type Side = 'home' | 'away';
  type PositionLine = 'goalies' | 'defense' | 'forwards';

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

  function cards(side: Side, line?: PositionLine): HTMLElement[] {
    const lineSelector = line ? `.${line}` : '';
    return Array.from(fixture.nativeElement.querySelectorAll(`.${side}-players .top-player${lineSelector}`));
  }

  function spot(playerCard: HTMLElement): { length: string, across: string } {
    return {length: playerCard.style.getPropertyValue('--length'), across: playerCard.style.getPropertyValue('--across')};
  }

  function bench(side: Side): HTMLElement {
    return fixture.nativeElement.querySelector(`.${side}-bench`);
  }

  function cardName(card: HTMLElement): string {
    return card.querySelector('.player-name').textContent.trim();
  }

  function names(side: Side, line: PositionLine): string[] {
    return cards(side, line).map(cardName);
  }

  function card(side: Side, name: string): HTMLElement {
    return cards(side).find(playerCard => cardName(playerCard) === name);
  }

  function rating(playerCard: HTMLElement): string {
    return playerCard.querySelector('.hokmob-score-container span').textContent.trim();
  }

  it('should line up the best rated goalie, two defensemen and three forwards of each team', () => {
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    expect(names('home', 'goalies')).toEqual(['Eric Comrie']);
    expect(names('home', 'defense')).toEqual(['Haydn Fleury', 'Elias Salomonsson']);
    expect(names('home', 'forwards')).toEqual(['Mark Scheifele', 'Cole Koepke', 'Morgan Barron']);
    expect(cards('home').map(rating)).toEqual(['7.9', '7.8', '6', '7', '6.7', '6.5']);

    expect(names('away', 'goalies')).toEqual(['Jordan Binnington']);
    expect(names('away', 'defense')).toEqual(['Logan Mailloux', 'Colton Parayko']);
    expect(names('away', 'forwards')).toEqual(['Dylan Holloway', 'Jimmy Snuggerud', 'Dalibor Dvorsky']);
  });

  it('should place each line at its distance from the end boards and spread its players across the rink', () => {
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    const lengths = cards('home').map(playerCard => parseFloat(spot(playerCard).length));
    // 17ft, 52ft and 85.6ft along a 200.13ft rink
    expect(lengths.map(length => length.toFixed(1))).toEqual(['8.5', '26.0', '26.0', '42.8', '42.8', '42.8']);
    expect(cards('home', 'defense').map(playerCard => spot(playerCard).across)).toEqual(['27.6%', '72.4%']);
    expect(cards('away', 'forwards').map(playerCard => spot(playerCard).across)).toEqual(['18%', '50%', '82%']);
    expect(spot(cards('away', 'goalies')[0])).toEqual(spot(cards('home', 'goalies')[0]));
  });

  it('should center a line with fewer players', () => {
    const homePlayers = gamePlayers(2025021057, true);
    const forwards = homePlayers.filter(player => player.skaterStats && player.position !== 'D').slice(0, 2);
    const defense = homePlayers.filter(player => player.position === 'D').slice(0, 1);
    show([...forwards, ...defense], gamePlayers(2025021057, false));
    expect(cards('home', 'defense').map(playerCard => spot(playerCard).across)).toEqual(['50%']);
    expect(cards('home', 'forwards').map(playerCard => spot(playerCard).across)).toEqual(['27.6%', '72.4%']);
  });

  it('should show the head coaches on the team benches', () => {
    fixture.componentRef.setInput('homeCoach', 'Scott Arniel');
    fixture.componentRef.setInput('awayCoach', 'Jim Montgomery');
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    expect(bench('home').querySelector('.coach-name').textContent.trim()).toBe('Scott Arniel');
    expect(bench('away').querySelector('.coach-name').textContent.trim()).toBe('Jim Montgomery');
    expect(bench('home').querySelector('.coach-label').textContent.trim()).toBe('Head Coach');
  });

  it('should show the team logos next to the coaches, and no logo when one is missing', () => {
    fixture.componentRef.setInput('homeCoach', 'Scott Arniel');
    fixture.componentRef.setInput('awayCoach', 'Jim Montgomery');
    fixture.componentRef.setInput('homeTeamLogo', NhlTeamLogoUtils.getTeamPrimaryLogo(52));
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    expect(bench('home').querySelector<HTMLElement & {src: string}>('.team-logo').src)
        .toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(52));
    expect(bench('away').querySelector('.team-logo')).toBeNull();
  });

  it('should show a dash for a missing coach and hide the benches without either coach', () => {
    fixture.componentRef.setInput('awayCoach', 'Jim Montgomery');
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    expect(bench('home').querySelector('.coach-name').textContent.trim()).toBe('-');

    fixture.componentRef.setInput('awayCoach', undefined);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.benches')).toBeNull();
  });

  it('should draw a rink lying across the card and one standing up, each with its own markings', () => {
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    const lying: SVGElement = fixture.nativeElement.querySelector('.rink-markings:not(.standing)');
    const standing: SVGElement = fixture.nativeElement.querySelector('.rink-markings.standing');
    expect(lying.getAttribute('viewBox')).toBe('0 0 200.13 78.74');
    expect(standing.getAttribute('viewBox')).toBe('0 0 200.13 98.42');
    for (const svg of [lying, standing]) {
      // Four end zone faceoff circles and the center circle, with a dot in each
      expect(svg.querySelectorAll('.thin circle').length).toBe(5);
      expect(svg.querySelectorAll('.dots circle').length).toBe(5);
      expect(svg.querySelectorAll('.blue-line').length).toBe(2);
      expect(svg.querySelectorAll('.crease').length).toBe(2);
      // The standing rink is squashed along its length on a phone, and the markings stretch with it
      expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    }
  });

  it('should keep the faceoff dots 22ft from the middle of a full width rink, and closer on the narrower one', () => {
    const [lying, standing] = component.rinkDrawings;
    expect(standing.faceoffCircles.map(circle => [circle.x, circle.y]))
        .toEqual([[35.1, 27.21], [35.1, 71.21], [165.03, 27.21], [165.03, 71.21]]);
    expect(standing.creasePaths[0]).toBe('M13.1 43.21 A6 6 0 0 1 13.1 55.21 Z');
    expect(standing.faceoffCircles[0].hashMarks).toBe('M33.6 12.46 v-2 M33.6 41.96 v2 M36.6 12.46 v-2 M36.6 41.96 v2');

    // 78.74ft is 80% of 98.42ft, so the dots are 17.6ft from the middle
    expect(lying.middle).toBe(39.37);
    expect(lying.faceoffCircles.slice(0, 2).map(circle => circle.y)).toEqual([21.77, 56.97]);
    expect(lying.goalY).toBe(36.37);
  });

  it('should pick the goalie who played over a better or equally rated backup who did not', () => {
    // Hofer didn't play and is rated 0, below Binnington's 4.1
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    expect(rating(cards('away', 'goalies')[0])).toBe('4.1');
    expect(cards('away', 'goalies')[0].querySelector('.goalie-icon')).not.toBeNull();
    expect(cards('away', 'forwards')[0].querySelector('.goalie-icon')).toBeNull();

    // Rated the same as Hellebuyck, Comrie still wins with his 59:52 on ice
    const homePlayers = gamePlayers(2025021057, true);
    homePlayers.find(player => player.playerId === 8477480).hokmobRating = 0;
    show(homePlayers.reverse(), gamePlayers(2025021057, false));
    expect(names('home', 'goalies')).toEqual(['Eric Comrie']);
  });

  it('should star the best rated player on the rink, preferring the home player in a tie', () => {
    show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
    expect(component.gameMvpPlayerId).toBe(8473533);
    expect(fixture.nativeElement.querySelectorAll('.star-icon').length).toBe(1);
    expect(card('away', 'Jordan Staal').querySelector('.star-icon')).not.toBeNull();

    const homePlayers = gamePlayers(2025030414, true);
    const homeForward = homePlayers.find(player => player.skaterStats && player.position !== 'D');
    homeForward.hokmobRating = 9.1;
    show(homePlayers, gamePlayers(2025030414, false));
    expect(component.gameMvpPlayerId).toBe(homeForward.playerId);
  });

  it('should show a puck for each goal, up to three', () => {
    show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
    // Jordan Staal scored twice, Nikolaj Ehlers once, Jalen Chatfield didn't score
    const pucks = (playerCard: HTMLElement) => playerCard.querySelectorAll('.puck-icon').length;
    expect(pucks(card('away', 'Jordan Staal'))).toBe(2);
    expect(pucks(card('away', 'Nikolaj Ehlers'))).toBe(1);
    expect(pucks(card('away', 'Jalen Chatfield'))).toBe(0);

    const awayPlayers = gamePlayers(2025030414, false);
    awayPlayers.find(player => player.playerId === 8473533).skaterStats.goals = 4;
    show(gamePlayers(2025030414, true), awayPlayers);
    expect(pucks(card('away', 'Jordan Staal'))).toBe(3);
  });

  it('should show the roster headshots and fall back to the blank headshot', () => {
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    const headshot: HTMLImageElement = card('home', 'Mark Scheifele').querySelector('.player-headshot');
    expect(headshot.getAttribute('src')).toBe('https://assets.nhle.com/mugs/nhl/20252026/WPG/8476460.png');
    headshot.dispatchEvent(new Event('error'));
    expect(headshot.src).toMatch(/assets\/blank_headshot\.png$/);
  });

  it('should emit the player ID when a player is clicked', () => {
    const clickedIds: number[] = [];
    component.playerClicked.subscribe(playerId => clickedIds.push(playerId));
    show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
    card('home', 'Mark Scheifele').click();
    card('away', 'Jordan Binnington').click();
    expect(clickedIds).toEqual([8476460, 8476412]);
  });

  it('should draw the rink with no players and no star without player stats', () => {
    show(undefined, []);
    expect(fixture.nativeElement.querySelector('.rink')).not.toBeNull();
    expect(cards('home').length).toBe(0);
    expect(cards('away').length).toBe(0);
    expect(component.gameMvpPlayerId).toBeUndefined();
  });

  it('should leave spots empty when a team has too few players at a position', () => {
    const homePlayers = gamePlayers(2025021057, true);
    const forwards = homePlayers.filter(player => player.skaterStats && player.position !== 'D').slice(0, 2);
    const defense = homePlayers.filter(player => player.position === 'D').slice(0, 1);
    show([...forwards, ...defense], gamePlayers(2025021057, false));
    expect(names('home', 'goalies')).toEqual([]);
    expect(names('home', 'defense')).toEqual(['Haydn Fleury']);
    expect(names('home', 'forwards')).toEqual(['Mark Scheifele', 'Cole Koepke']);
  });

  describe('highlighted player', () => {
    function highlight(highlightedPlayer: PlayerHighlight): void {
      fixture.componentRef.setInput('highlightedPlayer', highlightedPlayer);
      fixture.detectChanges();
    }

    function highlightedNames(): string[] {
      return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.top-player.highlighted')).map(cardName);
    }

    /** Whether each of the away player's pucks is green, in order. */
    function greenPucks(name: string): boolean[] {
      return Array.from<Element>(card('away', name).querySelectorAll('.player-goal-container'))
          .map(puck => puck.classList.contains('highlighted-goal'));
    }

    beforeEach(() => {
      // Jordan Staal (8473533) scored twice for the away team, Nikolaj Ehlers once
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
    });

    it("should highlight the hovered player's spot and turn only the hovered goal's puck green", () => {
      highlight({playerId: 8473533, goalIndex: 1});
      expect(highlightedNames()).toEqual(['Jordan Staal']);
      expect(greenPucks('Jordan Staal')).toEqual([false, true]);
      expect(greenPucks('Nikolaj Ehlers')).toEqual([false]);

      highlight({playerId: 8473533, goalIndex: 0});
      expect(greenPucks('Jordan Staal')).toEqual([true, false]);
    });

    it('should highlight the starred player in the rating blue and everyone else in the rating green', () => {
      // Jordan Staal is the game's starred player
      expect(component.gameMvpPlayerId).toBe(8473533);
      highlight({playerId: 8473533, goalIndex: 1});
      expect(card('away', 'Jordan Staal').style.getPropertyValue('--highlight-color')).toBe(StatsUtils.hokmobRatingBlue);

      highlight({playerId: 8477940, goalIndex: 0});
      expect(card('away', 'Nikolaj Ehlers').style.getPropertyValue('--highlight-color')).toBe(StatsUtils.hokmobRatingGreen);
      expect(card('away', 'Jordan Staal').style.getPropertyValue('--highlight-color')).toBe('');
    });

    it('should highlight the player without a green puck for a non-goal hover', () => {
      highlight({playerId: 8473533});
      expect(highlightedNames()).toEqual(['Jordan Staal']);
      expect(greenPucks('Jordan Staal')).toEqual([false, false]);
    });

    it('should highlight the player without a green puck for a goal past the third', () => {
      const awayPlayers = gamePlayers(2025030414, false);
      awayPlayers.find(player => player.playerId === 8473533).skaterStats.goals = 4;
      show(gamePlayers(2025030414, true), awayPlayers);
      highlight({playerId: 8473533, goalIndex: 3});
      expect(highlightedNames()).toEqual(['Jordan Staal']);
      expect(greenPucks('Jordan Staal')).toEqual([false, false, false]);
    });

    it('should highlight nothing for a player not in the top players, or after the hover ends', () => {
      highlight({playerId: 1, goalIndex: 0});
      expect(highlightedNames()).toEqual([]);
      highlight({playerId: 8473533, goalIndex: 0});
      highlight(null);
      expect(highlightedNames()).toEqual([]);
      expect(fixture.nativeElement.querySelectorAll('.highlighted-goal').length).toBe(0);
    });
  });
});

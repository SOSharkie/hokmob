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
    // Connor and Barron are both rated 6.5, and Connor is one of the Winnipeg stars
    expect(names('home', 'forwards')).toEqual(['Mark Scheifele', 'Cole Koepke', 'Kyle Connor']);
    expect(cards('home').map(rating)).toEqual(['7.9', '7.9', '6', '7.1', '6.7', '6.5']);

    expect(names('away', 'goalies')).toEqual(['Jordan Binnington']);
    // Parayko and Mailloux are both rated 6.3, and Parayko is one of the St. Louis stars
    expect(names('away', 'defense')).toEqual(['Colton Parayko', 'Logan Mailloux']);
    expect(names('away', 'forwards')).toEqual(['Dylan Holloway', 'Jimmy Snuggerud', 'Dalibor Dvorsky']);
  });

  it('should give a spot to a star player over an equally rated teammate', () => {
    // Carolina: Jaccob Slavin is one of its stars and Shayne Gostisbehere is not, and both are rated 6.2
    show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
    expect(names('away', 'defense')).toEqual(['Jalen Chatfield', 'Jaccob Slavin']);
    expect(cards('away', 'defense').map(rating)).toEqual(['7.1', '6.2']);
  });

  it('should keep the better rated player over a star', () => {
    // None of the three Carolina forwards is a star, so Sebastian Aho, rated 6.2, stays off the rink
    show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
    expect(names('away', 'forwards')).toEqual(['Jordan Staal', 'Nikolaj Ehlers', 'Logan Stankoven']);
    expect(card('away', 'Sebastian Aho')).toBeUndefined();
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
    expect(standing.getAttribute('viewBox')).toBe('0 0 157.47 98.42');
    for (const svg of [lying, standing]) {
      // Four end zone faceoff circles and the center circle, with a dot in each
      expect(svg.querySelectorAll('.thin circle').length).toBe(5);
      expect(svg.querySelectorAll('.dots circle').length).toBe(5);
      expect(svg.querySelectorAll('.blue-line').length).toBe(2);
      expect(svg.querySelectorAll('.crease').length).toBe(2);
      // Each viewBox is the shape its rink is drawn at, so this only takes up the rounding of the rink's border
      expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    }
  });

  it('should draw the standing rink shorter than a real one, keeping its markings round', () => {
    const [lying, standing] = component.rinkDrawings;
    // The viewBox is the shape the CSS gives the standing rink, so nothing in it is stretched
    expect(standing.length / standing.width).toBeCloseTo(GameTopPlayersComponent.standingAspectRatio, 4);
    expect(standing.viewBox).toBe('0 0 157.47 98.42');

    // A real rink is drawn as it is, and everything along the shorter one moves in with it, keeping its place
    expect(lying.goalLineXs).toEqual([13.1, 187.03]);
    expect(lying.blueLineXs).toEqual([71.1, 129.03]);
    expect(lying.goalXs).toEqual([9.8, 187.03]);
    expect(standing.goalLineXs).toEqual([10.31, 147.16]);
    expect(standing.blueLineXs).toEqual([55.94, 101.53]);
    expect(standing.centerX).toBe(78.74);
    expect(standing.goalXs).toEqual([7.01, 147.16]);
    expect(standing.goalLineXs[0] / standing.length).toBeCloseTo(lying.goalLineXs[0] / lying.length, 4);
    expect(standing.blueLineXs[0] / standing.length).toBeCloseTo(lying.blueLineXs[0] / lying.length, 4);

    // Every round marking shrinks with the square root of the length the rink lost, so it covers the same ice as the
    // oval it stands in for instead of looking too big for the shorter rink
    expect(lying.circleRadius).toBe(14.75);
    expect(standing.circleRadius).toBe(13.08);
    expect(standing.circleRadius / lying.circleRadius).toBeCloseTo(Math.sqrt(standing.length / lying.length), 3);
    expect(lying.creasePaths[0]).toBe('M13.1 33.37 A6 6 0 0 1 13.1 45.37 Z');
    expect(lying.refereeCreasePath).toBe('M90.06 0 A10 10 0 0 0 110.06 0');
    expect(standing.creasePaths[0]).toBe('M10.31 43.89 A5.32 5.32 0 0 1 10.31 54.53 Z');
    expect(standing.creasePaths[1]).toBe('M147.16 43.89 A5.32 5.32 0 0 0 147.16 54.53 Z');
    expect(standing.refereeCreasePath).toBe('M69.87 0 A8.87 8.87 0 0 0 87.61 0');
  });

  it('should keep the faceoff dots 22ft from the middle of a full width rink, and closer on the narrower one', () => {
    const [lying, standing] = component.rinkDrawings;
    expect(standing.faceoffCircles.map(circle => [circle.x, circle.y]))
        .toEqual([[27.62, 27.21], [27.62, 71.21], [129.85, 27.21], [129.85, 71.21]]);
    // The hash marks sit on the circle, so they move in with its radius
    expect(standing.faceoffCircles[0].hashMarks).toBe('M26.12 14.13 v-2 M26.12 40.29 v2 M29.12 14.13 v-2 M29.12 40.29 v2');

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
    homeForward.hokmobRating = 9.3; // Staal's rating, so the home player takes the tie
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

  describe('star lineup toggle', () => {
    function toggle(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('.lineup-toggle');
    }

    function title(): string {
      return fixture.nativeElement.querySelector('.game-top-players-header span').textContent.trim();
    }

    it('should show the rating lineup under Top Players until the toggle is pressed', () => {
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
      expect(title()).toBe('Top Players');
      expect(component.showStarLineup).toBeFalse();
      expect(toggle().getAttribute('aria-pressed')).toBe('false');
      expect(toggle().classList).not.toContain('showing-stars');
      expect(names('away', 'forwards')).toEqual(['Jordan Staal', 'Nikolaj Ehlers', 'Logan Stankoven']);
    });

    it("should show each team's five stars, and the goalie who played, when it is pressed", () => {
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
      toggle().click();
      fixture.detectChanges();
      expect(title()).toBe('Star Players');
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
      expect(toggle().classList).toContain('showing-stars');

      // Carolina's stars, none of them rated into the lineup: Svechnikov is rated 4.7 and Aho 6.2
      expect(names('away', 'forwards')).toEqual(['Sebastian Aho', 'Nikolaj Ehlers', 'Andrei Svechnikov']);
      expect(names('away', 'defense')).toEqual(['Jaccob Slavin', 'Shayne Gostisbehere']);
      expect(names('away', 'goalies')).toEqual(['Brandon Bussi']);
      // Vegas' stars, with Mitch Marner rated 5.1 and Shea Theodore 4.8
      expect(names('home', 'forwards')).toEqual(['Jack Eichel', 'Mitch Marner', 'Mark Stone']);
      expect(names('home', 'defense')).toEqual(['Rasmus Andersson', 'Shea Theodore']);
      expect(names('home', 'goalies')).toEqual(['Carter Hart']);
    });

    it('should star the best rated player of the lineup it is showing', () => {
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
      // Jordan Staal, rated 9.1, is no star player, so the rink's star moves to Nikolaj Ehlers
      expect(component.gameMvpPlayerId).toBe(8473533);
      toggle().click();
      fixture.detectChanges();
      expect(component.gameMvpPlayerId).toBe(8477940);
      expect(card('away', 'Nikolaj Ehlers').querySelector('.star-icon')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.star-icon').length).toBe(1);
    });

    it('should fill a missing star with the best rated player of that line', () => {
      // Calgary dressed neither of its star defensemen, so its two best rated ones keep the spots
      show(gamePlayers(2025020952, true), gamePlayers(2025020952, false));
      toggle().click();
      fixture.detectChanges();
      expect(names('away', 'forwards')).toEqual(['Matt Coronato', 'Mikael Backlund', 'Morgan Frost']);
      expect(names('away', 'defense')).toEqual(['Zach Whitecloud', 'Yan Kuznetsov']);
      expect(cards('away', 'defense').map(rating)).toEqual(['6.5', '6.4']);
    });

    it('should go back to the rating lineup when it is pressed again', () => {
      show(gamePlayers(2025021057, true), gamePlayers(2025021057, false));
      toggle().click();
      fixture.detectChanges();
      expect(names('home', 'forwards')).toEqual(['Mark Scheifele', 'Kyle Connor', 'Gabriel Vilardi']);

      toggle().click();
      fixture.detectChanges();
      expect(title()).toBe('Top Players');
      expect(names('home', 'forwards')).toEqual(['Mark Scheifele', 'Cole Koepke', 'Kyle Connor']);
      expect(names('home', 'defense')).toEqual(['Haydn Fleury', 'Elias Salomonsson']);
    });
  });

  describe('bench players', () => {
    function benchToggle(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('.bench-toggle');
    }

    function benchPlayers(side: Side): HTMLElement[] {
      return Array.from(bench(side).querySelectorAll('.bench-player'));
    }

    function benchNames(side: Side): string[] {
      return benchPlayers(side).map(cardName);
    }

    function isOpen(): boolean {
      return fixture.nativeElement.querySelector('.benches').classList.contains('expanded');
    }

    function clickToggle(): void {
      benchToggle().click();
      fixture.detectChanges();
    }

    beforeEach(() => {
      fixture.componentRef.setInput('homeCoach', 'Bruce Cassidy');
      fixture.componentRef.setInput('awayCoach', "Rod Brind'Amour");
    });

    it('should seat the four next best rated players of each team on its bench, best first', () => {
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
      // Aho and Gostisbehere are both rated 6.2, and Aho is one of the Carolina stars
      expect(benchNames('away')).toEqual(['Jackson Blake', 'Sebastian Aho', 'Shayne Gostisbehere', 'Taylor Hall']);
      expect(benchPlayers('away').map(rating)).toEqual(['6.7', '6.2', '6.2', '6.1']);
      // Vegas' third defenseman sits behind two forwards
      expect(benchNames('home')).toEqual(['William Karlsson', 'Cole Smith', 'Keegan Kolesar', 'Noah Hanifin']);
      expect(benchPlayers('home').map(rating)).toEqual(['6.4', '6', '6', '5.8']);
      // Nobody on the bench is on the rink too
      for (const side of ['home', 'away'] as Side[]) {
        expect(benchNames(side).filter(name => card(side, name))).toEqual([]);
      }
    });

    it('should keep the benches closed until the toggle is pressed, then close them again', () => {
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
      expect(isOpen()).toBeFalse();
      expect(benchToggle().getAttribute('aria-expanded')).toBe('false');
      expect(benchToggle().title).toBe('Show the bench players');
      expect(bench('home').querySelector('.bench-players').getAttribute('aria-hidden')).toBe('true');

      clickToggle();
      expect(isOpen()).toBeTrue();
      expect(benchToggle().getAttribute('aria-expanded')).toBe('true');
      expect(benchToggle().title).toBe('Hide the bench players');
      expect(bench('away').querySelector('.bench-players').getAttribute('aria-hidden')).toBe('false');

      clickToggle();
      expect(isOpen()).toBeFalse();
    });

    it('should seat the players above the coach', () => {
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
      const children = Array.from(bench('away').children).map(child => child.className);
      expect(children[0]).toContain('bench-players');
      expect(children[1]).toContain('coach');
      expect(bench('away').querySelector('.coach .coach-name').textContent.trim()).toBe("Rod Brind'Amour");
    });

    it("should move the rated players the star lineup leaves off the rink onto the bench", () => {
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
      fixture.nativeElement.querySelector('.lineup-toggle').click();
      fixture.detectChanges();
      expect(benchNames('away')).toEqual(['Jordan Staal', 'Logan Stankoven', 'Jalen Chatfield', 'Jackson Blake']);
      // The rink's star stays on the rink, so no one on the bench has one
      expect(benchPlayers('away')[0].querySelector('.star-icon')).toBeNull();
      expect(benchPlayers('away')[0].querySelectorAll('.puck-icon').length).toBe(2);
    });

    it('should seat a backup goalie, and fewer players when the team has fewer left', () => {
      const homePlayers = gamePlayers(2025021057, true);
      const forwards = homePlayers.filter(player => player.skaterStats && player.position !== 'D').slice(0, 4);
      const defense = homePlayers.filter(player => player.position === 'D').slice(0, 2);
      const goalies = homePlayers.filter(player => player.goalieStats);
      show([...forwards, ...defense, ...goalies], gamePlayers(2025021057, false));
      // Hellebuyck didn't play and is rated 0
      expect(benchNames('home')).toEqual(['Morgan Barron', 'Connor Hellebuyck']);
      expect(benchPlayers('home')[1].querySelector('.goalie-icon')).not.toBeNull();
      expect(benchPlayers('home')[0].querySelector('.goalie-icon')).toBeNull();
    });

    it('should emit the player ID when a bench player is clicked', () => {
      const clickedIds: number[] = [];
      component.playerClicked.subscribe(playerId => clickedIds.push(playerId));
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
      clickToggle();
      benchPlayers('away')[0].click();
      expect(clickedIds).toEqual([8482809]);
    });

    it('should highlight a hovered bench player', () => {
      show(gamePlayers(2025030414, true), gamePlayers(2025030414, false));
      fixture.componentRef.setInput('highlightedPlayer', {playerId: 8478427});
      fixture.detectChanges();
      const aho = benchPlayers('away')[1];
      expect(aho.classList).toContain('highlighted');
      expect(aho.style.getPropertyValue('--highlight-color')).toBe(StatsUtils.hokmobRatingGreen);
    });

    it('should leave the benches empty and hide the toggle without players', () => {
      show(undefined, []);
      expect(fixture.nativeElement.querySelector('.benches')).not.toBeNull();
      expect(benchPlayers('home').length).toBe(0);
      expect(benchPlayers('away').length).toBe(0);
      expect(benchToggle()).toBeNull();
    });
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

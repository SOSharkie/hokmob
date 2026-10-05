import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ClubStats } from '@shared/models/nhl-web-api/club-stats.model';
import { MockClubStatsKey, mockClubStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { GameSeasonLeadersComponent } from './game-season-leaders.component';

describe('GameSeasonLeadersComponent', () => {
  let component: GameSeasonLeadersComponent;
  let fixture: ComponentFixture<GameSeasonLeadersComponent>;

  /** Boston (6) hosting Utah (68), the teams of the future game 2026020056. */
  const bostonId = 6;
  const utahId = 68;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ GameSeasonLeadersComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameSeasonLeadersComponent);
    component = fixture.componentInstance;
  });

  type Side = 'home' | 'away';
  type PositionLine = 'goalies' | 'defense' | 'forwards';

  function show(homeStats: ClubStats, awayStats: ClubStats, homeTeamId = bostonId, awayTeamId = utahId): void {
    fixture.componentRef.setInput('homeStats', homeStats);
    fixture.componentRef.setInput('awayStats', awayStats);
    fixture.componentRef.setInput('homeTeamId', homeTeamId);
    fixture.componentRef.setInput('awayTeamId', awayTeamId);
    fixture.detectChanges();
  }

  function showSeason(season: '20252026' | '20262027'): void {
    show(mockClubStats(`BOS-${season}-2` as MockClubStatsKey), mockClubStats(`UTA-${season}-2` as MockClubStatsKey));
  }

  function cards(side: Side, line?: PositionLine): HTMLElement[] {
    const lineSelector = line ? `.${line}` : '';
    return Array.from(fixture.nativeElement.querySelectorAll(`.${side}-players .top-player${lineSelector}`));
  }

  function cardName(playerCard: HTMLElement): string {
    return playerCard.querySelector('.player-name').textContent.trim();
  }

  function names(side: Side, line: PositionLine): string[] {
    return cards(side, line).map(cardName);
  }

  function card(side: Side, name: string): HTMLElement {
    return cards(side).find(playerCard => cardName(playerCard) === name);
  }

  function statLine(playerCard: HTMLElement): string {
    return playerCard.querySelector('.player-stats').textContent.trim();
  }

  function header(selector: string): string {
    return fixture.nativeElement.querySelector(`.rink-card-header ${selector}`)?.textContent.trim();
  }

  it("should line up each team's top goalie by wins, and top two defensemen and three forwards by points", () => {
    showSeason('20252026');
    expect(names('home', 'goalies')).toEqual(['Jeremy Swayman']);
    expect(names('home', 'defense')).toEqual(['Charlie McAvoy', 'Mason Lohrei']);
    expect(names('home', 'forwards')).toEqual(['David Pastrnak', 'Morgan Geekie', 'Pavel Zacha']);
    expect(names('away', 'goalies')).toEqual(['Karel Vejmelka']);
    expect(names('away', 'defense')).toEqual(['Mikhail Sergachev', 'John Marino']);
    expect(names('away', 'forwards')).toEqual(['Clayton Keller', 'Nick Schmaltz', 'Dylan Guenther']);
  });

  it('should break a tie in points by goals', () => {
    showSeason('20262027');
    // Mark Kastelic's 3 points lead, then four forwards with 2: JJ Peterka (2 goals), Elias Lindholm and Fraser Minten
    // (1 goal each) and David Pastrnak (no goals)
    expect(names('home', 'forwards')).toEqual(['Mark Kastelic', 'JJ Peterka', 'Elias Lindholm']);
    // Dylan Guenther (3-2-5) ahead of Clayton Keller (0-5-5)
    expect(names('away', 'forwards')).toEqual(['Dylan Guenther', 'Clayton Keller', 'Nick Schmaltz']);
    expect(names('home', 'defense')).toEqual(['Hampus Lindholm', 'Nikita Zadorov']);
  });

  it('should break a tie in points and goals by fewer games played, then by the bigger star', () => {
    const boston = mockClubStats('BOS-20262027-2');
    const skater = (lastName: string) => boston.skaters.find(item => item.lastName.default === lastName);
    // Morgan Geekie, a Boston star, matches Elias Lindholm and Fraser Minten's 1-1-2 in 3 games
    Object.assign(skater('Geekie'), {goals: 1, assists: 1, points: 2});
    show(boston, mockClubStats('UTA-20262027-2'));
    expect(names('home', 'forwards')).toEqual(['Mark Kastelic', 'JJ Peterka', 'Morgan Geekie']);

    // Fraser Minten got there in 2 games
    skater('Minten').gamesPlayed = 2;
    show({...boston}, mockClubStats('UTA-20262027-2'));
    expect(names('home', 'forwards')).toEqual(['Mark Kastelic', 'JJ Peterka', 'Fraser Minten']);
  });

  it('should break a tie in wins by starts, then by save percentage', () => {
    showSeason('20262027');
    // Karel Vejmelka (2 starts) and Sebastian Cossa (1 start) have a win each
    expect(names('away', 'goalies')).toEqual(['Karel Vejmelka']);

    // With the same starts, Cossa's .944 beats Vejmelka's .917
    const utah = mockClubStats('UTA-20262027-2');
    utah.goalies.find(goalie => goalie.lastName.default === 'Cossa').gamesStarted = 2;
    show(mockClubStats('BOS-20262027-2'), utah);
    expect(names('away', 'goalies')).toEqual(['Sebastian Cossa']);
  });

  it('should leave out players without games', () => {
    const boston = mockClubStats('BOS-20252026-2');
    boston.goalies.find(goalie => goalie.lastName.default === 'Swayman').gamesPlayed = 0;
    show(boston, mockClubStats('UTA-20252026-2'));
    expect(names('home', 'goalies')).toEqual(['Joonas Korpisalo']);
  });

  it("should show each skater's games and goals, assists and points, and the goalie's record, SV% and GAA", () => {
    showSeason('20252026');
    expect(statLine(card('home', 'David Pastrnak'))).toBe('77 GP · 29-71-100');
    expect(statLine(card('away', 'Mikhail Sergachev'))).toBe('78 GP · 10-49-59');
    expect(statLine(card('home', 'Jeremy Swayman'))).toBe('31-18-4 · .908 · 2.71');
    expect(statLine(card('away', 'Karel Vejmelka'))).toBe('38-20-3 · .897 · 2.75');
  });

  it('should spell the stat line out for its tooltip and screen readers', () => {
    showSeason('20262027');
    const peterka = card('home', 'JJ Peterka');
    expect(peterka.querySelector('.player-stats').getAttribute('title'))
        .toBe('3 games played, 2 goals, 0 assists, 2 points');
    expect(card('home', 'Jeremy Swayman').getAttribute('aria-label'))
        .toBe('Jeremy Swayman, 2 wins, 0 losses, 0 overtime losses, .947 save percentage, 1.47 goals against average');
    expect(card('away', 'Karel Vejmelka').getAttribute('aria-label'))
        .toBe('Karel Vejmelka, 1 win, 1 loss, 0 overtime losses, .917 save percentage, 1.52 goals against average');
  });

  it('should name the season and game type of the totals', () => {
    showSeason('20252026');
    expect(header('.title')).toBe('Season Leaders');
    expect(header('.season-label')).toBe('2025-26 Regular Season');

    showSeason('20262027');
    expect(header('.season-label')).toBe('2026-27 Regular Season');

    // The 2025-26 final: Vegas hosting Carolina
    show(mockClubStats('VGK-20252026-3'), mockClubStats('CAR-20252026-3'), 54, 12);
    expect(header('.season-label')).toBe('2025-26 Playoffs');
    expect(names('home', 'goalies')).toEqual(['Carter Hart']);
    expect(names('away', 'forwards')).toEqual(['Jackson Blake', 'Taylor Hall', 'Nikolaj Ehlers']);
  });

  it("should switch to each team's star skaters and back, keeping the wins leader in goal", () => {
    showSeason('20262027');
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.lineup-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(header('.title')).toBe('Star Players');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    // Pavel Zacha has no points yet, but is one of Boston's stars
    expect(names('home', 'forwards')).toEqual(['David Pastrnak', 'Morgan Geekie', 'Pavel Zacha']);
    // Charlie McAvoy hasn't played, so the next defenseman by points joins Hampus Lindholm
    expect(names('home', 'defense')).toEqual(['Hampus Lindholm', 'Nikita Zadorov']);
    expect(names('home', 'goalies')).toEqual(['Jeremy Swayman']);
    expect(names('away', 'forwards')).toEqual(['Clayton Keller', 'Logan Cooley', 'Dylan Guenther']);

    toggle.click();
    fixture.detectChanges();
    expect(header('.title')).toBe('Season Leaders');
    expect(names('home', 'forwards')).toEqual(['Mark Kastelic', 'JJ Peterka', 'Elias Lindholm']);
  });

  it('should place the lines on the rink like the top players', () => {
    showSeason('20252026');
    const spot = (playerCard: HTMLElement) => [playerCard.style.getPropertyValue('--length'),
      playerCard.style.getPropertyValue('--across')];
    expect(cards('home', 'defense').map(playerCard => spot(playerCard)[1])).toEqual(['27.6%', '72.4%']);
    expect(cards('away', 'forwards').map(playerCard => spot(playerCard)[1])).toEqual(['18%', '50%', '82%']);
    expect(parseFloat(spot(cards('away', 'goalies')[0])[0]).toFixed(1)).toBe('8.5');
  });

  it('should show the players there are when a line is short, and no one for a team without totals', () => {
    const utah = mockClubStats('UTA-20252026-2');
    utah.goalies = [];
    utah.skaters = utah.skaters.filter(skater => skater.positionCode !== 'D' || skater.lastName.default === 'Marino');
    show(mockClubStats('BOS-20252026-2'), utah);
    expect(names('away', 'goalies')).toEqual([]);
    expect(names('away', 'defense')).toEqual(['John Marino']);
    expect(cards('away', 'defense')[0].style.getPropertyValue('--across')).toBe('50%');
    expect(cards('home').length).toBe(6);

    show(mockClubStats('BOS-20262027-3'), undefined);
    expect(cards('home').length).toBe(0);
    expect(cards('away').length).toBe(0);
    expect(header('.season-label')).toBe('2026-27 Playoffs');

    show(undefined, undefined);
    expect(header('.season-label')).toBeUndefined();
  });

  it("should link each player to his player page, and mark only the goalie with the mask", () => {
    showSeason('20252026');
    expect(card('home', 'David Pastrnak').getAttribute('href')).toBe('/player/8477956');
    expect(card('away', 'Karel Vejmelka').getAttribute('href')).toBe('/player/8478872');
    expect(card('away', 'Karel Vejmelka').querySelector('.goalie-icon')).not.toBeNull();
    expect(card('home', 'David Pastrnak').querySelector('.goalie-icon')).toBeNull();
  });

  it('should show the headshots and fall back to the blank headshot', () => {
    showSeason('20252026');
    const headshot: HTMLImageElement = card('home', 'David Pastrnak').querySelector('.player-headshot');
    expect(headshot.getAttribute('src')).toBe('https://assets.nhle.com/mugs/nhl/20252026/BOS/8477956.png');
    headshot.dispatchEvent(new Event('error'));
    expect(headshot.src).toMatch(/assets\/blank_headshot\.png$/);
  });

});

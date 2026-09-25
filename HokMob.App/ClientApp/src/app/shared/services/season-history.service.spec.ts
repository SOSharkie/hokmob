import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {SeasonHistoryService} from '@shared/services/season-history.service';
import {mockPlayerStats, MockPlayerStatsId, mockSeasonHistory} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {RatedGame, RatedSeason} from '@shared/models/nhl-history/season-history.model';
import {RecentPlayerGamesComponent} from '@app/player/recent-player-games/recent-player-games.component';

describe('SeasonHistoryService', () => {
  let service: SeasonHistoryService;
  let httpMock: HttpTestingController;

  const historyUrl = 'assets/history/20252026-2.json';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SeasonHistoryService]
    });
    service = TestBed.inject(SeasonHistoryService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function loadFixture(): Promise<RatedSeason> {
    const ratedSeason = service.getSeasonHistory(20252026, 2);
    httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
    return ratedSeason;
  }

  function ratedGamesOf(ratedSeason: RatedSeason, playerName: string): RatedGame[] {
    return ratedSeason.ratedGames.filter(game => game.player.name === playerName);
  }

  it('should load the season file and rate every skater and goalie who faced a shot', async () => {
    const ratedSeason = await loadFixture();
    expect(ratedSeason.season).toBe(20252026);
    expect(ratedSeason.gameType).toBe(2);
    expect(ratedSeason.games.length).toBe(7);
    expect(ratedSeason.players.length).toBe(208);
    // 252 skater rows and 15 of the 16 goalie rows
    expect(ratedSeason.ratedGames.length).toBe(267);
    expect(ratedSeason.ratedGames.filter(game => game.position === 'F').length).toBe(168);
    expect(ratedSeason.ratedGames.filter(game => game.position === 'D').length).toBe(84);
    expect(ratedSeason.ratedGames.filter(game => game.position === 'G').length).toBe(15);
    ratedSeason.ratedGames.forEach(game => expect(game.rating).withContext(game.player.name).toBeLessThanOrEqual(10));
  });

  it('should default to the regular season', () => {
    service.getSeasonHistory(20252026);
    httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
  });

  it('should give each rating its game, date, team and opponent', async () => {
    const ratedSeason = await loadFixture();
    const [lindholm] = ratedGamesOf(ratedSeason, 'Elias Lindholm');
    // BOS 5 @ CAR 6
    expect(lindholm.game.id).toBe(2025021237);
    expect(lindholm.game.date).toBe('2026-04-07');
    expect(lindholm.teamId).toBe(6);
    expect(lindholm.opponentId).toBe(12);
    expect(lindholm.game.awayScore).toBe(5);
    expect(lindholm.game.homeScore).toBe(6);
    expect(lindholm.position).toBe('F');
    expect(lindholm.player.position).toBe('C');
    expect(lindholm.timeOnIce).toBeGreaterThan(0);
  });

  it('should rate every game the same as the player page rates the same stat lines', async () => {
    const ratedSeason = await loadFixture();
    const players: [MockPlayerStatsId, string, boolean][] = [
      [8477496, 'Elias Lindholm', false],
      [8477934, 'Leon Draisaitl', false],
      [8476945, 'Connor Hellebuyck', true],
      [8483548, 'Brandon Bussi', true]
    ];
    let compared = 0;
    players.forEach(([playerId, name, isGoalie]) => {
      const recentGames = new RecentPlayerGamesComponent();
      recentGames.games = mockPlayerStats(playerId).recentGames;
      recentGames.isGoalie = isGoalie;
      recentGames.ngOnChanges();
      ratedGamesOf(ratedSeason, name).forEach(ratedGame => {
        const row = recentGames.rows.find(recentRow => recentRow.gameId === ratedGame.game.id);
        expect(row).withContext(name + ' ' + ratedGame.game.id).toBeDefined();
        expect(ratedGame.rating).withContext(name + ' ' + ratedGame.game.id).toBe(row.hokmobRating);
        compared++;
      });
    });
    // Lindholm and Bussi 2 games each, Draisaitl and Hellebuyck 1
    expect(compared).toBe(6);
  });

  it('should leave out a goalie who faced no shots, but not the other goalie of the team', async () => {
    const ratedSeason = await loadFixture();
    expect(ratedSeason.players.some(player => player.name === 'Pyotr Kochetkov')).toBeTrue();
    expect(ratedGamesOf(ratedSeason, 'Pyotr Kochetkov')).toEqual([]);
    expect(ratedGamesOf(ratedSeason, 'Frederik Andersen').length).toBe(1);
  });

  it('should give a traded player each game\'s team', async () => {
    const ratedSeason = await loadFixture();
    // Nic Dowd played for Washington, then Vegas
    expect(ratedGamesOf(ratedSeason, 'Nic Dowd').map(game => game.teamId)).toEqual([15, 54]);
  });

  it('should only work out the uncapped rating of a game rated 10', async () => {
    const history = mockSeasonHistory();
    // Draisaitl's real game, with 5 more goals on 5 more shots
    const row = history.skaters.game.findIndex((game, index) => history.games.id[game] === 2025021061 &&
        history.players.name[history.skaters.player[index]] === 'Leon Draisaitl');
    history.skaters.goals[row] += 5;
    history.skaters.shots[row] += 5;
    const ratedSeason = SeasonHistoryService.rateSeason(history);
    const [draisaitl] = ratedGamesOf(ratedSeason, 'Leon Draisaitl');
    expect(draisaitl.rating).toBe(10);
    expect(draisaitl.uncappedRating).toBeGreaterThan(10);
    expect(ratedSeason.ratedGames.filter(game => game.rating < 10).every(game => game.uncappedRating === undefined))
        .toBeTrue();
  });

  it('should load and rate a season once, for every caller', async () => {
    const first = service.getSeasonHistory(20252026, 2);
    const second = service.getSeasonHistory(20252026, 2);
    httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
    expect(await first).toBe(await second);

    expect(await service.getSeasonHistory(20252026, 2)).toBe(await first);
    httpMock.expectNone(historyUrl);
  });

  it('should reject on an HTTP error, and ask again on the next call', async () => {
    const failed = service.getSeasonHistory(20252026, 2);
    const rejection = expectAsync(failed).toBeRejected();
    httpMock.expectOne(historyUrl).flush('Not found', {status: 404, statusText: 'Not Found'});
    await rejection;
    expect(console.error).toHaveBeenCalled();

    const retried = await loadFixture();
    expect(retried.ratedGames.length).toBe(267);
  });

  it('should reject a file it can\'t rate', async () => {
    const failed = service.getSeasonHistory(20252026, 2);
    const rejection = expectAsync(failed).toBeRejected();
    httpMock.expectOne(historyUrl).flush({season: 20252026});
    await rejection;
    expect(console.error).toHaveBeenCalled();
  });

  describe('getPositionGroup', () => {
    it('should group centers and wingers as forwards', () => {
      expect(['C', 'L', 'R'].map(SeasonHistoryService.getPositionGroup)).toEqual(['F', 'F', 'F']);
      expect(SeasonHistoryService.getPositionGroup('D')).toBe('D');
      expect(SeasonHistoryService.getPositionGroup('G')).toBe('G');
    });
  });
});

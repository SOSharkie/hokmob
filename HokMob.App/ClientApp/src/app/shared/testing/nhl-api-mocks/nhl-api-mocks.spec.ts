import {
  mockDraftPicks,
  mockDraftStats,
  mockGoalieStatsLeaders,
  mockHitsAndShotsLeaders,
  mockPlayerLanding,
  mockPlayerSearchResults,
  mockPlayerStats,
  mockPlayoffBracket,
  mockSkaterStatsLeaders,
  mockSeasonDates,
  mockSeasonHistory,
  mockTeamStats
} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";
import {GoalieGameStats, SkaterGameStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";

/**
 * The fixtures are real responses, and the specs of every phase assert values that are in them. These tests check
 * that each accessor returns the response it says it does, and a fresh copy every time.
 */
describe('nhl-api-mocks', () => {

  describe('mockPlayerLanding', () => {
    it('should return the captured landing of every player', () => {
      expect(mockPlayerLanding(8476460).lastName.default).toBe('Scheifele');
      expect(mockPlayerLanding(8477480).position).toBe('G');
      expect(mockPlayerLanding(8476945).lastName.default).toBe('Hellebuyck');
      expect(mockPlayerLanding(8470638).lastName.default).toBe('Bergeron');
    });

    it('should return a retired player without a current team', () => {
      const bergeron = mockPlayerLanding(8470638);
      expect(bergeron.isActive).toBeFalse();
      expect(bergeron.currentTeamId).toBeUndefined();
      expect(bergeron.featuredStats.season).toBe(20222023);
    });

    it('should return the draft details and the latest season of an active player', () => {
      const scheifele = mockPlayerLanding(8476460);
      expect(scheifele.draftDetails).toEqual(jasmine.objectContaining({year: 2011, round: 1, overallPick: 7}));
      expect(scheifele.featuredStats.season).toBe(20252026);
      expect(scheifele.featuredStats.regularSeason.subSeason.points).toBe(103);
    });

    it('should return a fresh copy', () => {
      mockPlayerLanding(8476945).sweaterNumber = 99;
      expect(mockPlayerLanding(8476945).sweaterNumber).not.toBe(99);
    });
  });

  describe('mockSkaterStatsLeaders and mockGoalieStatsLeaders', () => {
    it('should return 5 leaders per category, best first', () => {
      const skaters = mockSkaterStatsLeaders();
      expect(skaters.points.length).toBe(5);
      expect(skaters.points[0].lastName.default).toBe('McDavid');
      expect(skaters.points[0].value).toBe(138);
      expect(mockGoalieStatsLeaders().wins.length).toBe(5);
    });

    it('should return the time on ice in seconds', () => {
      expect(mockSkaterStatsLeaders().toi[0].value).toBeGreaterThan(600);
    });

    it('should return the playoff leaders of the same season', () => {
      expect(mockSkaterStatsLeaders(3).points.length).toBe(5);
      expect(mockGoalieStatsLeaders(3).savePctg[0].value).toBeLessThanOrEqual(1);
    });
  });

  describe('mockPlayoffBracket', () => {
    it('should return the 2026 bracket by default', () => {
      expect(mockPlayoffBracket().series.length).toBe(15);
      expect(mockPlayoffBracket().series[0].seriesLetter).toBe('A');
    });

    it('should return a bracket of every captured year', () => {
      expect(mockPlayoffBracket(2023).series.length).toBe(15);
      expect(mockPlayoffBracket(2021).series.length).toBe(15);
      expect(mockPlayoffBracket(2020).series.length).toBe(23);
      expect(mockPlayoffBracket(2027).series).toEqual([]);
    });

    it('should return the 2020 qualifying round as round 0, and 2021 without conferences', () => {
      expect(mockPlayoffBracket(2020).series.filter(series => series.playoffRound === 0).length).toBe(8);
      expect(mockPlayoffBracket(2021).series.every(series => !series.conferenceName)).toBeTrue();
    });

    it('should return a fresh copy', () => {
      mockPlayoffBracket(2023).series.pop();
      expect(mockPlayoffBracket(2023).series.length).toBe(15);
    });
  });

  describe('mockPlayerSearchResults', () => {
    it('should return real search results with string IDs', () => {
      const results = mockPlayerSearchResults();
      expect(results.length).toBe(10);
      expect(results[0].name).toBe('Mackenzie Blackwood');
      expect(results[0].playerId).toBe('8478406');
      expect(results.every(result => result.active)).toBeTrue();
    });

    it('should include a player without a last season', () => {
      expect(mockPlayerSearchResults().some(result => !result.lastSeasonId)).toBeTrue();
    });
  });

  describe('mockPlayerStats', () => {
    it('should return a skater with hits and scores in his recent games', () => {
      const barbashev = mockPlayerStats(8477964);
      const games = barbashev.recentGames as SkaterGameStats[];
      expect(games.length).toBe(10);
      expect(games[0].gameId).toBe(2025030416);
      expect(games[0].gameType).toBe(3);
      expect(games[0].hits).toBeDefined();
      expect(games[0].homeScore).toBeDefined();
    });

    it('should return a traded season as one row, newest season first', () => {
      const seasons = mockPlayerStats(8477496).regularSeasons as SkaterSeasonStats[];
      expect(seasons[0].seasonId).toBeGreaterThan(seasons[1].seasonId);
      const tradedSeason = seasons.find(season => season.seasonId === 20232024);
      expect(tradedSeason.teamAbbrevs).toBe('CGY,VAN');
      expect(tradedSeason.gamesPlayed).toBe(75);
      expect(tradedSeason.points).toBe(44);
      expect(tradedSeason.hits).toBe(89);
    });

    it('should return goalies with their saves by strength', () => {
      const hellebuyck = mockPlayerStats(8476945).recentGames as GoalieGameStats[];
      expect(hellebuyck[0].evSaves).toBeDefined();
      expect(hellebuyck[0].ppShotsAgainst).toBeDefined();
      const bussi = (mockPlayerStats(8483548).recentGames as GoalieGameStats[])
          .find(game => game.gameId === 2025030414);
      expect(bussi.saves).toBe(18);
      expect(bussi.shotsAgainst).toBe(21);
    });

    it('should return a fresh copy', () => {
      mockPlayerStats(8477964).recentGames.pop();
      expect(mockPlayerStats(8477964).recentGames.length).toBe(10);
    });
  });

  describe('mockHitsAndShotsLeaders', () => {
    it('should return the top 5 skaters by hits and by shots', () => {
      const leaders = mockHitsAndShotsLeaders();
      expect(leaders.hits.length).toBe(5);
      expect(leaders.hits[0].skaterFullName).toBe('Yakov Trenin');
      expect(leaders.hits[0].hits).toBe(413);
      expect(leaders.shots[0].skaterFullName).toBe('Nathan MacKinnon');
      expect(leaders.shots[0].shots).toBe(350);
    });
  });

  describe('mockTeamStats', () => {
    it('should return all 32 teams of 2025-26, with Utah as 68', () => {
      const teams = mockTeamStats().teams;
      expect(teams.length).toBe(32);
      expect(teams.find(team => team.teamId === 68).teamFullName).toContain('Utah');
      expect(teams.find(team => team.teamId === 6).teamFullName).toBe('Boston Bruins');
    });

    it('should return no teams for a season without games', () => {
      expect(mockTeamStats(20262027).teams).toEqual([]);
    });
  });

  describe('mockSeasonDates', () => {
    it('should return the two latest seasons, newest first, with a fresh copy every time', () => {
      const seasons = mockSeasonDates().seasons;
      expect(seasons.map(season => season.id)).toEqual([20262027, 20252026]);
      expect(seasons[0].firstGameDate).toBe('2026-09-19');
      expect(seasons[0].firstPlayoffGameDate).toBeNull();
      expect(seasons[1].firstPlayoffGameDate).toBe('2026-04-18');
      seasons[0].id = 0;
      expect(mockSeasonDates().seasons[0].id).toBe(20262027);
    });
  });

  describe('mockDraftPicks', () => {
    it('should return the latest draft by default', () => {
      const draft = mockDraftPicks();
      expect(draft.draftYear).toBe(2026);
      expect(draft.picks.length).toBe(32);
      expect(draft.picks[0].lastName.default).toBe('McKenna');
      expect(draft.draftYears[draft.draftYears.length - 1]).toBe(2026);
      expect(draft.selectableRounds).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should return round 1 of every captured year', () => {
      expect(mockDraftPicks(2006).picks[2].positionCode).toBe('F');
      expect(mockDraftPicks(2015).picks[0].teamName.default).toBe('Edmonton Oilers');
      expect(mockDraftPicks(2021).picks.length).toBe(32);
    });

    it('should return the forfeited 2021 pick without a first name or position', () => {
      const forfeited = mockDraftPicks(2021).picks.find(pick => pick.overallPick === 11);
      expect(forfeited.lastName.default).toBe('Forfeited');
      expect(forfeited.firstName).toBeUndefined();
      expect(forfeited.positionCode).toBeUndefined();
    });

    it('should return a fresh copy', () => {
      mockDraftPicks(2015).picks.pop();
      expect(mockDraftPicks(2015).picks.length).toBe(30);
    });
  });

  describe('mockDraftStats', () => {
    it('should return a player per 2015 pick, sorted by overall pick, with the goalie', () => {
      const players = mockDraftStats().players;
      expect(players.map(player => player.draftOverall)).toEqual(Array.from({length: 30}, (_, i) => i + 1));
      expect(players[0]).toEqual(jasmine.objectContaining({name: 'Connor McDavid', goals: 409, assists: 811, points: 1220}));
      expect(players[21]).toEqual(jasmine.objectContaining({name: 'Ilya Samsonov', positionCode: 'G', assists: 5}));
    });

    it('should leave out the 2006 players who never played', () => {
      const overallPicks = mockDraftStats(2006).players.map(player => player.draftOverall);
      expect(overallPicks.length).toBe(27);
      expect(overallPicks).not.toContain(19);
      expect(overallPicks).not.toContain(20);
      expect(overallPicks).not.toContain(24);
    });

    it('should return a fresh copy', () => {
      mockDraftStats().players.pop();
      expect(mockDraftStats().players.length).toBe(30);
    });
  });

  describe('mockSeasonHistory', () => {
    it('should return the 7 generated games, with every column of a table as long as the table', () => {
      const history = mockSeasonHistory();
      expect(history.season).toBe(20252026);
      expect(history.gameType).toBe(2);
      expect(history.games.id).toEqual([2025020259, 2025021057, 2025021061, 2025021237, 2025021290, 2025021292,
        2025021293]);
      const tables: [object, number][] = [[history.games, 7], [history.players, 208], [history.skaters, 252],
        [history.goalies, 16]];
      tables.forEach(([table, length]) => Object.entries(table).forEach(([field, column]) =>
          expect((column as unknown[]).length).withContext(field).toBe(length)));
    });

    it('should point every row at a player and a game in the file', () => {
      const history = mockSeasonHistory();
      [history.skaters, history.goalies].forEach(rows => {
        expect(rows.player.every(index => index >= 0 && index < 208)).toBeTrue();
        expect(rows.game.every(index => index >= 0 && index < 7)).toBeTrue();
      });
      const lindholm = history.players.name.indexOf('Elias Lindholm');
      expect(history.players.id[lindholm]).toBe(8477496);
      expect(history.players.position[lindholm]).toBe('C');
    });

    it('should return a fresh copy every time', () => {
      mockSeasonHistory().games.id.pop();
      expect(mockSeasonHistory().games.id.length).toBe(7);
    });
  });
});

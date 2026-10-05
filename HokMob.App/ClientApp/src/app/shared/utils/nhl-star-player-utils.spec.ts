import {NhlStarPlayerUtils} from "@shared/utils/nhl-star-player-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {MockGamecenterGameId, mockClubStats, mockGameBoxscore} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";
import {BoxscoreSkater} from "@shared/models/nhl-web-api/boxscore.model";

describe('NhlStarPlayerUtils', () => {

  /** The games the star players are checked against, and the teams they dressed for. */
  const gameIds: MockGamecenterGameId[] = [2025020952, 2025021057, 2025030414];

  /** Every skater of those games by player ID, with the position the boxscore gave him. */
  function boxscoreSkaters(): Map<number, BoxscoreSkater> {
    return new Map(gameIds.flatMap(gameId => {
      const players = mockGameBoxscore(gameId).playerByGameStats;
      return [players.homeTeam, players.awayTeam].flatMap(team => [...team.forwards, ...team.defense]);
    }).map(skater => [skater.playerId, skater]));
  }

  describe('getStarForwardIds and getStarDefenseIds', () => {
    it('should give every active team three star forwards and two star defensemen', () => {
      const activeTeamIds = NhlTeamUtils.getActiveTeamIds();
      expect(activeTeamIds.length).toBe(32);
      for (const teamId of activeTeamIds) {
        const context = NhlTeamUtils.getTeam(teamId).name;
        expect(NhlStarPlayerUtils.getStarForwardIds(teamId).length).withContext(context).toBe(3);
        expect(NhlStarPlayerUtils.getStarDefenseIds(teamId).length).withContext(context).toBe(2);
      }
    });

    it('should give a team its own stars, the bigger star first', () => {
      // Edmonton (22) and Carolina (12)
      expect(NhlStarPlayerUtils.getStarForwardIds(22)).toEqual([8478402, 8477934, 8476454]);
      expect(NhlStarPlayerUtils.getStarDefenseIds(22)).toEqual([8480803, 8475218]);
      expect(NhlStarPlayerUtils.getStarForwardIds(12)).toEqual([8478427, 8477940, 8480830]);
      expect(NhlStarPlayerUtils.getStarDefenseIds(12)).toEqual([8476958, 8476906]);
    });

    it('should give no stars to the former Arizona or an unknown team', () => {
      expect(NhlStarPlayerUtils.getStarForwardIds(53)).toEqual([]);
      expect(NhlStarPlayerUtils.getStarDefenseIds(53)).toEqual([]);
      expect(NhlStarPlayerUtils.getStarPlayerIds(undefined)).toEqual([]);
    });

    it('should name each star only once', () => {
      const starPlayerIds = NhlTeamUtils.getActiveTeamIds().flatMap(teamId => NhlStarPlayerUtils.getStarPlayerIds(teamId));
      expect(starPlayerIds.length).toBe(160);
      expect(new Set(starPlayerIds).size).toBe(starPlayerIds.length);
    });
  });

  describe('getStarPlayerIds', () => {
    it('should give all five stars of a team, its forwards first', () => {
      // Winnipeg: Mark Scheifele, Kyle Connor and Gabriel Vilardi, then Josh Morrissey and Dylan DeMelo
      expect(NhlStarPlayerUtils.getStarPlayerIds(52)).toEqual([8476460, 8478398, 8480014, 8477504, 8476331]);
    });
  });

  describe('getStarRank', () => {
    it("should rank a team's stars within their own line", () => {
      // Colorado's forwards Nathan MacKinnon, Martin Necas and Brock Nelson, and its defensemen Cale Makar and Devon Toews
      expect([8477492, 8480039, 8475754].map(playerId => NhlStarPlayerUtils.getStarRank(playerId))).toEqual([1, 2, 3]);
      expect([8480069, 8478038].map(playerId => NhlStarPlayerUtils.getStarRank(playerId))).toEqual([1, 2]);
    });

    it('should rank every line of every team, and no one else', () => {
      for (const teamId of NhlTeamUtils.getActiveTeamIds()) {
        const context = NhlTeamUtils.getTeam(teamId).name;
        expect(NhlStarPlayerUtils.getStarForwardIds(teamId).map(playerId => NhlStarPlayerUtils.getStarRank(playerId)))
            .withContext(context).toEqual([1, 2, 3]);
        expect(NhlStarPlayerUtils.getStarDefenseIds(teamId).map(playerId => NhlStarPlayerUtils.getStarRank(playerId)))
            .withContext(context).toEqual([1, 2]);
      }
      // Jalen Chatfield, a Carolina defenseman who isn't one of its stars
      expect(NhlStarPlayerUtils.getStarRank(8478970)).toBeUndefined();
      expect(NhlStarPlayerUtils.getStarRank(undefined)).toBeUndefined();
    });
  });

  describe('isStarPlayer', () => {
    it('should know a star from the rest', () => {
      // Robert Thomas, one of the St. Louis stars, and his teammate Oskar Sundqvist
      expect(NhlStarPlayerUtils.isStarPlayer(8480023)).toBeTrue();
      expect(NhlStarPlayerUtils.isStarPlayer(8476897)).toBeFalse();
      expect(NhlStarPlayerUtils.isStarPlayer(undefined)).toBeFalse();
    });

    it('should name no goalies, since the top players card always shows the one who played', () => {
      // Every dressed goalie of three real games, Connor Hellebuyck, Jordan Binnington and Dustin Wolf among them
      const goalies = gameIds.flatMap(gameId => {
        const players = mockGameBoxscore(gameId).playerByGameStats;
        return [...players.homeTeam.goalies, ...players.awayTeam.goalies];
      });
      expect(goalies.length).toBe(12);
      for (const goalie of goalies) {
        expect(NhlStarPlayerUtils.isStarPlayer(goalie.playerId)).withContext(goalie.name.default).toBeFalse();
      }
    });
  });

  describe('pickStarLine', () => {
    /** Boston's 2026-27 skaters at one position, most points first, as the season leaders card lists them. */
    function bostonSkaters(defense: boolean) {
      return mockClubStats('BOS-20262027-2').skaters
          .filter(skater => (skater.positionCode === 'D') === defense)
          .sort((skaterA, skaterB) => skaterB.points - skaterA.points);
    }

    it("should line up a team's stars, the bigger star first, whatever their place in the list", () => {
      // Boston (6): David Pastrnak, Morgan Geekie and Pavel Zacha, with 2, 1 and 0 points
      const forwards = NhlStarPlayerUtils.pickStarLine(bostonSkaters(false), NhlStarPlayerUtils.getStarForwardIds(6), 3);
      expect(forwards.map(skater => skater.lastName.default)).toEqual(['Pastrnak', 'Geekie', 'Zacha']);
    });

    it('should top up the line with the first of the others when a star is missing', () => {
      // Charlie McAvoy hasn't played, so Hampus Lindholm is joined by the next defenseman in the list
      const defense = NhlStarPlayerUtils.pickStarLine(bostonSkaters(true), NhlStarPlayerUtils.getStarDefenseIds(6), 2);
      expect(defense.map(skater => skater.lastName.default)).toEqual(['Lindholm', 'Zadorov']);
    });

    it('should keep the order of the list for a team without stars, and return no more than there are', () => {
      const skaters = bostonSkaters(true);
      expect(NhlStarPlayerUtils.pickStarLine(skaters, [], 2)).toEqual(skaters.slice(0, 2));
      expect(NhlStarPlayerUtils.pickStarLine(skaters.slice(0, 1), NhlStarPlayerUtils.getStarDefenseIds(6), 2))
          .toEqual(skaters.slice(0, 1));
      expect(NhlStarPlayerUtils.pickStarLine([], NhlStarPlayerUtils.getStarDefenseIds(6), 2)).toEqual([]);
    });
  });

  describe('the star lines', () => {
    it('should list every star at the position he plays', () => {
      const skaters = boxscoreSkaters();
      let checked = 0;
      for (const teamId of NhlTeamUtils.getActiveTeamIds()) {
        for (const playerId of NhlStarPlayerUtils.getStarForwardIds(teamId)) {
          const skater = skaters.get(playerId);
          if (skater) {
            checked++;
            expect(skater.position).withContext(skater.name.default).not.toBe('D');
          }
        }
        for (const playerId of NhlStarPlayerUtils.getStarDefenseIds(teamId)) {
          const skater = skaters.get(playerId);
          if (skater) {
            checked++;
            expect(skater.position).withContext(skater.name.default).toBe('D');
          }
        }
      }
      // The six teams of those games dressed most of their stars
      expect(checked).toBeGreaterThan(20);
    });
  });

});

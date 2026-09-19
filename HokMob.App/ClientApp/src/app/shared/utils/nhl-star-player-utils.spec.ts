import {NhlStarPlayerUtils} from "@shared/utils/nhl-star-player-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {MockGamecenterGameId, mockGameBoxscore} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('NhlStarPlayerUtils', () => {

  describe('getStarPlayerIds', () => {
    it('should give every active team two star players', () => {
      const activeTeamIds = NhlTeamUtils.getActiveTeamIds();
      expect(activeTeamIds.length).toBe(32);
      for (const teamId of activeTeamIds) {
        expect(NhlStarPlayerUtils.getStarPlayerIds(teamId).length)
            .withContext(NhlTeamUtils.getTeam(teamId).name).toBe(2);
      }
    });

    it('should give a team its own stars, biggest first', () => {
      // Connor McDavid and Leon Draisaitl of Edmonton (22), Sidney Crosby and Evgeni Malkin of Pittsburgh (5)
      expect(NhlStarPlayerUtils.getStarPlayerIds(22)).toEqual([8478402, 8477934]);
      expect(NhlStarPlayerUtils.getStarPlayerIds(5)).toEqual([8471675, 8471215]);
    });

    it('should give no stars to the former Arizona or an unknown team', () => {
      expect(NhlStarPlayerUtils.getStarPlayerIds(53)).toEqual([]);
      expect(NhlStarPlayerUtils.getStarPlayerIds(undefined)).toEqual([]);
    });

    it('should name each star only once', () => {
      const starPlayerIds = NhlTeamUtils.getActiveTeamIds().flatMap(teamId => NhlStarPlayerUtils.getStarPlayerIds(teamId));
      expect(new Set(starPlayerIds).size).toBe(starPlayerIds.length);
    });
  });

  describe('getStarRank', () => {
    it("should rank a team's stars 1 and 2", () => {
      // Nathan MacKinnon and Cale Makar of Colorado
      expect(NhlStarPlayerUtils.getStarRank(8477492)).toBe(1);
      expect(NhlStarPlayerUtils.getStarRank(8480069)).toBe(2);
    });

    it("should rank every team's stars, and no one else", () => {
      for (const teamId of NhlTeamUtils.getActiveTeamIds()) {
        expect(NhlStarPlayerUtils.getStarPlayerIds(teamId).map(playerId => NhlStarPlayerUtils.getStarRank(playerId)))
            .withContext(NhlTeamUtils.getTeam(teamId).name).toEqual([1, 2]);
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

    it('should name no goalies, since the top players card always shows one', () => {
      // Every dressed goalie of three real games, Connor Hellebuyck, Jordan Binnington and Dustin Wolf among them
      const gameIds: MockGamecenterGameId[] = [2025020952, 2025021057, 2025030414];
      const goalies = gameIds.flatMap(gameId => {
        const players = mockGameBoxscore(gameId).playerByGameStats;
        return [...players.homeTeam.goalies, ...players.awayTeam.goalies];
      });
      expect(goalies.length).toBeGreaterThan(8);
      for (const goalie of goalies) {
        expect(NhlStarPlayerUtils.isStarPlayer(goalie.playerId))
            .withContext(goalie.name.default).toBeFalse();
      }
    });
  });

});

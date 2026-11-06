import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {mockFutureGame, mockStandingsTeams} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('NhlTeamUtils', () => {

  describe('getTeamIdByAbbrev', () => {
    it('should find every team in the real standings, with matching abbreviation and full name', () => {
      mockStandingsTeams().forEach(standingsTeam => {
        const teamId = NhlTeamUtils.getTeamIdByAbbrev(standingsTeam.teamAbbrev.default);
        expect(teamId).withContext(standingsTeam.teamAbbrev.default).toBeDefined();
        const team = NhlTeamUtils.getTeam(teamId);
        expect(team.triCode).toBe(standingsTeam.teamAbbrev.default);
        expect(team.name).withContext(standingsTeam.teamAbbrev.default).toBe(standingsTeam.teamName.default);
      });
    });

    it('should find Utah as team 68, matching the score API', () => {
      const utah = mockFutureGame().awayTeam;
      expect(NhlTeamUtils.getTeamIdByAbbrev(utah.abbrev)).toBe(utah.id);
    });

    it('should find the Mammoth rather than the Utah Hockey Club, which has the same abbreviation', () => {
      expect(NhlTeamUtils.getTeam(59).triCode).toBe(NhlTeamUtils.getTeam(68).triCode);
      expect(NhlTeamUtils.getTeamIdByAbbrev('UTA')).toBe(68);
    });

    it('should ignore letter case and still find former teams', () => {
      expect(NhlTeamUtils.getTeamIdByAbbrev('sjs')).toBe(28);
      expect(NhlTeamUtils.getTeamIdByAbbrev('ARI')).toBe(53);
    });

    it('should return undefined for an unknown or missing abbreviation', () => {
      expect(NhlTeamUtils.getTeamIdByAbbrev('XYZ')).toBeUndefined();
      expect(NhlTeamUtils.getTeamIdByAbbrev(undefined)).toBeUndefined();
    });
  });

  describe('getTeam', () => {
    it('should know the Utah Hockey Club, the team ID of the 2024-25 season', () => {
      expect(NhlTeamUtils.getTeam(59)).toEqual({
        id: 59,
        name: 'Utah Hockey Club',
        shortName: 'Utah',
        teamName: 'Hockey Club',
        triCode: 'UTA'
      });
    });
  });

  describe('getActiveTeamIds', () => {
    it('should return the 32 teams of the real standings, without Arizona or the Utah Hockey Club', () => {
      const activeTeamIds = NhlTeamUtils.getActiveTeamIds();
      expect(activeTeamIds.length).toBe(32);
      expect(activeTeamIds).not.toContain(53);
      expect(activeTeamIds).not.toContain(59);
      mockStandingsTeams().forEach(standingsTeam => {
        expect(activeTeamIds).withContext(standingsTeam.teamAbbrev.default)
            .toContain(NhlTeamUtils.getTeamIdByAbbrev(standingsTeam.teamAbbrev.default));
      });
    });

    it('should return teams that all have a name and abbreviation', () => {
      NhlTeamUtils.getActiveTeamIds().forEach(teamId => {
        const team = NhlTeamUtils.getTeam(teamId);
        expect(team.name).withContext(String(teamId)).not.toBe('Unknown');
        expect(team.triCode).withContext(String(teamId)).toMatch(/^[A-Z]{3}$/);
      });
    });
  });

  describe('getTeam', () => {
    it('should return Utah Mammoth for team 68', () => {
      expect(NhlTeamUtils.getTeam(68)).toEqual(jasmine.objectContaining({id: 68, name: 'Utah Mammoth', triCode: 'UTA'}));
    });

    it('should return an unknown team for an unknown ID', () => {
      expect(NhlTeamUtils.getTeam(999)).toEqual(jasmine.objectContaining({id: 100, name: 'Unknown', triCode: '-'}));
    });
  });
});

import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {mockStandingsTeams} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('NhlTeamLogoUtils', () => {

  const fallbackLogo = 'assets/logos/team_fallback.png';

  it('should have a logo for every team in the real standings', () => {
    mockStandingsTeams().forEach(standingsTeam => {
      const teamId = NhlTeamUtils.getTeamIdByAbbrev(standingsTeam.teamAbbrev.default);
      expect(NhlTeamLogoUtils.getTeamPrimaryLogo(teamId)).withContext(standingsTeam.teamAbbrev.default).not.toBe(fallbackLogo);
    });
  });

  it('should use a local logo for a known team', () => {
    expect(NhlTeamLogoUtils.getTeamPrimaryLogo(21)).toBe('assets/logos/colorado.png');
  });

  it('should use the NHL hosted logo for Utah', () => {
    expect(NhlTeamLogoUtils.getTeamPrimaryLogo(68)).toBe('https://assets.nhle.com/logos/nhl/svg/UTA_light.svg');
  });

  it('should use the fallback logo for an unknown or missing team', () => {
    expect(NhlTeamLogoUtils.getTeamPrimaryLogo(999)).toBe(fallbackLogo);
    expect(NhlTeamLogoUtils.getTeamPrimaryLogo(undefined)).toBe(fallbackLogo);
  });
});

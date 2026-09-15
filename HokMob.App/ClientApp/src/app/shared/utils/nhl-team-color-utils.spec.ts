import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";

describe('NhlTeamColorUtils', () => {

  describe('getTeamPrimaryColor', () => {
    it('should return team colors, including Utah', () => {
      expect(NhlTeamColorUtils.getTeamPrimaryColor(68)).toBe('#6CACE4');
      expect(NhlTeamColorUtils.getTeamPrimaryColor(54)).toBe('#B4975A');
    });

    it('should return black for an unknown team', () => {
      expect(NhlTeamColorUtils.getTeamPrimaryColor(999)).toBe('#000000');
    });
  });

  describe('getTeamSecondaryColor', () => {
    it('should use a light color when both teams are blue or both are red', () => {
      expect(NhlTeamColorUtils.getTeamSecondaryColor(7, 52)).toBe('#FFFFFFB1');
      expect(NhlTeamColorUtils.getTeamSecondaryColor(12, 13)).toBe('#FFFFFFB1');
    });

    it('should use the other team\'s primary color when the colors differ', () => {
      expect(NhlTeamColorUtils.getTeamSecondaryColor(12, 54)).toBe('#B4975A');
    });
  });
});

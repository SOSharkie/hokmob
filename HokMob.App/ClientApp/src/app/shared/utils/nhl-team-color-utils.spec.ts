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

  describe('getTeamTextColor', () => {
    it('should use dark text on the light primaries', () => {
      // Bruins gold, Kraken ice blue, Utah blue, Golden Knights gold, Flyers orange
      for (const teamId of [6, 55, 68, 54, 4]) {
        expect(NhlTeamColorUtils.getTeamTextColor(teamId)).withContext(String(teamId)).toBe('#1B1B1B');
      }
    });

    it('should keep white text on the dark and saturated primaries', () => {
      // Devils red, Rangers blue, Wild green, an unknown team's black
      for (const teamId of [1, 3, 30, 999]) {
        expect(NhlTeamColorUtils.getTeamTextColor(teamId)).withContext(String(teamId)).toBe('#FFFFFF');
      }
    });

    it('should use dark text on white and white text on black', () => {
      expect(NhlTeamColorUtils.getTextColorOn('#FFFFFF')).toBe('#1B1B1B');
      expect(NhlTeamColorUtils.getTextColorOn('#000000')).toBe('#FFFFFF');
    });

    it('should keep white text when there is no color yet', () => {
      expect(NhlTeamColorUtils.getTextColorOn(undefined)).toBe('#FFFFFF');
      expect(NhlTeamColorUtils.getTextColorOn('red')).toBe('#FFFFFF');
    });

    it('should judge a translucent color as it shows on the dark cards', () => {
      // The light secondary color two blue or two red teams get: a light gray on the card, too light for white
      expect(NhlTeamColorUtils.getTextColorOn('#FFFFFFB1')).toBe('#1B1B1B');
      // Barely there over the dark card
      expect(NhlTeamColorUtils.getTextColorOn('#FFFFFF10')).toBe('#FFFFFF');
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

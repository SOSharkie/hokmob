import {StatCategoryUtils} from '@shared/utils/stat-category-utils';
import {NhlTeamUtils} from '@shared/utils/nhl-team-utils';
import {SkaterSeasonStats} from '@shared/models/nhl-stats-api/player-stats.model';
import {
  mockGoalieStatsLeaders,
  mockHitsAndShotsLeaders,
  mockSeasonPlayersSkaterPoints,
  mockSkaterPointsLeaders25,
  mockSkaterStatsLeaders
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

describe('StatCategoryUtils', () => {

  describe('categories', () => {
    it('should list the stats page\'s nine categories in its order', () => {
      expect(StatCategoryUtils.categories.map(category => category.title)).toEqual([
        'Points', 'Goals', 'Assists', 'Save Percentage', 'Goals Against Average', 'Wins', 'Shots', 'Hits',
        'Time On Ice Per Game'
      ]);
    });

    it('should give every category a unique route id', () => {
      const ids = StatCategoryUtils.categories.map(category => category.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain('save-percentage');
      expect(ids).toContain('time-on-ice');
    });

    it('should have each category\'s own stat among its columns, shown on a phone', () => {
      for (const category of StatCategoryUtils.categories) {
        const ownColumn = category.columns.find(column => column.field === category.field);
        expect(ownColumn).withContext(category.id).toBeDefined();
        expect(ownColumn.format).withContext(category.id).toBe(category.format);
        expect(ownColumn.showOnPhone).withContext(category.id).toBeTrue();
        expect(category.columns.filter(column => column.field === category.field).length).withContext(category.id).toBe(1);
      }
    });

    it('should keep at most five stat columns on a phone, so the table fits', () => {
      for (const category of StatCategoryUtils.categories) {
        const phoneColumns = category.columns.filter(column => column.showOnPhone || column.field === category.field);
        expect(phoneColumns.length).withContext(category.id).toBeLessThanOrEqual(5);
      }
    });

    it('should list the web API categories of each source in the stats page\'s order', () => {
      expect(StatCategoryUtils.getLeaderCategories('skaterLeaders')).toEqual(['points', 'goals', 'assists', 'toi']);
      expect(StatCategoryUtils.getLeaderCategories('goalieLeaders'))
          .toEqual(['savePctg', 'goalsAgainstAverage', 'wins']);
    });
  });

  describe('getTableColumns', () => {
    it('should put the sorted stat in the far right column, after the others in their order', () => {
      expect(StatCategoryUtils.getTableColumns(StatCategoryUtils.getCategory('points')).map(column => column.label))
          .toEqual(['GP', 'G', 'A', '+/-', 'P/GP', 'P']);
      expect(StatCategoryUtils.getTableColumns(StatCategoryUtils.getCategory('wins')).map(column => column.label))
          .toEqual(['GP', 'GS', 'L', 'OTL', 'SV%', 'GAA', 'W']);
      for (const category of StatCategoryUtils.categories) {
        const columns = StatCategoryUtils.getTableColumns(category);
        expect(columns[columns.length - 1].field).withContext(category.id).toBe(category.field);
        expect(columns.length).withContext(category.id).toBe(category.columns.length);
      }
    });

    it('should return no columns for a missing category', () => {
      expect(StatCategoryUtils.getTableColumns(null)).toEqual([]);
    });
  });

  describe('getCategory', () => {
    it('should find a category by its route id', () => {
      expect(StatCategoryUtils.getCategory('save-percentage').leaderCategory).toBe('savePctg');
      expect(StatCategoryUtils.getCategory('hits').source).toBe('hitsAndShots');
    });

    it('should return undefined for an unknown or missing id', () => {
      expect(StatCategoryUtils.getCategory('savePctg')).toBeUndefined();
      expect(StatCategoryUtils.getCategory(null)).toBeUndefined();
    });
  });

  describe('formatValue', () => {
    it('should format each kind of stat from a real McDavid row', () => {
      const mcDavid = (mockSeasonPlayersSkaterPoints().players as SkaterSeasonStats[])
          .find(row => row.skaterFullName === 'Connor McDavid');
      expect(StatCategoryUtils.formatValue(mcDavid.points, 'number')).toBe('138');
      expect(StatCategoryUtils.formatValue(mcDavid.plusMinus, 'plusMinus')).toBe('+17');
      expect(StatCategoryUtils.formatValue(mcDavid.pointsPerGame, 'decimal')).toBe('1.68');
      expect(StatCategoryUtils.formatValue(mcDavid.shootingPct, 'percentage')).toBe('15.7');
      expect(StatCategoryUtils.formatValue(mcDavid.timeOnIcePerGame, 'toi')).toBe('22:59');
      expect(StatCategoryUtils.formatValue(mcDavid.positionCode, 'text')).toBe('C');
    });

    it('should format goalie stats with the site\'s pipes', () => {
      expect(StatCategoryUtils.formatValue(0.921317, 'savePctg')).toBe('.921');
      expect(StatCategoryUtils.formatValue(2.02427, 'gaa')).toBe('2.02');
    });

    it('should show an even or negative plus/minus without a plus', () => {
      expect(StatCategoryUtils.formatValue(0, 'plusMinus')).toBe('0');
      expect(StatCategoryUtils.formatValue(-12, 'plusMinus')).toBe('-12');
    });

    it('should show a dash for a missing value', () => {
      expect(StatCategoryUtils.formatValue(undefined, 'number')).toBe('-');
      expect(StatCategoryUtils.formatValue(null, 'savePctg')).toBe('-');
      expect(StatCategoryUtils.formatValue('', 'text')).toBe('-');
    });
  });

  describe('getRankLabels', () => {
    it('should rank the real top 25 in points, with the ties sharing a rank', () => {
      const values = mockSkaterPointsLeaders25().points.map(leader => leader.value);
      expect(StatCategoryUtils.getRankLabels(values)).toEqual([
        '1', '2', '3', '4', '5', '6', 'T-7', 'T-7', '9', '10', '11', '12', '13', '14', 'T-15', 'T-15', 'T-15', '18',
        'T-19', 'T-19', '21', '22', 'T-23', 'T-23', '25'
      ]);
    });

    it('should give a missing value its own rank', () => {
      expect(StatCategoryUtils.getRankLabels([5, null, null, 2])).toEqual(['1', '2', '3', '4']);
    });

    it('should return no ranks for no values', () => {
      expect(StatCategoryUtils.getRankLabels([])).toEqual([]);
      expect(StatCategoryUtils.getRankLabels(null)).toEqual([]);
    });
  });

  describe('getEntries', () => {
    it('should convert the real web API skater leaders of a category', () => {
      const entries = StatCategoryUtils.getEntries(StatCategoryUtils.getCategory('points'),
          mockSkaterStatsLeaders(), null, null, 20252026);
      expect(entries.length).toBe(5);
      expect(entries[0].name).toBe('Connor McDavid');
      expect(entries[0].value).toBe(138);
      expect(entries[0].teamId).toBe(NhlTeamUtils.getTeamIdByAbbrev('EDM'));
      expect(entries[0].headshot).toContain('8478402');
    });

    it('should convert the real web API goalie leaders of a category', () => {
      const entries = StatCategoryUtils.getEntries(StatCategoryUtils.getCategory('save-percentage'),
          null, mockGoalieStatsLeaders(), null, 20252026);
      const leader = mockGoalieStatsLeaders().savePctg[0];
      expect(entries[0].playerId).toBe(leader.id);
      expect(entries[0].value).toBe(leader.value);
    });

    it('should convert the real stats API hits leaders, building the headshot from the team', () => {
      const entries = StatCategoryUtils.getEntries(StatCategoryUtils.getCategory('hits'),
          null, null, mockHitsAndShotsLeaders(), 20252026);
      expect(entries[0].name).toBe('Yakov Trenin');
      expect(entries[0].value).toBe(413);
      expect(entries[0].teamId).toBe(NhlTeamUtils.getTeamIdByAbbrev('MIN'));
      expect(entries[0].headshot).toBe('https://assets.nhle.com/mugs/nhl/20252026/MIN/8478508.png');
    });

    it('should use the last team of a traded player', () => {
      const panarin = (mockSeasonPlayersSkaterPoints().players as SkaterSeasonStats[])
          .filter(row => row.skaterFullName === 'Artemi Panarin');
      const entries = StatCategoryUtils.toStatsApiEntries(panarin, 'shots', 20252026);
      expect(entries[0].teamId).toBe(NhlTeamUtils.getTeamIdByAbbrev('LAK'));
      expect(entries[0].headshot).toContain('/20252026/LAK/');
    });

    it('should give no leaders for a source that failed or has no such category', () => {
      expect(StatCategoryUtils.getEntries(StatCategoryUtils.getCategory('goals'), null, null, null, 20252026))
          .toEqual([]);
      expect(StatCategoryUtils.getEntries(StatCategoryUtils.getCategory('wins'), null, {}, null, 20252026))
          .toEqual([]);
      expect(StatCategoryUtils.getEntries(StatCategoryUtils.getCategory('shots'), null, null, null, 20252026))
          .toEqual([]);
    });
  });
});

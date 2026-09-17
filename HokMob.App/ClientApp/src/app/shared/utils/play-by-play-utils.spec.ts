import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {KeyEventPeriod, Play, PlayDetails} from "@shared/models/nhl-web-api/play-by-play.model";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {
  derivedLivePlayByPlay,
  MockGamecenterGameId,
  mockGamePlayByPlay
} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

/** A real play of a captured game, by event ID. */
function play(gameId: MockGamecenterGameId, eventId: number): Play {
  return mockGamePlayByPlay(gameId).plays.find(item => item.eventId === eventId);
}

/** Each period as [period number, "typeDescKey timeInPeriod" of its plays]. */
function summarize(periods: KeyEventPeriod[]): [number, string[]][] {
  return periods.map(period =>
      [period.periodDescriptor.number, period.plays.map(item => item.typeDescKey + " " + item.timeInPeriod)]);
}

describe('PlayByPlayUtils', () => {

  describe('getKeyEventPeriods', () => {
    it('should group the goals and penalties of a real regulation game by period', () => {
      expect(summarize(PlayByPlayUtils.getKeyEventPeriods(mockGamePlayByPlay(2025021057)))).toEqual([
        [1, ['goal 02:31', 'penalty 03:12', 'goal 07:51', 'penalty 17:20']],
        [2, ['penalty 13:31', 'penalty 18:17']],
        [3, ['goal 05:17', 'goal 11:53', 'goal 19:09']]
      ]);
    });

    it('should keep the overtime but leave out the shootout of a real shootout game', () => {
      const periods = PlayByPlayUtils.getKeyEventPeriods(mockGamePlayByPlay(2025020952));
      expect(periods.map(period => period.periodDescriptor.periodType)).toEqual([
        NhlPeriodTypeEnum.REGULATION, NhlPeriodTypeEnum.REGULATION, NhlPeriodTypeEnum.REGULATION, NhlPeriodTypeEnum.OVERTIME
      ]);
      expect(summarize(periods)[3]).toEqual([4, ['penalty 04:35']]);
    });

    it('should list a period without goals or penalties', () => {
      const playByPlay = mockGamePlayByPlay(2025021057);
      playByPlay.plays = playByPlay.plays.filter(item => item.periodDescriptor.number !== 2 || item.typeDescKey !== 'penalty');
      expect(summarize(PlayByPlayUtils.getKeyEventPeriods(playByPlay))[1]).toEqual([2, []]);
    });

    it('should list only the periods played so far in a live game', () => {
      expect(summarize(PlayByPlayUtils.getKeyEventPeriods(derivedLivePlayByPlay()))).toEqual([
        [1, ['goal 02:31', 'penalty 03:12', 'goal 07:51', 'penalty 17:20']],
        [2, ['penalty 13:31']]
      ]);
    });

    it('should order the plays by sortOrder', () => {
      const playByPlay = mockGamePlayByPlay(2025021057);
      playByPlay.plays.reverse();
      expect(summarize(PlayByPlayUtils.getKeyEventPeriods(playByPlay))[0])
          .toEqual([1, ['goal 02:31', 'penalty 03:12', 'goal 07:51', 'penalty 17:20']]);
    });

    it('should return no periods without plays', () => {
      expect(PlayByPlayUtils.getKeyEventPeriods(mockGamePlayByPlay(2026020056))).toEqual([]);
      expect(PlayByPlayUtils.getKeyEventPeriods(undefined)).toEqual([]);
      expect(PlayByPlayUtils.getKeyEventPeriods({...mockGamePlayByPlay(2025021057), plays: undefined})).toEqual([]);
    });
  });

  describe('getGoalIndexes', () => {
    it("should index each goal of a real game among its scorer's goals, in scoring order", () => {
      const goalIndexes = PlayByPlayUtils.getGoalIndexes(PlayByPlayUtils.getKeyEventPeriods(mockGamePlayByPlay(2025030414)));
      // Jordan Staal scored in the 1st (448) and the 3rd (212), Nikolaj Ehlers once (215)
      expect(goalIndexes.get(448)).toBe(0);
      expect(goalIndexes.get(212)).toBe(1);
      expect(goalIndexes.get(215)).toBe(0);
      expect(goalIndexes.size).toBe(8);
      // Penalties aren't indexed
      expect(goalIndexes.has(444)).toBeFalse();
    });

    it('should leave out the shootout of a real shootout game', () => {
      const goalIndexes = PlayByPlayUtils.getGoalIndexes(PlayByPlayUtils.getKeyEventPeriods(mockGamePlayByPlay(2025020952)));
      expect(goalIndexes.size).toBe(4);
    });

    it('should return no indexes without periods', () => {
      expect(PlayByPlayUtils.getGoalIndexes(undefined).size).toBe(0);
      expect(PlayByPlayUtils.getGoalIndexes([]).size).toBe(0);
    });
  });

  describe('getRosterSpotMap', () => {
    it('should map the player IDs of a real game to roster spots', () => {
      const rosterSpots = PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(2025021057));
      expect(rosterSpots.size).toBe(40);
      expect(rosterSpots.get(8478398).lastName.default).toBe('Connor');
      expect(rosterSpots.get(8478398).teamId).toBe(52);
    });

    it('should return an empty map without roster spots', () => {
      expect(PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(2026020056)).size).toBe(0);
      expect(PlayByPlayUtils.getRosterSpotMap(undefined).size).toBe(0);
    });
  });

  describe('names', () => {
    it('should build full and last names from a roster spot', () => {
      const rosterSpot = PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(2025030414)).get(8477964);
      expect(PlayByPlayUtils.getFullName(rosterSpot)).toBe('Ivan Barbashev');
      expect(PlayByPlayUtils.getLastName(rosterSpot)).toBe('Barbashev');
    });

    it('should return empty names without a roster spot', () => {
      expect(PlayByPlayUtils.getFullName(undefined)).toBe('');
      expect(PlayByPlayUtils.getLastName(undefined)).toBe('');
    });
  });

  describe('getMainPlayerId and getMainPlayerLabel', () => {
    const rosterSpots = PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(2025030414));

    it('should return the scorer of a goal', () => {
      expect(PlayByPlayUtils.getMainPlayerId(play(2025030414, 69))).toBe(8482702);
      expect(PlayByPlayUtils.getMainPlayerLabel(play(2025030414, 69), rosterSpots)).toBe('Logan Stankoven');
    });

    it('should return the penalized player of a penalty', () => {
      expect(PlayByPlayUtils.getMainPlayerId(play(2025030414, 78))).toBe(8477447);
      expect(PlayByPlayUtils.getMainPlayerLabel(play(2025030414, 78), rosterSpots)).toBe('Shea Theodore');
    });

    it('should return the player who served a bench minor', () => {
      const benchMinor = play(2025030414, 444);
      expect(benchMinor.details.committedByPlayerId).toBeUndefined();
      expect(PlayByPlayUtils.getMainPlayerId(benchMinor)).toBe(8477964);
      expect(PlayByPlayUtils.getMainPlayerLabel(benchMinor, rosterSpots)).toBe('Ivan Barbashev (served)');
    });

    it('should label a penalty without any player as a team penalty', () => {
      const benchMinor = play(2025030414, 444);
      delete benchMinor.details.servedByPlayerId;
      expect(PlayByPlayUtils.getMainPlayerId(benchMinor)).toBeUndefined();
      expect(PlayByPlayUtils.getMainPlayerLabel(benchMinor, rosterSpots)).toBe('Team penalty');
    });

    it('should return nothing for other plays or unknown players', () => {
      const faceoff = mockGamePlayByPlay(2025030414).plays.find(item => item.typeDescKey === 'faceoff');
      expect(PlayByPlayUtils.getMainPlayerId(faceoff)).toBeUndefined();
      expect(PlayByPlayUtils.getMainPlayerId(undefined)).toBeUndefined();
      expect(PlayByPlayUtils.getMainPlayerLabel(play(2025030414, 69), new Map())).toBe('');
    });
  });

  describe('getAssistPlayerIds', () => {
    it('should return the assists of real goals in order', () => {
      expect(PlayByPlayUtils.getAssistPlayerIds(play(2025030414, 69).details)).toEqual([8478970, 8482809]);
      expect(PlayByPlayUtils.getAssistPlayerIds(play(2025030414, 212).details)).toEqual([8477940]);
    });

    it('should return no assists for unassisted and shootout goals', () => {
      expect(PlayByPlayUtils.getAssistPlayerIds(play(2025030414, 215).details)).toEqual([]);
      expect(PlayByPlayUtils.getAssistPlayerIds(play(2025020952, 121).details)).toEqual([]);
      expect(PlayByPlayUtils.getAssistPlayerIds(undefined)).toEqual([]);
    });
  });

  describe('getPenaltyLabel', () => {
    it('should humanize the descKey of real minor penalties', () => {
      expect(PlayByPlayUtils.getPenaltyLabel(play(2025030414, 78).details)).toBe('Tripping');
      expect(PlayByPlayUtils.getPenaltyLabel(play(2025021057, 654).details)).toBe('Holding the stick');
      expect(PlayByPlayUtils.getPenaltyLabel(play(2025030414, 896).details)).toBe('Cross checking');
    });

    it('should reword goalkeeper interference', () => {
      expect(PlayByPlayUtils.getPenaltyLabel(play(2025030414, 984).details)).toBe('Goalkeeper interference');
    });

    it('should add the severity of penalties that are not minors', () => {
      expect(PlayByPlayUtils.getPenaltyLabel(play(2025030414, 444).details)).toBe('Too many men on the ice (bench minor)');
      const major: PlayDetails = {...play(2025030414, 78).details, typeCode: 'MAJ', descKey: 'fighting', duration: 5};
      expect(PlayByPlayUtils.getPenaltyLabel(major)).toBe('Fighting (major)');
      const unknownSeverity: PlayDetails = {...play(2025030414, 78).details, typeCode: 'XYZ'};
      expect(PlayByPlayUtils.getPenaltyLabel(unknownSeverity)).toBe('Tripping');
    });

    it('should fall back to the severity without a descKey', () => {
      const details = play(2025030414, 78).details;
      delete details.descKey;
      expect(PlayByPlayUtils.getPenaltyLabel(details)).toBe('Minor');
      expect(PlayByPlayUtils.getPenaltyLabel({...details, typeCode: 'MIS'})).toBe('Misconduct');
      expect(PlayByPlayUtils.getPenaltyLabel({...details, typeCode: undefined})).toBe('Penalty');
      expect(PlayByPlayUtils.getPenaltyLabel(undefined)).toBe('Penalty');
    });
  });
});

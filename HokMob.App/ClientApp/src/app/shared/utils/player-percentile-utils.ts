import {PositionGroup} from "@shared/models/nhl-history/season-history.model";
import {
  LeagueGoalieStats,
  LeaguePlayers,
  LeagueSkaterStats
} from "@shared/models/nhl-stats-api/league-players.model";
import {StatsUtils} from "@shared/utils/stats-utils";
import {TeamRankTier} from "@shared/utils/team-rating-utils";
import {NstPlayerStats} from "@shared/models/natural-stat-trick/nst-players.model";
import {EdgeSeason, EdgeSeasonSkater} from "@shared/models/nhl-edge/edge-season.model";

/**
 * One axis of a player's traits: a season stat, worked out the same way for every player of the pool.
 */
export interface PlayerTraitAxis<T> {
  key: string;
  /** The axis label, like "Goals". */
  label: string;
  /** What the stat is, like "Goals per 60 minutes", for the label's title. */
  description: string;
  /**
   * The stat, or undefined when it can't be worked out (no time on ice, no shots faced). Not used by an axis with
   * parts, whose value is the average of its parts' percentiles.
   */
  getValue?: (row: T) => number;
  /**
   * The stats of an axis made of several, like blocked shots and takeaways. Each is ranked against the pool on its
   * own, and the axis ranks the weighted average of their percentiles, so the stat with the bigger numbers doesn't
   * outweigh the others. A part a row has no value for (no Natural Stat Trick row, no time on ice) is left out of his
   * average, and the axis has no value only when none of its parts has one.
   */
  parts?: PlayerTraitAxisPart<T>[];
  /** How the value reads, like "1.85" or "54.2%". An axis with parts reads its parts from the row instead. */
  formatValue: (value: number, row: T) => string;
  /** Whether a lower value ranks higher. */
  lowerIsBetter?: boolean;
}

/** One stat of an axis with parts. */
export interface PlayerTraitAxisPart<T> {
  /** The stat, or undefined when it can't be worked out. */
  getValue: (row: T) => number;
  /** Whether a lower value ranks higher. */
  lowerIsBetter?: boolean;
  /** What its percentile counts for in the axis's average: 1 by default, ½ for a stat that only adds to the others. */
  weight?: number;
}

/**
 * A skater's league row, joined on playerId with his season on Natural Stat Trick and in the NHL EDGE season file,
 * when they have him, so every part of an axis is ranked against the same pool.
 */
export interface SkaterTraitRow extends LeagueSkaterStats {
  nst?: NstPlayerStats;
  edge?: EdgeSeasonSkater;
}

/**
 * What the traits add to the league rows, both optional: Natural Stat Trick's skaters of the season (ixG, hits taken,
 * 5v5 on-ice xGA) and the NHL EDGE season file (top speed, bursts). Without either, its parts are left out.
 */
export interface PlayerTraitSources {
  nstPlayers?: NstPlayerStats[];
  edgeSeason?: EdgeSeason;
}

/** A player's percentile on one axis. */
export interface PlayerTrait {
  key: string;
  label: string;
  description: string;
  /**
   * The player's stat, or undefined when it can't be worked out. For an axis with parts, the average of his parts'
   * percentiles, 0 to 100.
   */
  value: number;
  /** The value as it reads, or "-" without one. */
  formattedValue: string;
  /** 0 to 100, or undefined without a value, or without a pool to compare it with. */
  percentile: number;
}

/**
 * The players a player is ranked against: his position group's players of the season with at least the minimum
 * games. A player under the minimum is ranked against them without being one of them.
 */
export interface PlayerPool<T = LeagueSkaterStats | LeagueGoalieStats> {
  group: PositionGroup;
  /** The player's own row. */
  player: T;
  /** His group's rows with at least minGames, his own among them unless he's a small sample. */
  pool: T[];
  /** The fewest games a player of the pool has (getMinGames). */
  minGames: number;
  gamesPlayed: number;
  /** Whether he has fewer than minGames, so he's ranked against the pool without being in it. */
  isSmallSample: boolean;
}

/** A player's traits: his percentile on each axis among the players at his position with enough games. */
export interface PlayerTraits {
  group: PositionGroup;
  gamesPlayed: number;
  /** The fewest games a player of the pool has (getMinGames). */
  minGames: number;
  /** The players compared with: his group's players with at least minGames. */
  poolSize: number;
  /** Whether he has fewer than minGames, so he's charted against the pool without being in it. */
  isSmallSample: boolean;
  traits: PlayerTrait[];
  /** Whether the player's Natural Stat Trick row is in his traits (Goals' ixG, Defense's xGA, Physical's hits taken). */
  usesNst: boolean;
  /** Whether the chart has its Speed axis, from the player's row in the NHL EDGE season file. */
  usesEdge: boolean;
  /** The EDGE file's last day, like "2026-11-23", for a season in progress. */
  edgeThroughDate?: string;
}

/**
 * Percentiles of season stats among the players at the same position, for the player page's traits chart: position
 * groups, the minimum games, per 60 minute rates and the percentile of any stat. Rows come from
 * NhlStatsApiService.getLeaguePlayers.
 */
export class PlayerPercentileUtils {

  /** The fewest games a player needs in a finished season, the same as the history page's leaderboard. */
  public static readonly fullSeasonMinGames = 20;

  /** A team's games in a regular season. */
  public static readonly teamSeasonGames = 82;

  /** What a secondary assist counts for in Playmaking, where a primary assist counts 1. */
  public static readonly secondaryAssistWeight = 0.5;

  /** What the expected goals (ixG) percentile counts for in Goals, where the goals percentile counts 1. */
  public static readonly expectedGoalsWeight = 0.5;

  /** What the hits taken percentile counts for in Physical, where the hits percentile counts 1. */
  public static readonly hitsTakenWeight = 0.5;

  /** What the on-ice xGA percentile counts for in Defense, where the blocks and takeaways percentiles count 1 each. */
  public static readonly expectedGoalsAgainstWeight = 0.5;

  /**
   * The percentiles where a rank's color tier starts (getRankTier), in the rating colors' shares: elite the top 5%,
   * good the rest of the top 25%, and poor the bottom 20%.
   */
  public static readonly rankTierPercentiles = {elite: 95, good: 75, poor: 20};

  /** Goals per 60, and his expected goals per 60 (NST's ixG) at half weight. */
  private static readonly goalsAxis: PlayerTraitAxis<SkaterTraitRow> = {
    key: "goals",
    label: "Goals",
    description: "Goals per 60 minutes, and his expected goals (ixG) per 60 at half weight, each ranked and averaged",
    // Chance quality counts, so a hot or cold shooting streak counts less, while goals still lead: goals with ixG at
    // half repeat from season to season better than goals alone (0.71 to 0.73 for forwards, against 0.62 to 0.63)
    parts: [
      {getValue: row => PlayerPercentileUtils.getPer60(row.goals, PlayerPercentileUtils.getSkaterTimeOnIce(row))},
      {
        getValue: row => PlayerPercentileUtils.getPer60(row.nst?.expectedGoals,
            PlayerPercentileUtils.getSkaterTimeOnIce(row)),
        weight: PlayerPercentileUtils.expectedGoalsWeight
      }
    ],
    formatValue: (_, row) => {
      const timeOnIce = PlayerPercentileUtils.getSkaterTimeOnIce(row);
      return PlayerPercentileUtils.joinPer60([
        PlayerPercentileUtils.formatCount(PlayerPercentileUtils.getPer60(row.goals, timeOnIce), 2, "goals"),
        PlayerPercentileUtils.formatCount(PlayerPercentileUtils.getPer60(row.nst?.expectedGoals, timeOnIce), 2, "ixG")
      ]);
    }
  };

  /** Shot attempts per 60 and his 5v5 Corsi For %: how much his shifts tilt the ice toward the other net. */
  private static readonly possessionAxis: PlayerTraitAxis<SkaterTraitRow> = {
    key: "possession",
    label: "Possession",
    description: "Shot attempts per 60 minutes (on goal, missed and blocked) and his team's 5v5 Corsi For % while he's " +
        "on the ice, each ranked and averaged",
    // Both from the stats API. Of the pairs tried, they repeat from season to season best (0.74 to 0.79 for forwards);
    // high danger attempts (iHDCF) or on-ice xGF% in their place repeat less
    parts: [
      {getValue: row => PlayerPercentileUtils.getPer60(row.totalShotAttempts, PlayerPercentileUtils.getSkaterTimeOnIce(row))},
      {getValue: row => PlayerPercentileUtils.getShare(row.satFor, row.satAgainst)}
    ],
    formatValue: (_, row) => {
      const attempts = PlayerPercentileUtils.getPer60(row.totalShotAttempts,
          PlayerPercentileUtils.getSkaterTimeOnIce(row));
      const corsi = PlayerPercentileUtils.getShare(row.satFor, row.satAgainst);
      return PlayerPercentileUtils.joinParts([
        attempts == null ? undefined : attempts.toFixed(1) + " attempts per 60",
        corsi == null ? undefined : (corsi * 100).toFixed(1) + "% Corsi For"
      ]);
    }
  };

  /** Shot attempts per 60, Possession's first half, on its own for a skater without EDGE. */
  private static readonly shotAttemptsAxis: PlayerTraitAxis<SkaterTraitRow> = {
    key: "shotAttempts",
    label: "Shot attempts",
    description: "Shot attempts per 60 minutes: on goal, missed and blocked",
    getValue: row => PlayerPercentileUtils.getPer60(row.totalShotAttempts,
        PlayerPercentileUtils.getSkaterTimeOnIce(row)),
    formatValue: value => value.toFixed(1) + " per 60"
  };

  private static readonly playmakingAxis: PlayerTraitAxis<SkaterTraitRow> = {
    key: "playmaking",
    label: "Playmaking",
    description: "Primary assists plus half of secondary assists, per 60 minutes",
    // Secondary assists count half: they repeat from season to season (more than half of a defenseman's assists
    // are secondary), but some of that is being on the ice with the scorers, like on a top power play unit
    getValue: row => row.totalPrimaryAssists == null ? undefined : PlayerPercentileUtils.getPer60(
        row.totalPrimaryAssists + PlayerPercentileUtils.secondaryAssistWeight * (row.totalSecondaryAssists ?? 0),
        PlayerPercentileUtils.getSkaterTimeOnIce(row)),
    formatValue: value => value.toFixed(2) + " per 60"
  };

  /** His 5v5 Corsi For %, Possession's second half, on its own (as Possession) for a skater without EDGE. */
  private static readonly corsiForAxis: PlayerTraitAxis<SkaterTraitRow> = {
    key: "possession",
    label: "Possession",
    description: "5v5 Corsi For %: his team's share of the shot attempts while he's on the ice",
    getValue: row => PlayerPercentileUtils.getShare(row.satFor, row.satAgainst),
    formatValue: value => (value * 100).toFixed(1) + "%"
  };

  /** Top speed and bursts over 20 mph per 60, from the EDGE season file. */
  private static readonly speedAxis: PlayerTraitAxis<SkaterTraitRow> = {
    key: "speed",
    label: "Speed",
    description: "Top skating speed and bursts over 20 mph per 60 minutes (NHL EDGE), each ranked and averaged",
    // Ranked against our pool, not EDGE's percentiles: EDGE ranks the bursts as a count, which favors the players
    // with the most games and ice time
    parts: [
      {getValue: row => row.edge?.speedMax ?? undefined},
      {getValue: row => PlayerPercentileUtils.getBurstsPer60(row)}
    ],
    formatValue: (_, row) => {
      const bursts = PlayerPercentileUtils.getBurstsPer60(row);
      return PlayerPercentileUtils.joinParts([
        row.edge?.speedMax == null ? undefined : row.edge.speedMax.toFixed(1) + " mph top speed",
        bursts == null ? undefined : bursts.toFixed(1) + " bursts over 20 mph per 60"
      ]);
    }
  };

  /** Blocks and takeaways per 60, and his 5v5 on-ice xGA per 60 (lower is better), from NST's on-ice page. */
  private static readonly defenseAxis: PlayerTraitAxis<SkaterTraitRow> = {
    key: "defense",
    label: "Defense",
    description: "Blocked shots and takeaways per 60 minutes, and the 5v5 expected goals against per 60 while he's on " +
        "the ice at half weight (lower is better), each ranked on its own and averaged",
    // Ranked apart, since a defenseman blocks five or six shots for every takeaway and blocks alone would decide it.
    // xGA follows the team and the role (a defenseman on a weak team, or who starts in his own end, allows more), so
    // it counts half: at a full third, defensemen's Defense repeated from season to season less than without it
    // (0.55 against 0.62 in one of two pairs), and at half as well or better (0.60 and 0.61, against 0.62 and 0.58)
    parts: [
      {getValue: row => PlayerPercentileUtils.getPer60(row.blockedShots, PlayerPercentileUtils.getSkaterTimeOnIce(row))},
      {getValue: row => PlayerPercentileUtils.getPer60(row.takeaways, PlayerPercentileUtils.getSkaterTimeOnIce(row))},
      {
        getValue: row => PlayerPercentileUtils.getPer60(row.nst?.onIceExpectedGoalsAgainst, row.nst?.onIceTimeOnIce),
        lowerIsBetter: true,
        weight: PlayerPercentileUtils.expectedGoalsAgainstWeight
      }
    ],
    formatValue: (_, row) => {
      const timeOnIce = PlayerPercentileUtils.getSkaterTimeOnIce(row);
      const expectedGoalsAgainst = PlayerPercentileUtils.getPer60(row.nst?.onIceExpectedGoalsAgainst,
          row.nst?.onIceTimeOnIce);
      return PlayerPercentileUtils.joinParts([
        PlayerPercentileUtils.joinPer60([
          PlayerPercentileUtils.formatCount(PlayerPercentileUtils.getPer60(row.blockedShots, timeOnIce), 1, "blocks"),
          PlayerPercentileUtils.formatCount(PlayerPercentileUtils.getPer60(row.takeaways, timeOnIce), 1, "takeaways")
        ]),
        expectedGoalsAgainst == null ? undefined : expectedGoalsAgainst.toFixed(2) + " xGA per 60 at 5v5"
      ]);
    }
  };

  /** Hits per 60, and hits taken per 60 (NST) at half weight. */
  private static readonly physicalAxis: PlayerTraitAxis<SkaterTraitRow> = {
    key: "physical",
    label: "Physical",
    description: "Hits per 60 minutes, and hits taken per 60 at half weight, each ranked and averaged",
    // Hits taken count half, since they partly measure carrying the puck into contact
    parts: [
      {getValue: row => PlayerPercentileUtils.getPer60(row.hits, PlayerPercentileUtils.getSkaterTimeOnIce(row))},
      {
        getValue: row => PlayerPercentileUtils.getPer60(row.nst?.hitsTaken, PlayerPercentileUtils.getSkaterTimeOnIce(row)),
        weight: PlayerPercentileUtils.hitsTakenWeight
      }
    ],
    formatValue: (_, row) => {
      const timeOnIce = PlayerPercentileUtils.getSkaterTimeOnIce(row);
      return PlayerPercentileUtils.joinPer60([
        PlayerPercentileUtils.formatCount(PlayerPercentileUtils.getPer60(row.hits, timeOnIce), 1, "hits"),
        PlayerPercentileUtils.formatCount(PlayerPercentileUtils.getPer60(row.nst?.hitsTaken, timeOnIce), 1, "hits taken")
      ]);
    }
  };

  /**
   * The axes of a skater's traits, forwards and defensemen alike, clockwise from the top, for a skater in the NHL
   * EDGE season file. Natural Stat Trick's parts drop out without it.
   */
  public static readonly skaterAxes: PlayerTraitAxis<SkaterTraitRow>[] = [
    PlayerPercentileUtils.goalsAxis,
    PlayerPercentileUtils.possessionAxis,
    PlayerPercentileUtils.playmakingAxis,
    PlayerPercentileUtils.speedAxis,
    PlayerPercentileUtils.defenseAxis,
    PlayerPercentileUtils.physicalAxis
  ];

  /**
   * The axes of a skater without an EDGE season (before 2021-22, no file, or not in it): Possession's shot attempts
   * and 5v5 Corsi For % as two axes, in Possession's and Speed's places, since a Speed vertex at 0 would look like a slow player.
   */
  public static readonly skaterAxesWithoutEdge: PlayerTraitAxis<SkaterTraitRow>[] = [
    PlayerPercentileUtils.goalsAxis,
    PlayerPercentileUtils.shotAttemptsAxis,
    PlayerPercentileUtils.playmakingAxis,
    PlayerPercentileUtils.corsiForAxis,
    PlayerPercentileUtils.defenseAxis,
    PlayerPercentileUtils.physicalAxis
  ];

  /** The axes of a goalie's traits, clockwise from the top. */
  public static readonly goalieAxes: PlayerTraitAxis<LeagueGoalieStats>[] = [
    {
      key: "savePct",
      label: "Save %",
      description: "Save percentage",
      getValue: row => PlayerPercentileUtils.getRatio(row.saves, row.shotsAgainst),
      formatValue: value => PlayerPercentileUtils.formatSavePct(value)
    },
    {
      key: "goalsSaved",
      label: "Goals saved",
      description: "Goals saved above average per 60 minutes, at each strength's league save percentage",
      getValue: row => PlayerPercentileUtils.getPer60(PlayerPercentileUtils.getGoalsSavedAboveAverage(row),
          row.timeOnIce),
      formatValue: value => (value > 0 ? "+" : "") + value.toFixed(2) + " per 60"
    },
    {
      key: "evenStrength",
      label: "Even strength",
      description: "Even strength save percentage",
      getValue: row => PlayerPercentileUtils.getRatio(row.evSaves, row.evShotsAgainst),
      formatValue: value => PlayerPercentileUtils.formatSavePct(value)
    },
    {
      key: "penaltyKill",
      label: "Penalty kill",
      description: "Save percentage while his team is short-handed",
      getValue: row => PlayerPercentileUtils.getRatio(row.ppSaves, row.ppShotsAgainst),
      formatValue: value => PlayerPercentileUtils.formatSavePct(value)
    },
    {
      key: "workload",
      label: "Workload",
      description: "Games started",
      getValue: row => row.gamesStarted ?? undefined,
      formatValue: value => value + " started"
    },
    {
      key: "winning",
      label: "Winning",
      description: "Wins per decision",
      getValue: row => PlayerPercentileUtils.getRatio(row.wins,
          (row.wins ?? 0) + (row.losses ?? 0) + (row.otLosses ?? 0)),
      formatValue: value => (value * 100).toFixed(0) + "% of decisions"
    }
  ];

  /**
   * The position group of a position code: D and G are their own, and C, L and R are forwards.
   */
  public static getPositionGroup(positionCode: string): PositionGroup {
    return positionCode === "D" || positionCode === "G" ? positionCode : "F";
  }

  /**
   * The fewest games a player needs to be in a percentile pool, or on the history page's leaderboard: 20 in a
   * finished season, and the same share of the season while it's in progress, counted from the most games any team
   * has played. At least 1.
   *
   * @param mostTeamGames - The most games any team has played in the season.
   */
  public static getMinGames(mostTeamGames: number): number {
    const minGames = Math.ceil((mostTeamGames ?? 0) * PlayerPercentileUtils.fullSeasonMinGames /
        PlayerPercentileUtils.teamSeasonGames);
    return Math.max(1, Math.min(PlayerPercentileUtils.fullSeasonMinGames, minGames));
  }

  /**
   * A count per 60 minutes of ice time, or undefined without a count or without ice time.
   *
   * @param count - The count, like goals.
   * @param seconds - The ice time it was made in.
   */
  public static getPer60(count: number, seconds: number): number {
    return count == null || !(seconds > 0) ? undefined : count * 3600 / seconds;
  }

  /** A skater's ice time over the season, in seconds. */
  public static getSkaterTimeOnIce(row: LeagueSkaterStats): number {
    return (row?.timeOnIcePerGame ?? 0) * (row?.gamesPlayed ?? 0);
  }

  /**
   * A skater's bursts over 20 mph per 60 minutes, from the EDGE season file, or undefined without his EDGE row. The
   * ice time is the league row's per game, the all-situation time the other per 60 axes use, over EDGE's own games,
   * so a file a day behind the league rows still divides his bursts by the games they came from.
   */
  public static getBurstsPer60(row: SkaterTraitRow): number {
    const edge = row?.edge;
    if (edge?.burstsOver20 == null) {
      return undefined;
    }
    return PlayerPercentileUtils.getPer60(edge.burstsOver20,
        (row.timeOnIcePerGame ?? 0) * (edge.gamesPlayed ?? row.gamesPlayed ?? 0));
  }

  /**
   * The league's skater rows, each joined on playerId with his Natural Stat Trick row and his row of the EDGE season
   * file. A source without him leaves its field undefined, and the rows are returned as they are without either.
   *
   * @param rows - Every skater of the season.
   * @param sources - Natural Stat Trick's skaters and the EDGE season file, either optional.
   */
  public static joinSkaterRows(rows: LeagueSkaterStats[], sources: PlayerTraitSources): SkaterTraitRow[] {
    const nstRows = new Map((sources?.nstPlayers ?? []).map(row => [row.playerId, row]));
    const edgeRows = new Map((sources?.edgeSeason?.skaters ?? []).map(row => [row.playerId, row]));
    if (!nstRows.size && !edgeRows.size) {
      return rows ?? [];
    }
    return (rows ?? []).map(row => ({...row, nst: nstRows.get(row.playerId), edge: edgeRows.get(row.playerId)}));
  }

  /**
   * A goalie's goals saved above an average goalie facing the same shots, from his season's saves by strength, at
   * StatsUtils' league save percentages (see StatsUtils.getGoalsSavedAboveAverage, which does the same for a game).
   */
  public static getGoalsSavedAboveAverage(row: LeagueGoalieStats): number {
    if (row?.evShotsAgainst == null && row?.ppShotsAgainst == null && row?.shShotsAgainst == null) {
      return undefined;
    }
    const savesAboveAverage = (saves: number, shots: number, leagueSavePctg: number) =>
        (saves ?? 0) - leagueSavePctg * (shots ?? 0);
    return savesAboveAverage(row.evSaves, row.evShotsAgainst, StatsUtils.leagueEvenStrengthSavePctg) +
        savesAboveAverage(row.ppSaves, row.ppShotsAgainst, StatsUtils.leaguePenaltyKillSavePctg) +
        savesAboveAverage(row.shSaves, row.shShotsAgainst, StatsUtils.leaguePowerPlaySavePctg);
  }

  /**
   * The percentile of a value among a pool's values: the share of the pool it's ahead of, with ties counted as half,
   * from 0 to 100. A value in the pool ties with itself, so the best of 100 is at 99.5. Undefined without a value or
   * without a pool. The pool's undefined values are left out.
   *
   * @param value - The player's value.
   * @param poolValues - The pool's values, the player's own among them when he's in the pool.
   * @param lowerIsBetter - Whether a lower value ranks higher.
   */
  public static getPercentile(value: number, poolValues: number[], lowerIsBetter: boolean = false): number {
    const pool = (poolValues ?? []).filter(poolValue => poolValue != null && !isNaN(poolValue));
    if (value == null || isNaN(value) || !pool.length) {
      return undefined;
    }
    let ahead = 0;
    let ties = 0;
    pool.forEach(poolValue => {
      if (poolValue === value) {
        ties++;
      } else if (lowerIsBetter ? value < poolValue : value > poolValue) {
        ahead++;
      }
    });
    return (ahead + ties / 2) / pool.length * 100;
  }

  /**
   * A value's rank in a pool: 1 plus how many of the pool's values are better, so tied values share a rank. A value
   * in the pool doesn't count itself, and a player under the minimum games gets the rank he'd have among them.
   * Undefined without a value or without a pool. The pool's undefined values are left out.
   *
   * @param value - The player's value.
   * @param poolValues - The pool's values, the player's own among them when he's in the pool.
   * @param lowerIsBetter - Whether a lower value ranks higher.
   */
  public static getRank(value: number, poolValues: number[], lowerIsBetter: boolean = false): number {
    const pool = (poolValues ?? []).filter(poolValue => poolValue != null && !isNaN(poolValue));
    if (value == null || isNaN(value) || !pool.length) {
      return undefined;
    }
    return 1 + pool.filter(poolValue => lowerIsBetter ? poolValue < value : poolValue > value).length;
  }

  /**
   * Where a percentile stands, for its rank's color (rankTierPercentiles): "elite" at the top 5%, "good" in the rest of
   * the top 25%, "poor" in the bottom 20%, and "middle" between them or without a percentile. A league of about 400
   * forwards needs shares, not the team cards' fixed ranks (TeamRatingUtils.getRankTier).
   *
   * @param percentile - 0 to 100, as getPercentile gives it.
   */
  public static getRankTier(percentile: number): TeamRankTier {
    const tiers = PlayerPercentileUtils.rankTierPercentiles;
    if (percentile == null || isNaN(percentile)) {
      return "middle";
    }
    if (percentile >= tiers.elite) {
      return "elite";
    }
    if (percentile >= tiers.good) {
      return "good";
    }
    return percentile < tiers.poor ? "poor" : "middle";
  }

  /**
   * The players a player is ranked against: the season's players of his position group with at least the minimum
   * games, which the traits card and the season performance card share. Undefined when he has no row in the season.
   *
   * @param leaguePlayers - Every player of the season at his position (skaters or goalies).
   * @param playerId - The player.
   */
  public static getPlayerPool<T extends LeagueSkaterStats | LeagueGoalieStats>(leaguePlayers: LeaguePlayers<T>,
                                                                               playerId: number): PlayerPool<T> {
    const rows = leaguePlayers?.players ?? [];
    const player = rows.find(row => row.playerId === playerId);
    if (!player) {
      return undefined;
    }
    const group = PlayerPercentileUtils.getRowGroup(player);
    const minGames = PlayerPercentileUtils.getMinGames(leaguePlayers.mostTeamGames);
    const gamesPlayed = player.gamesPlayed ?? 0;
    return {
      group,
      player,
      pool: rows.filter(row => PlayerPercentileUtils.getRowGroup(row) === group && (row.gamesPlayed ?? 0) >= minGames),
      minGames,
      gamesPlayed,
      isSmallSample: gamesPlayed < minGames
    };
  }

  /**
   * A player's traits: his percentile on each axis among the season's players of his position group with at least
   * the minimum games. A player under the minimum is charted against that pool, without being in it. A skater's rows
   * are joined with Natural Stat Trick's and the EDGE season file's first, so each of their parts is ranked against
   * the same pool; a skater without an EDGE row gets the axes without Speed (skaterAxesWithoutEdge). Undefined when he
   * has no row in the season.
   *
   * @param leaguePlayers - Every player of the season at his position (skaters or goalies).
   * @param playerId - The player.
   * @param sources - A skater's Natural Stat Trick and EDGE season data, either optional. A goalie's are ignored.
   */
  public static getPlayerTraits(leaguePlayers: LeaguePlayers, playerId: number,
                                sources?: PlayerTraitSources): PlayerTraits {
    const rows = leaguePlayers?.players ?? [];
    const playerRow = rows.find(row => row.playerId === playerId);
    const isSkater = !!playerRow && PlayerPercentileUtils.getRowGroup(playerRow) !== "G";
    const joined = isSkater ? {
      ...leaguePlayers,
      players: PlayerPercentileUtils.joinSkaterRows(rows as LeagueSkaterStats[], sources)
    } : leaguePlayers;
    const playerPool = PlayerPercentileUtils.getPlayerPool(joined, playerId);
    if (!playerPool) {
      return undefined;
    }
    const {group, player, pool} = playerPool;
    const skater = isSkater ? player as SkaterTraitRow : undefined;
    const usesEdge = skater?.edge?.speedMax != null;
    const skaterAxes = usesEdge ? PlayerPercentileUtils.skaterAxes : PlayerPercentileUtils.skaterAxesWithoutEdge;
    const axes = (group === "G" ? PlayerPercentileUtils.goalieAxes : skaterAxes) as
        PlayerTraitAxis<LeagueSkaterStats | LeagueGoalieStats>[];
    return {
      usesNst: !!skater?.nst,
      usesEdge,
      edgeThroughDate: usesEdge ? sources?.edgeSeason?.throughDate : undefined,
      group,
      gamesPlayed: playerPool.gamesPlayed,
      minGames: playerPool.minGames,
      poolSize: pool.length,
      isSmallSample: playerPool.isSmallSample,
      traits: axes.map(axis => {
        const getValue = PlayerPercentileUtils.getAxisValue(axis, pool);
        const value = getValue(player);
        const percentile = PlayerPercentileUtils.getPercentile(value, pool.map(getValue), axis.lowerIsBetter);
        return {
          key: axis.key,
          label: axis.label,
          description: axis.description,
          value,
          formattedValue: value == null ? "-" : axis.formatValue(value, player),
          percentile
        };
      })
    };
  }

  /**
   * How an axis values a row: its stat, or for an axis with parts, the weighted average of the row's percentiles on
   * each part against the pool. A part the row has no value for, or that nobody in the pool has (no Natural Stat
   * Trick), is left out of the average; undefined when no part has one. The pool's values of each part are read once.
   */
  private static getAxisValue<T>(axis: PlayerTraitAxis<T>, pool: T[]): (row: T) => number {
    if (!axis.parts?.length) {
      return row => PlayerPercentileUtils.toNumber(axis.getValue?.(row));
    }
    const partPools = axis.parts.map(part => pool.map(row => PlayerPercentileUtils.toNumber(part.getValue(row))));
    return row => {
      let sum = 0;
      let weights = 0;
      axis.parts.forEach((part, index) => {
        const percentile = PlayerPercentileUtils.getPercentile(PlayerPercentileUtils.toNumber(part.getValue(row)),
            partPools[index], part.lowerIsBetter);
        if (percentile != null) {
          const weight = part.weight ?? 1;
          sum += weight * percentile;
          weights += weight;
        }
      });
      return weights > 0 ? sum / weights : undefined;
    };
  }

  /** A per 60 rate with its unit, like "2.41 goals", or undefined without the rate. */
  private static formatCount(value: number, decimals: number, unit: string): string {
    return value == null ? undefined : value.toFixed(decimals) + " " + unit;
  }

  /** Rates joined into one, like "2.41 goals and 1.30 ixG per 60", or undefined without any. */
  private static joinPer60(rates: string[]): string {
    const present = rates.filter(rate => rate);
    return present.length ? present.join(" and ") + " per 60" : undefined;
  }

  /** An axis's parts as they read, joined with commas, leaving out the ones without a value. */
  private static joinParts(parts: string[]): string {
    return parts.filter(part => part).join(", ");
  }

  /** A row's position group: a goalie row has no position code. */
  public static getRowGroup(row: LeagueSkaterStats | LeagueGoalieStats): PositionGroup {
    return "positionCode" in row ? PlayerPercentileUtils.getPositionGroup(row.positionCode) : "G";
  }

  /** A part's share of a part and the rest, like Corsi For of all the shot attempts, or undefined without any. */
  public static getShare(part: number, rest: number): number {
    return PlayerPercentileUtils.getRatio(part, (part ?? 0) + (rest ?? 0));
  }

  /** A count over a total, or undefined without the count or a total. */
  public static getRatio(count: number, total: number): number {
    return count == null || !(total > 0) ? undefined : count / total;
  }

  /** A save percentage as the NHL shows it, like ".915". */
  public static formatSavePct(value: number): string {
    return value.toFixed(3).replace(/^0/, "");
  }

  /** A finite number, or undefined. */
  public static toNumber(value: number): number {
    return value == null || !isFinite(value) ? undefined : value;
  }
}

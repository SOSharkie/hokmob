import {PositionGroup} from "@shared/models/nhl-history/season-history.model";
import {
  LeagueGoalieStats,
  LeaguePlayers,
  LeagueSkaterStats
} from "@shared/models/nhl-stats-api/league-players.model";
import {StatsUtils} from "@shared/utils/stats-utils";

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
   * own, and the axis ranks the average of their percentiles, so the stat with the bigger numbers doesn't outweigh
   * the others.
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

  /** The axes of a skater's traits, forwards and defensemen alike, clockwise from the top. */
  public static readonly skaterAxes: PlayerTraitAxis<LeagueSkaterStats>[] = [
    {
      key: "goals",
      label: "Goals",
      description: "Goals per 60 minutes",
      getValue: row => PlayerPercentileUtils.getPer60(row.goals, PlayerPercentileUtils.getSkaterTimeOnIce(row)),
      formatValue: value => value.toFixed(2) + " per 60"
    },
    {
      key: "shotAttempts",
      label: "Shot attempts",
      description: "Shot attempts per 60 minutes: on goal, missed and blocked",
      getValue: row => PlayerPercentileUtils.getPer60(row.totalShotAttempts,
          PlayerPercentileUtils.getSkaterTimeOnIce(row)),
      formatValue: value => value.toFixed(1) + " per 60"
    },
    {
      key: "playmaking",
      label: "Playmaking",
      description: "Primary assists plus half of secondary assists, per 60 minutes",
      // Secondary assists count half: they repeat from season to season (more than half of a defenseman's assists
      // are secondary), but some of that is being on the ice with the scorers, like on a top power play unit
      getValue: row => row.totalPrimaryAssists == null ? undefined : PlayerPercentileUtils.getPer60(
          row.totalPrimaryAssists + PlayerPercentileUtils.secondaryAssistWeight * (row.totalSecondaryAssists ?? 0),
          PlayerPercentileUtils.getSkaterTimeOnIce(row)),
      formatValue: value => value.toFixed(2) + " per 60"
    },
    {
      key: "possession",
      label: "Possession",
      description: "5v5 Corsi For %: his team's share of the shot attempts while he's on the ice",
      getValue: row => PlayerPercentileUtils.getShare(row.satFor, row.satAgainst),
      formatValue: value => (value * 100).toFixed(1) + "%"
    },
    {
      key: "defense",
      label: "Defense",
      description: "Blocked shots and takeaways per 60 minutes, each ranked on its own and averaged",
      // Ranked apart, since a defenseman blocks five or six shots for every takeaway and blocks alone would decide it
      parts: [
        {getValue: row => PlayerPercentileUtils.getPer60(row.blockedShots, PlayerPercentileUtils.getSkaterTimeOnIce(row))},
        {getValue: row => PlayerPercentileUtils.getPer60(row.takeaways, PlayerPercentileUtils.getSkaterTimeOnIce(row))}
      ],
      formatValue: (_, row) => {
        const timeOnIce = PlayerPercentileUtils.getSkaterTimeOnIce(row);
        return PlayerPercentileUtils.getPer60(row.blockedShots, timeOnIce).toFixed(1) + " blocks and " +
            PlayerPercentileUtils.getPer60(row.takeaways, timeOnIce).toFixed(1) + " takeaways per 60";
      }
    },
    {
      key: "physical",
      label: "Physical",
      description: "Hits per 60 minutes",
      getValue: row => PlayerPercentileUtils.getPer60(row.hits, PlayerPercentileUtils.getSkaterTimeOnIce(row)),
      formatValue: value => value.toFixed(1) + " per 60"
    }
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
   * A player's traits: his percentile on each axis among the season's players of his position group with at least
   * the minimum games. A player under the minimum is charted against that pool, without being in it. Undefined when
   * he has no row in the season.
   *
   * @param leaguePlayers - Every player of the season at his position (skaters or goalies).
   * @param playerId - The player.
   */
  public static getPlayerTraits(leaguePlayers: LeaguePlayers, playerId: number): PlayerTraits {
    const rows = leaguePlayers?.players ?? [];
    const player = rows.find(row => row.playerId === playerId);
    if (!player) {
      return undefined;
    }
    const group = PlayerPercentileUtils.getRowGroup(player);
    const axes = (group === "G" ? PlayerPercentileUtils.goalieAxes : PlayerPercentileUtils.skaterAxes) as
        PlayerTraitAxis<LeagueSkaterStats | LeagueGoalieStats>[];
    const minGames = PlayerPercentileUtils.getMinGames(leaguePlayers.mostTeamGames);
    const pool = rows.filter(row => PlayerPercentileUtils.getRowGroup(row) === group &&
        (row.gamesPlayed ?? 0) >= minGames);
    return {
      group,
      gamesPlayed: player.gamesPlayed ?? 0,
      minGames,
      poolSize: pool.length,
      isSmallSample: (player.gamesPlayed ?? 0) < minGames,
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
   * How an axis values a row: its stat, or for an axis with parts, the average of the row's percentiles on each part
   * against the pool (undefined when a part can't be worked out). The pool's values of each part are read once.
   */
  private static getAxisValue<T>(axis: PlayerTraitAxis<T>, pool: T[]): (row: T) => number {
    if (!axis.parts?.length) {
      return row => PlayerPercentileUtils.toNumber(axis.getValue?.(row));
    }
    const partPools = axis.parts.map(part => pool.map(row => PlayerPercentileUtils.toNumber(part.getValue(row))));
    return row => {
      const percentiles = axis.parts.map((part, index) => PlayerPercentileUtils.getPercentile(
          PlayerPercentileUtils.toNumber(part.getValue(row)), partPools[index], part.lowerIsBetter));
      return percentiles.some(percentile => percentile == null) ? undefined :
          percentiles.reduce((sum, percentile) => sum + percentile, 0) / percentiles.length;
    };
  }

  /** A row's position group: a goalie row has no position code. */
  private static getRowGroup(row: LeagueSkaterStats | LeagueGoalieStats): PositionGroup {
    return "positionCode" in row ? PlayerPercentileUtils.getPositionGroup(row.positionCode) : "G";
  }

  /** A part's share of a part and the rest, like Corsi For of all the shot attempts, or undefined without any. */
  private static getShare(part: number, rest: number): number {
    return PlayerPercentileUtils.getRatio(part, (part ?? 0) + (rest ?? 0));
  }

  /** A count over a total, or undefined without the count or a total. */
  private static getRatio(count: number, total: number): number {
    return count == null || !(total > 0) ? undefined : count / total;
  }

  /** A save percentage as the NHL shows it, like ".915". */
  private static formatSavePct(value: number): string {
    return value.toFixed(3).replace(/^0/, "");
  }

  /** A finite number, or undefined. */
  private static toNumber(value: number): number {
    return value == null || !isFinite(value) ? undefined : value;
  }
}

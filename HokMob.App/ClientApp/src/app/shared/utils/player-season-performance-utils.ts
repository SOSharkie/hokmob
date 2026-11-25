import {PositionGroup} from "@shared/models/nhl-history/season-history.model";
import {
  LeagueGoalieStats,
  LeaguePlayers,
  LeagueSkaterStats
} from "@shared/models/nhl-stats-api/league-players.model";
import {NstPlayerStats} from "@shared/models/natural-stat-trick/nst-players.model";
import {EdgeGoalieDetail, EdgeSkaterDetail} from "@shared/models/nhl-web-api/edge.model";
import {PlayerPercentileUtils, PlayerPool} from "@shared/utils/player-percentile-utils";
import {TeamRankTier, TeamRatingUtils} from "@shared/utils/team-rating-utils";
import {StatsUtils} from "@shared/utils/stats-utils";

/** Whether counting stats show as season totals or per 60 minutes of ice time. */
export type SeasonPerformanceMode = "total" | "per60";

/** A skater's row with his Natural Stat Trick row, when NST has one. */
export interface SkaterPerformanceRow extends LeagueSkaterStats {
  nst?: NstPlayerStats;
}

/**
 * One stat of the season performance card, worked out the same way for every player of the pool, and ranked among
 * them.
 */
export interface SeasonStatDefinition<T> {
  key: string;
  label: string;
  /** What the stat is, for the row's tooltip. */
  description: string;
  /** A count, like goals, which Per 60 turns into a rate of all-situation ice time. */
  getCount?: (row: T) => number;
  /** A share or a rate that stays as it is in both modes, like Corsi For % or ice time per game. */
  getValue?: (row: T) => number;
  /** How the value reads. A count gets two decimals per 60 unless this says otherwise. */
  format?: (value: number, mode: SeasonPerformanceMode) => string;
  /** The decimals of a count's season total, 0 by default. */
  totalDecimals?: number;
  /** Whether a count shows its sign, like a differential. */
  signed?: boolean;
  /** Whether a lower value ranks higher, like giveaways. */
  lowerIsBetter?: boolean;
  /** Ranked, but never colored: more isn't better or worse, like hits taken. */
  neutral?: boolean;
  /** Whether the stat is Natural Stat Trick's, so it's left out when NST has no row for the player. */
  fromNst?: boolean;
  /** Whether the player gets the row at all, like faceoffs only for a player who takes them. */
  isShown?: (row: T) => boolean;
  /**
   * The players the stat ranks among, when it's fewer than the pool: a share needs enough attempts, so a few lucky
   * shots don't top it. The player himself is ranked against them whether he's one or not.
   */
  qualifier?: {test: (row: T, minGames: number) => boolean, note: (minGames: number) => string};
  /** A detail for the tooltip, after the description, like a faceoff record "234 won, 175 lost". */
  getDetail?: (row: T) => string;
}

/** A stat from NHL EDGE: its value and the NHL's percentile, which we can't rank ourselves. */
export interface EdgeStatDefinition<E> {
  key: string;
  label: string;
  description: string;
  /** The value and the NHL's percentile (0 to 1), or undefined when EDGE doesn't have it. */
  get: (edge: E) => {value: number, percentile: number};
  format: (value: number) => string;
}

/** A titled group of the card, in one of its two columns on a desktop. */
export interface SeasonStatGroup<T, E> {
  title: string;
  /** 0 for the left column, 1 for the right. On a phone the left column's groups come first. */
  column: 0 | 1;
  stats?: SeasonStatDefinition<T>[];
  /** NHL EDGE stats, after the group's own. */
  edgeStats?: EdgeStatDefinition<E>[];
}

/** One row of the card, as it shows. */
export interface SeasonPerformanceRow {
  key: string;
  label: string;
  /** Like "52.4%", or "-" without a value. */
  value: string;
  /** Like "12th", or for an NHL EDGE stat its percentile, like "96%". Empty without one. */
  rank: string;
  rankTier: TeamRankTier;
  /** The bar's length: his percentile, 0 to 100. */
  barWidth: number;
  /** The row's tooltip: the stat, and his rank among whom. */
  description: string;
  /** Whether the row is NHL EDGE's. */
  isEdge?: boolean;
}

export interface SeasonPerformanceGroup {
  title: string;
  column: 0 | 1;
  /** Whether its rows are NHL EDGE's percentiles, which the title says. */
  isEdge: boolean;
  rows: SeasonPerformanceRow[];
}

/** A player's season performance: his stats in groups, each ranked among the players at his position. */
export interface SeasonPerformance {
  group: PositionGroup;
  gamesPlayed: number;
  /** A skater's ice time per game, in seconds. */
  timeOnIcePerGame: number;
  /** A goalie's starts. */
  gamesStarted: number;
  minGames: number;
  poolSize: number;
  isSmallSample: boolean;
  /** Whether any shown row is Natural Stat Trick's, so the card credits it. */
  hasNst: boolean;
  /** Whether any shown row is NHL EDGE's. */
  hasEdge: boolean;
  groups: SeasonPerformanceGroup[];
}

/**
 * The player page's season performance card, like FotMob's: a player's season stats and advanced stats in groups, each
 * ranked among the players at his position with enough games (PlayerPercentileUtils' pool, shared with the traits
 * card). Counting stats can be season totals or per 60 minutes. Natural Stat Trick adds the stats the NHL's APIs don't
 * have, and NHL EDGE the tracking stats, with the NHL's own percentiles. See "Season performance" in docs/nhl-api.md.
 */
export class PlayerSeasonPerformanceUtils {

  /** The faceoffs a game a player needs to be ranked on faceoffs, so a winger's handful doesn't top the list. */
  public static readonly faceoffsPerMinGame = 5;

  /** The shots a game a player needs to be ranked on shooting %. */
  public static readonly shotsPerMinGame = 1;

  /** The groups of a skater's card, forwards and defensemen alike. */
  public static readonly skaterGroups: SeasonStatGroup<SkaterPerformanceRow, EdgeSkaterDetail>[] = [
    {
      title: "Scoring",
      column: 0,
      stats: [
        {key: "goals", label: "Goals", description: "Goals", getCount: row => row.goals},
        {key: "assists", label: "Assists", description: "Assists", getCount: row => row.assists},
        {
          key: "primaryAssists", label: "Primary assists", description: "First assists, on the pass before the goal",
          getCount: row => row.totalPrimaryAssists
        },
        {
          key: "secondaryAssists", label: "Secondary assists", description: "Second assists",
          getCount: row => row.totalSecondaryAssists
        },
        {key: "points", label: "Points", description: "Goals and assists", getCount: row => row.points},
        {key: "ppPoints", label: "Power play points", description: "Power play points", getCount: row => row.ppPoints}
      ]
    },
    {
      title: "Shooting",
      column: 0,
      stats: [
        {key: "shots", label: "Shots on goal", description: "Shots on goal", getCount: row => row.shots},
        {
          key: "shootingPct", label: "Shooting %", description: "Goals per shot on goal",
          getValue: row => PlayerPercentileUtils.getRatio(row.goals, row.shots),
          format: value => PlayerSeasonPerformanceUtils.formatPercent(value),
          qualifier: {
            test: (row, minGames) => (row.shots ?? 0) >= minGames * PlayerSeasonPerformanceUtils.shotsPerMinGame,
            note: minGames => (minGames * PlayerSeasonPerformanceUtils.shotsPerMinGame) + "+ shots"
          }
        },
        {
          key: "shotAttempts", label: "Shot attempts", description: "Shot attempts: on goal, missed and blocked",
          getCount: row => row.totalShotAttempts
        },
        {
          key: "expectedGoals", label: "Expected goals", fromNst: true, totalDecimals: 1,
          description: "Individual expected goals (ixG): the chance that each of his unblocked shot attempts scores, added up",
          getCount: row => row.nst?.expectedGoals
        },
        {
          key: "highDangerAttempts", label: "High danger attempts", fromNst: true,
          description: "Shot attempts from the slot and the crease (iHDCF)",
          getCount: row => row.nst?.highDangerAttempts
        }
      ]
    },
    {
      title: "Possession",
      column: 0,
      stats: [
        {
          key: "corsi", label: "5v5 Corsi For %",
          description: "5v5 Corsi For %: his team's share of the shot attempts while he's on the ice",
          getValue: row => PlayerPercentileUtils.getShare(row.satFor, row.satAgainst),
          format: value => PlayerSeasonPerformanceUtils.formatPercent(value)
        },
        {
          key: "fenwick", label: "5v5 Fenwick For %",
          description: "5v5 Fenwick For %: his team's share of the unblocked shot attempts while he's on the ice",
          getValue: row => PlayerPercentileUtils.getShare(row.usatFor, row.usatAgainst),
          format: value => PlayerSeasonPerformanceUtils.formatPercent(value)
        },
        {
          key: "faceoffs", label: "Faceoffs", description: "Faceoffs won, of the ones he took",
          getValue: row => PlayerPercentileUtils.getShare(row.totalFaceoffWins, row.totalFaceoffLosses),
          format: value => PlayerSeasonPerformanceUtils.formatPercent(value),
          isShown: row => PlayerSeasonPerformanceUtils.getFaceoffs(row) > 0,
          getDetail: row => (row.totalFaceoffWins ?? 0) + " won, " + (row.totalFaceoffLosses ?? 0) + " lost",
          qualifier: {
            test: (row, minGames) => PlayerSeasonPerformanceUtils.getFaceoffs(row) >=
                minGames * PlayerSeasonPerformanceUtils.faceoffsPerMinGame,
            note: minGames => (minGames * PlayerSeasonPerformanceUtils.faceoffsPerMinGame) + "+ faceoffs"
          }
        },
        {
          key: "reboundsCreated", label: "Rebounds created", fromNst: true,
          description: "His shots that gave a rebound", getCount: row => row.nst?.reboundsCreated
        },
        {
          key: "rushAttempts", label: "Rush attempts", fromNst: true, description: "Shot attempts off the rush",
          getCount: row => row.nst?.rushAttempts
        }
      ]
    },
    {
      title: "Defense and physical",
      column: 1,
      stats: [
        {key: "hits", label: "Hits", description: "Hits", getCount: row => row.hits},
        {
          key: "hitsTaken", label: "Hits taken", fromNst: true, neutral: true, description: "The hits he took",
          getCount: row => row.nst?.hitsTaken
        },
        {key: "blockedShots", label: "Blocked shots", description: "Shots he blocked", getCount: row => row.blockedShots},
        {key: "takeaways", label: "Takeaways", description: "Takeaways", getCount: row => row.takeaways},
        {
          key: "giveaways", label: "Giveaways", description: "Giveaways", lowerIsBetter: true,
          getCount: row => row.giveaways
        }
      ]
    },
    {
      title: "Discipline",
      column: 1,
      stats: [
        {
          key: "penaltyMinutes", label: "Penalty minutes", description: "Penalty minutes", lowerIsBetter: true,
          getCount: row => row.penaltyMinutes
        },
        {
          key: "penaltiesDrawn", label: "Penalties drawn", description: "Penalties drawn",
          getCount: row => row.penaltiesDrawn
        },
        {
          key: "penaltyDiff", label: "Penalty differential", description: "Penalties drawn minus penalties taken",
          signed: true,
          getCount: row => row.penaltiesDrawn == null || row.penalties == null ? undefined :
              row.penaltiesDrawn - row.penalties
        }
      ]
    },
    {
      title: "Usage",
      column: 1,
      stats: [
        {
          key: "timeOnIce", label: "Ice time per game", description: "Ice time per game, all situations",
          getValue: row => row.timeOnIcePerGame, format: value => StatsUtils.formatSeconds(value)
        },
        {
          key: "ppTimeOnIce", label: "Power play time per game", description: "Power play ice time per game",
          getValue: row => row.ppTimeOnIcePerGame, format: value => StatsUtils.formatSeconds(value)
        },
        {
          key: "shTimeOnIce", label: "Short-handed time per game", description: "Short-handed ice time per game",
          getValue: row => row.shTimeOnIcePerGame, format: value => StatsUtils.formatSeconds(value)
        }
      ],
      edgeStats: [
        {
          key: "offensiveZone", label: "Offensive zone time",
          description: "The share of his ice time in the offensive zone (NHL EDGE)",
          get: edge => PlayerSeasonPerformanceUtils.toEdgeStat(edge.zoneTimeDetails?.offensiveZonePctg,
              edge.zoneTimeDetails?.offensiveZonePercentile),
          format: value => PlayerSeasonPerformanceUtils.formatPercent(value)
        }
      ]
    },
    {
      title: "Skating",
      column: 1,
      edgeStats: [
        {
          key: "topSpeed", label: "Top speed", description: "His fastest skating speed (NHL EDGE)",
          get: edge => PlayerSeasonPerformanceUtils.toEdgeStat(edge.skatingSpeed?.speedMax?.imperial,
              edge.skatingSpeed?.speedMax?.percentile),
          format: value => value.toFixed(1) + " mph"
        },
        {
          key: "bursts", label: "Bursts over 20 mph", description: "Times he skated faster than 20 mph (NHL EDGE)",
          get: edge => PlayerSeasonPerformanceUtils.toEdgeStat(edge.skatingSpeed?.burstsOver20?.value,
              edge.skatingSpeed?.burstsOver20?.percentile),
          format: value => String(value)
        },
        {
          key: "shotSpeed", label: "Top shot speed", description: "His hardest shot (NHL EDGE)",
          get: edge => PlayerSeasonPerformanceUtils.toEdgeStat(edge.topShotSpeed?.imperial,
              edge.topShotSpeed?.percentile),
          format: value => value.toFixed(1) + " mph"
        }
      ]
    }
  ];

  /** The groups of a goalie's card. His stats don't change with Per 60, which the card doesn't offer him. */
  public static readonly goalieGroups: SeasonStatGroup<LeagueGoalieStats, EdgeGoalieDetail>[] = [
    {
      title: "Goaltending",
      column: 0,
      stats: [
        {
          key: "savePct", label: "Save %", description: "Save percentage",
          getValue: row => PlayerPercentileUtils.getRatio(row.saves, row.shotsAgainst),
          format: value => PlayerPercentileUtils.formatSavePct(value)
        },
        {
          key: "goalsAgainstAverage", label: "Goals against average", description: "Goals against per 60 minutes",
          lowerIsBetter: true, getValue: row => row.goalsAgainstAverage, format: value => value.toFixed(2)
        },
        {
          key: "goalsSaved", label: "Goals saved above average",
          description: "Goals saved above an average goalie facing the same shots, at each strength's league save percentage",
          getValue: row => PlayerPercentileUtils.getGoalsSavedAboveAverage(row),
          format: value => PlayerSeasonPerformanceUtils.formatSigned(value, 1)
        },
        {
          key: "goalsSavedPer60", label: "Goals saved per 60", description: "Goals saved above average per 60 minutes",
          getValue: row => PlayerPercentileUtils.getPer60(PlayerPercentileUtils.getGoalsSavedAboveAverage(row),
              row.timeOnIce),
          format: value => PlayerSeasonPerformanceUtils.formatSigned(value, 2)
        }
      ]
    },
    {
      title: "By strength",
      column: 0,
      stats: [
        {
          key: "evenStrength", label: "Even strength save %", description: "Even strength save percentage",
          getValue: row => PlayerPercentileUtils.getRatio(row.evSaves, row.evShotsAgainst),
          format: value => PlayerPercentileUtils.formatSavePct(value)
        },
        {
          key: "penaltyKill", label: "Penalty kill save %", description: "Save percentage while his team is short-handed",
          getValue: row => PlayerPercentileUtils.getRatio(row.ppSaves, row.ppShotsAgainst),
          format: value => PlayerPercentileUtils.formatSavePct(value)
        }
      ]
    },
    {
      title: "Workload",
      column: 1,
      stats: [
        {key: "gamesStarted", label: "Games started", description: "Games started", getValue: row => row.gamesStarted},
        {key: "wins", label: "Wins", description: "Wins", getValue: row => row.wins},
        {key: "shutouts", label: "Shutouts", description: "Shutouts", getValue: row => row.shutouts}
      ]
    },
    {
      title: "Tracking",
      column: 1,
      edgeStats: [
        {
          key: "highDanger", label: "High danger save %",
          description: "Save percentage on shots from the slot and the crease (NHL EDGE)",
          get: edge => {
            const high = (edge.shotLocationSummary ?? []).find(location => location.locationCode === "high");
            return PlayerSeasonPerformanceUtils.toEdgeStat(high?.savePctg, high?.savePctgPercentile);
          },
          format: value => PlayerPercentileUtils.formatSavePct(value)
        },
        {
          key: "gamesAbove900", label: "Games above .900", description: "The share of his games with a .900 save percentage or better (NHL EDGE)",
          get: edge => PlayerSeasonPerformanceUtils.toEdgeStat(edge.stats?.gamesAbove900?.value,
              edge.stats?.gamesAbove900?.percentile),
          format: value => Math.round(value * 100) + "%"
        }
      ]
    }
  ];

  private static readonly groupNames: Record<PositionGroup, string> = {
    F: "forwards",
    D: "defensemen",
    G: "goalies"
  };

  /**
   * A player's season performance: every stat of his groups, ranked among the season's players of his position group
   * with at least the minimum games. NST's stats are left out without NST's rows (or without his row in them), and
   * EDGE's without his EDGE stats, so the card shows the NHL's stats alone. Undefined when he has no row in the season.
   *
   * @param leaguePlayers - Every player of the season at his position (skaters or goalies).
   * @param playerId - The player.
   * @param mode - Whether counting stats are totals or per 60 minutes. Goalies' stats stay as they are.
   * @param nstPlayers - Every skater's season on NST, or undefined when it couldn't be loaded.
   * @param edge - The player's NHL EDGE stats, or undefined without them.
   */
  public static getSeasonPerformance(leaguePlayers: LeaguePlayers, playerId: number, mode: SeasonPerformanceMode,
                                     nstPlayers?: NstPlayerStats[],
                                     edge?: EdgeSkaterDetail | EdgeGoalieDetail): SeasonPerformance {
    const playerPool = PlayerPercentileUtils.getPlayerPool(leaguePlayers, playerId);
    if (!playerPool) {
      return undefined;
    }
    const isGoalie = playerPool.group === "G";
    const nstById = new Map((nstPlayers ?? []).map(row => [row.playerId, row]));
    const withNst = (row: LeagueSkaterStats): SkaterPerformanceRow => ({...row, nst: nstById.get(row.playerId)});
    const pool = isGoalie ? playerPool : {
      ...playerPool,
      player: withNst(playerPool.player as LeagueSkaterStats),
      pool: (playerPool.pool as LeagueSkaterStats[]).map(withNst)
    };
    const groupName = PlayerSeasonPerformanceUtils.getGroupName(playerPool.group);
    const groups = ((isGoalie ? PlayerSeasonPerformanceUtils.goalieGroups : PlayerSeasonPerformanceUtils.skaterGroups) as
        SeasonStatGroup<SkaterPerformanceRow | LeagueGoalieStats, EdgeSkaterDetail | EdgeGoalieDetail>[])
        .map(group => ({
          title: group.title,
          column: group.column,
          isEdge: !group.stats?.length,
          rows: [
            ...(group.stats ?? [])
                .filter(stat => !stat.fromNst || (pool.player as SkaterPerformanceRow).nst)
                .filter(stat => !stat.isShown || stat.isShown(pool.player))
                .map(stat => PlayerSeasonPerformanceUtils.getRow(stat, pool, isGoalie ? "total" : mode, groupName))
                .filter(row => row),
            ...(edge ? group.edgeStats ?? [] : [])
                .map(stat => PlayerSeasonPerformanceUtils.getEdgeRow(stat, edge, groupName))
                .filter(row => row)
          ]
        }))
        .filter(group => group.rows.length);
    const skater = isGoalie ? undefined : playerPool.player as LeagueSkaterStats;
    const shownStats = groups.flatMap(group => group.rows.map(row => row.key));
    const nstKeys = PlayerSeasonPerformanceUtils.skaterGroups.flatMap(group => group.stats ?? [])
        .filter(stat => stat.fromNst)
        .map(stat => stat.key);
    return {
      group: playerPool.group,
      gamesPlayed: playerPool.gamesPlayed,
      timeOnIcePerGame: skater?.timeOnIcePerGame,
      gamesStarted: isGoalie ? (playerPool.player as LeagueGoalieStats).gamesStarted : undefined,
      minGames: playerPool.minGames,
      poolSize: playerPool.pool.length,
      isSmallSample: playerPool.isSmallSample,
      hasNst: !isGoalie && shownStats.some(key => nstKeys.includes(key)),
      hasEdge: groups.some(group => group.rows.some(row => row.isEdge)),
      groups
    };
  }

  /** The players of a position group, like "forwards". */
  public static getGroupName(group: PositionGroup): string {
    return PlayerSeasonPerformanceUtils.groupNames[group] ?? "players";
  }

  /**
   * The pool's description for a tooltip, like "389 forwards with 7+ games".
   */
  public static describePool(count: number, groupName: string, minGames: number, qualifierNote?: string): string {
    return count + " " + groupName + " with " + minGames + "+ games" + (qualifierNote ? " and " + qualifierNote : "");
  }

  /** A share as a percentage with one decimal, like 0.5243 to "52.4%". */
  public static formatPercent(value: number): string {
    return (value * 100).toFixed(1) + "%";
  }

  /** A number with its sign, like "+3.4" or "-1.2". Zero has none. */
  public static formatSigned(value: number, decimals: number): string {
    const text = value.toFixed(decimals);
    return value > 0 && Number(text) !== 0 ? "+" + text : text.replace(/^-(0(\.0+)?)$/, "$1");
  }

  /**
   * One stat's row: the player's value, his rank and percentile among the pool (or the players of it who qualify),
   * and its tier's color. In Per 60 a count becomes a rate of all-situation ice time, for the pool too. Undefined for a
   * stat nobody has that season, like shot attempts before the stats API had them.
   */
  private static getRow<T extends LeagueSkaterStats | LeagueGoalieStats>(stat: SeasonStatDefinition<T>,
                                                                         playerPool: PlayerPool<T>,
                                                                         mode: SeasonPerformanceMode,
                                                                         groupName: string): SeasonPerformanceRow {
    const getValue = (row: T): number => PlayerPercentileUtils.toNumber(stat.getCount ?
        (mode === "per60" ? PlayerPercentileUtils.getPer60(stat.getCount(row),
            PlayerSeasonPerformanceUtils.getTimeOnIce(row as LeagueSkaterStats)) : stat.getCount(row)) :
        stat.getValue?.(row));
    const ranked = stat.qualifier ?
        playerPool.pool.filter(row => stat.qualifier.test(row, playerPool.minGames)) : playerPool.pool;
    const poolValues = ranked.map(getValue);
    const value = getValue(playerPool.player);
    const rank = PlayerPercentileUtils.getRank(value, poolValues, stat.lowerIsBetter);
    const percentile = PlayerPercentileUtils.getPercentile(value, poolValues, stat.lowerIsBetter);
    const rankedCount = poolValues.filter(poolValue => poolValue != null).length;
    if (value == null && !rankedCount) {
      return undefined;
    }
    const poolText = PlayerSeasonPerformanceUtils.describePool(rankedCount, groupName, playerPool.minGames,
        stat.qualifier?.note(playerPool.minGames));
    const rankText = rank == null ? "" : TeamRatingUtils.getOrdinal(rank);
    const detail = stat.getDetail?.(playerPool.player);
    return {
      key: stat.key,
      label: stat.label,
      value: value == null ? "-" : PlayerSeasonPerformanceUtils.formatValue(stat, value, mode),
      rank: rankText,
      rankTier: stat.neutral ? "middle" : PlayerPercentileUtils.getRankTier(percentile),
      barWidth: percentile ?? 0,
      description: stat.description + (stat.getCount && mode === "per60" ? ", per 60 minutes" : "") +
          (detail ? ": " + detail : "") + (rank == null ? "" : ". " + rankText + " of " + poolText)
    };
  }

  /** An NHL EDGE stat's row, with the NHL's percentile in the pill, or undefined when EDGE doesn't have it. */
  private static getEdgeRow<E>(stat: EdgeStatDefinition<E>, edge: E, groupName: string): SeasonPerformanceRow {
    const edgeStat = stat.get(edge);
    if (edgeStat?.value == null) {
      return undefined;
    }
    const percentile = edgeStat.percentile == null ? undefined : edgeStat.percentile * 100;
    const percentileText = percentile == null ? "" : Math.round(percentile) + "%";
    return {
      key: stat.key,
      label: stat.label,
      value: stat.format(edgeStat.value),
      rank: percentileText,
      rankTier: PlayerPercentileUtils.getRankTier(percentile),
      barWidth: percentile ?? 0,
      description: stat.description + (percentile == null ? "" :
          ". NHL EDGE percentile among " + groupName + ": " + percentileText),
      isEdge: true
    };
  }

  private static formatValue<T>(stat: SeasonStatDefinition<T>, value: number, mode: SeasonPerformanceMode): string {
    if (stat.format) {
      return stat.format(value, mode);
    }
    const decimals = mode === "per60" ? 2 : stat.totalDecimals ?? 0;
    return stat.signed ? PlayerSeasonPerformanceUtils.formatSigned(value, decimals) : value.toFixed(decimals);
  }

  /** A skater's ice time over the season, in seconds: skater/timeonice's, or his ice time per game times his games. */
  private static getTimeOnIce(row: LeagueSkaterStats): number {
    return row?.timeOnIce ?? PlayerPercentileUtils.getSkaterTimeOnIce(row);
  }

  private static getFaceoffs(row: LeagueSkaterStats): number {
    return (row?.totalFaceoffWins ?? 0) + (row?.totalFaceoffLosses ?? 0);
  }

  /** An EDGE value and percentile, or undefined without a value. */
  private static toEdgeStat(value: number, percentile: number): {value: number, percentile: number} {
    return value == null ? undefined : {value, percentile};
  }
}

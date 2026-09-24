import {
  KeyEventPeriod,
  Play,
  PlayByPlay,
  PlayDetails,
  RosterSpot
} from "@shared/models/nhl-web-api/play-by-play.model";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {NhlPlayTypeEnum} from "@shared/enums/nhl-play-type.enum";

/**
 * Helpers for the play-by-play response (gamecenter/{id}/play-by-play), shared by the event timelines.
 */
export class PlayByPlayUtils {

  /**
   * Penalty severities by details.typeCode.
   */
  private static readonly penaltySeverities: Record<string, string> = {
    MIN: "minor",
    MAJ: "major",
    BEN: "bench minor",
    MIS: "misconduct",
    GAM: "game misconduct",
    MAT: "match penalty",
    PS: "penalty shot"
  };

  /**
   * Penalty descKeys that don't read well with their hyphens replaced by spaces.
   */
  private static readonly penaltyDescriptions: Record<string, string> = {
    "interference-goalkeeper": "Goalkeeper interference"
  };

  public static isGoal(play: Play): boolean {
    return play?.typeDescKey === NhlPlayTypeEnum.GOAL;
  }

  public static isPenalty(play: Play): boolean {
    return play?.typeDescKey === NhlPlayTypeEnum.PENALTY;
  }

  /**
   * Groups the goals and penalties by period, in play order. Every period with plays is listed, even without goals or
   * penalties, but the shootout isn't.
   *
   * @param playByPlay - The game's play-by-play.
   */
  public static getKeyEventPeriods(playByPlay: PlayByPlay): KeyEventPeriod[] {
    const periods = new Map<number, KeyEventPeriod>();
    (playByPlay?.plays ?? [])
        .filter(play => play.periodDescriptor && play.periodDescriptor.periodType !== NhlPeriodTypeEnum.SHOOTOUT)
        .sort((playA, playB) => playA.sortOrder - playB.sortOrder)
        .forEach(play => {
          const periodNumber = play.periodDescriptor.number;
          if (!periods.has(periodNumber)) {
            periods.set(periodNumber, {periodDescriptor: play.periodDescriptor, plays: []});
          }
          if (PlayByPlayUtils.isGoal(play) || PlayByPlayUtils.isPenalty(play)) {
            periods.get(periodNumber).plays.push(play);
          }
        });
    return Array.from(periods.values()).sort((periodA, periodB) =>
        periodA.periodDescriptor.number - periodB.periodDescriptor.number);
  }

  /**
   * Maps each goal's event ID to its index among its scorer's goals in the game, in scoring order (0 for their first
   * goal).
   *
   * @param periods - The key event periods (getKeyEventPeriods), which leave out the shootout.
   */
  public static getGoalIndexes(periods: KeyEventPeriod[]): Map<number, number> {
    const goalCounts = new Map<number, number>();
    const goalIndexes = new Map<number, number>();
    (periods ?? []).flatMap(period => period.plays ?? []).filter(play => PlayByPlayUtils.isGoal(play)).forEach(play => {
      const scorerId = play.details?.scoringPlayerId;
      const goalIndex = goalCounts.get(scorerId) ?? 0;
      goalCounts.set(scorerId, goalIndex + 1);
      goalIndexes.set(play.eventId, goalIndex);
    });
    return goalIndexes;
  }

  /**
   * Counts the faceoffs each player took (won or lost), by player ID. The boxscore only has a win percentage.
   *
   * @param playByPlay - The game's play-by-play.
   */
  public static getFaceoffCounts(playByPlay: PlayByPlay): Map<number, number> {
    const faceoffCounts = new Map<number, number>();
    (playByPlay?.plays ?? []).filter(play => play.typeDescKey === NhlPlayTypeEnum.FACEOFF).forEach(play => {
      [play.details?.winningPlayerId, play.details?.losingPlayerId].filter(playerId => playerId != null)
          .forEach(playerId => faceoffCounts.set(playerId, (faceoffCounts.get(playerId) ?? 0) + 1));
    });
    return faceoffCounts;
  }

  /**
   * Counts the penalties each player drew, by player ID, from the drawnByPlayerId of each penalty. This matches the
   * stats API's penaltiesDrawn: each fighter draws the other's major, coincidental minors count, and a penalty with no
   * drawer (too many men, a misconduct, delay of game) counts for nobody. Goalies can draw penalties too.
   *
   * @param playByPlay - The game's play-by-play.
   */
  public static getPenaltiesDrawnCounts(playByPlay: PlayByPlay): Map<number, number> {
    const penaltiesDrawnCounts = new Map<number, number>();
    (playByPlay?.plays ?? []).filter(play => play.typeDescKey === NhlPlayTypeEnum.PENALTY).forEach(play => {
      const playerId = play.details?.drawnByPlayerId;
      if (playerId != null) {
        penaltiesDrawnCounts.set(playerId, (penaltiesDrawnCounts.get(playerId) ?? 0) + 1);
      }
    });
    return penaltiesDrawnCounts;
  }

  /**
   * Maps player IDs to the game's roster spots, for names and headshots.
   *
   * @param playByPlay - The game's play-by-play.
   */
  public static getRosterSpotMap(playByPlay: PlayByPlay): Map<number, RosterSpot> {
    return new Map((playByPlay?.rosterSpots ?? []).map(spot => [spot.playerId, spot] as [number, RosterSpot]));
  }

  /**
   * Returns the player's full name, like "Kyle Connor", or an empty string without a roster spot.
   */
  public static getFullName(rosterSpot: RosterSpot): string {
    return [rosterSpot?.firstName?.default, rosterSpot?.lastName?.default].filter(name => !!name).join(" ");
  }

  /**
   * Returns the player's last name, like "Connor", or an empty string without a roster spot.
   */
  public static getLastName(rosterSpot: RosterSpot): string {
    return rosterSpot?.lastName?.default ?? "";
  }

  /**
   * Returns the goal scorer, or the penalized player. Bench penalties have no penalized player, so it returns the
   * player who served it (if any).
   *
   * @param play - A goal or penalty play.
   */
  public static getMainPlayerId(play: Play): number {
    if (PlayByPlayUtils.isGoal(play)) {
      return play.details?.scoringPlayerId;
    } else if (PlayByPlayUtils.isPenalty(play)) {
      return play.details?.committedByPlayerId ?? play.details?.servedByPlayerId;
    }
    return undefined;
  }

  /**
   * Returns the full name of the goal scorer or penalized player. A penalty served by another player gets
   * " (served)", like "Ivan Barbashev (served)", and one without any player is a "Team penalty".
   *
   * @param play - A goal or penalty play.
   * @param rosterSpots - The game's roster spots by player ID.
   */
  public static getMainPlayerLabel(play: Play, rosterSpots: Map<number, RosterSpot>): string {
    const name = PlayByPlayUtils.getFullName(rosterSpots?.get(PlayByPlayUtils.getMainPlayerId(play)));
    if (PlayByPlayUtils.isPenalty(play) && !play.details?.committedByPlayerId) {
      return name ? name + " (served)" : "Team penalty";
    }
    return name;
  }

  /**
   * Returns the IDs of a goal's assists, in order. Empty for unassisted and shootout goals.
   */
  public static getAssistPlayerIds(details: PlayDetails): number[] {
    return [details?.assist1PlayerId, details?.assist2PlayerId].filter(playerId => !!playerId);
  }

  /**
   * Returns the penalty's description, like "Tripping", with its severity unless it's a minor, like
   * "Too many men on the ice (bench minor)". Without a description, it returns the severity ("Major") or "Penalty".
   *
   * @param details - A penalty play's details.
   */
  public static getPenaltyLabel(details: PlayDetails): string {
    const severity = PlayByPlayUtils.penaltySeverities[details?.typeCode];
    const descKey = details?.descKey;
    if (!descKey) {
      return severity ? PlayByPlayUtils.capitalize(severity) : "Penalty";
    }
    const description = PlayByPlayUtils.penaltyDescriptions[descKey] ??
        PlayByPlayUtils.capitalize(descKey.replace(/-/g, " "));
    return severity && details.typeCode !== "MIN" ? description + " (" + severity + ")" : description;
  }

  private static capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.substring(1);
  }
}

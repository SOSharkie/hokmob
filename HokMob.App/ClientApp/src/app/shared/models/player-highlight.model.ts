/**
 * A player hovered on the game page, to highlight in Top Players.
 */
export interface PlayerHighlight {
  playerId: number;
  /**
   * The hovered goal's index among the player's goals in this game, in scoring order (0 for their first goal).
   * Undefined when the hovered item isn't one of the player's goals, like a penalty or an assist.
   */
  goalIndex?: number;
}

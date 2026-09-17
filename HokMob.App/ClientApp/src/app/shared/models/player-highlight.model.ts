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

/**
 * A player clicked in the goal scorers or an event timeline.
 */
export interface PlayerClick {
  playerId: number;
  /**
   * The clicked goal's event ID, to look up its highlight clip (GameLandingGoal.eventId). Undefined when the click
   * wasn't on a goal's main scorer, like an assist or a penalized player.
   */
  eventId?: number;
}

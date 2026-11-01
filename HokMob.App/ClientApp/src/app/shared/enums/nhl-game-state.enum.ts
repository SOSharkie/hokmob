
/**
 * The new NHL API gameState values.
 */
export enum NhlGameStateEnum {

    FUTURE = "FUT",

    PREGAME = "PRE",

    LIVE = "LIVE",

    CRITICAL = "CRIT",

    /** The game just ended, before the NHL marks it FINAL a few minutes later. */
    OVER = "OVER",

    FINAL = "FINAL",

    OFF = "OFF"

}

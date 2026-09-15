import {GameLanding} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {PlayByPlay} from "@shared/models/nhl-web-api/play-by-play.model";
import {Boxscore} from "@shared/models/nhl-web-api/boxscore.model";
import {RightRail} from "@shared/models/nhl-web-api/right-rail.model";

/**
 * All gamecenter responses for one game, as NhlGameService.getGameBundle returns them. Only the landing is required;
 * the other responses are undefined when their request fails.
 */
export interface GameBundle {
  landing: GameLanding;
  playByPlay?: PlayByPlay;
  boxscore?: Boxscore;
  rightRail?: RightRail;
}

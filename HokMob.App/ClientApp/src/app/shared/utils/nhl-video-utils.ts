import {ScoreGame} from "@shared/models/nhl-web-api/score.model";
import {GameLandingGoal} from "@shared/models/nhl-web-api/gamecenter-landing.model";

/**
 * A game video that can play in the highlights dialog.
 */
export interface HighlightVideo {
  /** Tab label, like "Recap". */
  label: string;
  /** Brightcove video ID, like "6398034433112". */
  videoId: string;
  /** The video's page on NHL.com. */
  nhlUrl: string;
}

/**
 * Game videos. NHL.com plays its videos with a Brightcove player that can be embedded in an iframe, so HokMob plays
 * them in its own dialog. The score endpoint gives each video's NHL.com path, which ends with the Brightcove ID.
 */
export class NhlVideoUtils {

  public static readonly nhlSiteUrl = "https://www.nhl.com";

  private static readonly brightcovePlayerUrl =
      "https://players.brightcove.net/6415718365001/D3UCGynRWU_default/index.html";

  /**
   * Returns the Brightcove video ID at the end of an NHL.com video path, like "6398034433112" for
   * "/video/car-at-vgk-recap-6398034433112", or undefined if the path doesn't end with one.
   *
   * @param path - The NHL.com video path.
   */
  public static getVideoId(path: string): string {
    return path?.match(/-(\d+)\/?$/)?.[1];
  }

  /**
   * Returns the embeddable player URL of a Brightcove video, starting playback when it loads.
   *
   * @param videoId - The Brightcove video ID.
   */
  public static getEmbedUrl(videoId: string): string {
    return NhlVideoUtils.brightcovePlayerUrl + "?videoId=" + encodeURIComponent(videoId) + "&autoplay=true";
  }

  /**
   * Returns a finished game's recap and condensed game, in that order, skipping videos that aren't posted or whose
   * path has no video ID.
   *
   * @param scoreGame - The game from score/{gameDate}.
   */
  public static getHighlightVideos(scoreGame: ScoreGame): HighlightVideo[] {
    const videos = [
      {label: "Recap", path: scoreGame?.threeMinRecap},
      {label: "Condensed Game", path: scoreGame?.condensedGame}
    ];
    return videos
        .map(video => ({
          label: video.label,
          videoId: NhlVideoUtils.getVideoId(video.path),
          nhlUrl: NhlVideoUtils.nhlSiteUrl + video.path
        }))
        .filter(video => !!video.videoId);
  }

  /**
   * Returns a goal's highlight video, or undefined when NHL.com hasn't posted the clip yet (live games and recent
   * goals).
   *
   * @param goal - The goal from gamecenter/{id}/landing's summary.scoring.
   */
  public static getGoalHighlightVideo(goal: GameLandingGoal): HighlightVideo {
    if (!goal?.highlightClip) {
      return undefined;
    }
    return {
      label: "Highlight",
      videoId: String(goal.highlightClip),
      nhlUrl: goal.highlightClipSharingUrl ?? ""
    };
  }
}

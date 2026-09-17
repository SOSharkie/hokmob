import {Component, Inject, ViewEncapsulation} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {HighlightVideo, NhlVideoUtils} from "@shared/utils/nhl-video-utils";
import {GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";

/**
 * Data of the goal highlight dialog: the scorer's game stats and the goal's highlight video.
 */
export interface GoalHighlightDialogData {
  player: GamePlayer;
  video: HighlightVideo;
}

/**
 * Shown when a goal with a posted highlight clip is clicked: the scorer's bio and game stats (shared with the player
 * game dialog) on top, and the goal's video below, in the same embedded Brightcove player as the highlights dialog.
 */
@Component({
  selector: 'app-goal-highlight-dialog',
  templateUrl: './goal-highlight-dialog.component.html',
  styleUrls: ['./goal-highlight-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class GoalHighlightDialogComponent {

  public player: GamePlayer;

  public video: HighlightVideo;

  public embedUrl: SafeResourceUrl;

  constructor(@Inject(MAT_DIALOG_DATA) data: GoalHighlightDialogData,
              private dialogRef: MatDialogRef<GoalHighlightDialogComponent>,
              private sanitizer: DomSanitizer) {
    this.player = data?.player;
    this.video = data?.video;
    if (this.video) {
      this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(NhlVideoUtils.getEmbedUrl(this.video.videoId));
    }
  }

  public close(): void {
    this.dialogRef.close();
  }
}

import {Component, Inject, ViewEncapsulation} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {HighlightVideo, NhlVideoUtils} from "@shared/utils/nhl-video-utils";

/**
 * Data of the highlights dialog: the game's videos and a subtitle naming the game.
 */
export interface HighlightsDialogData {
  videos: HighlightVideo[];
  subtitle: string;
}

/**
 * Plays a finished game's highlights in the NHL's embedded Brightcove player, with a tab per video.
 */
@Component({
  selector: 'app-highlights-dialog',
  templateUrl: './highlights-dialog.component.html',
  styleUrls: ['./highlights-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class HighlightsDialogComponent {

  public videos: HighlightVideo[];

  public subtitle: string;

  public selectedVideo: HighlightVideo;

  /**
   * The player URL of the selected video. Kept in a field, since a new SafeResourceUrl on every change detection
   * would reload the iframe.
   */
  public embedUrl: SafeResourceUrl;

  constructor(@Inject(MAT_DIALOG_DATA) data: HighlightsDialogData,
              private dialogRef: MatDialogRef<HighlightsDialogComponent>,
              private sanitizer: DomSanitizer) {
    this.videos = data?.videos ?? [];
    this.subtitle = data?.subtitle ?? "";
    this.selectVideo(this.videos[0]);
  }

  /**
   * Plays the given video, unless it's already playing.
   *
   * @param video - The video to play.
   */
  public selectVideo(video: HighlightVideo): void {
    if (!video || video === this.selectedVideo) {
      return;
    }
    this.selectedVideo = video;
    this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(NhlVideoUtils.getEmbedUrl(video.videoId));
  }

  public close(): void {
    this.dialogRef.close();
  }
}

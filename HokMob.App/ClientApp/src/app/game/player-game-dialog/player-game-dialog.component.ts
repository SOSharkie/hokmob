import {Component, Inject, OnInit, ViewEncapsulation} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {Router} from "@angular/router";
import {GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";

/**
 * Data of the player game dialog: a player's stats in the game, from the game page's boxscore.
 */
export interface PlayerGameDialogData {
  player: GamePlayer;
}

@Component({
  selector: 'app-player-game-dialog',
  templateUrl: './player-game-dialog.component.html',
  styleUrls: ['./player-game-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PlayerGameDialogComponent implements OnInit {

  public player: GamePlayer;

  constructor(private router: Router,
              private dialogRef: MatDialogRef<PlayerGameDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: PlayerGameDialogData) {}

  public ngOnInit(): void {
    this.player = this.data?.player;
  }

  public clickPlayerProfile(): void {
    this.dialogRef.close();
    setTimeout(() => {
      window.scrollTo(0, 0);
      this.router.navigate(['/player', this.player.playerId]);
    }, 100)
  }

  public closeDialog(): void {
    this.dialogRef.close();
  }
}

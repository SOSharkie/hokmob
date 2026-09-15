import {Component, Inject, OnInit, ViewEncapsulation} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import * as dayjs from "dayjs";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {
  PlayoffCarouselSeries,
  PlayoffSeriesGame,
  PlayoffSeriesGameTeam,
  PlayoffSeriesSchedule
} from "@shared/models/nhl-web-api/playoffs.model";
import {ScoreGame, ScoreTeam} from "@shared/models/nhl-web-api/score.model";
import {SeriesStatus} from "@shared/models/nhl-web-api/common.model";

/**
 * Data passed to the playoff series dialog.
 */
export interface PlayoffSeriesDialogData {
  series: PlayoffCarouselSeries;
  /** The season of the series, like 20252026. Defaults to the current season. */
  season: number;
}

@Component({
  selector: 'app-playoff-series-dialog',
  templateUrl: './playoff-series-dialog.component.html',
  styleUrls: ['./playoff-series-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PlayoffSeriesDialogComponent implements OnInit {

  public get seriesTitle(): string {
    const series = this.data?.series;
    if (!series?.topSeed || !series?.bottomSeed) {
      return "NHL Playoffs";
    }
    const status = this.getSeriesStatus();
    const statusText = status.topSeedWins + status.bottomSeedWins > 0
        ? NhlGameInfoUtils.getSeriesStatusShort(status)
        : series.topSeed.abbrev + " vs " + series.bottomSeed.abbrev;
    return this.getRoundName() + ": " + statusText;
  }

  public seriesSchedule: PlayoffSeriesSchedule;

  public seriesGames: ScoreGame[];

  constructor(private nhlPlayoffService: NhlStandingAndPlayoffService,
              private dialogRef: MatDialogRef<PlayoffSeriesDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: PlayoffSeriesDialogData) {}

  public ngOnInit(): void {
    const series = this.data?.series;
    if (!series?.topSeed || !series?.bottomSeed) {
      return;
    }
    const season = this.data.season ?? DateTimeUtils.getCurrentNhlSeason();
    this.nhlPlayoffService.getNhlPlayoffSeriesSchedule(season, series.seriesLetter).then(result => {
      this.seriesSchedule = result;
      this.seriesGames = (result.games ?? []).map(game => this.toScoreGame(game));
    }).catch(() => {
      // The service logs the error. Show the title without games
    });
  }

  public seriesGameClicked(): void {
    this.dialogRef.close();
  }

  /**
   * Gets the round name, like "East Round 1", "West Semifinals", "East Finals" or "Stanley Cup Finals". The conference
   * is only known once the series schedule loads.
   */
  private getRoundName(): string {
    const conferenceName = this.seriesSchedule?.topSeedTeam?.conference?.name;
    const conference = conferenceName ? (conferenceName === "Western" ? "West " : "East ") : "";
    switch (this.data.series.roundNumber) {
      case 1:
        return conference + "Round 1";
      case 2:
        return conference + "Semifinals";
      case 3:
        return conference + "Finals";
      case 4:
        return "Stanley Cup Finals";
      default:
        return "NHL Playoffs";
    }
  }

  /**
   * Builds the series status after the given game, or the current status without one. Games that haven't been played
   * have no series status, so they use the current wins.
   */
  private getSeriesStatus(game?: PlayoffSeriesGame): SeriesStatus {
    const series = this.data.series;
    return {
      round: series.roundNumber,
      seriesAbbrev: this.seriesSchedule?.roundAbbrev,
      seriesTitle: this.getRoundName(),
      seriesLetter: series.seriesLetter,
      neededToWin: series.neededToWin,
      topSeedTeamAbbrev: series.topSeed.abbrev,
      topSeedWins: game?.seriesStatus?.topSeedWins ?? series.topSeed.wins,
      bottomSeedTeamAbbrev: series.bottomSeed.abbrev,
      bottomSeedWins: game?.seriesStatus?.bottomSeedWins ?? series.bottomSeed.wins,
      gameNumberOfSeries: game?.gameNumber
    };
  }

  /**
   * Converts a series schedule game to the score response shape that app-scorecard expects.
   */
  private toScoreGame(game: PlayoffSeriesGame): ScoreGame {
    return {
      ...game,
      gameDate: dayjs(game.startTimeUTC).format("YYYY-MM-DD"),
      homeTeam: this.toScoreTeam(game.homeTeam),
      awayTeam: this.toScoreTeam(game.awayTeam),
      seriesStatus: this.getSeriesStatus(game)
    };
  }

  private toScoreTeam(team: PlayoffSeriesGameTeam): ScoreTeam {
    // The series schedule has no team logos; app-scorecard gets them from NhlTeamLogoUtils
    return {id: team.id, name: team.commonName, abbrev: team.abbrev, score: team.score, logo: undefined};
  }
}

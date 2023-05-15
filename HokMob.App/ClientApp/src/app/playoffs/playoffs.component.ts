import {Component, OnInit} from '@angular/core';
import {NhlPlayoffService} from "@shared/services/nhl-playoff.service";
import {NhlPlayoffModel} from "@shared/models/nhl-playoffs/nhl-playoff.model";
import {NhlPlayoffMatchupTeamModel} from "@shared/models/nhl-playoffs/nhl-playoff-matchup-team.model";
import {NhlSeriesSummaryModel} from "@shared/models/nhl-playoffs/nhl-series-summary.model";

@Component({
  selector: 'app-playoffs',
  templateUrl: './playoffs.component.html',
  styleUrls: ['./playoffs.component.scss']
})
export class PlayoffsComponent implements OnInit {

  public playoffsData: NhlPlayoffModel;

  constructor(private nhlPlayoffService: NhlPlayoffService) {
  }

  public ngOnInit(): void {
    this.nhlPlayoffService.getNhlPlayoffs().then(result => {
      result.rounds.forEach((round, roundNum) => {
        round.series.forEach((series, seriesNum) => {
          // Handle the case where a series is finished but the NHL API has not updated the next round with the winners
          if (series.currentGame.seriesSummary.seriesStatus && series.currentGame.seriesSummary.seriesStatusShort.includes("win")) {
            let winnerAbr = series.currentGame.seriesSummary.seriesStatusShort.slice(0, 3);
            let team = new NhlPlayoffMatchupTeamModel();
            if (series.matchupTeams[0].seriesRecord.wins === 4) {
              team.team = series.matchupTeams[0].team;
              team.seed = series.matchupTeams[0].seed;
              team.seriesRecord = {wins: 0, losses: 0};
            } else if (series.matchupTeams[1].seriesRecord.wins === 4) {
              team.team = series.matchupTeams[1].team;
              team.seed = series.matchupTeams[1].seed;
              team.seriesRecord = {wins: 0, losses: 0};
            }
            switch (series.seriesCode) {
              case "A":
              case "B":
                this.updateSeriesWithWinner(result, 1, 0, winnerAbr, team, "Eastern");
                break;
              case "C":
              case "D":
                this.updateSeriesWithWinner(result, 1, 1, winnerAbr, team, "Eastern");
                break;
              case "E":
              case "F":
                this.updateSeriesWithWinner(result, 1, 2, winnerAbr, team, "Western");
                break;
              case "G":
              case "H":
                this.updateSeriesWithWinner(result, 1, 3, winnerAbr, team, "Western");
                break;
              case "I":
              case "J":
                this.updateSeriesWithWinner(result, 2, 0, winnerAbr, team, "Eastern");
                break;
              case "K":
              case "L":
                this.updateSeriesWithWinner(result, 2, 1, winnerAbr, team, "Western");
                break;
              case "M":
              case "N":
                this.updateSeriesWithWinner(result, 3, 0, winnerAbr, team, "Finals");
                break;
            }
          }
        });
      });
      this.playoffsData = result;
    })
  }

  private updateSeriesWithWinner(playoffs: NhlPlayoffModel, round: number, series: number, winnerAbr: string,
                                 team: NhlPlayoffMatchupTeamModel, conferenceName: string): void {
    let updateSeriesSummary = false;
    if (!playoffs.rounds[round].series[series].matchupTeams) {
      playoffs.rounds[round].series[series].matchupTeams = [team, null];
      playoffs.rounds[round].series[series].names.teamAbbreviationA = winnerAbr;
      playoffs.rounds[round].series[series].names.teamAbbreviationB = "TBD";
      updateSeriesSummary = true;
    } else if (!playoffs.rounds[round].series[series].matchupTeams[1]) {
      playoffs.rounds[round].series[series].matchupTeams[1] = team;
      playoffs.rounds[round].series[series].names.teamAbbreviationB = winnerAbr;
      updateSeriesSummary = true;
    }

    if (updateSeriesSummary) {
      let seriesSummary = new NhlSeriesSummaryModel();
      seriesSummary.seriesStatus = playoffs.rounds[round].series[series].names.teamAbbreviationA + " vs " +
          playoffs.rounds[round].series[series].names.teamAbbreviationB;
      seriesSummary.seriesStatusShort = "TBD";
      playoffs.rounds[round].series[series].currentGame = {seriesSummary: seriesSummary};
      playoffs.rounds[round].series[series].conference = {id: 1, name: conferenceName, link: ""};
    }
  }
}

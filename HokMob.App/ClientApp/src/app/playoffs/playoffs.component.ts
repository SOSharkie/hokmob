import {Component, OnInit} from '@angular/core';
import {NhlPlayoffService} from "@shared/services/nhl-playoff.service";
import {NhlPlayoffModel} from "@shared/models/nhl-playoffs/nhl-playoff.model";
import {NhlPlayoffMatchupTeamModel} from "@shared/models/nhl-playoffs/nhl-playoff-matchup-team.model";

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
          if (series.currentGame.seriesSummary.seriesStatus && series.currentGame.seriesSummary.seriesStatusShort.includes("win")) {
            let winner = series.currentGame.seriesSummary.seriesStatusShort.slice(0, 3);
            let team = new NhlPlayoffMatchupTeamModel();
            if (series.matchupTeams[0].seriesRecord.wins === 4) {
              team.team = series.matchupTeams[0].team;
              team.seed = series.matchupTeams[0].seed;
              team.seriesRecord = {wins: 0, losses: 0};
            } else {
              team = series.matchupTeams[1];
            }
            switch (series.seriesCode) {
              case "A":
              case "B":
                if (!result.rounds[1].series[0].matchupTeams) {
                  result.rounds[1].series[0].matchupTeams = [team, null];
                  result.rounds[1].series[0].names.teamAbbreviationA = winner;
                }
                break;
              case "C":
              case "D":
                if (!result.rounds[1].series[1].matchupTeams) {
                  result.rounds[1].series[1].matchupTeams = [team, null];
                  result.rounds[1].series[1].names.teamAbbreviationA = winner;
                }
                break;
              case "E":
              case "F":
                if (!result.rounds[1].series[2].matchupTeams) {
                  result.rounds[1].series[2].matchupTeams = [team, null];
                  result.rounds[1].series[2].names.teamAbbreviationA = winner;
                }
                break;
              case "G":
              case "H":
                if (!result.rounds[1].series[3].matchupTeams) {
                  result.rounds[1].series[3].matchupTeams = [team, null];
                  result.rounds[1].series[3].names.teamAbbreviationA = winner;
                }
                break;
              case "I":
              case "J":
                if (!result.rounds[2].series[0].matchupTeams) {
                  result.rounds[2].series[0].matchupTeams = [team, null];
                  result.rounds[2].series[0].names.teamAbbreviationA = winner;
                }
                break;
              case "L":
              case "M":
                if (!result.rounds[2].series[1].matchupTeams) {
                  result.rounds[2].series[1].matchupTeams = [team, null];
                  result.rounds[2].series[1].names.teamAbbreviationA = winner;
                }
                break;
            }

          }
        });
      });
      this.playoffsData = result;
    })
  }
}

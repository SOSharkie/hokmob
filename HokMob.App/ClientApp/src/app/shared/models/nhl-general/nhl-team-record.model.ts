import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {NhlLeagueRecordModel} from "@shared/models/nhl-general/nhl-league-record.model";

export class NhlTeamRecordModel {

  public team: NhlTeamModel;

  public leagueRecord: NhlLeagueRecordModel;

  public regulationWins: number;

  public goalsAgainst: number;

  public goalsScored: number;

  public points: number;

  public divisionRank: string;

  public divisionL10Rank: string;

  public divisionRoadRank: string;

  public divisionHomeRank: string;

  public conferenceRank: string;

  public conferenceL10Rank: string;

  public conferenceRoadRank: string;

  public conferenceHomeRank: string;

  public leagueRank: string;

  public leagueL10Rank: string;

  public leagueRoadRank: string;

  public leagueHomeRank: string;

  public wildCardRank: string;

  public row: number;

  public gamesPlayed: number;

  public streak: {
    streakType: string,
    steakNumber: number,
    streakCode: string
  }

  clinchIndicator: string;
  
  pointsPercentage: number;
  
  ppDivisionRank: string;
  
  ppConferenceRank: string;
  
  ppLeagueRank: string;
  
  lastUpdated: string;
}

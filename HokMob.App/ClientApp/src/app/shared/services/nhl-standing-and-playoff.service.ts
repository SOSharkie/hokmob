import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {HttpParams} from "@angular/common/http";
import {NhlPlayoffModel} from "@shared/models/nhl-playoffs/nhl-playoff.model";
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import * as dayjs from "dayjs";
import {StandingsGroup, StandingsResponse, StandingsTeam} from "@shared/models/nhl-web-api/standings.model";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";

@Injectable()
export class NhlStandingAndPlayoffService {

  private readonly nhlPlayoffUrl = "https://statsapi.web.nhl.com/api/v1/tournaments/playoffs?expand=round.series,schedule.game.seriesSummary&season=";

  // Proxied through the HokMob backend (NhlController) to avoid CORS
  private readonly nhlStandingsUrl = "/api/nhl/standings/now";

  private readonly nhlScheduleUrl = "https://statsapi.web.nhl.com/api/v1/schedule";

  private readonly scheduleDetails = "linescore,broadcasts(all)"

  constructor(private http: HttpClient) { }

  /**
   *  Gets the current NHL standings, grouped for the given standings type. Between seasons, standings/now returns the
   *  final standings of the last season.
   *
   * @param standingsType - How to group the standings: by league, conference, division, or wild card with leaders.
   */
  public getNhlStandings(standingsType: NhlStandingsTypeEnum): Promise<StandingsGroup[]> {
    return new Promise((resolve, reject) => {
      return this.http.get<StandingsResponse>(this.nhlStandingsUrl).subscribe({
        next: (response) => {
          resolve(this.groupStandings(response.standings ?? [], standingsType));
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   *  Gets the NHL playoff details for the given season.
   *
   * @param season - The season to get playoff details for.
   */
  public getNhlPlayoffs(season: string): Promise<NhlPlayoffModel> {
    let url = this.nhlPlayoffUrl + season
    return new Promise((resolve, reject) => {
      return this.http.get<NhlPlayoffModel>(url).subscribe({
        next: (response) => {
          resolve(response);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   *  Gets all nhl game models for a playoff series.
   *
   * @param teamId1 - The team ID to get NHL game models for.
   * @param teamId2 - The team ID to get NHL game models for.
   */
  public getNhlPlayoffSeriesGames(teamId1: number, teamId2: number): Promise<NhlScheduleModel> {
    const options = {
      params: new HttpParams().set("startDate", this.formatDateStringForNhl(dayjs().subtract(40, 'days').toDate()))
          .set("endDate", this.formatDateStringForNhl(dayjs().add(20, 'days').toDate()))
          .set("teamId", teamId1 + "," + teamId2)
          .set("gameType", "P")
          .set("hydrate", this.scheduleDetails)
    };

    return new Promise((resolve, reject) => {
      return this.http.get<NhlScheduleModel>(this.nhlScheduleUrl, options).subscribe({
        next: (response) => {
          resolve(response);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Groups the flat standings list. Conferences are ordered Eastern then Western, and divisions alphabetically within
   * their conference. Wild card standings list each division's top 3, then the rest of the conference by wild card rank.
   */
  private groupStandings(teams: StandingsTeam[], standingsType: NhlStandingsTypeEnum): StandingsGroup[] {
    switch (standingsType) {
      case NhlStandingsTypeEnum.BY_CONFERENCE:
        return this.sortedGroups(teams, team => team.conferenceName, team => team.conferenceSequence)
            .map(([conference, conferenceTeams]) => ({title: conference + " Conference", teams: conferenceTeams}));
      case NhlStandingsTypeEnum.BY_DIVISION:
        return this.sortedGroups(teams, team => team.conferenceName, team => team.divisionSequence)
            .flatMap(([, conferenceTeams]) =>
                this.sortedGroups(conferenceTeams, team => team.divisionName, team => team.divisionSequence))
            .map(([division, divisionTeams]) => ({title: division + " Division", teams: divisionTeams}));
      case NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS:
        return this.sortedGroups(teams, team => team.conferenceName, team => team.wildcardSequence)
            .flatMap(([conference, conferenceTeams]) => [
              ...this.sortedGroups(conferenceTeams.filter(team => team.wildcardSequence === 0),
                  team => team.divisionName, team => team.divisionSequence)
                  .map(([division, leaders]) => ({title: division + " Leaders", teams: leaders})),
              {title: conference + " Wild Card", teams: conferenceTeams.filter(team => team.wildcardSequence > 0)}
            ]);
      default:
        return [{title: "NHL", teams: [...teams].sort((a, b) => a.leagueSequence - b.leagueSequence)}];
    }
  }

  /**
   * Splits teams into groups by name, returning [name, teams] pairs sorted by name with each group's teams sorted by rank.
   */
  private sortedGroups(teams: StandingsTeam[], getName: (team: StandingsTeam) => string,
                       getRank: (team: StandingsTeam) => number): [string, StandingsTeam[]][] {
    const groups = new Map<string, StandingsTeam[]>();
    teams.forEach(team => {
      const name = getName(team);
      groups.set(name, [...(groups.get(name) ?? []), team]);
    });
    return [...groups.entries()]
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
        .map(([name, groupTeams]) => [name, groupTeams.sort((a, b) => getRank(a) - getRank(b))]);
  }

  private formatDateStringForNhl(date: Date): string {
    return dayjs(date).format("YYYY-MM-DD");
  }

}

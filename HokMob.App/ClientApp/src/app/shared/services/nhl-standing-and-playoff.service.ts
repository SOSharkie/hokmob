import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {StandingsGroup, StandingsResponse, StandingsTeam} from "@shared/models/nhl-web-api/standings.model";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {
  PlayoffBracket,
  PlayoffBracketSeries,
  PlayoffBracketTeam,
  PlayoffBracketSeason,
  PlayoffCarousel,
  PlayoffCarouselSeed,
  PlayoffCarouselSeries,
  PlayoffSeriesSchedule
} from "@shared/models/nhl-web-api/playoffs.model";

@Injectable()
export class NhlStandingAndPlayoffService {

  // Proxied through the HokMob backend (NhlController) to avoid CORS
  private readonly nhlStandingsUrl = "/api/nhl/standings/now";

  private readonly nhlPlayoffCarouselUrl = "/api/nhl/playoff-series/carousel/";

  private readonly nhlPlayoffBracketUrl = "/api/nhl/playoff-bracket/";

  private readonly nhlPlayoffSeriesScheduleUrl = "/api/nhl/schedule/playoff-series/";

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
   *  Gets the NHL playoff series for the given season, by round. The carousel has no seed ranks, so they're merged in
   *  from the playoff bracket. If the bracket fails to load, the series are returned without ranks.
   *
   * @param season - The season to get playoff details for, like "20252026".
   */
  public getNhlPlayoffs(season: string): Promise<PlayoffCarousel> {
    const carousel = this.get<PlayoffCarousel>(this.nhlPlayoffCarouselUrl + season + "/");
    const bracket = this.get<PlayoffBracket>(this.nhlPlayoffBracketUrl + season.substring(4)).catch(() => null);
    return Promise.all([carousel, bracket]).then(([carouselResult, bracketResult]) => {
      this.addSeedRanks(carouselResult, bracketResult);
      return carouselResult;
    });
  }

  /**
   *  Gets the playoff bracket of a season, with its series converted to the carousel series model that the series cards
   *  and dialog use. Only rounds 1 to 4 are kept: the qualifying round of 2020 (round 0) is left out and flagged.
   *
   * @param year - The year the season ends in, like 2026 for 2025-26.
   */
  public getNhlPlayoffBracket(year: number): Promise<PlayoffBracketSeason> {
    return this.get<PlayoffBracket>(this.nhlPlayoffBracketUrl + year).then(bracket => {
      const series = bracket?.series ?? [];
      return {
        year: year,
        season: (year - 1) * 10000 + year,
        series: series.filter(item => item.playoffRound >= 1 && item.playoffRound <= 4)
            .map(item => this.toCarouselSeries(item)),
        hasQualifyingRound: series.some(item => item.playoffRound === 0)
      };
    });
  }

  /**
   *  Gets the latest playoff bracket with series: the bracket of the given year, or the previous year's while the given
   *  year's has no series yet (before its playoffs start).
   *
   * @param year - The year the latest season ends in, like 2027 for 2026-27.
   */
  public getLatestNhlPlayoffBracket(year: number): Promise<PlayoffBracketSeason> {
    return this.getNhlPlayoffBracket(year).then(bracket => {
      return bracket.series.length ? bracket : this.getNhlPlayoffBracket(year - 1);
    });
  }

  /**
   *  Gets the schedule and games of a playoff series.
   *
   * @param season - The season of the series, like 20252026.
   * @param seriesLetter - The series letter, from "A" (first round) to "O" (Stanley Cup Final).
   */
  public getNhlPlayoffSeriesSchedule(season: number | string, seriesLetter: string): Promise<PlayoffSeriesSchedule> {
    return this.get<PlayoffSeriesSchedule>(this.nhlPlayoffSeriesScheduleUrl + season + "/" + seriesLetter.toLowerCase() + "/");
  }

  /**
   * Sets each carousel seed's rank from the bracket series with the same letter, matching teams by ID.
   */
  private addSeedRanks(carousel: PlayoffCarousel, bracket: PlayoffBracket): void {
    const bracketSeries = new Map((bracket?.series ?? []).map(series => [series.seriesLetter, series]));
    carousel.rounds?.forEach(round => round.series.forEach(series => {
      const match = bracketSeries.get(series.seriesLetter);
      if (match) {
        this.setSeedRank(series.topSeed, match);
        this.setSeedRank(series.bottomSeed, match);
      }
    }));
  }

  /**
   * Converts a bracket series to the carousel model. A seed whose team isn't known yet is left undefined. The bracket
   * has no wins needed, which has been 4 in every round since 1987.
   */
  private toCarouselSeries(series: PlayoffBracketSeries): PlayoffCarouselSeries {
    const toSeed = (team: PlayoffBracketTeam, wins: number, rank: number): PlayoffCarouselSeed => team ? {
      id: team.id,
      abbrev: team.abbrev,
      logo: team.logo,
      darkLogo: team.darkLogo,
      wins: wins ?? 0,
      rank: rank
    } : undefined;
    return {
      seriesLetter: series.seriesLetter,
      roundNumber: series.playoffRound,
      seriesLabel: series.seriesTitle,
      seriesLink: series.seriesUrl,
      conferenceName: series.conferenceName,
      topSeed: toSeed(series.topSeedTeam, series.topSeedWins, series.topSeedRank),
      bottomSeed: toSeed(series.bottomSeedTeam, series.bottomSeedWins, series.bottomSeedRank),
      neededToWin: 4,
      winningTeamId: series.winningTeamId,
      losingTeamId: series.losingTeamId
    };
  }

  private setSeedRank(seed: PlayoffCarouselSeed, bracketSeries: PlayoffBracketSeries): void {
    if (seed?.id === bracketSeries.topSeedTeam?.id) {
      seed.rank = bracketSeries.topSeedRank;
    } else if (seed?.id === bracketSeries.bottomSeedTeam?.id) {
      seed.rank = bracketSeries.bottomSeedRank;
    }
  }

  private get<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      return this.http.get<T>(url).subscribe({
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

}

import {Component, Input, OnChanges} from '@angular/core';
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {GoalieSeasonStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";

/**
 * One row of the career table: a season with a logo per team the player played for that season.
 */
export interface CareerSeasonRow {
  /** Like "2023-2024". */
  season: string;
  /** One logo per team of the season, in the order the API gives them. */
  teamLogos: string[];
  gamesPlayed: number;
  goals?: number;
  assists?: number;
  points?: number;
  shutouts?: number;
  goalsAgainstAverage?: number;
  savePct?: number;
}

/**
 * The player's NHL seasons, newest first, from the stats API rows (/api/nhl-stats/player/{id}). A season with two
 * teams is one row with both logos (decision 5), and a team the logo utils don't know, like ATL, gets the fallback
 * logo.
 */
@Component({
  selector: 'app-player-career',
  templateUrl: './player-career.component.html',
  styleUrls: ['./player-career.component.scss']
})
export class PlayerCareerComponent implements OnChanges {

  @Input()
  public seasons: SkaterSeasonStats[] | GoalieSeasonStats[];

  @Input()
  public isGoalie: boolean;

  public rows: CareerSeasonRow[] = [];

  public ngOnChanges(): void {
    const seasons: (SkaterSeasonStats | GoalieSeasonStats)[] = this.seasons ?? [];
    this.rows = seasons.map(season => ({
      season: DateTimeUtils.getNhlSeasonDisplayValue(String(season.seasonId)),
      teamLogos: PlayerCareerComponent.getTeamLogos(season.teamAbbrevs),
      gamesPlayed: season.gamesPlayed,
      goals: (season as SkaterSeasonStats).goals,
      assists: (season as SkaterSeasonStats).assists,
      points: (season as SkaterSeasonStats).points,
      shutouts: (season as GoalieSeasonStats).shutouts,
      goalsAgainstAverage: (season as GoalieSeasonStats).goalsAgainstAverage,
      savePct: (season as GoalieSeasonStats).savePct
    }));
  }

  /**
   * The logos of a season's teams, like "CGY,VAN" for a traded season.
   *
   * @param teamAbbrevs - The season's team abbreviations, separated by commas.
   */
  private static getTeamLogos(teamAbbrevs: string): string[] {
    return (teamAbbrevs ?? "").split(",")
        .map(abbrev => abbrev.trim())
        .filter(abbrev => !!abbrev)
        .map(abbrev => NhlTeamLogoUtils.getTeamPrimaryLogo(NhlTeamUtils.getTeamIdByAbbrev(abbrev)));
  }
}

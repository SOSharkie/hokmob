import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {StandingsGroup} from "@shared/models/nhl-web-api/standings.model";
import {StandingsTypeFilter, StandingsTypeUtils} from "@shared/utils/standings-type-utils";

/**
 * The team page's standings tab: the whole league's standings of the picked type, with the team's row highlighted,
 * and the standings page's type filters above them. The team page keeps the type in the URL, so this component only
 * asks for a new one (standingsTypeChange) and loads whatever type it's given.
 */
@Component({
  selector: 'app-team-standings',
  templateUrl: './team-standings.component.html',
  styleUrls: ['./team-standings.component.scss']
})
export class TeamStandingsComponent implements OnInit, OnChanges {

  /** The type the tab opens with, without a standingsType query parameter. */
  public static readonly defaultStandingsType = NhlStandingsTypeEnum.BY_DIVISION;

  @Input()
  public teamId: number;

  @Input()
  public standingsType: NhlStandingsTypeEnum = TeamStandingsComponent.defaultStandingsType;

  @Output()
  public standingsTypeChange = new EventEmitter<NhlStandingsTypeEnum>();

  public readonly filters: StandingsTypeFilter[] = StandingsTypeUtils.filters;

  /** The standings of the shown type. Undefined while they load, or after they failed. */
  public standings: StandingsGroup[];

  /** Whether the last request failed, for the error message. */
  public hasError: boolean = false;

  /** Loads the first standings, whether or not a type was given. */
  public ngOnInit(): void {
    this.retrieveStandings();
  }

  /** Loads the standings again whenever the type changes after that. */
  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['standingsType'] && !changes['standingsType'].firstChange) {
      this.retrieveStandings();
    }
  }

  constructor(private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService) {}

  /**
   * Asks the team page for another standings type. The page writes it to the URL and passes it back in.
   */
  public selectStandingsType(type: NhlStandingsTypeEnum): void {
    if (type !== this.standingsType) {
      this.standingsTypeChange.emit(type);
    }
  }

  private retrieveStandings(): void {
    this.standingsType = this.standingsType ?? TeamStandingsComponent.defaultStandingsType;
    const standingsType = this.standingsType;
    this.standings = undefined;
    this.hasError = false;
    this.nhlStandingAndPlayoffService.getNhlStandings(standingsType).then(standings => {
      if (standingsType === this.standingsType) {
        this.standings = standings;
      }
    }).catch(() => {
      // The service logs the error. Show the message rather than the standings of another type
      if (standingsType === this.standingsType) {
        this.hasError = true;
      }
    });
  }
}

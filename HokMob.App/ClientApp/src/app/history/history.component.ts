import {Component, OnInit} from '@angular/core';
import {RatedSeason} from "@shared/models/nhl-history/season-history.model";
import {HistorySeasonOption, SeasonHistoryService} from "@shared/services/season-history.service";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {PickerMenuUtils} from "@shared/utils/picker-menu-utils";

/**
 * The history page (`/history`): season-wide HokMob rating charts of a finished season, from the season's preloaded
 * stat lines (SeasonHistoryService), rated with the same formulas as the game and player pages. The season picker lists
 * every season with a file in src/assets/history.
 */
@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {

  public readonly seasonOptions: HistorySeasonOption[] = SeasonHistoryService.seasons;

  public selectedSeason: HistorySeasonOption = SeasonHistoryService.seasons[0];

  public ratedSeason: RatedSeason;

  public isLoading: boolean = false;

  public hasError: boolean = false;

  /** Counts the loads, so a season picked before the last one can't replace it. */
  private loadId: number = 0;

  constructor(private seasonHistoryService: SeasonHistoryService) {
  }

  public ngOnInit(): void {
    this.loadSeason(this.selectedSeason);
  }

  /**
   * A season's picker label, like "2025-26 Regular Season".
   */
  public getSeasonLabel(option: HistorySeasonOption): string {
    const years = DateTimeUtils.getNhlSeasonDisplayValue(String(option.season));
    // 20252026 reads "2025-2026", shortened to "2025-26"
    const shortYears = years.substring(0, 5) + years.substring(7);
    return shortYears + (option.gameType === NhlGameTypeEnum.PLAYOFFS ? " Playoffs" : " Regular Season");
  }

  public isSelected(option: HistorySeasonOption): boolean {
    return option.season === this.selectedSeason?.season && option.gameType === this.selectedSeason?.gameType;
  }

  public selectSeason(option: HistorySeasonOption): void {
    if (!this.isSelected(option)) {
      this.selectedSeason = option;
      this.loadSeason(option);
    }
  }

  /**
   * Scrolls the opened season menu to the selected season.
   */
  public scrollToSelectedSeason(): void {
    PickerMenuUtils.scrollToSelectedOption("season-menu");
  }

  private loadSeason(option: HistorySeasonOption): void {
    const loadId = ++this.loadId;
    this.ratedSeason = undefined;
    this.hasError = false;
    this.isLoading = true;
    this.seasonHistoryService.getSeasonHistory(option.season, option.gameType).then(ratedSeason => {
      if (loadId === this.loadId) {
        this.ratedSeason = ratedSeason;
        this.isLoading = false;
      }
    }).catch(() => {
      // The service logs the error
      if (loadId === this.loadId) {
        this.hasError = true;
        this.isLoading = false;
      }
    });
  }
}

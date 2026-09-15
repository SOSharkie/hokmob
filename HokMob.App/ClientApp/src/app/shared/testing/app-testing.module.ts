import {NgModule} from '@angular/core';
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {RouterTestingModule} from "@angular/router/testing";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {NgOptimizedImage} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from "@angular/material/dialog";
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {MaterialModule} from "@shared/modules/material.module";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {BetaNhlStatsService} from "@shared/services/beta-nhl-stats.service";
import {NhlStatsService} from "@shared/services/nhl-stats.service";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import {NhlSearchService} from "@shared/services/nhl-search.service";
import {SavePercentagePipe} from "@shared/pipes/save-percentage.pipe";
import {GoalsAgainstAveragePipe} from "@shared/pipes/goals-against-average.pipe";

const modules = [
  HttpClientTestingModule,
  RouterTestingModule,
  NoopAnimationsModule,
  NgOptimizedImage,
  FormsModule,
  ReactiveFormsModule,
  MaterialModule,
  MatDialogModule,
  MatAutocompleteModule
];

/**
 * Imports, pipes and services for component unit tests, mirroring AppModule. HTTP requests go to HttpClientTestingModule,
 * so tests never call the backend. Specs declare the component under test and add CUSTOM_ELEMENTS_SCHEMA so child
 * components don't need to be declared.
 */
@NgModule({
  imports: modules,
  declarations: [SavePercentagePipe, GoalsAgainstAveragePipe],
  exports: [...modules, SavePercentagePipe, GoalsAgainstAveragePipe],
  providers: [
    NhlGameService,
    NhlImageService,
    NhlStandingAndPlayoffService,
    BetaNhlStatsService,
    NhlStatsService,
    RouterExtensionService,
    NhlSearchService,
    {provide: MatDialogRef, useValue: {close: () => {}}},
    {provide: MAT_DIALOG_DATA, useValue: {}}
  ]
})
export class AppTestingModule {
}

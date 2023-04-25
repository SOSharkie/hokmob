import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from '@app/app-routing.module';
import { AppComponent } from '@app/app.component';
import { HomeComponent } from '@home/home.component';
import { NavigationMenuComponent } from '@home/navigation-menu/navigation-menu.component';
import { ScoreboardComponent } from '@home/scoreboard/scoreboard.component';
import { HeaderComponent } from '@header/header.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { ScorecardComponent } from '@shared/components/scorecard/scorecard.component';
import {FormsModule} from "@angular/forms";
import {HttpClientModule} from "@angular/common/http";
import { MaterialModule } from '@shared/modules/material.module';
import {NhlLogoService} from "@shared/services/nhl-logo.service";
import {NgOptimizedImage} from "@angular/common";
import { AboutComponent } from './about/about.component';
import { GameComponent } from './game/game.component';
import { GoalScorersComponent } from './game/goal-scorers/goal-scorers.component';
import {EventTimelineComponent} from "@app/game/event-timeline/event-timeline.component";
import { EventComponent } from './game/event-timeline/event/event.component';
import { FooterComponent } from './footer/footer.component';
import { TeamFormComponent } from './game/team-form/team-form.component';
import { PreviousGameComponent } from './game/team-form/previous-game/previous-game.component';
import { PlayoffsComponent } from './playoffs/playoffs.component';
import { PlayoffSeriesComponent } from './playoffs/playoff-series/playoff-series.component';
import { GameStatsComponent } from './game/game-stats/game-stats.component';
import {NhlPlayoffService} from "@shared/services/nhl-playoff.service";
import { PlayoffSeriesDialogComponent } from '@app/playoffs/playoff-series-dialog/playoff-series-dialog.component';
import {NhlGameService} from "@shared/services/nhl-game.service";
import {MatDialogModule} from "@angular/material/dialog";
import {RouterExtensionService} from "@shared/services/router-extension.service";

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    HeaderComponent,
    SearchInputComponent,
    NavigationMenuComponent,
    ScoreboardComponent,
    ScorecardComponent,
    AboutComponent,
    GameComponent,
    GoalScorersComponent,
    EventTimelineComponent,
    EventComponent,
    FooterComponent,
    TeamFormComponent,
    PreviousGameComponent,
    PlayoffsComponent,
    PlayoffSeriesComponent,
    GameStatsComponent,
    PlayoffSeriesDialogComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    MaterialModule,
    NgOptimizedImage,
    MatDialogModule
  ],
  providers: [
    NhlGameService,
    NhlLogoService,
    NhlPlayoffService,
    RouterExtensionService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

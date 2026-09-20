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
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {HttpClientModule} from "@angular/common/http";
import { MaterialModule } from '@shared/modules/material.module';
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
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import { PlayoffSeriesDialogComponent } from '@app/playoffs/playoff-series-dialog/playoff-series-dialog.component';
import {NhlGameService} from "@shared/services/nhl-game.service";
import {MatDialogModule} from "@angular/material/dialog";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import { StatsComponent } from './stats/stats.component';
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NhlLeadersService} from "@shared/services/nhl-leaders.service";
import { StatLeaderboardComponent } from '@app/stats/stat-leaderboard/stat-leaderboard.component';
import { PlayoffSummaryComponent } from './home/playoff-summary/playoff-summary.component';
import { PlayerComponent } from './player/player.component';
import { MomentumComponent } from './game/momentum/momentum.component';
import { PlayerGameDialogComponent } from './game/player-game-dialog/player-game-dialog.component';
import { PlayerGameStatsComponent } from './game/player-game-stats/player-game-stats.component';
import { HighlightsDialogComponent } from './game/highlights-dialog/highlights-dialog.component';
import { GoalHighlightDialogComponent } from './game/goal-highlight-dialog/goal-highlight-dialog.component';
import { PlayerStatsComponent } from './player/player-stats/player-stats.component';
import { RecentPlayerGamesComponent } from './player/recent-player-games/recent-player-games.component';
import { PlayerBioComponent } from './player/player-bio/player-bio.component';
import { TeamComponent } from './team/team.component';
import { GameHeaderComponent } from '@app/game/game-header/game-header.component';
import {SavePercentagePipe} from "@shared/pipes/save-percentage.pipe";
import {GoalsAgainstAveragePipe} from "@shared/pipes/goals-against-average.pipe";
import {NhlSearchService} from "@shared/services/nhl-search.service";
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import { SearchResultComponent } from './shared/components/search-result/search-result.component';
import { StandingsComponent } from './shared/components/standings/standings.component';
import { TeamLogoComponent } from './shared/components/team-logo/team-logo.component';
import { LeagueStandingsComponent } from './league-standings/league-standings.component';
import {SingleTeamFormComponent} from "@app/team/single-team-form/single-team-form.component";
import { TeamScheduleComponent } from './team/team-schedule/team-schedule.component';
import { TeamStatsComponent } from './team/team-stats/team-stats.component';
import { TeamNextGameComponent } from './team/team-next-game/team-next-game.component';
import { StandingsSummaryComponent } from './home/standings-summary/standings-summary.component';
import { GameTopPlayersComponent } from './game/game-top-players/game-top-players.component';
import { MiniEventTimelineComponent } from './game/mini-event-timeline/mini-event-timeline.component';
import { MiniEventComponent } from './game/mini-event-timeline/mini-event/mini-event.component';
import { PlayerCareerComponent } from './player/player-career/player-career.component';
import { DraftComponent } from './draft/draft.component';
import { DevComponent } from './dev/dev.component';

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
    PlayoffSeriesDialogComponent,
    StatsComponent,
    StatLeaderboardComponent,
    PlayoffSummaryComponent,
    PlayerComponent,
    MomentumComponent,
    PlayerGameDialogComponent,
    PlayerGameStatsComponent,
    HighlightsDialogComponent,
    GoalHighlightDialogComponent,
    PlayerStatsComponent,
    RecentPlayerGamesComponent,
    PlayerBioComponent,
    TeamComponent,
    GameHeaderComponent,
    SavePercentagePipe,
    GoalsAgainstAveragePipe,
    SearchResultComponent,
    StandingsComponent,
    TeamLogoComponent,
    LeagueStandingsComponent,
    SingleTeamFormComponent,
    TeamScheduleComponent,
    TeamStatsComponent,
    TeamNextGameComponent,
    StandingsSummaryComponent,
    GameTopPlayersComponent,
    MiniEventTimelineComponent,
    MiniEventComponent,
    PlayerCareerComponent,
    DraftComponent,
    DevComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    MaterialModule,
    NgOptimizedImage,
    MatDialogModule,
    MatAutocompleteModule,
    ReactiveFormsModule
  ],
  providers: [
    NhlGameService,
    NhlStandingAndPlayoffService,
    NhlStatsApiService,
    NhlLeadersService,
    RouterExtensionService,
    NhlSearchService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

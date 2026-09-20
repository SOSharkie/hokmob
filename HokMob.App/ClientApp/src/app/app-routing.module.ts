import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {HomeComponent} from "@home/home.component";
import {AboutComponent} from "@app/about/about.component";
import {GameComponent} from "@app/game/game.component";
import {PlayoffsComponent} from "@app/playoffs/playoffs.component";
import {StatsComponent} from "@app/stats/stats.component";
import {PlayerComponent} from "@app/player/player.component";
import {TeamComponent} from "@app/team/team.component";
import {LeagueStandingsComponent} from "@app/league-standings/league-standings.component";
import {DraftComponent} from "@app/draft/draft.component";
import {DevComponent} from "@app/dev/dev.component";
import {canMatchDevPage} from "@app/dev/dev.guard";

const routes: Routes = [
  { path: '', component: HomeComponent, data: {routeIdx: 0} },
  { path: 'game/:id', component: GameComponent, data: {routeIdx: 1} },
  { path: 'about', component: AboutComponent, data: {routeIdx: 2} },
  { path: 'playoffs', component: PlayoffsComponent, data: {routeIdx: 3} },
  { path: 'stats', component: StatsComponent, data: {routeIdx: 4} },
  { path: 'player/:id', component: PlayerComponent, data: {routeIdx: 5} },
  { path: 'team/:id', component: TeamComponent, data: {routeIdx: 6} },
  { path: 'standings', component: LeagueStandingsComponent, data: {routeIdx: 7} },
  { path: 'draft', component: DraftComponent, data: {routeIdx: 8} },
  // Only matches when the app is served locally, so the deployed site falls through to the wildcard below
  { path: 'dev', component: DevComponent, canMatch: [canMatchDevPage], data: {routeIdx: 9} },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {scrollPositionRestoration: 'enabled', canceledNavigationResolution: 'computed'})],
  exports: [RouterModule]
})
export class AppRoutingModule { }

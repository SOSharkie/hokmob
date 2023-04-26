import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {HomeComponent} from "@home/home.component";
import {AboutComponent} from "@app/about/about.component";
import {GameComponent} from "@app/game/game.component";
import {PlayoffsComponent} from "@app/playoffs/playoffs.component";
import {StatsComponent} from "@app/stats/stats.component";

const routes: Routes = [
  { path: '', component: HomeComponent, data: {routeIdx: 0} },
  { path: 'game/:id', component: GameComponent, data: {routeIdx: 1} },
  { path: 'about', component: AboutComponent, data: {routeIdx: 2} },
  { path: 'playoffs', component: PlayoffsComponent, data: {routeIdx: 3} },
  { path: 'stats', component: StatsComponent, data: {routeIdx: 4} },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

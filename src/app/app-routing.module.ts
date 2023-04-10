import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {HomeComponent} from "@home/home.component";
import {AboutComponent} from "@app/about/about.component";
import {GameComponent} from "@app/game/game.component";

const routes: Routes = [
  { path: '', component: HomeComponent, data: {routeIdx: 0} },
  { path: 'game/:id', component: GameComponent, data: {routeIdx: 1} },
  { path: 'about', component: AboutComponent, data: {routeIdx: 2} },

  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

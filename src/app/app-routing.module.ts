import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {HomeComponent} from "@home/home.component";
import {AboutComponent} from "@app/about/about.component";

const routes: Routes = [
  { path: '', component: HomeComponent, data: {routeIdx: 0} },
  { path: 'about', component: AboutComponent, data: {routeIdx: 1} },

  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

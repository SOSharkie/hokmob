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
import {NhlGameService} from "./shared/services/nhl-game.service";

import { MaterialModule } from '@shared/modules/material.module';
import {NhlLogoService} from "@shared/services/nhl-logo.service";
import {NgOptimizedImage} from "@angular/common";
import { AboutComponent } from './about/about.component';
import { GameComponent } from './game/game.component';

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
    GameComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    MaterialModule,
    NgOptimizedImage
  ],
  providers: [
    NhlGameService,
    NhlLogoService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

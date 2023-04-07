import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HomeComponent } from './home/home.component';
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { HeaderComponent } from './header/header.component';
import { SearchInputComponent } from './shared/components/search-input/search-input.component';
import { NavigationMenuComponent } from './home/navigation-menu/navigation-menu.component';
import { ScoreboardComponent } from './home/scoreboard/scoreboard.component';
import { ScorecardComponent } from './shared/components/scorecard/scorecard.component';
import { MatNativeDateModule } from "@angular/material/core";

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    HeaderComponent,
    SearchInputComponent,
    NavigationMenuComponent,
    ScoreboardComponent,
    ScorecardComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatToolbarModule,
    MatInputModule,
    MatIconModule,
    MatNativeDateModule,
    MatDatepickerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

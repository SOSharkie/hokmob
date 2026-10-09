import { Component } from '@angular/core';

/**
 * A feature card on the about page.
 */
export interface AboutFeature {
  title: string;
  description: string;
  /** A Lucide icon name registered in `LUCIDE_ICONS`, the same one the app's menus use for that page. */
  iconName: string;
}

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {

  public readonly contactEmail = "SOSharkie@gmail.com";

  public readonly features: AboutFeature[] = [
    {
      title: "Live scores",
      iconName: "calendar-days",
      description: "Every game of the day, updated live, with the playoff picture front and center in the postseason."
    },
    {
      title: "Game center",
      iconName: "gauge",
      description: "Goal scorers, momentum, an event timeline, team stats, highlights and player ratings for every game."
    },
    {
      title: "Standings and playoffs",
      iconName: "list-ordered",
      description: "League, conference and division standings, and the full playoff bracket."
    },
    {
      title: "Teams and players",
      iconName: "shield",
      description: "Team schedules, form and stats, player profiles, and league stat leaders."
    }
  ];
}

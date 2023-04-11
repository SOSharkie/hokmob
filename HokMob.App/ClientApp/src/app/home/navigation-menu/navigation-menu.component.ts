import { Component } from '@angular/core';
import {NavMenuItemModel} from "../../shared/models/nav-menu-item.model";

@Component({
  selector: 'app-navigation-menu',
  templateUrl: './navigation-menu.component.html',
  styleUrls: ['./navigation-menu.component.scss']
})
export class NavigationMenuComponent {

  public navMenuItems: NavMenuItemModel[] = [
    {name: "Standings", iconName: "table_rows"},
    {name: "Stats", iconName: "leaderboard"},
    {name: "News", iconName: "newspaper"},
    {name: "Teams", iconName: "group"},
    {name: "More", iconName: "more"}
  ];
}

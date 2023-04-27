import { Component } from '@angular/core';
import {NavMenuItemModel} from "@shared/models/nav-menu-item.model";
import {ActivatedRoute, Router} from "@angular/router";

@Component({
  selector: 'app-navigation-menu',
  templateUrl: './navigation-menu.component.html',
  styleUrls: ['./navigation-menu.component.scss']
})
export class NavigationMenuComponent {

  public navMenuItems: NavMenuItemModel[] = [
    {name: "Playoffs", iconName: "ballot"},
    {name: "Stats", iconName: "leaderboard"},
    {name: "Standings", iconName: "table_rows"},
    {name: "News", iconName: "newspaper"},
    {name: "Teams", iconName: "group"}
  ];

  constructor(private route: ActivatedRoute,
              private router: Router) {
  }

  public onClickMenuItem(menuItem: NavMenuItemModel) {
    switch (menuItem.name) {
      case "Playoffs":
        this.router.navigate(['playoffs']);
        break;
      case "Stats":
        this.router.navigate(['stats'])
        break;
    }
  }
}

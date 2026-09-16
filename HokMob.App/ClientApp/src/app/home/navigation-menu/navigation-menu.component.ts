import { Component } from '@angular/core';
import {NavMenuItemModel} from "@shared/models/nav-menu-item.model";
import {ActivatedRoute, Router} from "@angular/router";
import {LUCIDE_ICON_NAMESPACE} from "@shared/icons/lucide-icons";

@Component({
  selector: 'app-navigation-menu',
  templateUrl: './navigation-menu.component.html',
  styleUrls: ['./navigation-menu.component.scss']
})
export class NavigationMenuComponent {

  public navMenuItems: NavMenuItemModel[] = [
    // {name: "Playoffs", iconName: "ballot"},
    {name: "Standings", iconName: "list-ordered"},
    {name: "Stats", iconName: "chart-no-axes-column"},
    {name: "Draft", iconName: "clipboard-list"},
    {name: "News", iconName: "newspaper"},
    {name: "Teams", iconName: "shield"}
  ];

  constructor(private route: ActivatedRoute,
              private router: Router) {
  }

  /**
   * The registered name of a menu item's icon, for `<mat-icon [svgIcon]>`.
   */
  public getSvgIcon(menuItem: NavMenuItemModel): string {
    return `${LUCIDE_ICON_NAMESPACE}:${menuItem.iconName}`;
  }

  public onClickMenuItem(menuItem: NavMenuItemModel) {
    switch (menuItem.name) {
      case "Playoffs":
        this.router.navigate(['playoffs']);
        break;
      case "Stats":
        this.router.navigate(['stats']);
        break;
      case "Draft":
        this.router.navigate(['draft']);
        break;
      case "Standings":
        this.router.navigate(['standings']);
        break;
      case "Teams":
        this.router.navigate(['standings']);
        break;
      case "News":
        window.location.href = 'https://www.reddit.com/r/hockey/';
        break;
    }
  }
}

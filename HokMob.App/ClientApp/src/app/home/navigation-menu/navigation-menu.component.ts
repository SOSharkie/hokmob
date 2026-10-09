import { Component } from '@angular/core';
import {NavMenuItemModel} from "@shared/models/nav-menu-item.model";
import {LUCIDE_ICON_NAMESPACE} from "@shared/icons/lucide-icons";

@Component({
  selector: 'app-navigation-menu',
  templateUrl: './navigation-menu.component.html',
  styleUrls: ['./navigation-menu.component.scss']
})
export class NavigationMenuComponent {

  /** Real links, so they work from the keyboard and can be opened in a new tab. */
  public navMenuItems: NavMenuItemModel[] = [
    // {name: "Playoffs", iconName: "ballot", route: "/playoffs"},
    {name: "Standings", iconName: "list-ordered", route: "/standings"},
    {name: "Stats", iconName: "chart-no-axes-column", route: "/stats"},
    {name: "History", iconName: "history", route: "/history"},
    {name: "Draft", iconName: "clipboard-list", route: "/draft"},
    {name: "News", iconName: "newspaper", url: "https://www.reddit.com/r/hockey/"},
    {name: "Teams", iconName: "shield", route: "/standings"}
  ];

  /**
   * The registered name of a menu item's icon, for `<mat-icon [svgIcon]>`.
   */
  public getSvgIcon(menuItem: NavMenuItemModel): string {
    return `${LUCIDE_ICON_NAMESPACE}:${menuItem.iconName}`;
  }
}

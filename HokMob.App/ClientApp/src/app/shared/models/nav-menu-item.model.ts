export class NavMenuItemModel {

  public name: string;

  /** A Lucide icon name registered in `LUCIDE_ICONS` (`@shared/icons/lucide-icons`). */
  public iconName: string;

  /** The app route the item links to, like "/stats". */
  public route?: string;

  /** An external page the item links to instead of a route. */
  public url?: string;

}

/**
 * Helpers for the pill pickers: a .pill-picker button opening a mat-menu with the .pill-picker-menu class, whose
 * options are .pill-picker-option buttons with .selected on the current one (styles in styles.scss).
 *
 * A mat-menu rather than a native <select>, because a native list can't be height-capped: the draft's 21 years
 * filled the screen. The menu also gives the options menuitemradio roles and handles arrow keys, Escape and outside
 * clicks, and flips above the button when there's no room below.
 */
export class PickerMenuUtils {

  /**
   * Scrolls an opened picker menu to its selected option, so an option further down the height-capped list is
   * visible. Bind it to the trigger's (menuOpened) event. The panel renders in the overlay after that event, hence
   * the timeout. The menu is found by its own class, because another menu can still be in the overlay while its close
   * animation runs.
   *
   * @param menuClass - The menu's own class besides pill-picker-menu, like "year-menu".
   */
  public static scrollToSelectedOption(menuClass: string): void {
    setTimeout(() => {
      document.querySelector('.pill-picker-menu.' + menuClass + ' .pill-picker-option.selected')
          ?.scrollIntoView({block: 'nearest'});
    });
  }
}

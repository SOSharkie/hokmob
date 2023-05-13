import { Injectable } from '@angular/core';
import { ThemeEnum } from '@shared/enums/theme.enum';
import { ThemeConstants } from '@shared/constants/theme.constants';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private headElement?: HTMLHeadElement | null;

  constructor() {
    this.headElement = document.getElementsByTagName('head')[0];
  }

  /**
   * @function initializes the theme from storage by calling setTheme()
   * @example initTheme()
   */
  initTheme(): void {
    let theme: string | null = this.getThemeFromStorage();
    this.setTheme(theme ? theme : ThemeEnum.Default);
  }

  /**
   * @returns the theme that has been set in localStorage
   */
  getThemeFromStorage(): string | null {
    return localStorage.getItem(ThemeConstants.THEME);
  }

  /**
   * @function adds the {@link theme} as a link to the head if none exists otherwise removes the saved .css theme link
   * @param theme name of the .css theme file, which is lazy loaded as a bundle in angular.json styles[] array
   * @example setTheme(ThemeEnum.Dark)
   */
  setTheme(theme: string): void {
    let themeElement = this.getThemeElement(theme);
    if (!themeElement) {
      this.addThemeElement(theme);
    } else if (this.getThemeFromStorage() !== ThemeEnum.Default &&
               this.getThemeFromStorage() !== theme) {
      this.removeThemeElement(this.getThemeFromStorage());
    }
    this.saveThemeToStorage(theme);
  }

  private addThemeElement(theme: string): void {
    let link: HTMLLinkElement = document.createElement('link');
    link.rel = ThemeConstants.STYLESHEET;
    link.href = `${theme + ThemeConstants.CSS_FILE_EXTENSION}`;
    this.headElement?.appendChild(link);
  }

  private getThemeElement(theme: string | null): HTMLElement | null {
    return document.querySelector(
      `link[rel='${ThemeConstants.STYLESHEET}'][href='${theme + ThemeConstants.CSS_FILE_EXTENSION}']`);
  }

  private removeThemeElement(theme: string | null): void{
    let themeElement = this.getThemeElement(theme);
    if (themeElement) this.headElement?.removeChild(themeElement);
  }

  private saveThemeToStorage(theme: string): void {
    localStorage.setItem(ThemeConstants.THEME, theme);
  }
}
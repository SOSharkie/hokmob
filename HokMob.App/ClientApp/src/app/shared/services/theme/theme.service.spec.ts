import { TestBed } from '@angular/core/testing';
import { ThemeConstants } from '@shared/constants/theme.constants';
import { ThemeEnum } from '@shared/enums/theme.enum';
import { ThemeService } from '@shared/services/theme/theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);

    const link: HTMLLinkElement = document.createElement('link');
    link.rel = ThemeConstants.STYLESHEET;
    link.href = `${ThemeEnum.Default + ThemeConstants.CSS_FILE_EXTENSION}`;
    document.getElementsByTagName('head')[0].appendChild(link);
  });

  afterEach(() => {
    localStorage.removeItem(ThemeConstants.THEME);
    Object.values(ThemeEnum).forEach((theme: string) => {
      const themeElement = document.querySelector(`link[rel='${ThemeConstants.STYLESHEET}'][href='${theme + ThemeConstants.CSS_FILE_EXTENSION}']`);
      if (themeElement) document.getElementsByTagName('head')[0].removeChild(themeElement);
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add a theme as a <link> to the head if the theme doesn\'t exist with setTheme', () => {
    const theme: string = ThemeEnum.Light;
    const query: string = `link[rel='${ThemeConstants.STYLESHEET}'][href='${theme + ThemeConstants.CSS_FILE_EXTENSION}']`;
    let themeElement = document.querySelector(query);
    let themeFromStorage = localStorage.getItem(ThemeConstants.THEME);
    
    expect(themeElement).toBeFalsy();
    expect(themeFromStorage).toBeFalsy();

    service.setTheme(theme);

    themeElement = document.querySelector(query);
    themeFromStorage = localStorage.getItem(ThemeConstants.THEME);

    expect(themeElement).toBeTruthy();
    expect(themeFromStorage).toEqual(theme);
  });

  it('should remove a theme that already exists in storage and is not the default', () => {
    let theme = ThemeEnum.Light;
    const link: HTMLLinkElement = document.createElement('link');
    const query: string = `link[rel='${ThemeConstants.STYLESHEET}'][href='${theme + ThemeConstants.CSS_FILE_EXTENSION}']`;

    link.rel = ThemeConstants.STYLESHEET;
    link.href = `${theme + ThemeConstants.CSS_FILE_EXTENSION}`;
    document.getElementsByTagName('head')[0].appendChild(link);
    localStorage.setItem(ThemeConstants.THEME, theme);

    let themeElement = document.querySelector(query);
    let themeFromStorage = localStorage.getItem(ThemeConstants.THEME);

    expect(themeElement).toBeTruthy();
    expect(themeFromStorage).toEqual(theme);

    theme = ThemeEnum.Default

    service.setTheme(theme);

    themeElement = document.querySelector(query);
    themeFromStorage = localStorage.getItem(ThemeConstants.THEME);
    expect(themeElement).toBeFalsy();
    expect(themeFromStorage).toEqual(theme);
  });

  it('should set the theme from local storage when one exists on initTheme', () => {
    localStorage.setItem(ThemeConstants.THEME, ThemeEnum.Light);

    service.initTheme();

    const theme = localStorage.getItem(ThemeConstants.THEME);
    const themeElement = document.querySelector(`link[rel='${ThemeConstants.STYLESHEET}'][href='${theme + ThemeConstants.CSS_FILE_EXTENSION}']`);

    expect(theme).toEqual(ThemeEnum.Light);
    expect(themeElement).toBeTruthy();
  });

  it('should set the default theme when none exists in local storage on initTheme', () => {
    service.initTheme();

    const theme = localStorage.getItem(ThemeConstants.THEME);
    const themeElement = document.querySelector(`link[rel='${ThemeConstants.STYLESHEET}'][href='${theme + ThemeConstants.CSS_FILE_EXTENSION}']`);
    expect(theme).toEqual(ThemeEnum.Default);
    expect(themeElement).toBeTruthy();
  });

  it('should get the current theme from local storage on getThemeFromStorage', () => {
    localStorage.setItem(ThemeConstants.THEME, ThemeEnum.Default);

    const theme = service.getThemeFromStorage();
    expect(theme).toEqual(ThemeEnum.Default);
  });
});
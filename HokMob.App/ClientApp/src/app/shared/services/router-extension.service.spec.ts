import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { RouterExtensionService } from './router-extension.service';

@Component({template: ''})
class EmptyComponent {
}

describe('RouterExtensionService', () => {
  let service: RouterExtensionService;
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ EmptyComponent ],
      imports: [
        RouterTestingModule.withRoutes([
          {path: '', component: EmptyComponent},
          {path: 'game/:id', component: EmptyComponent},
          {path: 'team/:id', component: EmptyComponent},
          {path: '**', redirectTo: ''}
        ], {canceledNavigationResolution: 'computed'})
      ],
      providers: [ RouterExtensionService ]
    });
    service = TestBed.inject(RouterExtensionService);
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    // Makes the router follow the back button, as the app's initial navigation does
    router.setUpLocationChangeListener();
  });

  /** Waits for the router to finish the next navigation. */
  function nextNavigationEnd(): Promise<unknown> {
    return firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd)));
  }

  /** Goes back like the browser's back button, and waits for the router to follow. */
  async function browserBack(): Promise<void> {
    const navigationEnd = nextNavigationEnd();
    location.back();
    await navigationEnd;
  }

  it('should have no previous page on the first page', async () => {
    await router.navigateByUrl('/game/2025021057');
    expect(service.getPreviousUrl()).toBeUndefined();
  });

  it('should know the previous page, including its date query parameter', async () => {
    await router.navigateByUrl('/?date=20260301');
    await router.navigateByUrl('/game/2025020952');
    expect(service.getPreviousUrl()).toBe('/?date=20260301');
  });

  it('should follow the browser back button instead of treating it as a new page', async () => {
    await router.navigateByUrl('/?date=20260301');
    await router.navigateByUrl('/game/2025020952');
    await router.navigateByUrl('/team/28');
    expect(service.getPreviousUrl()).toBe('/game/2025020952');

    await browserBack();
    expect(location.path()).toBe('/game/2025020952');
    // Before, the previous URL was the team page just left, so the back buttons went back and forth between them
    expect(service.getPreviousUrl()).toBe('/?date=20260301');
  });

  it('should go back in the history when there is a previous page', async () => {
    await router.navigateByUrl('/?date=20260301');
    await router.navigateByUrl('/game/2025020952');
    const navigateByUrl = spyOn(router, 'navigateByUrl').and.callThrough();

    const navigationEnd = nextNavigationEnd();
    service.back('/');
    await navigationEnd;

    expect(location.path()).toBe('/?date=20260301');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('should open the fallback URL without a previous page', async () => {
    await router.navigateByUrl('/game/2025020952');
    const navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const back = spyOn(location, 'back');

    service.back('/?date=20260301');

    expect(navigateByUrl).toHaveBeenCalledWith('/?date=20260301');
    expect(back).not.toHaveBeenCalled();
  });

  it('should replace the current page for a navigation that replaces the URL', async () => {
    await router.navigateByUrl('/game/2025020952');
    await router.navigateByUrl('/team/28');
    await router.navigateByUrl('/team/22', {replaceUrl: true});
    expect(service.getPreviousUrl()).toBe('/game/2025020952');
    expect(RouterExtensionService.getBackLabel(location.path(), '')).toBe('Team');
  });

  it('should keep the URL after redirects', async () => {
    await router.navigateByUrl('/nowhere');
    await router.navigateByUrl('/game/2025020952');
    expect(service.getPreviousUrl()).toBe('/');
  });

  describe('getBackLabel', () => {
    it('should label the pages of the app', () => {
      expect(RouterExtensionService.getBackLabel('/', 'Stats')).toBe('Games');
      expect(RouterExtensionService.getBackLabel('/?date=20260301', 'Stats')).toBe('Games');
      expect(RouterExtensionService.getBackLabel('/game/2025020952', 'Stats')).toBe('Game');
      expect(RouterExtensionService.getBackLabel('/team/28', 'Stats')).toBe('Team');
      expect(RouterExtensionService.getBackLabel('/player/8477964', 'Stats')).toBe('Player');
      expect(RouterExtensionService.getBackLabel('/stats?gameType=P', 'Games')).toBe('Stats');
      expect(RouterExtensionService.getBackLabel('/standings?standingsType=byDivision', 'Games')).toBe('Standings');
      expect(RouterExtensionService.getBackLabel('/playoffs?season=20222023', 'Games')).toBe('Playoffs');
      expect(RouterExtensionService.getBackLabel('/about', 'Games')).toBe('About');
    });

    it('should use the fallback label without a URL', () => {
      expect(RouterExtensionService.getBackLabel(undefined, 'Stats')).toBe('Stats');
      expect(RouterExtensionService.getBackLabel(null, 'Games')).toBe('Games');
    });
  });
});

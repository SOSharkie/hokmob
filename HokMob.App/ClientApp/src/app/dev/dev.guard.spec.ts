import { TestBed } from '@angular/core/testing';
import { Route, UrlSegment } from '@angular/router';
import { LocalEnvironmentUtils } from '@shared/utils/local-environment-utils';

import { canMatchDevPage } from './dev.guard';

describe('canMatchDevPage', () => {

  const route: Route = {path: 'dev'};
  const segments: UrlSegment[] = [new UrlSegment('dev', {})];

  /** Runs the guard in an injection context, as the router does. */
  function runGuard(): boolean | unknown {
    return TestBed.runInInjectionContext(() => canMatchDevPage(route, segments));
  }

  it('should match the Dev route when the app is served locally', () => {
    spyOn(LocalEnvironmentUtils, 'isRunningLocally').and.returnValue(true);
    expect(runGuard()).toBeTrue();
  });

  it('should not match the Dev route on the deployed site', () => {
    spyOn(LocalEnvironmentUtils, 'isRunningLocally').and.returnValue(false);
    expect(runGuard()).toBeFalse();
  });
});

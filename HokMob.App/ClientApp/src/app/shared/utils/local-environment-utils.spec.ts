import { LocalEnvironmentUtils } from '@shared/utils/local-environment-utils';

describe('LocalEnvironmentUtils', () => {

  describe('isRunningLocally', () => {

    it('should be true for the hostnames the app is served from locally', () => {
      ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'].forEach(hostname => {
        expect(LocalEnvironmentUtils.isRunningLocally(hostname)).withContext(hostname).toBeTrue();
      });
    });

    it('should be true for a hostname under localhost, and ignore its case', () => {
      expect(LocalEnvironmentUtils.isRunningLocally('app.localhost')).toBeTrue();
      expect(LocalEnvironmentUtils.isRunningLocally('LocalHost')).toBeTrue();
    });

    it('should be false for a deployed host', () => {
      ['hokmob.com', 'www.hokmob.com', 'localhost.example.com', 'notlocalhost'].forEach(hostname => {
        expect(LocalEnvironmentUtils.isRunningLocally(hostname)).withContext(hostname).toBeFalse();
      });
    });

    it('should be false without a hostname', () => {
      // undefined isn't passed, since the default parameter would replace it with the current page's hostname
      expect(LocalEnvironmentUtils.isRunningLocally(null)).toBeFalse();
      expect(LocalEnvironmentUtils.isRunningLocally('')).toBeFalse();
    });

    it('should read the current page when no hostname is passed', () => {
      // Karma serves the tests from localhost
      expect(LocalEnvironmentUtils.isRunningLocally()).toBe(
          LocalEnvironmentUtils.isRunningLocally(window.location.hostname));
    });
  });
});

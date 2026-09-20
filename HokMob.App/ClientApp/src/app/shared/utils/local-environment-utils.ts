/**
 * Tells whether the app is running locally, on a developer's machine, rather than on the deployed site. The Dev page
 * and its header link are only available there (see `canMatchDevPage`).
 */
export class LocalEnvironmentUtils {

  /** The hostnames the app is served from locally: `npm run dev` (4200), the backend (7157) and `dotnet run` (44424). */
  private static readonly localHostnames = ["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"];

  /**
   * Whether the app is being served locally. True for localhost, the loopback addresses and any `*.localhost`
   * hostname; false everywhere else, including the deployed site.
   *
   * @param hostname - The hostname to check, the current page's by default.
   */
  public static isRunningLocally(hostname: string = window.location?.hostname): boolean {
    const host = (hostname ?? "").toLowerCase();
    return LocalEnvironmentUtils.localHostnames.includes(host) || host.endsWith(".localhost");
  }
}

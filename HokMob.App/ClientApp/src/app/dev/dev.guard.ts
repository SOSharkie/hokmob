import {CanMatchFn} from "@angular/router";
import {LocalEnvironmentUtils} from "@shared/utils/local-environment-utils";

/**
 * Keeps the Dev page to a developer's machine. When the app isn't served locally the route doesn't match, so the
 * wildcard route takes over and `/dev` lands on the home page.
 */
export const canMatchDevPage: CanMatchFn = () => LocalEnvironmentUtils.isRunningLocally();

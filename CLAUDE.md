# HokMob

Hockey stats site (like Fotmob, for the NHL). `HokMob.App/` is an ASP.NET Core (.NET 7) backend that serves the Angular
app and proxies the NHL API. `HokMob.App/ClientApp/` is the Angular 15 frontend (Angular Material, dayjs, chart.js).

## NHL API migration (in progress)

The old NHL APIs (`statsapi.web.nhl.com`, `cms.nhl.bamgrid.com`, `suggest.svc.nhl.com`) are dead. Pages are being
moved to `api-web.nhle.com` phase by phase. **Read `docs/nhl-api-migration-plan.md` before working on any page**: it
has field mappings, what's done, decisions and known risks. Update its status, tables and decisions when you finish or
change a phase.

- Unmigrated pages (team, player, playoffs bracket, search) still call dead APIs. Their `ERR_NAME_NOT_RESOLVED` /
  `statsapi.web.nhl.com` console errors are expected noise, not regressions.
- Out-of-scope code that breaks because a shared component changed gets the smallest compile fix plus a `// TODO:`
  comment pointing at the plan (see `team.component.ts` for the format).

## Layout

- `HokMob.App/Controllers/NhlController.cs`: proxies `/api/nhl/<path>` → `https://api-web.nhle.com/v1/<path>`. Only
  first path segments in `AllowedRoots` are proxied, so add new roots there. Empty segments are dropped, so a
  trailing `/` is fine.
- `HokMob.App/Services/NhlApiClient.cs`: HTTP client with in-memory caching per path root (10s for live data).
- `ClientApp/src/app/shared/`:
  - `models/nhl-web-api/`: typed models for the new API. The older `models/nhl-*` folders hold old API models, kept
    only for unmigrated pages.
  - `services/`: Angular services.
  - `utils/`: static helpers: `PeriodUtils`, `NhlGameInfoUtils`, `NhlTeamUtils`, `NhlTeamLogoUtils`,
    `NhlTeamColorUtils`, `NhlPlayerHeadshotUtils`, `DateTimeUtils`, `StatsUtils`, `PlayByPlayUtils`.
  - `enums/`: new API enums (`NhlGameStateEnum`, `NhlGameTypeEnum`, ...).
  - `components/`: shared components (scorecard, standings, ...).
- Feature folders under `ClientApp/src/app/`: `home`, `game`, `playoffs`, `league-standings`, `team`, `player`, `stats`,
  `header`, `footer`, `about`.
- Path aliases: `@shared/*`, `@app/*`, `@home/*`, `@header/*`.

## Editing conventions

- Angular services call relative URLs (`/api/nhl/score/2026-03-15`), never the NHL host directly (no CORS). They wrap
  `HttpClient` in Promises (`new Promise` + `subscribe`), log with `console.error`, and reject on error.
- Use the new models; read localized names via `.default`. Don't adapt new data into the old models.
- Team logos, colors and full names come from the utils keyed by team ID (`NhlTeamUtils.getTeam(id)`,
  `NhlTeamLogoUtils.getTeamPrimaryLogo(id)`). Standings rows only have abbreviations: `NhlTeamUtils.getTeamIdByAbbrev`.
  Utah is ID 68.
- Game state/type checks: `NhlGameInfoUtils.isFutureGame/isLiveGame/isCompletedGame(gameState)`; period labels:
  `PeriodUtils`; playoff series text: `NhlGameInfoUtils.getSeriesStatusShort`.
- Components `.catch()` every service promise (the service already logs). Show an empty or fallback state instead of
  stale data (see `ScoreboardComponent.retrieveNhlGames`).
- `tsconfig.json` has `strict` and `strictTemplates` on, but `strictNullChecks` off. Guard with `?.` / `??` anyway,
  because API fields go missing (TBD series, future games).
- Style: 2-space indent, JSDoc on public methods and non-obvious helpers, getters for template-bound values.
- Line endings: the repo uses CRLF with `core.autocrlf=true`. Files rewritten with LF only trigger "LF will be replaced
  by CRLF" warnings; the diff stays clean. When scripting edits, preserve the file's existing line endings.
- Stage new files with `git add` right after creating them.

## Running the app

- Start the backend and frontend together from `HokMob.App/ClientApp` with `npm run dev`, then open
  `http://localhost:4200`. The backend runs on `https://localhost:7157`, and `/api` is proxied via `proxy.conf.js`.
  It sets `DOTNET_ROLL_FORWARD=Major`, so a newer .NET runtime works.
- In Claude Code, start it with the Browser pane's `preview_start` using the `hokmob` config in `.claude/launch.json`.
  Don't start dev servers from Bash. The first start takes ~20s; wait before navigating, or reload.
- `dotnet run` from `HokMob.App` is the HTTPS/SPA-proxy route (port 44424) and needs a trusted dev certificate; see
  `README.md` troubleshooting.
- Check the proxy alone: `https://localhost:7157/api/nhl/score/now`, or `fetch('/api/nhl/...')` from the page.

## Building and testing

- **CI:** `.github/workflows/pr-tests.yml` runs on every pull request: job "Client tests" (production `ng build`,
  which enforces the `angular.json` budgets, then `npm run test:ci`) and job "Backend build" (`dotnet build -c
  Release`). Both are meant to be required status checks for merging into `master`.
- **Type-check:** from `HokMob.App/ClientApp`, run `npx ng build --configuration development` (~10–20s). This catches
  template type errors that `tsc` alone misses. Run it after every change.
- **Unit tests:** from `HokMob.App/ClientApp`, run `npm run test:ci` (Karma + headless Chrome, single run, ~30s).
  `npm test` watches and opens Chrome. To run a subset, add `--include "src/app/home/**/*.spec.ts"` (repeatable) to
  `npx ng test --watch=false --browsers=ChromeHeadless`.
  - **Every migration phase adds or updates tests** for the services, utils and components it touches. The plan's
    section 7 lists what each phase needs. Cover the happy path, empty data, HTTP errors and important edge cases.
  - **Use real API data.** `src/app/shared/testing/nhl-api-mocks/` holds real api-web.nhle.com responses (JSON, only
    item counts trimmed). `nhl-api-mocks.ts` returns fresh copies (`mockScoreResponse()`, `mockPlayoffGame()`,
    `mockStandingsTeams()`, `mockRankedCarouselSeries('A')`, ...). For a new endpoint, curl a real response into that
    folder and add an accessor; don't hand-write response objects. `derived*` helpers (live game, TBD game, series in
    progress) edit real data for states that can't be captured yet.
  - Assert values that appear in the fixture (team names, scores, ranks), not values copied from the component.
  - **Services:** `TestBed` with `HttpClientTestingModule`; use `HttpTestingController.expectOne(url).flush(...)`,
    call `httpMock.verify()` in `afterEach`, and check rejections with `expectAsync(promise).toBeRejected()`, created
    before flushing the error.
  - **Components:** import `AppTestingModule` (`src/app/shared/testing/app-testing.module.ts`), set
    `schemas: [CUSTOM_ELEMENTS_SCHEMA]`, and declare only the component under test. The module mirrors `AppModule`
    and stubs `MatDialogRef`/`MAT_DIALOG_DATA`; override them with `TestBed.overrideProvider` before the first
    `TestBed.inject`. Set inputs with `fixture.componentRef.setInput(...)` before `fixture.detectChanges()`, so
    `ngOnChanges` runs. Child components aren't declared, but their bound inputs can be read as element properties.
  - After flushing a response, wait with `await new Promise(resolve => setTimeout(resolve))`, then call
    `fixture.detectChanges()`. Use `fakeAsync` + `tick` only for timers like the scoreboard's 10s refresh, and
    destroy the fixture before the test ends.
  - **Components must `.catch()` service promises.** An unhandled rejection is thrown in `afterAll` and makes Karma
    report "Disconnected, because no message in 30000 ms". If a run stops like that, look for "Uncaught (in promise)"
    in the output.
  - Specs for unmigrated components are still CLI "should create" placeholders; some skip rendering (with a comment).
    Replace them with real tests when the component migrates.
  - `tsconfig.spec.json` must not include `"node"` in `types` (it clashes with the DOM lib and changes `setInterval`'s
    return type), and needs `resolveJsonModule` for the fixtures. `src/test.ts` only sets up the test environment;
    the Angular 15 Karma builder finds the spec files.
  - Gotcha: a default parameter replaces `undefined`, so pass `null` to test a missing input through a helper.
- **Browser verification** (Claude Code Browser pane):
  - Use `read_network_requests` with `urlPattern: "/api/nhl"` to confirm calls return 200.
  - Use `javascript_tool` to read rendered text. Screenshots are small at the default pane size.
  - Some layouts hide or move panels at narrow widths (e.g. the home playoff summary). `resize_window` to about
    1400×1000, then reset to `desktop` when done.
  - The console log persists across navigations, so old errors look new. To check for new errors, wrap `console.error`
    in the page right after navigating, then perform the action and read the captured list.
- **Date-gated UI:** the home playoff summary only shows when `DateTimeUtils.isPlayoffMode()` is true (May 21 to
  September). To test it off-season, temporarily add `return true;` at the top of that method, then revert with
  `git checkout -- <file>`. Never commit the override.
- **Sample data:** the API is public. `curl -sSL -o <scratch>/x.json https://api-web.nhle.com/v1/<path>` and inspect
  with `node -e`. Useful test inputs are listed in the plan's phases table. No live games until the preseason starts
  on 2026-09-29; the 2025-26 playoffs are all finished.

## Git

- `master` is the main branch; migration work happens on `api-refactor`.
- Commit messages: a summary line (e.g. "Migrate playoff summary to new NHL API (phase 3)"), then bullet lists grouped
  by phase or area.

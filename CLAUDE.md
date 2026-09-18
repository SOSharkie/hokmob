# HokMob

Hockey stats site (like Fotmob, for the NHL). `HokMob.App/` is an ASP.NET Core (.NET 7) backend that serves the Angular
app and proxies the NHL API. `HokMob.App/ClientApp/` is the Angular 15 frontend (Angular Material, dayjs, chart.js).

## NHL APIs

The site runs on three public sources ([reference](https://github.com/Zmalski/NHL-API-Reference/blob/main/README.md)):
`api-web.nhle.com/v1` for live, game, team, schedule, standings, playoff and draft data; the stats API
`api.nhle.com/stats/rest/en` for per-season and per-game player stats, team stats, hits and shots leaders and season
dates; and `search.d3.nhle.com` for the player search. All three go through the backend, which builds every stats API
query (the stats API sends no CORS header).

**Read [`docs/nhl-api.md`](docs/nhl-api.md) before working on a page.** It covers which API serves what, what each
page loads, the response conventions, the stats API query syntax and fields, the caching rules, and the open live
game checks. Update it when a page's data changes or an open item closes. The draft page has its own doc,
[`docs/draft-page.md`](docs/draft-page.md).

The old hosts (`statsapi.web.nhl.com`, `cms.nhl.bamgrid.com`, `suggest.svc.nhl.com`) are dead and no longer resolve.
A request to one of them is a regression.

## Layout

- `HokMob.App/Controllers/NhlController.cs`: proxies `/api/nhl/<path>` → `https://api-web.nhle.com/v1/<path>`. Only
  first path segments in `AllowedRoots` are proxied, so add new roots there. Empty segments are dropped, so a
  trailing `/` is fine.
- `HokMob.App/Services/NhlApiClient.cs`: HTTP client with in-memory caching per path root (10s for live data; the
  durations are in `docs/nhl-api.md`). `NhlSeasonService` gives it the current season, for caching settled score days.
- `HokMob.App/Controllers/NhlSearchController.cs`: `/api/nhl-search/player?q=…` → `search.d3.nhle.com` player search
  (`NhlSearchApiClient`, cached 5 minutes). Only allowlisted query parameters are forwarded.
- `HokMob.App/Controllers/NhlStatsController.cs`: `/api/nhl-stats/player/{id}`, `/leaders`, `/teams`, `/seasons` and
  `/draft?year=&round=` (career stats of a draft round, keyed by overall pick), built from the stats API
  (`NhlStatsApiClient`, cached 5 minutes). The controller builds every upstream query and merges the reports a page
  needs into one response.
- `ClientApp/src/app/shared/`:
  - `models/nhl-web-api/`: typed models for api-web and the player search. `models/nhl-stats-api/`: the
    `/api/nhl-stats/*` responses.
  - `services/`: Angular services.
  - `utils/`: static helpers: `PeriodUtils`, `NhlGameInfoUtils`, `NhlTeamUtils`, `NhlTeamLogoUtils`,
    `NhlTeamColorUtils`, `NhlPlayerHeadshotUtils`, `NhlVideoUtils`, `DateTimeUtils`, `StatsUtils`, `PlayByPlayUtils`,
    `PickerMenuUtils` (with the `.pill-picker` styles in `styles.scss`, for the draft and playoffs pickers).
  - `enums/`: API enums (`NhlGameStateEnum`, `NhlGameTypeEnum`, ...).
  - `components/`: shared components (scorecard, standings, ...).
- Feature folders under `ClientApp/src/app/`: `home`, `game`, `playoffs`, `league-standings`, `team`, `player`, `stats`,
  `draft` (`docs/draft-page.md`), `header`, `footer`, `about`.
- Path aliases: `@shared/*`, `@app/*`, `@home/*`, `@header/*`.

## Editing conventions

- Angular services call relative URLs (`/api/nhl/score/2026-03-15`), never the NHL host directly (no CORS). They wrap
  `HttpClient` in Promises (`new Promise` + `subscribe`), log with `console.error`, and reject on error.
- Read localized names via `.default` (most api-web names are `{ "default": "Jets", ... }` objects).
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
- **Always stop your dev server when the work is done** (`preview_stop` with its `serverId`), as the last step. A
  server left running holds port 4200 and blocks other sessions from starting their own.
- `dotnet run` from `HokMob.App` is the HTTPS/SPA-proxy route (port 44424) and needs a trusted dev certificate; see
  `README.md` troubleshooting.
- Check the proxy alone: `https://localhost:7157/api/nhl/score/now`, or `fetch('/api/nhl/...')` from the page.

## Building and testing

- **CI:** `.github/workflows/pr-tests.yml` runs on every pull request: job "Client tests" (production `ng build`,
  which enforces the `angular.json` budgets, then `npm run test:ci`) and job "Backend build" (`dotnet build -c
  Release`). Both have to pass before merging into `master`.
- **Type-check:** from `HokMob.App/ClientApp`, run `npx ng build --configuration development` (~10–20s). This catches
  template type errors that `tsc` alone misses. Run it after every change.
- **Unit tests:** from `HokMob.App/ClientApp`, run `npm run test:ci` (Karma + headless Chrome, single run, ~30s).
  `npm test` watches and opens Chrome. To run a subset, add `--include "src/app/home/**/*.spec.ts"` (repeatable) to
  `npx ng test --watch=false --browsers=ChromeHeadless`.
  - **Add or update tests for every service, util and component you touch:** the happy path, empty data, HTTP
    errors and the important edge cases.
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
  - The only CLI "should create" placeholder specs left are `about`, `footer`, `navigation-menu` and `app`, which
    call no API. Give a component a real spec when you change it.
  - `tsconfig.spec.json` must not include `"node"` in `types` (it clashes with the DOM lib and changes `setInterval`'s
    return type), and needs `resolveJsonModule` for the fixtures. `src/test.ts` only sets up the test environment;
    the Angular 15 Karma builder finds the spec files.
  - **Local times and days:** CI runs on UTC, a dev machine doesn't, so never hard-code a string formatted from
    a `startTimeUTC`. Derive the expected value from the same instant (`toLocaleTimeString('en-US', …)`), as
    `team-next-game.component.spec.ts` does. A date-only string like `"2026-06-14"` parses as local midnight,
    so those are safe.
  - Gotcha: a default parameter replaces `undefined`, so pass `null` to test a missing input through a helper.
- **Browser verification** (Claude Code Browser pane):
  - Use `read_network_requests` with `urlPattern: "/api/nhl"` to confirm calls return 200.
  - Use `javascript_tool` to read rendered text. Screenshots are small at the default pane size.
  - Some layouts hide or move panels at narrow widths (e.g. the home playoff summary). `resize_window` to about
    1400×1000, then reset to `desktop` when done.
  - The console log persists across navigations, so old errors look new. To check for new errors, wrap `console.error`
    in the page right after navigating, then perform the action and read the captured list.
- **Season-gated UI:** the current season and playoff mode come from `NhlStatsApiService.getCurrentSeason()` (the
  rules are in `docs/nhl-api.md`). In playoff mode, home shows the playoff summary and `/stats` shows the playoffs
  first. To test that outside the playoffs, temporarily return `isPlayoffMode: true` from `getCurrentSeason`, then
  revert with `git checkout -- <file>`. Never commit the override. In specs, spy on `getCurrentSeason` instead of
  the date.
- **Sample data:** both APIs are public. Stats API example: `curl -sSL -o <scratch>/x.json
  "https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&cayenneExp=playerId=8477496%20and%20gameTypeId=2"`
  (URL-encode spaces as `%20`). For api-web: `curl -sSL -o <scratch>/x.json https://api-web.nhle.com/v1/<path>` and
  inspect with `node -e`. The 2026-27 preseason starts 2026-09-19 and the regular season 2026-09-29; the 2025-26
  playoffs are all finished. During a live game, `npm run capture-live-fixtures -- --watch` (from
  `HokMob.App/ClientApp`) saves live responses for the open checks in `docs/nhl-api.md`.

## Git

- `master` is the main branch. Work on a feature branch and open a pull request; both CI jobs have to pass.
- Commit messages: a summary line (e.g. "Size the goal dialog to its video"), then bullet lists grouped by area.

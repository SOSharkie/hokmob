# HokMob

Hockey stats site (like Fotmob, for the NHL). `HokMob.App/` is an ASP.NET Core (.NET 7) backend that serves the Angular
app and proxies the NHL API. `HokMob.App/ClientApp/` is the Angular 15 frontend (Angular Material, dayjs, chart.js).

## NHL API migration (done)

The old NHL APIs (`statsapi.web.nhl.com`, `cms.nhl.bamgrid.com`, `suggest.svc.nhl.com`) are dead, and nothing calls
them anymore. The home and game pages moved in phases 0–8 (`docs/nhl-api-migration-plan.md`); the team, player, stats
and playoffs pages and the header search moved in phases 9–14, and phase 15 deleted the old code
(`docs/nhl-api-legacy-migration-plan.md`). **Read both plans before working on a page**: they have field mappings,
decisions, known risks, and the open live game checks and follow-ups (first plan section 10, second plan section 15).
Update them when you change a page or finish an open item.

- **APIs** ([reference](https://github.com/Zmalski/NHL-API-Reference/blob/main/README.md)):
  - `api-web.nhle.com/v1` for everything live, game, team, schedule, standings and playoff data.
  - The stats API `api.nhle.com/stats/rest/en` for per-season and per-game player stats, and for hits and shots
    leaders.

  The second plan's section 3 says which one to use for what, and section 2.2 has the verified stats API query
  syntax (`cayenneExp`, `isAggregate`, `isGame`, `sort`) and fields. The stats API sends no CORS header, so it's
  only called from the backend, which builds the queries.

- Every page and the header search use the new APIs. A request to an old host is a regression.
- Out-of-scope code that breaks because a shared component changed gets the smallest compile fix plus a `// TODO:`
  comment pointing at the plan (like `// TODO: ... (see docs/nhl-api-migration-plan.md, 5.2)`).

## Layout

- `HokMob.App/Controllers/NhlController.cs`: proxies `/api/nhl/<path>` → `https://api-web.nhle.com/v1/<path>`. Only
  first path segments in `AllowedRoots` are proxied, so add new roots there. Empty segments are dropped, so a
  trailing `/` is fine.
- `HokMob.App/Services/NhlApiClient.cs`: HTTP client with in-memory caching per path root (10s for live data).
- `HokMob.App/Controllers/NhlSearchController.cs`: `/api/nhl-search/player?q=…` → `search.d3.nhle.com` player search
  (`NhlSearchApiClient`, cached 5 minutes). Only allowlisted query parameters are forwarded.
- `HokMob.App/Controllers/NhlStatsController.cs`: `/api/nhl-stats/player/{id}`, `/leaders`, `/teams`, `/seasons` and
  `/draft?year=&round=` (career stats of a draft round, keyed by overall pick; see `docs/draft-page-plan.md`),
  built from the stats API (`NhlStatsApiClient`, cached 5 minutes). The controller builds every upstream query and merges the
  reports a page needs into one response.
- `ClientApp/src/app/shared/`:
  - `models/nhl-web-api/`: typed models for api-web and the player search. `models/nhl-stats-api/`: the
    `/api/nhl-stats/*` responses.
  - `services/`: Angular services.
  - `utils/`: static helpers: `PeriodUtils`, `NhlGameInfoUtils`, `NhlTeamUtils`, `NhlTeamLogoUtils`,
    `NhlTeamColorUtils`, `NhlPlayerHeadshotUtils`, `NhlVideoUtils`, `DateTimeUtils`, `StatsUtils`, `PlayByPlayUtils`.
  - `enums/`: new API enums (`NhlGameStateEnum`, `NhlGameTypeEnum`, ...).
  - `components/`: shared components (scorecard, standings, ...).
- Feature folders under `ClientApp/src/app/`: `home`, `game`, `playoffs`, `league-standings`, `team`, `player`, `stats`,
  `draft` (`docs/draft-page-plan.md`), `header`, `footer`, `about`.
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
- **Always stop your dev server when the work is done** (`preview_stop` with its `serverId`), as the last step. A
  server left running holds port 4200 and blocks other sessions from starting their own.
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
- **Season-gated UI:** the current season and playoff mode come from `NhlStatsApiService.getCurrentSeason()`, worked
  out from `/api/nhl-stats/seasons` by `DateTimeUtils.getCurrentNhlSeason` / `isPlayoffMode`. A season starts 14
  days before its first (preseason) game; playoff mode runs from 2 days before its first playoff game until the next
  season starts. In playoff mode, home shows the playoff summary and `/stats` shows the playoffs first. To test it
  outside the playoffs, temporarily return `isPlayoffMode: true` from `getCurrentSeason`, then revert with
  `git checkout -- <file>`. Never commit the override. In specs, spy on `getCurrentSeason` instead of the date.
- **Sample data:** both APIs are public. Stats API example: `curl -sSL -o <scratch>/x.json
  "https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&cayenneExp=playerId=8477496%20and%20gameTypeId=2"`
  (URL-encode spaces as `%20`). For api-web: `curl -sSL -o <scratch>/x.json https://api-web.nhle.com/v1/<path>` and inspect
  with `node -e`. Useful test inputs are listed in the plan's phases table. No live games until the preseason starts
  on 2026-09-19 (the regular season starts 2026-09-29); the 2025-26 playoffs are all finished. During a live game,
  `npm run capture-live-fixtures -- --watch` (from `HokMob.App/ClientApp`) saves live responses for the first plan's
  section 10 checks.

## Git

- `master` is the main branch; migration work happens on `api-refactor`.
- Commit messages: a summary line (e.g. "Migrate playoff summary to new NHL API (phase 3)"), then bullet lists grouped
  by phase or area.

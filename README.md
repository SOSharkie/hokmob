# HokMob

Website: [hokmob.azurewebsites.net](https://hokmob.azurewebsites.net/)

A hockey stats website for the NHL, based on the soccer stats site [Fotmob](https://www.fotmob.com/). It shows
scores, standings, game details, team and player pages, leaderboards, the playoff bracket and the draft, all from
publicly available NHL API data.

The app has two parts:
- **`HokMob.App/`** – ASP.NET Core (.NET 7) backend. It serves the built Angular app and proxies the NHL APIs.
- **`HokMob.App/ClientApp/`** – Angular 15 frontend.

## Prerequisites

- [.NET 7 SDK](https://dotnet.microsoft.com/download/dotnet/7.0) (or a newer SDK, see note below)
- [Node.js](https://nodejs.org/) and npm
- A trusted ASP.NET Core dev certificate: `dotnet dev-certs https --trust`

> **Only have .NET 8+ installed?** The project targets `net7.0`. To run it on a newer runtime,
> set `DOTNET_ROLL_FORWARD=Major` before running (PowerShell: `$env:DOTNET_ROLL_FORWARD="Major"`,
> bash: `export DOTNET_ROLL_FORWARD=Major`).

## NHL API proxy

The NHL APIs don't all send CORS headers, so the browser can't call them directly. The Angular app calls the
backend, which forwards the request:

```
GET /api/nhl/score/now  ->  https://api-web.nhle.com/v1/score/now
```

| Route | Upstream | Controller / client |
|---|---|---|
| `/api/nhl/<path>` | `api-web.nhle.com/v1` | `NhlController.cs`, `NhlApiClient.cs` |
| `/api/nhl-stats/*` | `api.nhle.com/stats/rest/en` | `NhlStatsController.cs`, `NhlStatsApiClient.cs` |
| `/api/nhl-search/player` | `search.d3.nhle.com` | `NhlSearchController.cs`, `NhlSearchApiClient.cs` |

- Only allow-listed top-level paths are proxied (`score`, `schedule`, `standings`, `gamecenter`, `player`, ...).
  To use a new api-web endpoint, add its first path segment to `AllowedRoots` in `NhlController.cs`.
- Responses are cached in memory, from 10 seconds for live data to hours for data that rarely changes.
- In Angular services, always use relative URLs like `/api/nhl/score/now` rather than an NHL host.

[`docs/nhl-api.md`](docs/nhl-api.md) describes which API serves what, what each page loads, the response
conventions, the stats API query syntax and the cache durations.

## Development server

The simplest way to run both parts, from `HokMob.App/ClientApp`:

```
npm run dev
```

It starts the backend on `https://localhost:7157` and an Angular dev server on plain HTTP; open
`http://localhost:4200`. Output is prefixed with `[api]` and `[web]`, and Ctrl+C stops both. Use this when a browser
doesn't trust the dev certificate. It also works without .NET 7 installed.

The HTTPS route runs both from the backend project instead:

```
cd HokMob.App
dotnet run
```

Then open `https://localhost:7157`. The first run installs npm packages and starts the Angular dev server
(`https://localhost:44424`) automatically. Either way the Angular app reloads when you change source files, and
`/api` requests are forwarded to the backend via `ClientApp/proxy.conf.js`.

You can also run the Angular dev server on its own (`cd HokMob.App/ClientApp`, then `npm start`), but
`/api/nhl/...` calls only work while the backend is also running. To test the backend on its own, open
`https://localhost:7157/api/nhl/score/now`.

### Troubleshooting: "Unable to configure HTTPS endpoint"

The ASP.NET Core dev certificate is missing or expired (they last one year). Check with
`dotnet dev-certs https --check --verbose`, then regenerate it:

```
dotnet dev-certs https --clean
dotnet dev-certs https --trust
```

If the Angular dev server then shows certificate errors, delete `%APPDATA%\ASP.NET\https\hokmob.pem` and
`hokmob.key` (bash/macOS: `~/.aspnet/https/`). `npm start` re-exports them from the new certificate.

## Tests

From `HokMob.App/ClientApp`:

```
npm run test:ci
```

That runs the [Karma](https://karma-runner.github.io) suite once in headless Chrome. `npm test` watches instead and
opens a browser. The `PR tests` workflow runs the production Angular build, the unit tests and `dotnet build -c
Release` on every pull request; all of it has to pass before merging into `master`.

## Build

Run `dotnet publish -c Release` from `HokMob.App` to build the backend and a production Angular bundle (output in
`bin/Release/net7.0/publish`). Pushing to `master` runs the same publish and deploys it to Azure. To build only the
Angular app, run `ng build` from `HokMob.App/ClientApp`; the artifacts land in `dist/`.

New Angular code is scaffolded from `HokMob.App/ClientApp` with `ng generate component <name>` (or `directive`,
`pipe`, `service`, ...).

## Documentation

- [`CLAUDE.md`](CLAUDE.md) – repo layout, editing conventions, how to run, build and test.
- [`docs/nhl-api.md`](docs/nhl-api.md) – the NHL APIs: which one serves what, response conventions, caching, open
  questions.
- [`docs/draft-page.md`](docs/draft-page.md) – the draft page's data and behaviour.

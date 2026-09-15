# HokMob

Website: [hokmob.azurewebsites.net/]()

This is a hockey stats website based on the the soccer stats website
[Fotmob](https://www.fotmob.com/). It uses publicly available NHL game API data to display scores, 
stats, and more.

The app has two parts:
- **`HokMob.App/`** – ASP.NET Core (.NET 7) backend. It serves the built Angular app and proxies NHL API requests.
- **`HokMob.App/ClientApp/`** – Angular 15 frontend.

## Prerequisites

- [.NET 7 SDK](https://dotnet.microsoft.com/download/dotnet/7.0) (or a newer SDK, see note below)
- [Node.js](https://nodejs.org/) and npm
- A trusted ASP.NET Core dev certificate: `dotnet dev-certs https --trust`

> **Only have .NET 8+ installed?** The project targets `net7.0`. To run it on a newer runtime,
> set `DOTNET_ROLL_FORWARD=Major` before running (PowerShell: `$env:DOTNET_ROLL_FORWARD="Major"`,
> bash: `export DOTNET_ROLL_FORWARD=Major`).

## NHL API proxy

The NHL web API (`https://api-web.nhle.com/v1/`) doesn't send CORS headers, so the browser can't call it
directly. Instead, the Angular app calls the backend at `/api/nhl/...`, and the backend forwards the request:

```
GET /api/nhl/score/now  ->  https://api-web.nhle.com/v1/score/now
```

- Controller: `HokMob.App/Controllers/NhlController.cs`
- HTTP client + in-memory caching: `HokMob.App/Services/NhlApiClient.cs`
- Only allow-listed top-level paths are proxied (`score`, `schedule`, `standings`, `gamecenter`, `player`, ...).
  To use a new NHL endpoint, add its first path segment to `AllowedRoots` in `NhlController.cs`.
- Responses are cached briefly (10s for live data, up to 30 minutes for player/stat data).

In Angular services, always use relative URLs like `/api/nhl/score/now` rather than the NHL URL.

## Development server

Run the backend and frontend together from the `HokMob.App` directory:

```
cd HokMob.App
dotnet run
```

Then open `https://localhost:7157`. The first run installs npm packages and starts the Angular dev server
(`https://localhost:44424`) automatically. The Angular app reloads when you change source files, and
`/api` requests are forwarded to the backend via `ClientApp/proxy.conf.js`.

You can also run the Angular dev server on its own (`cd HokMob.App/ClientApp`, then `npm start`), but
`/api/nhl/...` calls only work while the backend is also running.

### One command over HTTP

From `HokMob.App/ClientApp`, `npm run dev` starts the backend (`https://localhost:7157`) and an Angular dev server
on plain HTTP together. Open `http://localhost:4200`. Use this when a browser doesn't trust the dev certificate,
such as the Claude Code in-app browser, which uses the `hokmob` config in `.claude/launch.json`. Output is prefixed
with `[api]` and `[web]`, and Ctrl+C stops both. The backend runs on a newer .NET runtime if .NET 7 isn't installed.

```
cd HokMob.App/ClientApp
npm run dev
```

To test the backend on its own, open `https://localhost:7157/api/nhl/score/now` in the browser.

### Troubleshooting: "Unable to configure HTTPS endpoint"

The ASP.NET Core dev certificate is missing or expired (they last one year). Check with
`dotnet dev-certs https --check --verbose`, then regenerate it:

```
dotnet dev-certs https --clean
dotnet dev-certs https --trust
```

If the Angular dev server then shows certificate errors, delete `%APPDATA%\ASP.NET\https\hokmob.pem` and
`hokmob.key` (bash/macOS: `~/.aspnet/https/`). `npm start` re-exports them from the new certificate.

## Code scaffolding

From `HokMob.App/ClientApp`, run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `dotnet publish -c Release` from `HokMob.App` to build the backend and a production Angular bundle
(output in `bin/Release/net7.0/publish`). This is what the GitHub Actions workflow deploys to Azure.

To build only the Angular app, run `ng build` from `HokMob.App/ClientApp`. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` from `HokMob.App/ClientApp` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).

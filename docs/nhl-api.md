# NHL APIs

Everything on the site comes from two public NHL APIs plus the player search host, and a live or finished game's
expected goals and Corsi from Natural Stat Trick. All of them are called through the backend, so Angular only ever uses relative
`/api/...` URLs.

| API | Host | Proxy | Used for |
|---|---|---|---|
| api-web | `api-web.nhle.com/v1` | `/api/nhl/<path>` | live, game, team, schedule, standings, playoff, draft and leader data, and NHL EDGE's tracking stats (see [NHL EDGE](#nhl-edge)) |
| Stats API | `api.nhle.com/stats/rest/en` | `/api/nhl-stats/*` | per-season and per-game player stats, every player's season (for percentiles), team season stats, hits and shots leaders, season dates, draft career stats |
| Player search | `search.d3.nhle.com` | `/api/nhl-search/player` | header search |
| Natural Stat Trick | `data.naturalstattrick.com` | `/api/nst/game/{gameId}`, `/api/nst/team-games?season=`, `/api/nst/players?season=` | a live or finished game's expected goals (xG) and Corsi, for teams and skaters, every team's xG in each game of a season, for the power rating, and every skater's season stats the NHL doesn't have, for the player page (see [Natural Stat Trick](#natural-stat-trick)) |

Reference: [Zmalski/NHL-API-Reference](https://github.com/Zmalski/NHL-API-Reference/blob/main/README.md). It documents
api-web well. For the stats API it lists endpoints and query parameters but not the report names, the `cayenneExp`
syntax or the response fields, so those are written down below (its WADL is at
`https://api.nhle.com/stats/rest/application.wadl?detail=true`). `search.d3.nhle.com` isn't in the reference at all.

## Which API for what

| Need | Source | Why |
|---|---|---|
| Player header, bio, headshot, draft, current team | api-web `player/{id}/landing` | The stats API's `players` report has only the name, position and current team, and returns at most 5 rows |
| Player traits (percentiles against his position) | Stats API, every player's season row (`/api/nhl-stats/league-players`), with NST's skaters (`/api/nst/players`) and the stored NHL EDGE season file (`assets/edge/`) | Every skater or goalie of a season in one response, with the realtime, assist split and 5v5 shot attempt fields; api-web has no league-wide player rows. NST adds ixG, hits taken and on-ice xGA, and the EDGE file every skater's top speed and bursts, so they're ranked against our own pool rather than with EDGE's percentiles (see [EDGE season data](#edge-season-data)) |
| Player season performance (ranked stats in groups) | Stats API's league rows, Natural Stat Trick's player season page, NHL EDGE | The ranks need every player of the season, which only the stats API and NST give in one response each; EDGE alone has skating and shot speed and zone time, with its own percentiles (see [Season performance](#season-performance)) |
| Player season cards, career table, recent games | Stats API | The landing's `seasonTotals` mixes every league, splits a traded season into one row per team and has no hits; the api-web game log has no hits, blocks, faceoffs or saves by strength, so no HokMob rating |
| Leaderboards: points, goals, assists, TOI, SV%, GAA, wins | api-web `skater-stats-leaders`, `goalie-stats-leaders` | Headshots, logos and the NHL's own qualification rules |
| Leaderboards: hits, shots | Stats API | api-web has no such categories (`categories=hits` returns 400) |
| A leaderboard's top 25 table: the related columns | Stats API, for the 25 leaders' IDs | The leaders only carry their own `value`; the order still comes from the leaderboard's source, so it matches the card |
| Team season stats (PP%, PK%, goals and shots per game) | Stats API `team/summary` | All 32 teams in one call, so league ranks come for free |
| Team power rating and advanced stats (Corsi, Fenwick, 5v5 percentages, PDO) | Stats API team reports, per game (`/api/nhl-stats/team-games`), with Natural Stat Trick's xG per game | Every team's game by game counts in one response, so the browser can rate the league on any day of the season; api-web has no shot attempts by strength |
| Standings, schedules, team form, next game, live games | api-web | The stats API has no schedules, and whether it has rows during a live game is unverified |
| Playoff bracket and series | api-web `playoff-bracket`, `playoff-series/*` | Not in the stats API |
| Season dates (current season, playoff mode) | Stats API `season` and `game` | Every season, not just the current one |
| Team IDs, names, logos, colors | `NhlTeamUtils` and the logo and color utils | The stats API's `team` report has no logos or colors, and its `triCode` isn't unique (`UTA` is both Utah Hockey Club 59 and Utah Mammoth 68) |
| Player search | `search.d3.nhle.com` | Active filter, current team and up to 20 results; the stats API's `players` has none of that |
| Expected goals (xG), Corsi | Natural Stat Trick | Neither NHL API has them per game, and neither has xG |
| Each team's xG per game (the power rating, and 5v5 xGF%) | Natural Stat Trick's team game logs | A whole season of every team's games in one page, so one fetch an hour covers the league |
| A skater's season ixG, high danger and rush attempts, rebounds created, hits taken | Natural Stat Trick's player season page | Every skater of a season in one page, keyed by NHL player ID; not NST's page for one player, which would cost a page per visitor |

## What each page loads

| Page | Requests |
|---|---|
| Home | `score/{YYYY-MM-DD}` (scoreboard, polled every 10s), `standings/now`, `playoff-series/carousel/{season}` plus `playoff-bracket/{year}` for seed ranks, `/api/nhl-stats/seasons` |
| Game | `gamecenter/{id}/landing`, `/play-by-play`, `/boxscore`, `/right-rail`; `score/{gameDate}` for a playoff game's `seriesStatus` (only `score` has it); `club-schedule-season/{abbrev}/{season}` for team form; `club-stats/{abbrev}/{season}/{gameType}` for a future game's season leaders (see [Season leaders](#season-leaders)); `/api/nhl-stats/team-games` and `/api/nst/team-games` for a future game's power rating card; `player/{id}/landing` for the player dialog; `/api/nst/game/{id}` for a live or finished game's xG and Corsi (the game stats card, the shot maps and the player dialog) |
| Team | `standings/now` (division, conference and season), `club-schedule-season/{abbrev}/now` (schedule and form), `score/{date}` for the next game, `/api/nhl-stats/teams`. The standings tab loads `standings/now` again for its type, the player stats tab `/api/nhl-stats/team-players?teamId=&season=&gameType=2` and the season's `assets/history/{season}-2.json` when it has one, and the team stats tab `/api/nhl-stats/team-games?season=&gameType=2` and `/api/nst/teams?season=` (see [Team page](#team-page) and [Team power rating](#team-power-rating)) |
| Player | `player/{id}/landing`, `/api/nhl-stats/player/{id}?position=skater` or `goalie` (a skater's recent games carry `totalFaceoffs`, `totalPrimaryAssists` / `totalSecondaryAssists`, `ppAssists` and `penaltiesDrawn` for the HokMob rating; a goalie's carry `goals` and `assists`, with no assist split), and the featured season's `assets/history/{season}-2.json` when it has one, for the regular season card's rating column (see [History data](#history-data)), and `/api/nhl-stats/league-players?season=&gameType=2&position=skater` or `goalie` for the featured season, for the traits and season performance cards (see [Player traits](#player-traits)), with `/api/nst/players?season=` (skaters only, for both cards), a skater's `assets/edge/{season}-2.json` (from 2021-22) for the traits card's Speed (see [EDGE season data](#edge-season-data)), and `edge/skater-detail/{id}/{season}/2` or `edge/goalie-detail/...` (from 2021-22) for the season performance card (see [Season performance](#season-performance)) |
| Stats | `standings/now` (for the season ID), `skater-stats-leaders/{season}/{gameType}`, `goalie-stats-leaders/{season}/{gameType}`, `/api/nhl-stats/leaders` (hits and shots), `/api/nhl-stats/seasons` |
| Stats category (`/stats/{category}`, a card's top 25) | `standings/now`, the card's leaders with `limit=25` and only its category, then `/api/nhl-stats/season-players?season=&gameType=&position=skater` or `goalie` `&ids=` (the 25 IDs) for the other columns, `/api/nhl-stats/seasons`. The categories and their columns are in `StatCategoryUtils` |
| Playoffs | `playoff-bracket/{year}`, `schedule/playoff-series/{season}/{letter}` for the series dialog, `/api/nhl-stats/seasons` |
| Standings | `standings/now` |
| Teams | `standings/now` (for the season ID), `/api/nhl-stats/teams?season=&gameType=2`, `/api/nhl-stats/team-games?season=&gameType=2` and `/api/nst/team-games?season=` (see [Teams page](#teams-page)) |
| Draft | `draft/picks/{year}/{round}` (or `draft/picks/now`), `/api/nhl-stats/draft?year=&round=` — see [`draft-page.md`](draft-page.md) |
| Header search | `/api/nhl-search/player?q=…`; teams come from `NhlTeamUtils`, with no request |
| History | `assets/history/{season}-{gameType}.json`, a static file generated from the stats API (see [History data](#history-data)), with no NHL API request |

### Loading skeletons

While a request is out, the team and player pages show each card it fills as a skeleton at the card's size, so nothing
jumps when the data comes in: `SkeletonCardComponent` (`shared/components/skeleton-card`), a card of gray blocks with
the real card's title when it's known. One component for every card: its `shape` (`game`, `bar`, `table`, `tiles` or
`block`, a chart's plot under its toggles) makes its rows look like the card's, and its `layout` (rows, row height,
columns, the title's height, a table header or toggles row, a headline like a rating and its rank, bottom padding)
gives it the card's size, with a `mobileLayout` for the fields that change at the card's own
breakpoint (`mobileBreakpoint`, 700px by default). A card takes a `loading` input and keeps its skeleton's layout next
to its own styles (like `SingleTeamFormComponent.skeletonLayout`). The pulsing block is the global `skeleton-block`
class (`styles/skeleton.scss`), which a page's own placeholders use too, like the player header's, sizing it themselves.

- **Team page:** the division label, the team stats card and the overview's conference standings until the standings
  and team stats load; the next game and the schedule until the schedule does; the form until it does (it can need
  the previous season's schedule too). The games tab's cards do the same. The team stats tab shows the season stats
  card's skeleton until the team stats load, and the power rating, advanced stats and chart skeletons until the
  season's games (and NST's expected goals) do, assuming expected goals, which add a row to each card. The chart's
  skeleton is in the tab, in the chart's place, since the chart draws on its canvas once.
- **Player page:** the header and every card until the landing loads, assuming the season card has its rating column
  like most; then the season, recent games and career cards until the stats load, with a career row per NHL regular
  season in the landing's `seasonTotals` and a recent game row per game played, up to 10, and the traits card until
  the league players, NST and a skater's EDGE season file have all answered, so the chart's axes don't change after
  it appears (with a line for the NST credit under a skater's chart). The season performance card waits for the league players, NST and EDGE together, so its
  rows don't come in one source at a time, at a center's size with NST and EDGE (16 rows in its taller column on a
  desktop, 32 on a phone) or a goalie's. A player who has never played an NHL game shows no stats skeletons.
- **Known drift:** a schedule row grows when a long team name wraps in a narrow column, a team stats row is 44 or 45px
  on a phone, a career row's height follows its crests (a traded season's two logos can wrap), and the player traits
  card is 20px taller for a player under the minimum games, with its small sample note, and the season performance
  card is shorter without NST, EDGE or faceoffs (a winger, a defenseman), none of which is known before the data. Each is the last card in its column, or a few pixels.

## api-web conventions

- **Localized names.** Most names are objects like `{ "default": "Jets", "fr": "…" }`. Read `.default`.
- **Team names differ per endpoint.** `score`: `homeTeam.name.default` is the common name only ("Jets").
  `landing` and `boxscore`: `placeName.default` plus `commonName.default`. `standings`: `teamName.default` is the
  full name, but rows have **no team ID**, only `teamAbbrev.default` (`NhlTeamUtils.getTeamIdByAbbrev`).
  `schedule/playoff-series`: series teams have `name` (common), game teams have `commonName` and `placeName`.
- **Game state.** `gameState` is `FUT`, `PRE`, `LIVE`, `CRIT`, `OVER`, `FINAL` or `OFF`; `gameScheduleState` is `OK`,
  `TBD`, `PPD`, `SUSP` or `CNCL`. `OVER` lasts a few minutes after the final horn, until the NHL marks the game
  `FINAL`; it counts as completed. Check with `NhlGameInfoUtils.isFutureGame` / `isLiveGame` / `isCompletedGame`,
  never a state directly, so a state like `OVER` can't fall through every check and leave a blank scorecard.
- **Game type** is a number (`NhlGameTypeEnum`): 1 preseason, 2 regular season, 3 playoffs.
- **Period and clock:** `periodDescriptor.number` and `.periodType` (`REG` / `OT` / `SO`), `clock.timeRemaining`,
  `clock.inIntermission`, and `gameOutcome.lastPeriodType` for a finished game's OT or SO label. `PeriodUtils` builds
  every label ("1st", "2OT", "End 1st", "2nd - 5:32", "SO").
- **Times.** `startTimeUTC` is the UTC start; `gameDate` is a date-only local string.
- **Headshots** come as URLs in the response (`rosterSpots`, `player/{id}/landing`, the leaders), or from
  `NhlPlayerHeadshotUtils`: `https://assets.nhle.com/mugs/nhl/{season}/{abbrev}/{id}.png`, or
  `.../mugs/nhl/latest/{id}.png` when only the player ID is known. A missing photo is a 200 with a generic
  silhouette, not an error.
- **Teams.** Team IDs are stable. Utah Mammoth `UTA` is ID 68; Arizona `ARI` (53) no longer exists. Country codes are
  3 letters, matching `assets/flags`.
- **Trailing slashes don't matter:** the proxy drops empty path segments.
- **Playoff series text** comes from `NhlGameInfoUtils.getSeriesStatusShort(seriesStatus)`: "CAR leads 3-1",
  "Tied 2-2", "CAR wins 4-2", or "(0-0)" before the series starts.
- **Playoff brackets** go back to at least 1943. Since 1979-80 a full bracket is 15 series: A–H in round 1, I–L in
  round 2, M and N in round 3, O in the final. Titles and seeds change by era, so the playoffs page takes its labels
  from the bracket and its picker starts at 2013-14. 2020 adds 8 qualifier series (S–Z, `playoffRound` 0), and 2021
  has no `conferenceAbbrev`. A future year returns `series: []`, and `playoff-series/carousel/{future season}`
  returns **HTTP 500** until the playoffs start.

## Stats API queries

The stats API sends no `Access-Control-Allow-Origin` header, so it can only be called from the backend, which builds
every query (`NhlStatsController` with `NhlStatsApiClient`) and merges the reports a page needs into one response.

- **Shape:** `{ data: [...], total }`; a bad query returns `{ message }`. Names are plain strings (no `.default`),
  percentages are 0–1, times are in seconds, and rows have no headshots or logos.
- **Parameters:** `cayenneExp` is the filter and is required for the skater and goalie reports (`and`, `=`, `>=`,
  `in (a,b)`, `likeIgnoreCase "mac%"`). `isAggregate=true` sums everything into one row; `isGame=true` gives one row
  per game. `sort` takes a JSON array like `[{"property":"gameDate","direction":"DESC"}]`. URL-encode the spaces in
  `cayenneExp` as `%20`.
- **At most 100 rows per request** (since 2026-11): `limit=-1`, or any limit over 100, returns the first 100 rows,
  while `total` still counts them all. Until then `limit=-1` returned every row. For more, page
  with `start=0,100,200,…` and `limit=100`, sorted by fields that are unique per row (a team's game rows by `gameId`
  then `teamId`); without a sort each request returns a different 100. `NhlStatsApiClient.GetAllReportRowsAsync`
  does this, 6 pages at a time, and reads the report again if `total` changes between pages; the data scripts use
  `ClientApp/stats-api-pages.js`, which does the same one page at a time, at most 4 a second (see the rate limit under
  [History data](#history-data)). `GetReportAsync` logs a
  warning when a `limit=-1` query gets fewer rows than `total`.
- **At most 10,000 rows per query**, even page by page: a query with more says its `total` is 10,000 and pages
  stop there, without an error. Split it (by team, or by dates). The backend and the scripts fail on a query that
  reaches it.
- **Per-season rows** (`isAggregate=false&isGame=false`): NHL seasons only, and a traded season is one combined row
  with `teamAbbrevs` like `"CGY,VAN"`. Rows have no `gameTypeId`, so query the regular season and the playoffs
  separately.
- **Per-game rows** (`isGame=true`): newest first when sorted by `gameDate` then `gameId`. They have no `gameTypeId`
  (read it from the game ID: `2025030414` → `03`) and no score — the `game` report returns the scores for a list of
  game IDs in one request. Checked field by field against a boxscore (game `2025030414`): every stat matches, saves
  by strength included, and both sources give the same HokMob rating.
- **No preseason rows at all** (see the open items).
- **Aggregate leaderboards:** any report sorted by one of its fields, e.g. `skater/realtime` by `hits` with
  `cayenneExp=seasonId=20252026 and gameTypeId=2`.
- **Some players' season rows:** `playerId in (...)` with the season and game type, e.g. a top 25's rows in one call
  per report (`/api/nhl-stats/season-players` takes at most 25 IDs). Rows come back in no particular order.
- **Every player's season rows:** the season and game type alone, read page by page sorted by `playerId` (one row
  per player per season), give the whole league: 789 skaters and 79 goalies in 2026-27 through 26 games, about 1,000
  skaters in a full season. `/api/nhl-stats/league-players` reads `skater/summary`, `skater/realtime`,
  `skater/scoringpergame`, `skater/summaryshooting`, `skater/timeonice`, `skater/penalties` and `skater/faceoffwins`
  (or `goalie/summary` and `goalie/savesByStrength`) this way, about 56 page requests for 2026-27's 789 skaters and
  70 for a full season, and merges them by `playerId` into columns (like `/team-games`), with `mostTeamGames` from
  `team/summary`. Cold, 2026-27 through 26 games took 3.4 seconds (1.6 with the first four reports) without a 429;
  the skater response is 134 KB (100 KB before the last three).
- **A team's season rows:** `teamId=<id>` with the season and game type gives one row per player who played for the
  team, counting only their games for it: Lukas Reichel's 2025-26 row for Boston has 10 games, though `teamAbbrevs`
  still lists every team of his season (`"CHI,VAN,BOS"`). `skater/realtime` and `goalie/summary` take the same filter.

| Report | Fields used |
|---|---|
| `skater/summary` | `skaterFullName`, `positionCode`, `teamAbbrevs` / `teamAbbrev`, `gamesPlayed`, `goals`, `assists`, `points`, `pointsPerGame`, `plusMinus`, `ppGoals`, `ppPoints`, `gameWinningGoals`, `shots`, `shootingPct` (`null` without shots), `penaltyMinutes`, `faceoffWinPct` (`null` without faceoffs), `timeOnIcePerGame` |
| `skater/realtime` | `hits`, `blockedShots`, `takeaways`, `giveaways`, `missedShots`, and a shooter's own `shotAttemptsBlocked` and `totalShotAttempts` (on goal, missed and blocked: McDavid's 2026-27 row has 68 + 35 + 28 = 131) |
| `skater/summaryshooting` | On-ice 5v5 shot attempts: `satFor`, `satAgainst` (Corsi), `usatFor`, `usatAgainst` (Fenwick), `timeOnIcePerGame5v5`; per season, a traded season is one row |
| `skater/faceoffwins` | `totalFaceoffWins`, `totalFaceoffLosses` (and by zone and strength); every skater has a row, 0 and 0 without faceoffs |
| `skater/timeonice` | `timeOnIce` (the season), `evTimeOnIcePerGame`, `ppTimeOnIcePerGame`, `shTimeOnIcePerGame` (also the season totals, `shifts`, `timeOnIcePerShift`) |
| `skater/scoringpergame` | `totalPrimaryAssists`, `totalSecondaryAssists` (the boxscore and `skater/summary` only have the total) |
| `skater/powerplay` | `ppAssists` (also `ppPrimaryAssists` / `ppSecondaryAssists`), `ppTimeOnIce` |
| `skater/penalties` | `penalties` (taken), `penaltiesDrawn`, also `netPenalties` (drawn minus taken) and their per 60s. It matches a count of the play-by-play's `drawnByPlayerId`: fighting majors and coincidental minors count, and penalties with no drawer (too many men, misconducts) count for nobody |
| `skater/bios`, `goalie/bios` | `playerId`, `draftYear`, `draftRound`, `draftOverall`; skater bios also have games, goals, assists and points |
| `goalie/summary` | `goalieFullName`, `teamAbbrevs` / `teamAbbrev`, `gamesPlayed`, `gamesStarted`, `wins`, `losses`, `otLosses`, `shutouts`, `shotsAgainst`, `saves`, `goalsAgainst`, `goalsAgainstAverage`, `savePct`, `timeOnIce`, and the goalie's own `goals`, `assists` and `points` |
| `goalie/savesByStrength` | `evSaves`, `ppSaves`, `shSaves`, `evShotsAgainst`, `ppShotsAgainst`, `shShotsAgainst`, `savePct`. The `pp` split is the shots a goalie faced on the penalty kill (the other team's power play: Shesterkin's 2026-27 row has 16 `pp` shots to 1 `sh`) |
| `team/summary` | `teamId`, `teamFullName`, `powerPlayPct`, `penaltyKillPct`, `goalsForPerGame`, `goalsAgainstPerGame`, `shotsForPerGame`, `shotsAgainstPerGame`, `faceoffWinPct`; per game (`isGame=true`) also `gameId`, `gameDate`, `homeRoad`, `wins`, `losses`, `otLosses`, `points`, `goalsFor`, `goalsAgainst`, and a game's shots as `shotsForPerGame` / `shotsAgainstPerGame` |
| `team/summaryshooting` | 5v5 shot attempts: `satFor`, `satAgainst` (Corsi), `usatFor`, `usatAgainst` (Fenwick), and `shots5v5` (shots on goal) |
| `team/powerplay`, `team/penaltykill` | `powerPlayGoalsFor`, `ppOpportunities`, `shGoalsAgainst`; `ppGoalsAgainst`, `timesShorthanded`, `shGoalsFor` |
| `team/goalsforbystrength`, `team/goalsagainstbystrength` | `goalsFor5On5`, `goalsAgainst5On5`. A team that scored no goals has **no `goalsforbystrength` row** for that game (113 games in 2025-26), or, since 2026-11, a row with a null `gameId` and null counts |
| `game` | `homeTeamId`, `visitingTeamId`, `homeScore`, `visitingScore`, `gameStateId`, `gameType`, `gameDate`, `easternStartTime` |
| `season` | `id`, `formattedSeasonId`, `preseasonStartdate`, `startDate`, `regularSeasonEndDate`, `endDate`, `numberOfGames` |

## Player search

`search.d3.nhle.com/api/v1/search/player?culture=en-us&limit={n}&q={query}&active=true` returns players only (the
`team` search returns nothing): `playerId`, `name`, `positionCode`, `teamId`, `teamAbbrev`, `lastTeamAbbrev`,
`lastSeasonId`, `sweaterNumber` and `active`. It allows CORS, but still goes through the backend so there's one
convention, popular queries are cached, and a CORS change can't break the site. `NhlSearchController` forwards only
allowlisted query parameters.

## Caching

`NhlApiClient` caches each api-web response in memory per path root, so many visitors share one upstream request:

| Root | Cached |
|---|---|
| `score`, `scoreboard`, `gamecenter` | 10s |
| `schedule`, `club-schedule`, `club-schedule-season`, `standings`, `playoff-series` | 5 min |
| `player`, `roster`, `club-stats`, `skater-stats-leaders`, `goalie-stats-leaders`, `edge` | 30 min |
| `draft` | 6 hours (picks only change during the draft) |
| anything else | 1 min |

`score/{date}` is special: a future day is kept for 30 minutes, and a past day of the current regular season is kept
with a 24-hour sliding expiration once it settles (1pm Eastern the day after it's played, which leaves time for stats
corrections, highlight clips and three stars). The client mirrors these rules for the home scoreboard's days
(`GameDayCacheUtils`, used by `NhlGameService`): a settled day is kept until the season changes, a future day for 30
minutes, and today, live games and unsettled days are always refetched.

`NhlStatsApiClient` and `NhlSearchApiClient` cache each upstream URL for 5 minutes. A stats endpoint that can't reach
upstream returns 502 rather than a partial answer.

`NaturalStatTrickClient` keeps a game NST marks final with a 24-hour sliding expiration, and anything else (a game
in progress, or no stats yet) for 3 minutes, or 10 once the key's standard tokens are below half. It keeps a season's
team game logs and its skaters for an hour, and a failed one for 5 minutes. See [Natural Stat Trick](#natural-stat-trick)
for why. `NaturalStatTrickService.getPlayers` keeps a season's skaters 5 minutes in the browser, like
`NhlStatsApiService.getLeaguePlayers`.

### Surviving an api-web outage

api-web sends the current day's `score/{date}` with `no-store`, so every request reaches the NHL origin. When that
origin struggles, the day takes 3-20 seconds or answers a 500 with an HTML page, while every other date still serves
from their edge. `NhlApiClient` keeps the scoreboard up through it (the reasoning is in its comments and `Program.cs`):

- **Last known good:** every successful response is also kept for 1 minute and served when a call times out, can't be
  reached or answers 5xx. A 4xx is passed through. Scores can lag by up to a minute.
- **One call per URL:** concurrent callers share one upstream request, which ignores any one caller's cancellation.
- **20s timeout** (10s for the stats and search clients): struggling responses regularly land between 10 and 20
  seconds. A sustained outage still reaches the browser as a 502 once the fallback copy expires, which is the
  intended bound; the client recovers on its next refresh.
- **Errors are JSON:** `NhlController` never passes an upstream error body through. Any status of 400 or more comes
  back as `{"status": <code>, "error": "The NHL API request failed."}`.

## Rating colors

Every rating is colored by its tier (`RatingColorUtils`): elite (blue), good (green), ordinary (orange) and poor (red).
The colors are the `--rating-elite`, `--rating-good`, `--rating-ordinary` and `--rating-poor` custom properties in
`styles.scss`, so stylesheets and style bindings share them: TS binds `var(--rating-…)` (`RatingColorUtils.getColor`),
and the history page's distribution chart, a canvas, reads their values (`RatingColorUtils.resolveTierColor`). Don't
write the hex values anywhere else.

A filled, colored box behind a number means a rating, so nothing else gets one. A stat leader's value on the stats
page and a goalie's save % and GAA on the player page are plain, bolder text, not a pill in the team's color: the
team's logo is already beside them, and many team colors are a tier's hue (a red team would read as a poor rating).

Each scale has its own cut points, set so a tier is about the same share of its ratings: elite the top 3 to 5%, good
the next 20% or so, ordinary the middle, and poor the bottom 20% or so. A green badge means "good" on a game, a season
and a team alike.

| Scale | Elite | Good | Ordinary | Poor | Shown on |
|---|---|---|---|---|---|
| `game` | 8+ | 6.5+ | 5+ | below 5 | game page, player page's recent games, ratings explorer, history page's best games and distribution |
| `seasonAverage` | 6.5+ | 6+ | 5.5+ | below 5.5 | player page, team page's players, history page's leaders, game page's season leaders |
| `team` | 7.5+ | 6+ | 3.5+ | below 3.5 | teams page, team page's and game page's power rating |

- **Game:** the median skater game of 2025-26 is about 5.8, so these color about 3% of skater games blue, 20% green,
  59% orange and 18% red. Goalie games spread wider: about 6%, 29%, 46% and 19%.
- **Season average:** an average spreads much less than a game (skaters with 20+ games average 4.9 to 7.1), so it has
  its own cut points. On the game's it was nearly always red. These color about 3% of 2025-26 skaters blue, 18% green,
  58% orange and 22% red.
- **Team:** from the rating's design (5 at the average, 1.5 points per standard deviation): about 5%, 20%, 59% and 16%.
- **Team stat ranks** (`TeamRatingUtils.getRankTier`) use the colors only at the ends of the league: blue for the best
  2, green for the rest of the best 8, red for the worst 6 and gray between (`rankTierSizes`).

The game page's top players card also rings a hovered player in the elite color if he's the game's star, and the good
color otherwise, whatever his rating.

## Team page

`/team/{id}` has five tabs, kept in the `tab` query parameter (`overview`, the default, is left out): `team-stats`,
`player-stats`, `games` and `standings`, in that order (`TeamTabs`). The standings tab's type is `standingsType`, as on the standings
page (`StandingsTypeUtils`), left out at its default, the divisions. Picking a tab rewrites the URL with
`Location.replaceState`, like the history page's filters, so it doesn't scroll to the top or add a history entry, and
the back button still leaves the page.

- **Overview:** the power rating card, the conference standings, the next game, the form and the schedule. The power
  rating card's toggle, in its header's top right corner, switches it to the team stats card and back
  (`TeamRatingCardComponent`). The page rates the league from `/api/nhl-stats/team-games` and NST's
  `/api/nst/team-games` (`TeamRatingService`, which keeps a season's games for 5 minutes, so the team stats tab and a
  future game reuse them). Without a rating (before the team's first game, or when the games fail) the card shows the
  team stats alone, without the toggle.
- **Standings:** the whole league's standings of the picked type, with the team's row highlighted.
- **Player stats:** a sortable table of skaters (GP, G, A, P, +/-, S, hits, FO%) and one of goalies (GS, W, L, OTL,
  SV%, GAA, SO, SA), from `/api/nhl-stats/team-players` (`skater/summary` merged with `skater/realtime`, and
  `goalie/summary`, filtered by team). The season is the standings' season, so it matches the overview between
  seasons; only the regular season for now. A season with a history file adds the average HokMob rating and a skater's
  Corsi For % or a goalie's goals saved above average, from the player's games for this team only
  (`PlayerSeasonRatingUtils.getTeamSeasonRatings`). The file is a snapshot, so a season in progress is rated through
  its `throughDate` (the column's tooltip says so), while the stats are current.
- **Team stats:** the power rating, the team stats and the advanced stats cards, three across on a desktop, in two
  columns on a tablet and stacked on a phone, and the power rating chart below them (see
  [Team power rating](#team-power-rating)). The tab loads `/api/nhl-stats/team-games` and NST's
  `/api/nst/team-games` at once and rates the league when both are back. The team stats card only needs
  `/api/nhl-stats/teams`, so it shows while the season's games load and when they fail. Until each card's data is in,
  it shows its skeleton (see [Loading skeletons](#loading-skeletons)).
  The team stats card (on the overview too) and the advanced stats card list their stats like the power rating card,
  in titled groups (results, special teams, shots and draws; goal margins, shot share, finishing and goaltending),
  each with its rank in a pill and a bar from the league average. The bars are scored like the rating's stats
  (`TeamRatingUtils.getScores`) on the team stats card, with goals and shots against scored lower is better, and from
  `TeamRating.scores` on the advanced stats card. The pill and bar are colored by the rank alone
  (`TeamRatingUtils.getRankTier`), in the [rating colors](#rating-colors): blue for the league's best 2, green for the
  rest of its best 8, red for its worst 6 and gray between, so only what stands out is colored. The cards' titles leave out the season, which the page already gives. The power rating card
  shows each stat's weight only while it's hovered. The advanced stats card leaves out Fenwick and PDO, which the
  teams page still shows. The cards' rows are 18px lines at every width, so their skeletons are the cards' height.
- **Games:** the next game and the schedule, and the form.

## Team power rating

The team stats tab rates every team from `/api/nhl-stats/team-games?season=&gameType=` (`NhlStatsController`): one
row per team and game, merged from the per game rows of `team/summary`, `team/summaryshooting`, `team/powerplay`,
`team/penaltykill`, `team/goalsforbystrength` and `team/goalsagainstbystrength`, with the opponent's 5v5 shots on
goal, sorted by date. It's sent as columns (`{ games: { gameId: [...], teamId: [...], ... } }`), 64 KB for 650 rows,
since a full season is about 2,600 rows; `NhlStatsApiService.getTeamGames` turns them into objects. A game missing
from one of the required reports is left out, but a missing goals by strength row counts as 0 goals (see the reports
table). All six reports are required, or it answers 502. A season is up to 2,624 rows per report, so each is read
in pages of 100 sorted by `gameId` then `teamId` (see the 100 row cap above): about 160 requests for a full season,
about 5 seconds when nothing is cached, then cached for 5 minutes.

Each game's expected goals come from Natural Stat Trick's `/api/nst/team-games?season=` (see
[Team game logs](#team-game-logs)): the team's 5v5 xG for and against. The team stats tab and the teams page ask for both at once, merge them by game and team
(`TeamRatingUtils.withExpectedGoals`) and rate the league once both are back, so the rating doesn't change under the
reader when the expected goals come in. NST failing isn't an error: the rating falls back to the NHL's stats (see
Fallback).

`TeamRatingUtils` (`shared/utils`) works out the totals, the advanced stats and the rating from those rows, for any
set of teams and days, so a league page can reuse it:

- **Stats:** the ones a rating can count: 5v5 Corsi %, 5v5 xGF% (NST), 5v5 shooting % and save %, net power play %
  (power play goals minus short-handed goals against, per power play) and the penalty differential per game (power
  plays drawn minus times short-handed). And the ones shown but not rated: points %, goal differential
  per game, special teams goal differential per game, 5v5 Fenwick %, shots for % (all situations), 5v5 goals for %
  and PDO (5v5 shooting % + save %, × 100). Each is ranked against the other teams over the same games.
- **Scores:** each stat is compared to the league: 5 plus 1.5 points per standard deviation from the teams' mean,
  from 0 to 10.
- **Rating:** the weighted sum of the rated stats' deviations, scaled back to one deviation the same way, so it's 0 to
  10 with one decimal like a HokMob player rating (San Jose was 2.9 through 2026-11-14, and 3.4 on the fallback), 5
  is an average team, and the spread doesn't depend on how early in the season it is. Colored on the team scale of the
  [rating colors](#rating-colors): blue from 7.5, green from 6, orange from 3.5 and red below, so an average team is
  orange.
- **Weights** (`expectedGoalsWeights`): 30% 5v5 Corsi %, 15% 5v5 xGF%, 15% 5v5 shooting %, 10% 5v5 save %, 20% net
  power play % and 10% penalty differential. The penalty kill isn't rated (see below). Nothing comes from the
  standings: the rating is a statistical look at how a team plays, so points %, wins and goal differential aren't in
  it (they were until 2026-11: 30% points %, 20% goal differential, 30% Corsi and 20% special teams).
- **Fallback** (`nhlWeights`): over games where a team has no expected goals, every team is rated on the NHL's stats
  alone, so the teams are always compared on the same stats: 45% Corsi (it takes xGF%'s share), 15% shooting %, 10%
  save %, 20% net power play % and 10% penalty differential. That happens when NST can't be
  asked (503, or no key), when it has no games for the season yet, and on the first day after a team's first game,
  until NST's hourly copy has it. A team whose latest game NST doesn't have yet still has expected goals from its
  earlier games, so one missing game doesn't change the weights. `TeamRating.hasExpectedGoals` and `weights` say
  which a rating used, and each point of the timeline decides for itself.
- **Timeline:** `getTimeline` rates the league on each of a team's game days, from its 3rd game, counting only the
  games played by then, so a point is where the team stood that night. With `lastGames: 10` each day counts only
  every team's last 10 games (the chart's Last 10).

### How the weights were picked

By backtesting the 2021-22 to 2025-26 seasons (the game has changed too much to weigh older ones the same; 2015-16
to 2020-21 were only a second check). Each team was rated after 10, 20, 30, 41, 55 and 70 games, and the rating
compared to the team's **forward strength**: how strong it proved over every game it played afterwards, the rest of
the regular season and the playoffs, with playoff games counted double, each result adjusted for the opponent and
home ice (a ridge Bradley-Terry fit), and a shootout counted as a tie. So a deep playoff run against good teams
counts, and loser points don't. The number below is the correlation between rating and forward strength, averaged
over the six checkpoints and the five seasons.

| Rating | Tracks forward strength | Tracks points % so far |
|---|---|---|
| Points % alone | 0.575 | 1.00 |
| Goal differential alone | 0.556 | 0.92 |
| 5v5 Corsi % alone | 0.553 | 0.45 |
| The rating until 2026-11 (30% points %, 20% goal differential, 30% Corsi, 20% special teams) | 0.645 | 0.90 |
| The fallback weights (NHL stats only) | 0.664 | 0.71 |
| The weights with NST's expected goals | 0.669 | 0.74 |

- **The differences are small.** Resampling team-seasons, the fallback weights beat the old rating by 0.017 (90%
  interval -0.015 to 0.050), the expected goals weights beat the fallback by 0.007 (-0.006 to 0.021), and the old
  rating by 0.024 (-0.004 to 0.055). What changed for sure is that the rating no longer mirrors the standings. Over
  2015-16 to 2020-21 the old rating tracked a little better (0.464 against 0.423 and 0.442), and adding 20% points %
  on top still adds about 0.009.
- **What each stat adds:** shot share is the backbone, and the only stat that tracks playoff strength at the end of a
  season. Shooting and save % are noise over 10 games (they repeat at 0.08 and 0.10 from one 10 game block to the
  next, against 0.58 for Corsi) but add up over a season. xG works as a blend with Corsi:
  replacing Corsi with it tracked worse (0.644).
- **The penalty kill isn't rated.** The power play matters, the penalty kill hardly does: 5% net penalty kill %
  tracked a little worse than none (0.665), and 5% of NST's expected goals against per 60 short-handed, which track
  better alone (0.31 against 0.18), only added 0.002 (0.670, 90% interval of the difference -0.004 to 0.008) for a
  second NST page an hour, and moved the ratings by 0.10 on average.
- **Tested and left out:** score adjusted Corsi and xG, Fenwick, scoring chances (as good as xG, within noise),
  high danger chances, goals saved and scored above expected, opponent and home ice adjustment, weighting recent
  games more, weights that grow with games played, faceoffs, hits, blocks, takeaways and giveaways.
- **Not done, by choice:** blending in last season's final rating early on tracks clearly better (see below), but it
  makes the rating about more than this season. Decided 2026-11-16: the rating stays about the current season only.

The backtest's NST data is kept locally, outside git (see [Team game logs](#team-game-logs)); the NHL's per game
team reports come from the stats API with `isGame=true`. The scripts are in `data/power-rating-backtest/` (local too),
with a README.

### What play-by-play and player data add

A second round (2026-11) looked for an edge in stats nobody publishes: about 85 of them, worked out from the stored
play-by-play, ice time logs, season totals and bios (see [Stored play-by-play](#stored-play-by-play)). Each was added to
the rating at ±10% and ±20% on 2023-24 to 2025-26, and the few that helped were then run on seasons they weren't picked
on. The number is the change in the rating's correlation with forward strength, with its 90% interval.

| Stat | Where picked | On seasons not picked on |
|---|---|---|
| Last season's final rating, fading as games are played (its share is 10 / (games + 10)) | 2021-26: +0.029 (0.008 to 0.046) | 2015-21: +0.058 (0.032 to 0.078) |
| The lineup's track record: last season's points per hour of the skaters, weighted by this season's ice time, at 20% | 2021-26: +0.023 (0.006 to 0.044) | 2015-21: +0.036 (0.004 to 0.062) |
| Slot shot share (5v5 unblocked attempts from between the faceoff dots, inside 35 feet of the goal line) in place of xGF% | 2023-26: +0.008 (-0.003 to 0.020) | 2022-23: +0.004 (-0.003 to 0.011) |
| Shooters' prior shooting %, weighted by this season's attempts, at 10% | 2023-26: +0.015 (-0.002 to 0.034) | 2022-23: -0.015 |
| Icings forced minus icings committed, at 5% | 2023-26: +0.007 (-0.005 to 0.015) | 2022-23: -0.002 |
| Prior save % of the goalies in net lately, for half of save % | 2023-26: +0.007 (-0.003 to 0.019) | 2021-23: -0.010 |

- **Nothing from this season's play-by-play adds a clear edge.** What it measures is what Corsi and xG already say, or
  noise. Tested and left out: shot distance, inner slot, tips, rebounds and rush shots; bursts of attempts; offensive
  zone faceoff share, icings, goalie freezes and where hits, giveaways and takeaways happen; time spent leading, the
  first goal, Corsi by period and by score; the share of games out-attempted or out-chanced; pace; restraining fouls
  against the rest, and penalties by zone; power play and penalty kill shot rates; the save % of the goalie with the
  most shots, or of the ones in net lately; scoring and shooting depth; how much ice time the top forwards and
  defensemen take; shift length; lineup changes and the core players dressed; age, height, weight, experience and
  draft position.
- **Slot shot share is the best single stat found**: alone it tracks forward strength at 0.621 over 2022-26, against
  0.569 for NST's xGF% and 0.558 for Corsi, and in xGF%'s place it did as well or a little better in all 4 seasons
  (+0.007, -0.001 to 0.017; +0.011 against the fallback weights). It's a way to rate without NST, not an addition: it would
  need every game's play-by-play, which api-web gives at one game a second.
- **The edge is in what was known before the season.** Last season's rating and the lineup's track record say much
  the same thing (they correlate 0.66 to 0.78) and both together add little more (+0.031 over 2021-26). The gain is
  early: after 10 games the rating tracks at 0.69 instead of 0.60, and from mid-season it's the same. With it the
  rating also beats the old one over 2015-21 (0.500 against 0.464). Last season's rating needs no new data: the
  previous season's team games and NST game logs. It's left out on purpose: the rating is about the current season
  only.

The power rating card shows the rating, its rank, its change over the last 5 games and, under "Built from", each
rated stat with its weight, its rank in a pill and a bar from the league average, colored like the team stats cards':
the stats and weights the rating was worked out with. It credits Natural
Stat Trick for the xG, or says the team is rated without expected goals on the fallback. The chart
(`TeamRatingChartComponent`, `shared/components`) plots up to 4 of its 9 lines (the rating and 8 stats: Corsi %,
xGF%, shooting %, save %, power play, penalties, points % and goal differential) on the rating's scale, all on one
axis, with each stat's value and rank in the tooltip. xGF% isn't offered when the games have no expected goals.
Given several teams, it plots one stat with a line per team, in the teams' colors, for a future league page.

## Teams page

`/teams` (`TeamsComponent`, the home page's Teams link) is every team's regular season in one sortable table, by
the power rating by default. The season is the standings' season, like the stats and team pages. It loads
`/api/nhl-stats/teams`, `/api/nhl-stats/team-games` and NST's `/api/nst/team-games` at once, and shows the table when
all three have answered or failed, so the rating doesn't change under the reader when the expected goals come in:

- **Columns:** the power rating, then five sections, each a header group: Record (GP, W, L, OTL, PTS, P%), Scoring
  (GF/GP, GA/GP, goal differential per game, SF/GP, SA/GP), Special Teams (PP%, PK%, special teams goal differential
  per game, FO%), Possession (5v5 CF% and FF%, xGF%, SF% in all situations) and 5v5 (GF%, SH%, SV%, PDO). The record,
  per game, PP%, PK% and FO% come from the stats API rows, the rest from `TeamRatingUtils`. Each header's tooltip says
  what it is. xGF% only shows when the games have NST's expected goals, credited under the table. Its sort ID is
  still `xg`.
- **Sections:** below 1200px (`$small-display-breakpoint`) the table shows one section at a time beside the team and
  its rating, picked from pills above it (the standings filters' style), and the group headers go. The CSS hides the
  other sections' columns (`.out-of-section`), so 1200px and up shows every column whatever is picked. Picking a
  section that hides the sorted column sorts by the rating again, and sorting by a column picks its section. On a phone
  the headers are tighter, with the sort arrow after the label, and a section still scrolls a little (Scoring, the
  widest, about 130px at 375px).
- **Failures:** without NST's expected goals, the rating is the fallback from the NHL's stats (see
  [Team power rating](#team-power-rating)) and the xGF% column and the credit go, with no note. Without the games,
  the rating and advanced columns show dashes and a note says so, and the default
  sort falls back to points % (ties go to the rating, then points %, then the name). Without the stats API rows (a
  season's first days, before it has any), the record and per game columns come from the games' totals, and PP%,
  PK% and FO% show dashes. Without both, it shows an error.
- **Sort:** clicking a header sorts by it, best first (goals and shots against, losses and OTL lowest first), and
  again reverses it; teams without a value stay last. It's kept in the URL as `sort` (the column ID, like `corsi`),
  `order` (`asc` or `desc`) and `section` (like `possession`), each left out at its default (the section's is the sorted
  column's, or Record for the rating), written with `Location.replaceState` like the team
  page's tabs, so sorting doesn't scroll or add history entries.
- **Layout:** the team column (position, logo, name) stays in view while the table scrolls sideways, which from 1200px
  it always does, since the site's pages are at most 1,400px wide. Phones show the abbreviation instead of the name.
- **Sticky scrollbar:** the table's own scrollbar is hidden, and a scrollbar below it sticks to the bottom of the screen
  while the table is in view, so the table can be scrolled sideways without going to its end. The two are kept in step
  with scroll listeners (outside Angular's zone), and a ResizeObserver sizes the scrollbar's content to the table's
  width and hides it when the table fits. On a phone it sits on the app's bottom menu and follows it down when it slides
  off (`ScrollDirectionService`). Sticking needs every ancestor to leave overflow visible or `clip`: `hidden`, as the
  router outlet in `app.component.scss` and the card had, makes that element the scroll container, and the scrollbar
  never sticks.

## Season leaders

A future game's page previews each team's key players on the top players card's rink (`GameSeasonLeadersComponent`,
on the shared `RinkComponent`): the top 3 forwards (`C`, `L`, `R`) and 2 defensemen (`D`) by points, and the top
goalie by wins, with their season totals. Only shown while `futureGame` is true; live and finished games keep the top
players card.

- **Source:** `club-stats/{abbrev}/{season}/{gameType}`, one request per team, cached 30 minutes. It has every skater's
  and goalie's totals for that team only, so a traded player has just his games with it. `season` is a **string**
  (`"20262027"`), unlike most responses. A game type without games (the playoffs before they start) returns empty
  `skaters` and `goalies`; a season the team has no games in (a future season, a team that didn't exist yet) is a 404.
  `club-stats/{abbrev}/now` exists too, but the page asks for the game's own season and game type.
- **Which totals** (`NhlGameService.getSeasonLeaderStats`): the game's season and game type, so a playoff game shows
  playoff totals and a preseason game the regular season. Until both teams have played a game of it (no skater with
  `gamesPlayed`), or when it's a 404, both teams fall back to the same season's regular season (a playoff game) or the
  previous season's (`season - 10001`). Both teams always come from the same season; the card names it, like
  "2025-26 Regular Season". If the fallback fails, the game's own totals are kept, and if neither loads the card is
  hidden.
- **Ranking:** skaters by points, then goals, then fewer games played, then the bigger star (`NhlStarPlayerUtils`).
  Goalies by wins, then games started, then save percentage. Players without games are left out, and a short line
  shows the players there are. The card is hidden when either team has no one.
- **Stat line:** `GP · G-A-P` for skaters and `W-L-OTL · SV% · GAA` for the goalie. A player links to his player page.
- **Average rating:** each player wears his average HokMob rating in the top players card's badge, with one decimal
  (like "7.1") and colored by that shown value, on the season average scale of the [rating colors](#rating-colors). It comes from the history file of the totals' season and game type
  (`SeasonHistoryService`), loaded by the game page once the totals are in, and counts only his games for that team
  (`PlayerSeasonRatingUtils.getTeamSeasonRatings`), like the totals. The playoffs have no history file, so playoff
  totals go without ratings, and so does a player without a rated game in the file, or every player while it loads
  or if it fails. The current season's file runs through its `throughDate`, so it can be a few days behind the totals.
- **Star lineup:** the toggle swaps the skaters for each team's stars who have played for it, topped up by points
  (`NhlStarPlayerUtils.pickStarLine`). The goalie stays the wins leader.

Below the season leaders, a future game shows both teams' power ratings in one card (`GamePowerRatingsComponent`), the
home team's first, side by side at every width with a line between them. The card's header says "Power Rating", with
one toggle in its top right corner (`TeamRatingViewToggleComponent`, the team page card's too) that switches both teams
to their season stats (`/api/nhl-stats/teams`, loaded with the games) and back, and the title to "Team Stats". Each team's
half is the team page's power rating or team stats card with `showTeam` and `embedded` on: no background or padding of
its own, and a smaller header with the team's logo and name on the left, like "Sharks". `showNote` is off: the league
average and NST's credit are noted once, centered, at the bottom of the card while it shows the power ratings. Without
both teams' season stats, or while they load, there's no toggle. Each half is a `power-rating` size container, so under
340px wide, like on a phone, it goes compact: the logo and the team's abbreviation for a title, each stat's short name
(`TeamMetric.shortLabel`, or the team stats card's own) on one line with its value and a smaller rank pill, no weights
or group titles, a smaller rating and the change shortened to "0.9 last 5". The card itself is a `power-rating`
container too, for the toggle, which shows its labels (Rating, Stats) only from 500px wide, and its icons alone below.
The team stats tab's cards aren't in such a container, so they never go compact. The league is rated on the game's
regular season from `/api/nhl-stats/team-games` and NST's `/api/nst/team-games`, the same way as the team stats tab
(see [Team power rating](#team-power-rating)), so a playoff game shows the regular season's ratings. There's no fallback
to the previous season: the card is hidden until both
teams have played a regular season game, and when the games fail to load. Loaded once, not on the game's refresh.

## Player traits

The player page's traits card (`PlayerTraitsComponent`, like FotMob's "Player traits") is a hexagon of six season
stats, each the player's percentile among the players at his position. It uses the landing's featured season, the
same one the season card shows, regular season only, and `/api/nhl-stats/league-players` for that season. A skater's
rows are joined on `playerId` with NST's skaters (`/api/nst/players`) and the season's NHL EDGE file
([EDGE season data](#edge-season-data)), both optional (`PlayerPercentileUtils.joinSkaterRows`), so every part of an
axis is ranked against the same pool. `PlayerPercentileUtils` does the math (`getPlayerPool` gives a player's group,
pool and minimum games), and the season performance card shares it, the endpoint and the response.

- **Position groups:** forwards (`C`, `L`, `R`), defensemen (`D`) and goalies, each against its own group.
- **Pool:** the group's players with at least the minimum games: 20 in a full season, the same share of games as the
  history page's leaderboard (20 of 82), scaled to the most games any team has played (`mostTeamGames`, from
  `team/summary`), at least 1 (`PlayerPercentileUtils.getMinGames`, which `SeasonRatingStatsUtils.getMinGames` uses
  too). The (?) explanation names it ("Among 433 forwards with at least 7 games in 2026-2027"). A player under it is
  charted against the pool without being in it, with "Only 4 games, small sample" under the chart.
- **Percentile:** the share of the pool he's ahead of, with ties counted as half (his own value ties with itself),
  shown rounded, 0 to 100. A stat that can't be worked out (no 5v5 shot attempts, no penalty kill shots) shows "-".
- **Skater axes,** clockwise from the top: Goals, Possession, Playmaking, Speed, Defense and Physical. Counting stats
  are per 60 minutes of all-situation ice time (`timeOnIcePerGame` × games). An axis of several stats (`parts`)
  ranks each one against the pool, then ranks the weighted average of the percentiles; a part a player has no value
  for (no NST row, no 5v5 time) is left out of his average.

  | Axis | Parts (weight) | Source |
  |---|---|---|
  | Goals | goals per 60 (1), ixG per 60 (½) | stats API, NST |
  | Possession | shot attempts per 60 (`totalShotAttempts`: on goal, missed and blocked) (1), 5v5 Corsi For % (`satFor` / `satFor + satAgainst`) (1) | stats API |
  | Playmaking | primary + ½ secondary assists per 60 | stats API |
  | Speed | bursts over 20 mph per 60 (1), top skating speed (½) | EDGE season file |
  | Defense | blocks per 60 (1), takeaways per 60 (1), 5v5 on-ice xGA per 60, lower first (½) | stats API, NST's on-ice page |
  | Physical | hits per 60 (1), hits taken per 60 (½) | stats API, NST |

- **Without NST** (503, no key, no row for him) its parts drop out: Goals is goals alone, Defense blocks and
  takeaways, Physical hits, as before, and the credit under the chart goes.
- **Without EDGE** (a season before 2021-22, a failed file, a skater not in it) the chart goes back to the axes
  without Speed (`skaterAxesWithoutEdge`): Possession's two halves become two axes again, Shot attempts and
  Possession (5v5 Corsi For % alone), in Possession's and Speed's places. A Speed vertex at 0 would look like a slow player, and a 5-axis chart a different card.
- **Speed** is ranked against our pool, not with EDGE's percentiles, which rank the bursts as a count and so favor
  the players with the most games. Bursts per 60 divide the file's `burstsOver20` by the league row's
  `timeOnIcePerGame` times EDGE's own `gamesPlayed`, so a file a day behind the league rows still divides by the games
  its bursts came from (in 2025-26 EDGE's games matched the stats API's for all 940 skaters). The Speed tooltip gives the
  file's date for a season in progress.
- **Validation, season to season** (as for Playmaking): the correlation of a player's axis value (his percentile)
  with his next season's, players with 40+ games in both, 2023-24 → 2024-25 and 2024-25 → 2025-26, forwards then
  defensemen:

  | Axis | Before | Now |
  |---|---|---|
  | Goals | F 0.62, 0.63; D 0.54, 0.43 | F 0.71, 0.73; D 0.70, 0.60 |
  | Physical | F 0.90, 0.93; D 0.90, 0.91 | F 0.90, 0.93; D 0.88, 0.90 |
  | Defense + ½ xGA | F 0.65, 0.54; D 0.62, 0.58 | F 0.67, 0.56; D 0.60, 0.61 |
  | Shot attempts / Possession (Corsi alone) → Possession | F 0.86, 0.87 / 0.56, 0.63; D 0.80, 0.80 / 0.55, 0.58 | F 0.74, 0.79; D 0.70, 0.71 |
  | Speed (new) | | F 0.86, 0.85; D 0.85, 0.84 |

  ixG alone repeats best of all (F 0.75 to 0.77, D 0.78 to 0.79), but goals still lead the axis. On-ice xGA alone
  repeats poorly (0.34 to 0.45), and at a full third of Defense it made defensemen's Defense less repeatable in one
  of the two pairs (D 0.55, 0.59), so it counts half, which holds up as well as before or better. For
  Possession, high danger attempts (iHDCF) per 60 instead of all attempts repeated less (F 0.64, 0.70), and so did
  NST's on-ice xGF% instead of Corsi (F 0.70, 0.71); NST's own 5v5 CF% repeats the same as the stats API's.
- **Spot checks** (2025-26 forwards, top 10): Goals has Caufield, Gauthier, DeBrincat, Hyman, MacKinnon; Possession
  Svechnikov, Hagel, Ehlers, MacKinnon, Kucherov; defensemen's Possession Malinski, Gostisbehere, Burns,
  Makar and Werenski. Speed has McDavid, MacKinnon, Tippett and Cooley, and Sanderson, Karlsson and Makar
  among defensemen; McDavid's 24.612 mph in the file is EDGE's own 24.6119. Bursts per 60 repeat better than top
  speed (F 0.91, 0.87 against 0.56, 0.63; D 0.82, 0.84 against 0.67, 0.56), but alone they put fast depth forwards near the top (Wright,
  Brindley, Frank, Hinostroza in 10 to 12 minutes; for forwards they correlate −0.22 with ice time, top speed +0.11).
  So top speed counts half: Speed repeats nearly as well as bursts alone, and better for defensemen in 2023-24 →
  2024-25 (F 0.86, 0.85; D 0.85, 0.84, against F 0.80, 0.81 and D 0.84, 0.80 with the two equal), and top speed
  still holds those forwards back. Defense and Physical are still topped by fourth-liners in 9 to 12 minutes a game
  (Samanski, Blais, Rempe), since a few events in little ice time make a high rate; a minimum ice time for the pool
  would change that, and is left for later.
- **Playmaking** is primary assists plus half of secondary assists (`totalPrimaryAssists`,
  `totalSecondaryAssists`). Checked season to season on players with 40+ games in both (2023-24 to 2025-26), the
  correlation of a player's rate with his next season's was 0.66 for forwards' primary assists alone and 0.59 to 0.61
  for defensemen's, and 0.70 to 0.73 with secondary assists at half; secondary assists are more than half of a
  defenseman's assists and about 40% of a forward's. Counting them in full repeats about as well (0.72 to 0.75),
  but that partly reflects being on the ice with the scorers, like on a top power play unit, so they count half.
- **Defense** ranks blocked shots and takeaways per 60 apart (and on-ice xGA at half), then ranks the average of the
  percentiles. Added up, blocks decided it: a defenseman blocks five or
  six shots for every takeaway, so the top of the 2026-27 list was all shot-blockers, like Conor Timmins with 27
  blocks and no takeaways. Averaged, the players who do both come first (Slavin, Seider, Brodin), and so do
  takeaway forwards like Logan O'Connor and Alex Tuch. Fourth-liners still rank high, since a few blocks in 9 minutes
  make a high rate; a minimum ice time for the pool would change that.
- **Goalie axes:** save %, goals saved above average per 60 (at `StatsUtils`' league save percentage of each
  strength, like the game rating), even strength save %, penalty kill save % (the `pp` split), games started, and wins
  per decision.
- **Color:** the shape is the team's primary color, lightened toward white until it has 3:1 contrast with the card
  (`NhlTeamColorUtils.getTeamColorOnCard`), so the navy and black primaries show; gray without a current team. The
  rating colors are reserved for ratings.
- **Layout:** on a wide desktop the traits card tops the third column and the career table runs under it, beside the
  bio and season cards, the playoffs card (across the first two columns when there is one), the recent games and the
  season performance card. On a small desktop and a phone the cards wrap or stack as before, with the traits card
  just before the career table.
- **Caching:** the backend keeps each report 5 minutes, and `NhlStatsApiService.getLeaguePlayers` keeps a season's
  response 5 minutes too, so moving between players of the same season doesn't ask again.
- **Credit:** a skater with an NST row gets "ixG, hits taken and xGA from Natural Stat Trick" under the chart,
  linking to NST's player season page. Each vertex's title names its stats and sources; the (?) explanation only
  gives the pool and how the percentiles are worked out.

## Season performance

The player page's season performance card (`PlayerSeasonPerformanceComponent`, like FotMob's) lists the featured
regular season's stats in titled groups, each with its value, the player's rank in a pill and a bar as long as his
percentile, the way the team page's stats cards show a team's. `PlayerSeasonPerformanceUtils` defines the groups and
works out every row.

- **Pool:** `PlayerPercentileUtils.getPlayerPool`, the traits card's: his position group's players with the minimum
  games. A player under it is ranked against them (`getRank`: 1 plus the values ahead of his, so ties share a rank),
  with "Only 4 games, small sample" under the header. A row's tooltip says among whom, like "12th of 433 forwards
  with 7+ games". Faceoff % ranks only the players with 5 faceoffs per minimum game ("and 35+ faceoffs"), and
  shooting % those with a shot per minimum game, so a handful of lucky attempts can't top them. Each rank agreed with
  a count from the stats API's rows (McDavid, 2026-11-24: 13 goals 11th of 433 forwards in total, 1.27 per 60 79th).
- **Colors:** only what stands out, in the rating colors (`PlayerPercentileUtils.getRankTier`): blue for the top 5%,
  green for the rest of the top 25%, red for the bottom 20%, gray between. Giveaways, penalty minutes and GAA rank
  lower first; hits taken are ranked but never colored.
- **Total / Per 60:** counting stats become per 60 minutes of all-situation ice time (`skater/timeonice`'s
  `timeOnIce`), for the pool too, so the ranks follow the toggle. Shares stay, and ice times are per game. A goalie
  has no toggle: his groups are shares, GAA and season counts, with goals saved above average both in total and per
  60.
- **Skater groups:** Scoring (goals, assists, primary and secondary, points, power play points), Shooting (shots,
  shooting %, shot attempts, NST's ixG and high danger attempts), Possession
  (5v5 Corsi and Fenwick For %, faceoff % for a player who takes faceoffs, with his record in its tooltip, NST's
  rebounds created and rush attempts), Defense and physical (hits, NST's hits taken, blocked shots, takeaways,
  giveaways), Discipline (penalty minutes, penalties drawn, the differential), Usage (ice time, power play and
  short-handed time per game, EDGE's offensive zone time) and Skating (EDGE's top speed, bursts over 20 mph and top
  shot speed). The first three groups are the left column on a desktop, the others the right.
- **Goalie groups:** Goaltending (save %, GAA, goals saved above average and per 60), By strength (even strength and
  penalty kill save %), Workload (starts, wins, shutouts) and Tracking (EDGE's high danger save % and games above
  .900).
- **Left out:** game-winning goals, goals above expected, IPP (individual points percentage, NST's) and EDGE's
  distance skated, to keep the card short. IPP ranked small samples first (fourth-liners with 3 points from 3 on-ice goals at 100%, one at 120%)
  and McDavid 55th of 427 forwards, and the points rows already say who drives the scoring.
- **Missing sources:** without NST (503, no key, no row for him) its rows are left out and the credit with them;
  without EDGE (before 2021-22, a 404, an error) its rows are. A stat nobody in the pool has, like 2017-18's shot
  attempts, is left out too; a stat only he lacks shows "-".
- **Placement:** on a wide desktop the card spans the recent games' two columns, right under them, with the traits
  and career cards down the third column beside it: the grid's rows are `auto auto 1fr` (`auto auto auto 1fr` with
  the playoffs card), and the card takes the flexible last row. On a small desktop it takes a row to itself, and on a
  phone it comes after the recent games, before the traits card. Its groups are two columns from 700px up, one below.
- **Shot attempts:** the stats API's `totalShotAttempts` is NST's iCF within one: of the 50 skaters of the league
  players fixture, 43 matched and 7 differed by one (2026-11-24).

## NHL EDGE

`api-web.nhle.com/v1/edge/...` (proxied as `/api/nhl/edge/...`, 30 minutes cached) has the NHL's player tracking:
`skater-detail/{playerId}/{season}/{gameType}` and `goalie-detail/...`, one request per player
(`NhlGameService.getPlayerEdgeDetail`, typed in `edge.model.ts`).

- **Skaters:** top skating speed (`skatingSpeed.speedMax`), bursts over 20 mph, total distance and the most in a game,
  top shot speed, shots, goals and shooting % by area, and zone time. Each has its value (imperial and metric), the
  **NHL's percentile** (0 to 1) and the league average. `skater-skating-distance-detail` adds distance per 60 and
  `skater-shot-speed-detail` the average shot speed. The card shows top speed, bursts, top shot speed and offensive
  zone time, and asks for nothing else, so its EDGE rows are the same in Total and Per 60.
- **Goalies:** `stats` (GAA, games above .900, goal differential and support per 60, points %) and
  `shotLocationSummary` by `all`, `high`, `mid` and `long`, each with its save % percentile. The counts' percentiles
  look upside down (Shesterkin's 101 saves at the 0th), so only the save percentages and games above .900 are used.
- **Seasons:** 2021-22 on (`seasonsWithEdgeStats` lists them); 2020-21 and the playoffs of a season without them
  answer 404, which the service resolves as no stats, and it doesn't ask for a season before 2021-22.
- **Percentiles aren't ours:** the pool is the NHL's (a 2026-27 forward's zone time percentiles are multiples of
  1/392). The card shows them as they are, as a percentage in the pill, under groups marked "NHL EDGE".
- **Units:** imperial (mph), like the site's distances in feet.
- **The traits card doesn't ask EDGE:** its Speed ranks every skater of the season, which EDGE only gives one player
  at a time, so it reads the stored season file instead ([EDGE season data](#edge-season-data)).

## EDGE season data

The traits card ranks a skater's top speed and bursts per 60 against our own pool, which needs every skater's EDGE
season, and EDGE has no league-wide list (its league endpoints are top 10s like `skater-speed-top-10`). So, like the
history files, a script collects them once into `src/assets/edge/{season}-2.json`, which `EdgeSeasonService` loads as
a static asset, kept for the session. It's the NHL's data, so it's committed; NST's never is.

- **Script:** `npm run build-edge-data -- <season> [--partial]` from `HokMob.App/ClientApp` (`build-edge-data.js`).
  It lists the season's skaters from the stats API (`skater/summary`, paged with `stats-api-pages.js`), then reads
  `edge/skater-detail/{playerId}/{season}/2` for each, one at a time, about one a second (api-web's limit, see
  [Stored play-by-play](#stored-play-by-play)), slowing down after a 429. A player who still fails after 5 tries is
  listed at the end and left out, instead of failing the run. A full season of about 940 skaters takes about 15
  minutes. Don't run it with another api-web script.
- **File:** `{ version, season, gameType, throughDate?, skaters: { playerId, gamesPlayed, speedMax, burstsOver20,
  distance, topShotSpeed, offensiveZonePctg, defensiveZonePctg } }`, columns sorted by player ID (`EdgeSeasonFile` in
  `models/nhl-edge/`). Speeds in mph, distance in miles, zone time as a share. `throughDate`, in a file built with
  `--partial`, is the day of the season's last final game. Distance, top shot speed and zone time aren't used yet;
  the season performance card could rank them against our pool from here instead of showing EDGE's percentiles.
- **Seasons:** EDGE starts in 2021-22 (2020-21 answers 404), so `EdgeSeasonService.seasons` can go back to 2021-22,
  and an earlier featured season has no file and no Speed. Built so far, and listed: 2023-24 (924 skaters, none
  left out, 43 KB, 16 KB gzipped), 2024-25 (918, 2 left out with a 404, 43 KB, 16 KB gzipped), 2025-26 (940, none
  left out, 44 KB, 16 KB gzipped) and `20262027-2.json`, through 2026-11-24 (788 skaters, 1 left out, 36 KB, 13 KB
  gzipped). 2021-22 and 2022-23 are still to be built, and chart without Speed until they are. In 2023-24 and
  2025-26, EDGE's games matched the stats API's for every skater.
- **Refresh:** the season in progress is rebuilt with `--partial` on the history file's schedule, in the
  `update-history-season` skill, and once more without it when the season is over. The file can trail the league
  rows by a day, which is fine for a percentile.

## Shot maps

A live or finished game's shot map card (`ShotMapComponent`, on the shared `RinkComponent`) and the player game dialog's
shot map (`PlayerShotMapComponent`) plot the shots on goal and goals of the play-by-play, which the page already loads.
The shot map card's header filter picks "All" (adding the missed shots), "On target" (the default) or "Goals". The
player map never shows missed shots, and blocked shots are never plotted. `ShotMapUtils.getShots` reads them, with the
missed shots only when asked (`includeMissed`).

- **Coordinates:** `details.xCoord` / `yCoord` in feet from center ice: x from -100 to 100 along the rink (goal lines at
  ±89), y from -42.5 to 42.5 across it. The teams switch ends each period, and `homeTeamDefendingSide` (`"left"` is
  negative x) says which end the home team defends. `getShots` turns every shot so the shooter attacks the net at
  x = 89, turning a shot towards the left end half a turn (both x and y negated) so it keeps its side of the net.
  Without `homeTeamDefendingSide` it goes by the half the shot came from.
- **Shooter and goalie:** a `shot-on-goal` has `shootingPlayerId`, a `goal` has `scoringPlayerId`; both have
  `goalieInNetId`, which is missing for an empty net goal. `eventOwnerTeamId` is the shooting team. In the fixture games
  each team's count matches the boxscore's `sog`, and a goalie's shots faced match his `shotsAgainst`.
- **Where the shots come from:** a few each game are from the neutral zone or the shooter's own half (an empty net goal
  from the defensive zone, even one at x = -98). The team map shows them where they are. The player map draws the
  offensive zone, or down to the center line when a shot came from the neutral zone, and pins a shot from the
  shooter's own half to its top edge.
- **What's missing:** there's no location on the net for a shot on goal (FotMob's goal mouth view), only a missed
  shot's `reason` (`wide-left`, `wide-right`, `above-crossbar`, `high-and-wide-left`, `hit-right-post`,
  `hit-crossbar`, `short`, `failed-bank-attempt`, ...). The card shows it as the missed shot's result without the side
  (`ShotMapUtils.getMissReasonLabel`: "Wide", "Over the net", "Hit the post", ...), since it doesn't say whose left it
  is. `shotType` is `wrist`, `snap`, `slap`,
  `backhand`, `tip-in`, `deflected`, `wrap-around`, `bat` or `poke` (`ShotMapUtils.getShotTypeLabel`). The shootout
  (period type `SO`) is left out.
- **Blocked shots,** if they're ever plotted: their coordinates are where the shot was blocked, not where it was taken,
  and `eventOwnerTeamId` is still the shooting team.
- **The team map** puts home's shots at the left end and away's at the right (standing up on phones, home's at the
  top). A missed shot is an empty circle in the team's color, under the shots on goal, and while the filter shows every
  shot, each team's count adds its missed shots ("21 shots · 15 missed · 3 goals"). The selected shot's line runs to
  the middle of the net, but a missed shot's is dashed and stops at the edge of the drawn crease (none from inside it),
  since the puck didn't get there. The crease is round on the drawn rink but a different size in percent on the lying
  and standing rinks (`RinkComponent.getCreaseRadiusPercent`), so the line has an end for each, and CSS shows the one
  for the layout (`ShotMapComponent.getCreaseEnd`). On phones the title moves left to make room for the filter. It
  lines the shots up with the drawn rink's goal lines and faceoff dots, since the rink is drawn 200.13ft long
  (`ShotMapComponent.getRinkPosition`). It starts on the last shot, a shot clicked on the rink shows its details, and
  a goal with a posted clip opens the goal highlight dialog.
- **xG:** once a live or finished game's Natural Stat Trick stats load, each shot gets NST's xG (see
  [Shot xG](#shot-xg)): the team map shows it in the shot's details and credits NST below the rink, and the player
  map's shot tooltip (a hovered or selected shot's result, time, shot type and xG) shows it too. A shot NST doesn't
  list shows "-" on the team map and no xG in the tooltip. During a live game, a shot past how far NST has got shows
  "Pending" in both (`GameShot.expectedGoalsPending`, see [Live games](#live-games)).

## Season dates and playoff mode

`/api/nhl-stats/seasons` returns `{ seasons: [{ id, firstGameDate, firstPlayoffGameDate }] }` for the two latest
seasons, newest first. The dates come from the stats API `game` report sorted by `gameDate` (`gameType in (1,2)` for
the first preseason or regular season game, `gameType=3` for the first playoff game); a date is null while no such
game is scheduled. Any upstream failure is a 502, because a missing date would look like a season that hasn't
started.

`DateTimeUtils` turns those into the current season and playoff mode, in local days:
- The current season is the newest one whose first game is at most **14 days** away or already played (otherwise the
  oldest listed).
- Playoff mode runs from **2 days** before the current season's first playoff game until the next season starts.

`NhlStatsApiService.getSeasonDates()` shares one request for an hour (a failed one isn't reused), and
`getCurrentSeason()` resolves `{ season, isPlayoffMode }` for today. Pages that depend on it wait for it and fall
back when it fails: home shows the standings summary, `/stats` the regular season without filters, and `/playoffs`
the latest bracket that has series.

2026-27 dates: preseason from 2026-09-19, regular season from 2026-09-29. The 2025-26 playoffs are all finished.

## History data

The history page doesn't call the NHL APIs. A season's per game stat lines are preloaded into
`src/assets/history/{season}-{gameType}.json` (`20252026-2.json` is the 2025-26 regular season), which the history
page loads (`SeasonHistoryService`), as do the player page for its rating column, the team page for its players' ratings
and a future game's season leaders (see [Season leaders](#season-leaders)). They're rated in the browser with
`StatsUtils.calculateSkaterGameRating` / `calculateGoalieGameRating`, the same as the player page's recent games. The
file holds the rating's inputs, not ratings, so a formula change shows up on the history page without regenerating it.

- **Generating a season:** `npm run build-season-data -- 20252026 [gameType]` from `HokMob.App/ClientApp` (game type 2
  by default), once the season is over: it fails while any of its games isn't final, unless `--partial` is passed. It
  takes about a minute. Add the new file's season to `SeasonHistoryService.seasons` for the page's picker. Nobody edits
  the file by hand.
- **A season in progress:** `npm run build-season-data -- 20262027 --partial` keeps the final games so far, and drops
  the rows of any game that isn't final, since a game in progress can have rows in some reports and not in others. The
  file is a snapshot: it doesn't update itself, so run the same command again to bring it up to date, and once more
  without `--partial` when the season is over, which removes `throughDate`. That field is only in a file with
  unfinished games, and holds the day of its last final game. With it, the page says "Season in progress, through
  November 5", and the leaderboard's 20 game minimum becomes the same share of the games played so far, from the most
  games any team has played (`SeasonRatingStatsUtils.getMinGames`): 5 games when the most is 18.
  `20262027-2.json` runs through 2026-11-23: 384 games, 868 players, 13,823 skater rows and 809 goalie rows, 849 KB
  (155 KB gzipped).
- **Player page:** when the landing's featured season has a regular season file, the season card gets a fifth column:
  the player's average HokMob rating over their rated games, and below it a skater's 5v5 Corsi For % (`satFor` /
  (`satFor` + `satAgainst`)) or a goalie's goals saved above average (`StatsUtils.getGoalsSavedAboveAverage`, summed
  over their games), from `PlayerSeasonRatingUtils`. The file is shared with the history page and kept for the session.
  A player who isn't in the file (no game since it was generated) gets no column, and the playoffs card never has one.
- **URL:** the picked season is a query parameter, `/history?season=20252026`, with `&gameType=3` for a playoffs file. Plain
  `/history`, or a season the page doesn't have, shows the newest season. The cards' filters are query parameters too:
  `distribution`, `leaders` and `best` (`F`, `D` or `G`) and `team` (the leaderboard's team ID), left out at their
  defaults. They're written with `Location.replaceState` rather than the router, which would scroll to the top of the page
  (`AppComponent` does on every router event) and add a history entry per click, and with the history state kept, because
  `RouterExtensionService` and the scroll restoration read the router's page ID from it. Picking a season clears them.
- **Seasons so far:** 2024-25 and 2025-26 (finished) and 2026-27 (in progress). 2024-25 has the same shape as 2025-26:
  1,312 games, 1,023 players, 47,224 skater rows and 2,764 goalie rows, 2.87 MB (492 KB gzipped). Its Utah is the Utah
  Hockey Club, team ID 59, not the Mammoth's 68. It's a former team in `NhlTeamUtils`, with the same `UTA` abbreviation
  and the Mammoth's logo and color, and `UTA` still resolves to 68.
- **Reports:** the per game rows (`isGame=true`) of the reports the player page's recent games merge: `skater/summary`,
  `skater/realtime`, `skater/faceoffwins`, `skater/scoringpergame`, `skater/powerplay` and `skater/penalties`, plus
  `skater/summaryshooting` for the 5v5 Corsi (`satFor`, `satAgainst`) and Fenwick (`usatFor`, `usatAgainst`) counts,
  which aren't rated yet (#120). Goalies: `goalie/summary` (`timeOnIce`, and `gamesStarted` and `wins` for the
  rating's win and shutout bonuses, since file version 2, and the goalie's own `goals` and `assists` since version 3)
  and `goalie/savesByStrength`. The `game` report gives each
  game's date, teams and score. The reports are merged by `playerId` + `gameId`.
- **Paging:** the stats API returns 100 rows per request (see its parameters), so every query is read in pages of
  100, sorted by `playerId` then `gameId` (the `game` report by `id`), by `stats-api-pages.js`, which the play-by-play
  script shares. It reads a query again when its `total` changes between pages, and fails when the rows don't add up
  to the total or repeat a key, or when a query reaches the 10,000 row cap. A regular season is about 47,000 skater
  game rows, so the skater reports are asked for per team (`seasonId=20252026 and gameTypeId=2 and teamId=<id>`,
  about 1,500 rows, 15 pages each), which also gives each row its team; the goalies (2,768 rows) are one query. A full
  season is about 3,400 pages, about 15 minutes.
- **Rate limit:** the stats API answers 429 with `Retry-After: 60` to a burst: 50 requests at about 13 a second got
  one (2026-11), while 70 at 3 a second and 90 at one every 1.3 seconds didn't. So the script reads two queries at a
  time, each one page at a time, starts a page at most every 250 ms across both (`stats-api-pages.js`), and waits on a
  429. It logs its progress every tenth of the skater queries.
- **Quirks:** `skater/summaryshooting` leaves a Corsi or Fenwick count null instead of 0 for a skater with a few 5v5
  shifts (stored as 0). `faceoffWinPct` is null without faceoffs (stored as 0, as the rating reads it) and truncated
  to 5 decimals (0.38461 for 5 of 13), so it's stored as given rather than worked out from the counts. A goalie's
  `goalsAgainst` isn't always `shotsAgainst - saves` (24 of the 2,768 games in 2025-26); the rating only uses shots and
  saves, so the file has no goals against.
- **Validation** before the file is written: every game is final and has skaters and goalies of both teams, every
  report has the same rows, each skater row's team matches its `homeRoad`, the primary and secondary assists add up to
  the assists, and the saves by strength add up to the saves and shots.
- **Format:** four columnar tables (`games`, `players`, `skaters`, `goalies`), each an object of equally long arrays,
  one per field, so no field name or player name repeats. A skater or goalie row points at its player and game by
  their index, and `home` (1 or 0) gives the team. A player's position is stored once (a player has one position per
  season). The fields are the stats API's; the `SeasonHistory` model describes them. 2025-26: 1,312 games, 1,038
  players, 47,230 skater rows and 2,768 goalie rows, 2.85 MB (491 KB gzipped). The browser parses it in about 10 ms
  and rates every row in under 100 ms, so there's no web worker.
- **Goalie points:** the boxscore has no goals or assists for a goalie, so the game page counts them from the landing's
  scoring summary (`StatsUtils.getGoalieRatingContext`), with the primary/secondary split. The stats API's goalie rows
  have no split, so the player and history pages count a goalie's assists at the flat 0.5. 2025-26 had 58 goalie
  assists, in 58 games, and no goalie goals.
- **What the page leaves out:** goalies who faced no shots, whom the rating gives 0 (3 in 2025-26). A goalie who
  faced shots and made no saves also gets 0, and is kept, as on the game page.
- **Capped ratings:** 91 games of 2025-26 are rated exactly 10 (51 skaters and 40 goalies). The service works out their
  uncapped total (`StatsUtils.getSkaterRawRating` / `getGoalieRawRating`), which ranks them in the best single games
  list.
- **Serving:** the file is copied to `dist/assets` with the other assets and served by `UseStaticFiles`, outside the
  main bundle and the `angular.json` initial budget. Azure (IIS) gzips JSON, so check that the deployed file comes
  back with `Content-Encoding: gzip`.
- **Test fixture:** `season-history-20252026-2.json` in `nhl-api-mocks` is the same script's output for 7 games
  (`--games <ids> --out <file>`, see `mockSeasonHistory`).

## Live game data

Checked against **DAL 2 @ STL 1** (game `2026010001`, preseason, 2026-09-19), captured from the 1st period to the
final with `npm run capture-live-fixtures -- --watch` from `HokMob.App/ClientApp`. The captures kept as fixtures are
`mockGameBundle(2026010001)` (the start of the 3rd period), `mockIntermissionLanding()`, `mockCriticalLanding()` and
`mockLiveScoreResponse()`.

- **Intermission:** `clock.inIntermission` is true and `clock.secondsRemaining` counts the intermission down, while
  `periodDescriptor` stays the period that just *ended*, so "End 1st" and "16:09 till 2nd" are both right.
- **Period change:** the clock resets to `20:00` with `running: false` until the opening faceoff. `running` is false
  at every whistle, so it tracks live play, not whether the game is on.
- **`CRIT`** occurs in the last minutes of a close game (3rd period, 2:59 left) and is otherwise identical to `LIVE`.
- **`summary.scoring` lists the period in progress before it has a goal**, with an empty `goals` array.
- **Each `summary.scoring` goal has a `strength`** (`"ev"`, `"pp"` or `"sh"`), and its `assists` are primary then
  secondary. This is the only place a goal's strength is stated: a play-by-play `goal` has just a `situationCode`,
  and skater counts can't settle it (a pulled goalie on a delayed penalty is 6 on 5 at even strength). Over 10 games
  (70 goals) it agreed exactly with the play-by-play, live too. `StatsUtils.getAssistCounts` reads it. A shootout
  goal is listed too, with no assists.
- **A `situation` object** is on the landing and the play-by-play while a team is short-handed, and drives the game
  header's power play badge. The short-handed team has no `situationDescriptions`. The key is **absent** at even
  strength and after the game, so read it with `?.`. It stays through an intermission when a penalty carries over,
  and the right-rail `powerPlay` stat counts the power play as soon as it starts (`"0/1"`). Right as a penalty is
  called, though, it can briefly count one short: Calgary's first power play of game 2026020328 showed `"0/-1"` (it
  ended the game `"0/1"`). `GameStatsComponent.formatPowerPlay` keeps both numbers at 0 or more, and an out-of-range
  `powerPlayPctg` highlights neither team.

  ```json
  {"homeTeam": {"abbrev": "STL", "situationDescriptions": ["PP"], "strength": 5},
   "awayTeam": {"abbrev": "DAL", "strength": 4},
   "situationCode": "1451", "timeRemaining": "01:01", "secondsRemaining": 61}
  ```

- **`summary.iceSurface`** (players on the ice, empty during an intermission) is only on a live response. Nothing
  reads it yet.
- **The play-by-play, boxscore and right-rail have their finished-game shape while the game is on** (every play with
  a `situationCode`, all `rosterSpots`, `playerByGameStats` from the 1st period, all `teamGameStats`), so top players
  and game stats need no live special case. `gameOutcome` only appears once the game is final.
- **A goal's `highlightClip` is added within minutes**, picked up by the page's normal refresh.
- **`score` lags the landing at a period change** by a few seconds (the landing was in the 2nd while `score` still
  showed the 1st intermission), so don't assert that the two agree.

## Stored play-by-play

`data/nhl-play-by-play/` at the repo root keeps whole regular seasons of the NHL's play-by-play and per game player
logs, for research on the team power rating: stats nobody publishes ready-made, worked out from the events. It's
written by `npm run build-play-by-play -- <season> [<season> ...]` (`ClientApp/build-play-by-play.js`), is in
`.gitignore` (about 55 MB a season) and isn't read by the app. The play-by-play of 2022-23 to 2026-27 (through
2026-11-15) is there, the logs from 2015-16 and the season totals from 2012-13 (`--only totals`, three requests a
season; the bios from 2021-22). 2021-22's play-by-play was never fetched. **Read these files instead
of asking the NHL again**: a finished game never changes, and the script resumes, so rerunning it only fetches the games
a file doesn't have (a season in progress's new games, or the rest after an interruption).

**The limit.** `gamecenter/{id}/play-by-play` allows about one request a second per IP address. Past that api-web
answers 429 with `Retry-After: 60`, and requests sent during those 60 seconds keep failing (5 parallel requests were
blocked after about 100 games, and 4 a second after 33). The stats API slows down with it. So the script sends one
request at a time, waits out every 429 and then slows down: a season (1,312 games) takes 25 to 40 minutes. Don't run two
copies, and don't fetch play-by-play in a loop any other way. The app's own api-web calls can fail while it runs.

| File | What | From |
|---|---|---|
| `{season}-2.ndjson` | One game per line: its plays, compacted | api-web `gamecenter/{id}/play-by-play` |
| `{season}-2-skater-toi.csv` | A row per skater and game: ice time and shifts | stats API `skater/timeonice`, `isGame=true` |
| `{season}-2-goalies.csv` | A row per goalie and game: shots, saves, goals against | stats API `goalie/summary`, `isGame=true` |
| `{season}-2-skater-totals.csv` | A row per skater: the season's games, goals, points, shots, ice time | stats API `skater/summary` |
| `{season}-2-goalie-totals.csv` | A row per goalie: the season's games, shots, saves, goals against | stats API `goalie/summary` |
| `{season}-2-skater-bios.csv` | A row per skater: birth date, height, weight, first season, draft | stats API `skater/bios` |

The game list comes from the stats API's `game?cayenneExp=season=20252026 and gameType=2` (one row per game with
`id`, `gameDate`, `homeTeamId`, `visitingTeamId` and `gameStateId`: 7 is finished, 1 not played yet).

**A game's line** is `{ id, date, home, away, roster, plays }`: `home` and `away` are team IDs, `roster` is
`[playerId, teamId, positionCode]` for everyone dressed (`rosterSpots`), and each play keeps these keys, absent when
the play has no such value:

| Key | Meaning |
|---|---|
| `t` | `typeDescKey`: `faceoff`, `shot-on-goal`, `missed-shot`, `blocked-shot`, `goal`, `hit`, `giveaway`, `takeaway`, `penalty`, `stoppage`, `delayed-penalty`, `period-start`, `period-end`, `game-end`, ... |
| `p`, `s` | Period number (4 is overtime, 5 the shootout) and seconds into the period |
| `sit` | `situationCode`: away goalie, away skaters, home skaters, home goalie. `1551` is 5v5, `1451` a home power play |
| `side` | `L` or `R`: the side the home team defends (`homeTeamDefendingSide`). It can be wrong or missing, so work out the direction from where each team's offensive zone shots are instead |
| `tm` | `eventOwnerTeamId`. For a blocked shot it's the shooter's team (and the zone is the blocker's), so take a play's team from its player and the roster |
| `x`, `y`, `z` | Coordinates in feet from center ice (the nets are at x = ±89) and `zoneCode` (`O`, `N`, `D`, from the owner's side). A blocked shot's are where it was blocked |
| `pl` | The play's main player: shooter, scorer, faceoff winner, hitter, the player giving or taking the puck away, the penalized player |
| `b` | The other player: blocker, faceoff loser, the player hit, the player who drew the penalty |
| `a1`, `a2`, `g`, `st` | A goal's assists; the goalie in net (absent on an empty net) and the `shotType` of a shot or goal |
| `r`, `r2` | A stoppage's `reason` and `secondaryReason` (`icing`, `offside`, `goalie-stopped-after-sog`, `puck-frozen`, `tv-timeout`, ...), a missed shot's reason, or a penalty's `descKey` (`tripping`, `hooking`, ...) |
| `pt`, `dur` | A penalty's type (`MIN`, `MAJ`, `BEN` for a bench minor, `MIS`, ...) and minutes |

What a play doesn't say: who was on the ice (that's the shift charts, not stored), passes, zone entries, or which team
iced the puck or froze it. The last two follow from the next faceoff, which is in the defending zone of the team that
did.

**The logs.** `skater-toi`: `gameId`, `playerId`, `team` (abbreviation), `position`, `toi`, `evToi`, `ppToi`, `shToi`
(seconds) and `shifts`. A season is about 47,000 rows and a stats API query sees 10,000 at most, so the script asks
two weeks of `gameDate` at a time, each read in pages of 100 (`stats-api-pages.js`, see [History data](#history-data)). `goalies`: `gameId`, `playerId`, `team`, `started` (1 or 0), `shotsAgainst`, `saves`,
`goalsAgainst` and `toi` (seconds), all situations. A goalie's 5v5 shots are in the play-by-play (`g` and `sit`).

**The totals.** `skater-totals`: `playerId`, `position`, `games`, `goals`, `assists`, `points`, `evPoints`, `shots` and
`toiPerGame` (seconds). `goalie-totals`: `playerId`, `games`, `started`, `shotsAgainst`, `saves`, `goalsAgainst` and
`toi` (seconds). `skater-bios`: `playerId`, `birthDate`, `height` (inches), `weight` (pounds), `firstSeason`, and
`draftYear` and `draftOverall` (empty when undrafted). They're what a player had done before a later season, for rating a lineup by its players' record, and
are refetched on every run, since a season in progress's change.

## Natural Stat Trick

A live or finished game's all situations expected goals (xG) and Corsi come from
[Natural Stat Trick](https://www.naturalstattrick.com) (NST), through `/api/nst/game/{gameId}`
(`NaturalStatTrickController`, `NaturalStatTrickClient`, `NaturalStatTrickGameParser`). The game page loads it once
the game has started (see [Live games](#live-games)) and shows it in the game stats card (each team's xG and Corsi %, crediting NST with a link to its
game page) and the player dialog (a skater's own xG and his on-ice Corsi %), and each shot's xG on the shot maps. The
goal highlight dialog's compact bar leaves them out.

**Access.** `data.naturalstattrick.com` is NST's mirror for bots. It isn't an API: it serves the same HTML pages as
`www.naturalstattrick.com` (a game page is about 5 MB), so the backend parses them. Every request needs the access key,
sent as the `nst-key` header. The key is the `NaturalStatTrick:Key` setting and must never be committed (the repo is
public, and NST asks that keys aren't exposed). Locally it's in user secrets
(`dotnet user-secrets set "NaturalStatTrick:Key" "<key>"` from `HokMob.App`); on Azure it's the
`NaturalStatTrick__Key` application setting. Without it the endpoint answers 503, and the game page shows its stats
without xG and Corsi.

**Limits.** Each page costs 10 of each of two token pools: 800 burst tokens refilled every 5 minutes, and 150 standard
tokens added every 5 minutes up to 1800. That's about 80 pages per 5 minutes and 180 per hour. Each response reports
what's left in its `tokens-remaining` and `burst-remaining` headers. Going over the limits can get the key blocked,
so the client:

- caches each game (24 hours sliding once NST marks it final, else 3 minutes, or 10 once fewer than 900 standard
  tokens are left),
- shares one request among concurrent visitors of the same game,
- pauses all requests for 5 minutes once either pool drops below 100 tokens, or when NST answers 401, 403 or 429, and
  answers 503 meanwhile (cached games are still served),
- only accepts regular season and playoff game IDs from 2007-08 on.

**The page.** `game.php?season=20262027&game=20010` for game 2026020010: the game ID without the season's first
year. The stats are tables found by ID, with the home team first:

| Table | What | Columns used |
|---|---|---|
| `tbtsall` | Each team, all situations: a line per period, then the total (the last line is used) | `Period`, `TOI` (how far the stats go), `CF`, `CA`, `xGF`, `xGA` |
| `tb{TEAM}oiall` | A team's skaters on-ice, all situations | `Player`, `Position`, `TOI` (minutes, like `20.2`), `CF`, `CA`, `xGF`, `xGA` |
| `tb{TEAM}stall` | A team's skaters' individual stats, all situations | `Player`, `ixG`, `iCF` |

The page also has `ev`, `5v5`, `sva` (score and venue adjusted 5v5), `pp` and `pk` versions of each table.
`{TEAM}` is NST's code without dots: `TB`, `LA`, `NJ`, `SJ`. Goalies aren't in these tables. A cell of `-` (a
percentage without attempts) reads as null.

The tables only have player names. The NHL player ID comes from the skater shot charts: each skater's picker label is
CSS keyed by team and sweater number (`input.sDET55:checked ~ul li #sDETlb:after { content:"Keegan Kolesar"; }`), and
his shot chart `<div class=DET55 ...>` has an image named after his NHL ID
(`/shotcharts/players/games/20262027/8478434-20110-eventmap-all.png`). Every skater of the games checked (2026020010,
2025030414 and 2026020110) matched. A name that can't be matched gets a null `playerId`, so he has no xG in the
player dialog.

A game NST has no stats for has no `tbtsall` table, and the endpoint answers 404. NST tracks games live, so a game
that just ended may still have partial numbers: the heading's `<h2>` says "Final" once NST has it all (`isFinal`).

### Team game logs

`/api/nst/team-games?season=20262027` reads NST's team game logs (`NaturalStatTrickTeamGamesParser`):
`games.php?fromseason=20262027&thruseason=20262027&stype=2&sit=5v5&loc=B&team=All&rate=n`, every team's every game
of a regular season at one strength state, on one page (about 3 MB for a full season, the same 10 tokens as any
page). The endpoint fetches the 5v5 page and reads one row per team and game: the 5v5 xG for and against. It's sent
as columns, with the teams named once (`{ season, teams: [names], games: { gameId, team, expectedGoalsFor,
expectedGoalsAgainst } }`, where `team` is an index into `teams`), 16 KB for 650 rows. The page is kept an hour, so
it costs at most 24 pages a day, like the team table it replaced, and a failed
fetch is kept 5 minutes, so an outage isn't asked about on every visit. It answers 404 when NST has no games for the
season yet and 503 when NST can't be asked.

The power rating counts these (see [Team power rating](#team-power-rating)), and they give the 5v5 xGF% of the
advanced stats card, credited under the power rating card, and of the teams page, which credits NST.
`NaturalStatTrickService.getTeamGames` gives each row the NHL's team ID.

- **Table:** one `<table id=teams>`, a row per team and game, with the TOI and the for and against counts of Corsi,
  Fenwick, shots, goals, xG, scoring chances and high, medium and low danger chances, then SH%, SV% and PDO. The rows
  aren't closed (no `</tr>`). The first cell is the date and score ("2025-10-07 - Blackhawks 2, Panthers 3"), and the
  report links give the game ID (`game=20001` is 2025020001). The parser reads the team, xGF and xGA.
- **Teams** are named, with no ID or abbreviation, and without periods or accents: "St Louis Blues", "Montreal
  Canadiens". `NhlTeamUtils.getTeamIdByName` matches them, and tells "Utah Hockey Club" (59) and "Utah Mammoth" (68)
  apart.
- **Gaps:** a game NST doesn't have (yet) has no row, and the rating goes without it (one 2021-22 game never got
  one). The other strength states have gaps of their own: a team that was never short-handed in a game has no row
  on the `sit=pk` page.
- **Numbers:** its 5v5 Corsi % correlates 0.997 with the stats API's across teams (2025-26), but isn't the same
  (San Jose 46.73% against 47.0%), so the Corsi shown and rated comes from the stats API. San Jose's 22 games through
  2026-11-14 added up to 36.56 xG for and 55.96 against, the team table's 36.54 and 55.97 within rounding.
- **The team table** (`teamtable.php`, which the app used for xGF% before) is the same counts summed per team, and
  takes `fd` and `td` dates. It isn't fetched anymore, but it's the public page the cards link to as the credit.

**Local copies.** `data/natural-stat-trick/team-games/{season}-2-{sit}.csv` at the repo root keeps whole seasons
for backtesting the rating. The folder is in `.gitignore`: the repo is public, and NST's data isn't republished in
it, so the files only exist on a machine that has fetched them, and a new checkout has none. They're written by
`npm run build-nst-team-games -- <season>`
(`ClientApp/build-nst-team-games.js`, which takes the key from `NST_KEY` or the user secrets and stops when the
tokens run low). Columns: `gameId`, `date`, `teamId` (the NHL's), `toi` in seconds, then every count of the table;
the percentages are left out. 2021-22 to 2025-26 and 2026-27 through 2026-11-15 have `5v5`, `sva` (score and venue
adjusted 5v5), `all`, `pp` and `pk`; 2015-16 to 2020-21 have no `sva` (fetched on 2026-11-16, 54 pages). A finished
season never needs fetching again while the files are kept; rerun the current season's to refresh it (5 pages). The
app doesn't read these files.

### Player season page

`/api/nst/players?season=20262027` reads NST's player season page (`NaturalStatTrickPlayersParser`):
`playerteams.php?fromseason=20262027&thruseason=20262027&stype=2&sit=all&score=all&stdoi=std&rate=n&team=ALL&pos=S&loc=B&toi=0&gpfilt=none&lines=single&draftteam=ALL`,
every skater's individual stats of a regular season, all situations, on one page (440 KB for 789 skaters, 10 tokens).
It's kept an hour like the team game logs, a failed fetch 5 minutes. The endpoint also reads the 5v5 on-ice page
(`stdoi=oi&sit=5v5`, 660 KB, its own hour's cache), so a season asked for all day costs at most 48 pages.
**Never fetch NST's page for one player** (`playerreport.php`): it would cost a page per visitor.

- **Table:** one `<table id=indreg>`, a row per skater: Player, Team, Position, GP, TOI (minutes with decimals),
  Goals, Total / First / Second Assists, Total Points, IPP, Shots, SH%, ixG, iCF, iFF, iSCF, iHDCF, Rush Attempts,
  Rebounds Created, PIM, penalties by type, Penalties Drawn, Giveaways, Takeaways, Hits, Hits Taken, Shots Blocked and
  Faceoffs Won / Lost / %. The first cell is a row number.
- **IDs:** each row links to the player's report (`playerreport.php?...&playerid=8470613`), so rows are keyed by NHL
  player ID with no name matching. A traded skater is one row (`CAR, COL`).
- **Response:** columns sorted by player ID: `playerId`, `gamesPlayed`, `timeOnIce` (seconds), `expectedGoals` (ixG),
  `highDangerAttempts` (iHDCF), `rushAttempts`, `reboundsCreated` and `hitsTaken`, about 25 KB
  for 789 skaters. A "-" is null. Its TOI matched the stats API's to the second
  (McDavid's 36979). 404 when NST has no skaters yet, 503 when it can't be asked.
- **On-ice page:** one `<table id=players>`: Player, Team, Position, GP, TOI, then the on-ice for, against and %
  of CF, FF, SF, GF, xGF, SCF, HDCF, HDGF, MDCF, MDGF, LDCF and LDGF, on-ice SH%, SV%, PDO, and zone starts and
  faceoffs. The endpoint reads TOI, xGF and xGA into `onIceTimeOnIce` (seconds), `onIceExpectedGoalsFor` and
  `onIceExpectedGoalsAgainst`, joined to the individual rows by player ID on every request, so an on-ice page that
  failed once isn't left out for the individual page's hour. Without it those columns are null, and the traits card's
  Defense goes without xGA. McDavid on 2026-11-24: 26,139 seconds at 5v5, 21.21 xGF and 16.62 xGA, as on NST.
- **Not used yet:** goalies (`pos=G&stdoi=g`, unverified;
  see the open items).

### Live games

NST updates a game's page while it's played, a few minutes behind. Captured on 2026-10-20 (LAK @ WSH, game
2026020144): at the 1st intermission NST had the whole period, and 3:04 into the 2nd it was at 0:12 of it, about 3
minutes of game time behind. An earlier capture (2026020121, 2026-10-17) had NST at about 19:12 of the 1st while the
NHL was 1:16 into the 2nd. The heading's `<h2>` shows the date, NST's score and where it is: "19:48 Per. 2" (time
left), "Per. 1 End", then "Final" (or "Final OT"). The team table's total line is labelled "Final" even live, so it
can't tell a live game apart.

- **How far it goes:** the parser reads the team table's last period with time played and its `TOI` into `period`
  and `timeInPeriod` (`2` and `"0:12"`; a finished period is `"20:00"`). The game stats card's credit says so,
  like "Expected goals and Corsi from Natural Stat Trick, through 2nd 0:12" or "through the 1st"
  (`NstStatsUtils.getProgressLabel`), until NST marks the game final.
- **Shots:** a play-by-play shot later than that has no NST shot yet and is marked pending (`NstStatsUtils.isPending`)
  rather than "-". A shot at or before it that NST doesn't list is a "-" as for a finished game.
- **Refreshing:** the game page asks for NST's stats when a live game opens and every minute until NST marks the game
  final, also after the NHL calls it final; a game that ended stops being refreshed 6 hours after its start, so one NST
  never finishes isn't asked for forever. A failed refresh (or a 404) keeps the stats shown. The backend's 3 minute
  cache for a game that isn't final means most of those minutes are served from memory, and NST's page is fetched about
  20 times an hour per live game that's being watched.
- **Budget:** NST's pages cost the same live. With the standard pool full (1800) when the first game starts and 1800
  more an hour, a night of 16 games, each watched throughout, would take about 880 pages over 5 hours against about 1100
  available. Live games are kept 10 minutes instead of 3 once fewer than 900 standard tokens are left, which the
  tokens-remaining header tells, so a busy night slows down before it reaches the 5 minute pause, and another app
  using the same key (another environment) is counted too.
- **The player dialog** gets a skater's NST stats when it opens, so they're as of then. The goalie and the goal highlight
  dialog have none.

### Shot xG

Each skater's individual event maps (one per situation: `all`, `ev`, `5v5`, `5v4`, `4v5`) are images, but every event
on them has a tooltip in the page, after the map's image (`.../games/20252026/8475188-30414-eventmap-all.png`, named
after the skater's NHL ID) and before the next map's:

```html
<div class=popup style="left: 79.7%; top: 38.6%;"><span class=popupr><span>Shot&nbsp;-&nbsp;Snap,&nbsp;26&nbsp;ft<br>0.11&nbsp;xG<br>19:22&nbsp;Per.&nbsp;1<br>5&nbsp;on&nbsp;4</span></span></div>
```

The parser reads the `all` maps' `Goal`, `Shot` (on goal) and `Miss` tooltips into the response's `shots`: shooter,
period, time elapsed, type, distance in feet and xG (to two decimals). A goal adds an "Assisted by" line, and a type
can carry "Rebound" or the miss's reason ("Miss - Rebound, Slap, Wide Right, 33 ft"). Blocked shots (`Shot blocked`)
have no xG, and hits, giveaways and takeaways have tooltips too. A regular season or preseason game's shootout
attempts are listed as period 5 at 0:00, with xG, but they aren't in NST's team totals, so the parser drops them; a
playoff game's period 5 is its second overtime.

`ShotMapUtils.getShots` matches each play-by-play goal, shot on goal and missed shot to NST's by shooter, period, time
and type (`goal`, `shot`, `miss`), and pairs a shooter's shots in the same second by distance. With the missed shots
(the shot map card's "All"), the shots add up to all of NST's shots' xG, which is the team's xG apart from goalies'
shots. Checked on 13 games (2026-10-17) with 13 different home teams,
including 3 overtime and 2 shootout games, and `S.J`, `L.A` and `T.B`: all 1086 of NST's shots matched one of the
1089 unblocked shots outside the shootouts. The 3 left were 2 goalies' shots (an empty net goal and an empty net miss:
goalies have no event map) and a shot from 9ft behind the net. Each team's shots added up to its NST xG within
rounding, except the two teams whose goalie shot: NST's team totals count his shot (about 0.8 xG each). Two shooters
had two shots in the same second, paired by distance.

## Open items

- **NST for the season performance card:** a goalie's GSAx and high danger save % (`playerteams.php` with `pos=G` and
  `stdoi=g`, never fetched: save one page to scratch before parsing) aren't on the card. A skater's on-ice xGF% is in
  `/api/nst/players` now (the traits card's Defense uses its xGA), but not on the card.
- **A minimum ice time for the traits pool:** per 60 axes still put fourth-liners at the top of Defense and Physical.

- **Goalie season averages** run higher than skaters' (5.4 to 6.8 in 2025-26), so on the season average cut points
  about half of goalies with 20+ games are green. They may need their own scale (see [Rating colors](#rating-colors)).
- **Stats API rows for regular season games.** It has no preseason rows at all (`skater/summary` with `isGame=true`
  returns 0 rows for `gameId=2026010001` and for `seasonId=20262027 and gameTypeId=1`, but 36 for `2025021057`), so
  the player page's recent games stay empty for preseason games. Whether rows exist while a regular season game is
  in progress, and how soon after it ends, needs checking from **2026-09-29**.
- **An in-progress playoff series** has never been seen live: the next game date on series cards, unplayed games in
  the series dialog (they have no `seriesStatus`), whether the carousel lists a series before both teams are known,
  and how `playoff-bracket` lists a TBD series. Check during the 2027 playoffs.
- **Playoff leaders before any playoff game** are unverified. For a finished season each category has 5 entries, and
  the api-web `toi` leader value is in seconds.
- **A local Utah logo** (`NhlTeamLogoUtils` TODO).
- **Historical abbreviations** the team utils don't know (`ATL`, `PHX`, `HFD`, ...) get the fallback logo, and `UTA`
  maps to 68 even for Utah Hockey Club (59) seasons.
- **Team form across seasons** only fills in from one previous season and assumes the team kept its abbreviation, so
  a relocated team gets fewer games. The rows show no dates, so April games next to October games aren't marked.

# NHL APIs

Everything on the site comes from two public NHL APIs plus the player search host. All three are called through the
backend, so Angular only ever uses relative `/api/...` URLs.

| API | Host | Proxy | Used for |
|---|---|---|---|
| api-web | `api-web.nhle.com/v1` | `/api/nhl/<path>` | live, game, team, schedule, standings, playoff, draft and leader data |
| Stats API | `api.nhle.com/stats/rest/en` | `/api/nhl-stats/*` | per-season and per-game player stats, team season stats, hits and shots leaders, season dates, draft career stats |
| Player search | `search.d3.nhle.com` | `/api/nhl-search/player` | header search |

Reference: [Zmalski/NHL-API-Reference](https://github.com/Zmalski/NHL-API-Reference/blob/main/README.md). It documents
api-web well. For the stats API it lists endpoints and query parameters but not the report names, the `cayenneExp`
syntax or the response fields, so those are written down below (its WADL is at
`https://api.nhle.com/stats/rest/application.wadl?detail=true`). `search.d3.nhle.com` isn't in the reference at all.

## Which API for what

| Need | Source | Why |
|---|---|---|
| Player header, bio, headshot, draft, current team | api-web `player/{id}/landing` | The stats API's `players` report has only the name, position and current team, and returns at most 5 rows |
| Player season cards, career table, recent games | Stats API | The landing's `seasonTotals` mixes every league, splits a traded season into one row per team and has no hits; the api-web game log has no hits, blocks, faceoffs or saves by strength, so no HokMob rating |
| Leaderboards: points, goals, assists, TOI, SV%, GAA, wins | api-web `skater-stats-leaders`, `goalie-stats-leaders` | Headshots, logos and the NHL's own qualification rules |
| Leaderboards: hits, shots | Stats API | api-web has no such categories (`categories=hits` returns 400) |
| Team season stats (PP%, PK%, goals and shots per game) | Stats API `team/summary` | All 32 teams in one call, so league ranks come for free |
| Standings, schedules, team form, next game, live games | api-web | The stats API has no schedules, and whether it has rows during a live game is unverified |
| Playoff bracket and series | api-web `playoff-bracket`, `playoff-series/*` | Not in the stats API |
| Season dates (current season, playoff mode) | Stats API `season` and `game` | Every season, not just the current one |
| Team IDs, names, logos, colors | `NhlTeamUtils` and the logo and color utils | The stats API's `team` report has no logos or colors, and its `triCode` isn't unique (`UTA` is both Utah Hockey Club 59 and Utah Mammoth 68) |
| Player search | `search.d3.nhle.com` | Active filter, current team and up to 20 results; the stats API's `players` has none of that |

## What each page loads

| Page | Requests |
|---|---|
| Home | `score/{YYYY-MM-DD}` (scoreboard, polled every 10s), `standings/now`, `playoff-series/carousel/{season}` plus `playoff-bracket/{year}` for seed ranks, `/api/nhl-stats/seasons` |
| Game | `gamecenter/{id}/landing`, `/play-by-play`, `/boxscore`, `/right-rail`; `score/{gameDate}` for a playoff game's `seriesStatus` (only `score` has it); `club-schedule-season/{abbrev}/{season}` for team form; `player/{id}/landing` for the player dialog |
| Team | `standings/now` (division and conference), `club-schedule-season/{abbrev}/now` (schedule and form), `score/{date}` for the next game, `/api/nhl-stats/teams` |
| Player | `player/{id}/landing`, `/api/nhl-stats/player/{id}?position=skater` or `goalie` |
| Stats | `standings/now` (for the season ID), `skater-stats-leaders/{season}/{gameType}`, `goalie-stats-leaders/{season}/{gameType}`, `/api/nhl-stats/leaders` (hits and shots), `/api/nhl-stats/seasons` |
| Playoffs | `playoff-bracket/{year}`, `schedule/playoff-series/{season}/{letter}` for the series dialog, `/api/nhl-stats/seasons` |
| Standings | `standings/now` |
| Draft | `draft/picks/{year}/{round}` (or `draft/picks/now`), `/api/nhl-stats/draft?year=&round=` — see [`draft-page.md`](draft-page.md) |
| Header search | `/api/nhl-search/player?q=…`; teams come from `NhlTeamUtils`, with no request |

## api-web conventions

- **Localized names.** Most names are objects like `{ "default": "Jets", "fr": "…" }`. Read `.default`.
- **Team names differ per endpoint.** `score`: `homeTeam.name.default` is the common name only ("Jets").
  `landing` and `boxscore`: `placeName.default` plus `commonName.default`. `standings`: `teamName.default` is the
  full name, but rows have **no team ID**, only `teamAbbrev.default` (`NhlTeamUtils.getTeamIdByAbbrev`).
  `schedule/playoff-series`: series teams have `name` (common), game teams have `commonName` and `placeName`.
- **Game state.** `gameState` is `FUT`, `PRE`, `LIVE`, `CRIT`, `FINAL` or `OFF`; `gameScheduleState` is `OK`, `TBD`,
  `PPD`, `SUSP` or `CNCL`. Check with `NhlGameInfoUtils.isFutureGame` / `isLiveGame` / `isCompletedGame`.
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
  per game. `sort` takes a JSON array like `[{"property":"gameDate","direction":"DESC"}]`. `limit=-1` returns every
  row. URL-encode the spaces in `cayenneExp` as `%20`.
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

| Report | Fields used |
|---|---|
| `skater/summary` | `skaterFullName`, `positionCode`, `teamAbbrevs` / `teamAbbrev`, `gamesPlayed`, `goals`, `assists`, `points`, `plusMinus`, `ppGoals`, `ppPoints`, `shots`, `shootingPct`, `penaltyMinutes`, `faceoffWinPct` (`null` without faceoffs), `timeOnIcePerGame` |
| `skater/realtime` | `hits`, `blockedShots`, `takeaways`, `giveaways`, `missedShots` |
| `skater/faceoffwins` | `totalFaceoffWins`, `totalFaceoffLosses` (and by zone and strength) |
| `skater/scoringpergame` | `totalPrimaryAssists`, `totalSecondaryAssists` (the boxscore and `skater/summary` only have the total) |
| `skater/powerplay` | `ppAssists` (also `ppPrimaryAssists` / `ppSecondaryAssists`), `ppTimeOnIce` |
| `skater/bios`, `goalie/bios` | `playerId`, `draftYear`, `draftRound`, `draftOverall`; skater bios also have games, goals, assists and points |
| `goalie/summary` | `goalieFullName`, `teamAbbrevs` / `teamAbbrev`, `gamesPlayed`, `gamesStarted`, `wins`, `losses`, `otLosses`, `shutouts`, `shotsAgainst`, `saves`, `goalsAgainst`, `goalsAgainstAverage`, `savePct`, `timeOnIce` |
| `goalie/savesByStrength` | `evSaves`, `ppSaves`, `shSaves`, `evShotsAgainst`, `ppShotsAgainst`, `savePct` |
| `team/summary` | `teamId`, `teamFullName`, `powerPlayPct`, `penaltyKillPct`, `goalsForPerGame`, `goalsAgainstPerGame`, `shotsForPerGame`, `shotsAgainstPerGame`, `faceoffWinPct` |
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
| `player`, `roster`, `club-stats`, `skater-stats-leaders`, `goalie-stats-leaders` | 30 min |
| `draft` | 6 hours (picks only change during the draft) |
| anything else | 1 min |

`score/{date}` is special: a future day is kept for 30 minutes, and a past day of the current regular season is kept
with a 24-hour sliding expiration once it settles (1pm Eastern the day after it's played, which leaves time for stats
corrections, highlight clips and three stars). The client mirrors these rules for the home scoreboard's days
(`GameDayCacheUtils`, used by `NhlGameService`): a settled day is kept until the season changes, a future day for 30
minutes, and today, live games and unsettled days are always refetched.

`NhlStatsApiClient` and `NhlSearchApiClient` cache each upstream URL for 5 minutes. A stats endpoint that can't reach
upstream returns 502 rather than a partial answer.

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
  and the right-rail `powerPlay` stat counts the power play as soon as it starts (`"0/1"`).

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

## Open items

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

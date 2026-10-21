# NHL APIs

Everything on the site comes from two public NHL APIs plus the player search host, and a live or finished game's
expected goals and Corsi from Natural Stat Trick. All of them are called through the backend, so Angular only ever uses relative
`/api/...` URLs.

| API | Host | Proxy | Used for |
|---|---|---|---|
| api-web | `api-web.nhle.com/v1` | `/api/nhl/<path>` | live, game, team, schedule, standings, playoff, draft and leader data |
| Stats API | `api.nhle.com/stats/rest/en` | `/api/nhl-stats/*` | per-season and per-game player stats, team season stats, hits and shots leaders, season dates, draft career stats |
| Player search | `search.d3.nhle.com` | `/api/nhl-search/player` | header search |
| Natural Stat Trick | `data.naturalstattrick.com` | `/api/nst/game/{gameId}` | a live or finished game's expected goals (xG) and Corsi, for teams and skaters (see [Natural Stat Trick](#natural-stat-trick)) |

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
| A leaderboard's top 25 table: the related columns | Stats API, for the 25 leaders' IDs | The leaders only carry their own `value`; the order still comes from the leaderboard's source, so it matches the card |
| Team season stats (PP%, PK%, goals and shots per game) | Stats API `team/summary` | All 32 teams in one call, so league ranks come for free |
| Standings, schedules, team form, next game, live games | api-web | The stats API has no schedules, and whether it has rows during a live game is unverified |
| Playoff bracket and series | api-web `playoff-bracket`, `playoff-series/*` | Not in the stats API |
| Season dates (current season, playoff mode) | Stats API `season` and `game` | Every season, not just the current one |
| Team IDs, names, logos, colors | `NhlTeamUtils` and the logo and color utils | The stats API's `team` report has no logos or colors, and its `triCode` isn't unique (`UTA` is both Utah Hockey Club 59 and Utah Mammoth 68) |
| Player search | `search.d3.nhle.com` | Active filter, current team and up to 20 results; the stats API's `players` has none of that |
| Expected goals (xG), Corsi | Natural Stat Trick | Neither NHL API has them per game, and neither has xG |

## What each page loads

| Page | Requests |
|---|---|
| Home | `score/{YYYY-MM-DD}` (scoreboard, polled every 10s), `standings/now`, `playoff-series/carousel/{season}` plus `playoff-bracket/{year}` for seed ranks, `/api/nhl-stats/seasons` |
| Game | `gamecenter/{id}/landing`, `/play-by-play`, `/boxscore`, `/right-rail`; `score/{gameDate}` for a playoff game's `seriesStatus` (only `score` has it); `club-schedule-season/{abbrev}/{season}` for team form; `club-stats/{abbrev}/{season}/{gameType}` for a future game's season leaders (see [Season leaders](#season-leaders)); `player/{id}/landing` for the player dialog; `/api/nst/game/{id}` for a live or finished game's xG and Corsi (the game stats card, the shot maps and the player dialog) |
| Team | `standings/now` (division and conference), `club-schedule-season/{abbrev}/now` (schedule and form), `score/{date}` for the next game, `/api/nhl-stats/teams` |
| Player | `player/{id}/landing`, `/api/nhl-stats/player/{id}?position=skater` or `goalie` (a skater's recent games carry `totalFaceoffs`, `totalPrimaryAssists` / `totalSecondaryAssists`, `ppAssists` and `penaltiesDrawn` for the HokMob rating; a goalie's carry `goals` and `assists`, with no assist split) |
| Stats | `standings/now` (for the season ID), `skater-stats-leaders/{season}/{gameType}`, `goalie-stats-leaders/{season}/{gameType}`, `/api/nhl-stats/leaders` (hits and shots), `/api/nhl-stats/seasons` |
| Stats category (`/stats/{category}`, a card's top 25) | `standings/now`, the card's leaders with `limit=25` and only its category, then `/api/nhl-stats/season-players?season=&gameType=&position=skater` or `goalie` `&ids=` (the 25 IDs) for the other columns, `/api/nhl-stats/seasons`. The categories and their columns are in `StatCategoryUtils` |
| Playoffs | `playoff-bracket/{year}`, `schedule/playoff-series/{season}/{letter}` for the series dialog, `/api/nhl-stats/seasons` |
| Standings | `standings/now` |
| Draft | `draft/picks/{year}/{round}` (or `draft/picks/now`), `/api/nhl-stats/draft?year=&round=` — see [`draft-page.md`](draft-page.md) |
| Header search | `/api/nhl-search/player?q=…`; teams come from `NhlTeamUtils`, with no request |
| History | `assets/history/{season}-{gameType}.json`, a static file generated from the stats API (see [History data](#history-data)), with no NHL API request |

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
- **Some players' season rows:** `playerId in (...)` with the season and game type, e.g. a top 25's rows in one call
  per report (`/api/nhl-stats/season-players` takes at most 25 IDs). Rows come back in no particular order.

| Report | Fields used |
|---|---|
| `skater/summary` | `skaterFullName`, `positionCode`, `teamAbbrevs` / `teamAbbrev`, `gamesPlayed`, `goals`, `assists`, `points`, `pointsPerGame`, `plusMinus`, `ppGoals`, `ppPoints`, `gameWinningGoals`, `shots`, `shootingPct` (`null` without shots), `penaltyMinutes`, `faceoffWinPct` (`null` without faceoffs), `timeOnIcePerGame` |
| `skater/realtime` | `hits`, `blockedShots`, `takeaways`, `giveaways`, `missedShots` |
| `skater/faceoffwins` | `totalFaceoffWins`, `totalFaceoffLosses` (and by zone and strength) |
| `skater/scoringpergame` | `totalPrimaryAssists`, `totalSecondaryAssists` (the boxscore and `skater/summary` only have the total) |
| `skater/powerplay` | `ppAssists` (also `ppPrimaryAssists` / `ppSecondaryAssists`), `ppTimeOnIce` |
| `skater/penalties` | `penaltiesDrawn`. It matches a count of the play-by-play's `drawnByPlayerId`: fighting majors and coincidental minors count, and penalties with no drawer (too many men, misconducts) count for nobody |
| `skater/bios`, `goalie/bios` | `playerId`, `draftYear`, `draftRound`, `draftOverall`; skater bios also have games, goals, assists and points |
| `goalie/summary` | `goalieFullName`, `teamAbbrevs` / `teamAbbrev`, `gamesPlayed`, `gamesStarted`, `wins`, `losses`, `otLosses`, `shutouts`, `shotsAgainst`, `saves`, `goalsAgainst`, `goalsAgainstAverage`, `savePct`, `timeOnIce`, and the goalie's own `goals`, `assists` and `points` |
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

`NaturalStatTrickClient` keeps a game NST marks final with a 24-hour sliding expiration, and anything else (a game
in progress, or no stats yet) for 3 minutes, or 10 once the key's standard tokens are below half. See
[Natural Stat Trick](#natural-stat-trick) for why.

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
- **Star lineup:** the toggle swaps the skaters for each team's stars who have played for it, topped up by points
  (`NhlStarPlayerUtils.pickStarLine`). The goalie stays the wins leader.

## Shot maps

A live or finished game's shot map card (`ShotMapComponent`, on the shared `RinkComponent`) and the player game dialog's
shot map (`PlayerShotMapComponent`) plot the shots on goal and goals of the play-by-play, which the page already loads.
Missed and blocked shots aren't plotted. `ShotMapUtils.getShots` reads them.

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
  shot's `reason` (`wide-left`, `above-crossbar`, `hit-right-post`, ...). `shotType` is `wrist`, `snap`, `slap`,
  `backhand`, `tip-in`, `deflected`, `wrap-around`, `bat` or `poke` (`ShotMapUtils.getShotTypeLabel`). The shootout
  (period type `SO`) is left out.
- **Blocked shots,** if they're ever plotted: their coordinates are where the shot was blocked, not where it was taken,
  and `eventOwnerTeamId` is still the shooting team.
- **The team map** puts home's shots at the left end and away's at the right (standing up on phones, home's at the
  top). It lines the shots up with the drawn rink's goal lines and faceoff dots, since the rink is drawn 200.13ft long
  (`ShotMapComponent.getRinkPosition`). It starts on the last shot, a shot clicked on the rink shows its details,
  and a goal with a posted clip opens the goal highlight dialog.
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

The history page doesn't call the NHL APIs. A finished season's per game stat lines are preloaded into
`src/assets/history/{season}-{gameType}.json` (`20252026-2.json` is the 2025-26 regular season), which only the history
page loads (`SeasonHistoryService`), and they're rated in the browser with `StatsUtils.calculateSkaterGameRating` /
`calculateGoalieGameRating`, the same as the player page's recent games. The file holds the rating's inputs, not
ratings, so a formula change shows up on the history page without regenerating it.

- **Generating a season:** `npm run build-season-data -- 20252026 [gameType]` from `HokMob.App/ClientApp` (game type 2
  by default), once the season is over: it fails while any of its games isn't final. It takes about a minute. Add the
  new file's season to `SeasonHistoryService.seasons` for the page's picker. Nobody edits the file by hand.
- **Reports:** the per game rows (`isGame=true`) of the reports the player page's recent games merge: `skater/summary`,
  `skater/realtime`, `skater/faceoffwins`, `skater/scoringpergame`, `skater/powerplay` and `skater/penalties`, plus
  `skater/summaryshooting` for the 5v5 Corsi (`satFor`, `satAgainst`) and Fenwick (`usatFor`, `usatAgainst`) counts,
  which aren't rated yet (#120). Goalies: `goalie/summary` (`timeOnIce`, and `gamesStarted` and `wins` for the
  rating's win and shutout bonuses, since file version 2, and the goalie's own `goals` and `assists` since version 3)
  and `goalie/savesByStrength`. The `game` report gives each
  game's date, teams and score. The reports are merged by `playerId` + `gameId`.
- **The 10,000 row cap:** the stats API returns at most 10,000 rows per query, even with `limit=-1`, without an
  error, and `total` says 10,000 too. A regular season is about 47,000 skater game rows, so the skater reports are
  asked for per team (`seasonId=20252026 and gameTypeId=2 and teamId=<id>`, about 1,500 rows each). The goalies (2,768
  rows) fit in one query. The script fails when a response has 10,000 rows or more.
- **Rate limit:** the stats API answers 429 to a few dozen requests at once, so the script sends two at a time and
  waits on a 429.
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

`ShotMapUtils.getShots` matches each play-by-play goal and shot on goal to NST's by shooter, period, time and type, and
pairs a shooter's shots in the same second by distance. Checked on 13 games (2026-10-17) with 13 different home teams,
including 3 overtime and 2 shootout games, and `S.J`, `L.A` and `T.B`: all 1086 of NST's shots matched one of the
1089 unblocked shots outside the shootouts. The 3 left were 2 goalies' shots (an empty net goal and an empty net miss:
goalies have no event map) and a shot from 9ft behind the net. Each team's shots added up to its NST xG within
rounding, except the two teams whose goalie shot: NST's team totals count his shot (about 0.8 xG each). Two shooters
had two shots in the same second, paired by distance.

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

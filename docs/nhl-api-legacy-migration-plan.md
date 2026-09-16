# NHL API Migration Plan, Part 2: Remaining Legacy APIs

Status: **Done** (planned 2026-09-15, phases 9–12 built 2026-09-15, 13–15 built 2026-09-16). Phases 9–15 continue
[`nhl-api-migration-plan.md`](nhl-api-migration-plan.md). Phases 0–8 in that plan migrated the home and game pages.
Scope: every remaining caller of a dead API: the team page, player page, stats page, header search and playoffs page.
Then the old services and models get deleted.

The first plan still applies: its endpoint conventions (section 6), testing requirements (section 7), decisions and
live game checklist (section 10). This plan only adds what's new. The decisions in section 12 were made on
2026-09-15.

**References** ([Zmalski/NHL-API-Reference](https://github.com/Zmalski/NHL-API-Reference/blob/main/README.md)):
- [api-web.nhle.com](https://github.com/Zmalski/NHL-API-Reference#nhl-web-api-documentation): the API the site
  uses so far ("api-web").
- [api.nhle.com/stats/rest](https://github.com/Zmalski/NHL-API-Reference#nhl-stats-api-documentation): the stats
  API ("stats API"). The reference lists its endpoints and query parameters, but not the report names, the
  `cayenneExp` syntax or the response fields. Section 2.2 records what was verified, and the stats API's WADL is at
  `https://api.nhle.com/stats/rest/application.wadl?detail=true`.

Section 3 compares the two APIs for each need of the remaining pages.

## 1. What was broken (2026-09-15, all fixed)

| Page / feature | Components | Dead calls | What the user sees |
|---|---|---|---|
| Team `/team/:id` | `TeamComponent`, `TeamNextGameComponent`, `SingleTeamFormComponent`, `TeamScheduleComponent` | `NhlStatsService.getNhlTeamStats` (`statsapi /teams?teamId=…&hydrate=previousSchedule,record,roster…`), `NhlGameService.getTeamGames` ×2, `getNhlGame`, `getNhlGameLiveFeed` | Blank page (`*ngIf="teamData"` never passes) |
| Player `/player/:id` | `PlayerComponent`, `PlayerBioComponent`, `PlayerStatsComponent`, `PlayerCareerComponent`, `RecentPlayerGamesComponent` | `NhlStatsService.getNhlPlayerStats` (`statsapi /people/{id}?expand=person.stats…`), `NhlGameService.getTeamGames`, `NhlImageService.getNhlPlayerHeadshot` | Blank page |
| Stats `/stats` | `StatsComponent`, `StatLeaderboardComponent` | `NhlStatsService.getNhlStats` (all 32 rosters with hydrated stats), `NhlImageService.getNhlPlayerHeadshot` | Loading spinner forever (the promise has no `.catch()`, so `isLoading` never clears) |
| Header search (every page) | `SearchInputComponent`, `SearchResultComponent` | `NhlSearchService.getNhlTeams` / `getNhlPlayers` (`statsapi /teams`), `NhlImageService` | No results; two failing requests and console errors on every page load |
| Playoffs `/playoffs` | `PlayoffsComponent` (+ migrated `app-playoff-series`) | None, but it hard-codes season `20222023` and uses the carousel, which only lists series whose teams are known | An old bracket; empty slots for later rounds |
| (unused) | `BetaNhlStatsService`, `NhlStatTypeEnum` | Stats API `leaders/…` called straight from the browser (blocked by CORS, see 2.2), hard-coded `20222023` | Nothing (no component injects it) |

Old code that only exists for these pages: `NhlStatsService`, `NhlSearchService`, `NhlImageService`, the dead
methods in `NhlGameService` (`getTeamGames`, `getNhlGame`, `getNhlGameLiveFeed`), `StatsUtils`
`calculatePlayerHokmobRating` / `calculatePlayerGoalieHokMobRating` / `sortByField` / `sortByTimeField`, and the model
folders `nhl-boxscore`, `nhl-general`, `nhl-linescore`, `nhl-live-feed`, `nhl-playoffs`, `nhl-schedule`, `nhl-stats`.
`NhlTeamUtils` still returns `NhlTeamCustomModel` from `nhl-general`, and `SearchResultModel` still references
`NhlTeamModel`.

## 2. Key findings (checked with curl on 2026-09-15)

`statsapi.web.nhl.com` still doesn't resolve.

### 2.1 api-web
- **`player/{id}/landing`** covers the header and bio:
  - `firstName`, `lastName`, `headshot`, `position`, `sweaterNumber`, `heightInInches`, `weightInPounds`,
    `shootsCatches`, `birthDate`, `birthCountry`, `draftDetails`, `currentTeamId` / `currentTeamAbbrev` /
    `fullTeamName`, `isActive`, `featuredStats` (`season`, `regularSeason.subSeason` / `.career`), `careerTotals`,
    `last5Games`.
  - **No captain, alternate captain or rookie flags** (the old bio grid showed them).
  - Its `seasonTotals[]` has one row per season, league, game type and team. **Rows have no team ID or
    abbreviation**, only `teamName.default`. They include every league (`NHL`, `AHL`, `OHL`, `WC-A`, `OG`, ...) and
    have **no hits**. The stats API's season rows are better for the season cards and career table (3).
- **`player/{id}/game-log/{season}/{gameType}`** (or `/now`): skater rows have goals, assists, points, plusMinus,
  power-play and shorthanded goals, shots, shifts, pim and toi; goalie rows have decision, shotsAgainst,
  goalsAgainst, savePctg and toi.
  - **Not included:** scores, hits, blocks, faceoffs, or even-strength / power-play saves. The HokMob rating can't be
    computed from it, so the page doesn't use it (3).
- **Leaders:** `skater-stats-leaders/{season}/{gameType}` (or `current`, which redirects to `20252026/2`) returns
  `goals`, `assists`, `points`, `plusMinus`, `goalsPp`, `goalsSh`, `penaltyMins`, `faceoffLeaders` and `toi`.
  `goalie-stats-leaders` returns `wins`, `shutouts`, `savePctg` and `goalsAgainstAverage`.
  - Entries: `id`, `firstName`, `lastName`, `sweaterNumber`, `headshot`, `teamAbbrev`, `teamName` (**common name**),
    `teamLogo`, `position`, `value`.
  - `?categories=points,goals&limit=5` narrows the response. The NHL applies its own qualification rules, so the old
    minimum-saves filter goes away.
  - **There are no hits or shots leaderboards:** `categories=hits` returns 400.
- **Team data:**
  - A `standings/now` row has `teamName`, `placeName`, `divisionName`, `conferenceName` and `teamAbbrev`.
  - `club-schedule-season/{abbrev}/now` is already used. On 2026-09-15 it has 88 `FUT` games.
  - `scoreboard/{abbrev}/now` lists the next ~8 game dates; its games have no `clock` in the off-season sample.
  - `roster/{abbrev}/current` and `club-stats/{abbrev}/now` exist if the team page grows a roster or team leaders.
- **Playoffs:**
  - `playoff-bracket/2023` returns all 15 series with teams, wins, ranks and winners.
  - `playoff-bracket/2027` returns `series: []`, and `playoff-series/carousel/20262027/` returns **HTTP 500** until
    the playoffs start.
  - How the bracket lists a series whose teams aren't known yet is unverified.
  - **Coverage by year:** brackets go back to at least 1943, which has only 3 series (A, B, I).
    - 1980, 1990, 2000, 2006, 2013, 2014, 2021, 2022 and 2026 all have 15 series: A–H in round 1, I–L in round 2,
      M/N in round 3, O in the final.
    - Titles and seeds change by era: "Preliminary Round" with league seeds (`L1`–`L16`) in 1980, "Division
      Semifinals" in 1990, "Conference Quarterfinals" with `C1`–`C8` from 2000 to 2013, and "1st Round" with `D1` /
      `WC1` from 2014.
    - 2020 adds 8 "Stanley Cup Qualifiers" series (S–Z, `playoffRound` 0). 2021 has no `conferenceAbbrev`, and its
      round 3 is "Stanley Cup Semifinals".

### 2.2 Stats API (`https://api.nhle.com/stats/rest/en/`)
- **CORS:** it sends no `Access-Control-Allow-Origin` header, so every call goes through the backend (5.1).
  `BetaNhlStatsService` could never have worked from the browser.
- **Response shape:** `{ data: [...], total }`. A bad query returns `{ message }` (e.g. `Invalid path 'active' for
  'Player'`). Names are plain strings (not `.default` objects), percentages are 0–1, times are in seconds, and rows
  have no headshots or logos.
- **Query parameters** (from the reference, verified where noted):
  - `cayenneExp`: the filter, required for skater and goalie reports. Verified: `and`, `=`, `>=`, `in (a,b)`,
    `likeIgnoreCase "mac%"`.
  - `isAggregate`: `true` sums everything into one row (`seasonId: null`). With `false`, you get one row per season,
    or per game with `isGame=true`.
  - `sort`: a JSON array like `[{"property":"gameDate","direction":"DESC"},{"property":"gameId","direction":"DESC"}]`,
    or a field name with `dir`.
  - `start` and `limit`: `-1` returns all rows. `players` returns at most 5 rows whatever the limit.
- **Per-season reports** (`isAggregate=false&isGame=false`, `cayenneExp=playerId={id} and gameTypeId={2|3}`):
  - They list **NHL seasons only**: Ovechkin (8471214) has 21 rows.
  - Each row has `teamAbbrevs`. A traded season is **one combined row**: Lindholm (8477496) 2023-24 is
    `"CGY,VAN"`, 75 GP, 44 P.
  - Rows have no `gameTypeId`, so query regular season and playoffs separately.
- **Per-game reports** (`isAggregate=false&isGame=true`, sorted by `gameDate` then `gameId` descending, `limit=10`,
  `cayenneExp=playerId={id} and seasonId>={season}`):
  - One row per game, newest first. Without a `gameTypeId` filter, regular season and playoff games are mixed
    (Barbashev 8477964: the 2026 Cup Final games come first). Across seasons, `seasonId>=` works.
  - Rows have `gameId`, `gameDate`, `teamAbbrev`, `opponentTeamAbbrev` and `homeRoad`, but no `gameTypeId` (read it
    from the game ID: `2025030414` → `03`) and no score.
  - For Barbashev in `2025030414`, `summary` + `realtime` match the boxscore fixture's `hits`, `blockedShots`,
    `takeaways`, `giveaways`, `sog`, `pim`, `plusMinus`, `goals`, `assists` and `powerPlayGoals`.
- **Reports and their fields** (the same fields per season and per game):

  | Report | Fields used |
  |---|---|
  | `skater/summary` | `skaterFullName`, `positionCode`, `teamAbbrevs` / `teamAbbrev`, `gamesPlayed`, `goals`, `assists`, `points`, `plusMinus`, `ppGoals`, `ppPoints`, `shots`, `shootingPct`, `penaltyMinutes`, `faceoffWinPct` (`null` for no faceoffs), `timeOnIcePerGame` |
  | `skater/realtime` | `hits`, `blockedShots`, `takeaways`, `giveaways`, `missedShots` |
  | `skater/faceoffwins` | `totalFaceoffWins`, `totalFaceoffLosses` (and by zone and strength) |
  | `skater/powerplay` | `ppAssists`, `ppTimeOnIce` |
  | `goalie/summary` | `goalieFullName`, `teamAbbrevs` / `teamAbbrev`, `gamesPlayed`, `gamesStarted`, `wins`, `losses`, `otLosses`, `shutouts`, `shotsAgainst`, `saves`, `goalsAgainst`, `goalsAgainstAverage`, `savePct`, `timeOnIce` |
  | `goalie/savesByStrength` | `evSaves`, `ppSaves`, `shSaves`, `evShotsAgainst`, `ppShotsAgainst`, `savePct` (no `timeOnIce`) |
  | `team/summary` | `teamId`, `teamFullName`, `powerPlayPct`, `penaltyKillPct`, `goalsForPerGame`, `goalsAgainstPerGame`, `shotsForPerGame`, `shotsAgainstPerGame`, `faceoffWinPct` |

- **Aggregate leaderboards:** any report sorted by a field works, like `skater/realtime` sorted by `hits` with
  `cayenneExp=seasonId=20252026 and gameTypeId=2` (Trenin, 413).
- **Other endpoints:**
  - `game?cayenneExp=id in (2025030414,2025030415)` returns `homeTeamId`, `visitingTeamId`, `homeScore`,
    `visitingScore`, `gameStateId` (7 for the finished games checked), `gameType` and `easternStartTime`: the scores
    for a list of games in one request.
  - `season` lists every season with `formattedSeasonId`, `preseasonStartdate`, `startDate`, `regularSeasonEndDate`,
    `endDate` and `numberOfGames`. 20262027: preseason 2026-09-19, regular season 2026-09-29, ends 2027-06-10.
  - `team` lists 62 teams, including historical ones (Atlanta Thrashers 11, Phoenix Coyotes 27, Hartford Whalers
    34). **`triCode` isn't unique:** `UTA` is both Utah Hockey Club (59) and Utah Mammoth (68).
  - `franchise` lists 40 franchises.
  - `players`: searchable (`lastName likeIgnoreCase "mac%"`), but capped at 5 rows, without an active flag, and
    mostly retired players.
  - Documented but not checked: `shiftcharts?cayenneExp=gameId={id}`, `leaders/skaters/{attribute}`, `milestones/*`,
    `draft`, `glossary`.

### 2.3 Search host
`search.d3.nhle.com/api/v1/search/player?culture=en-us&limit={n}&q={query}&active=true` returns players only (the
`team` search returns nothing). Results have `playerId`, `name`, `positionCode`, `teamId`, `teamAbbrev`,
`lastTeamAbbrev`, `lastSeasonId`, `sweaterNumber` and `active`. It isn't in the reference. It allows CORS (`*`),
but the convention is still relative URLs through the backend (decision 1).

### 2.4 Season boundaries
- api-web `schedule/2026-09-15` and the stats API `season` agree: preseason 2026-09-19, regular season
  2026-09-29, regular season end 2027-04-10, playoffs end 2027-06-10. `scoreboard/BOS/now` already lists preseason
  game `2026010013` on 2026-09-20. **Live games start around 2026-09-19**, not 2026-09-29 as the first plan says
  (2026-09-29 is the regular season start).
- `DateTimeUtils.getCurrentNhlSeason()` switched seasons on October 10, so it returned `20252026` for the first games
  of 2026-27. Migrated pages take the season from responses instead (decision 6). Since 11.1 it works from season
  dates.

## 3. Which API for what

| Need | api-web | Stats API | Use |
|---|---|---|---|
| Player header, bio, headshot, draft, current team | `player/{id}/landing` has all of it | `players` has only the name, position and current team ID | **api-web** |
| Player season cards | `seasonTotals`: all leagues mixed, one row per team (sum them yourself), no hits | Per-season `summary` + `realtime`: NHL only, a traded season already combined, hits and blocks | **Stats API** |
| Player career table | `seasonTotals`: team name only, so logos need name matching | Per-season rows with `teamAbbrevs` | **Stats API** |
| Player recent games with ratings | Game log: no hits, blocks, faceoffs, saves by strength or scores; boxscores would take 10 requests | Per-game `summary` + `realtime` (skaters) or `summary` + `savesByStrength` (goalies), plus `game` for scores | **Stats API** (decision 2) |
| Leaderboards: points, goals, assists, TOI, SV%, GAA, wins | Leaders with headshots, logos and the NHL's qualification rules | Sortable reports without headshots or logos; goalie qualification would be ours | **api-web** |
| Leaderboards: hits, shots | Not available (400) | `realtime` sorted by `hits`, `summary` sorted by `shots` | **Stats API** (decision 3) |
| Player search | (`search.d3.nhle.com`: active filter, current team, up to 20 results) | `players`: 5 results, no active filter | **search.d3** |
| Team list (IDs, names, abbreviations) | None (`NhlTeamUtils` is hard-coded) | `team`, historical teams included, but `triCode` isn't unique and there are no logos or colors | **Keep `NhlTeamUtils`** |
| Team standings, schedule, form, next game | `standings`, `club-schedule-season`, `score` | No schedules | **api-web** |
| Team season stats (PP%, PK%, GF/GA and shots per game); not on the old page | `standings` has GF/GA totals only | `team/summary`: all 32 teams in one call, so league ranks too | **Stats API** (decision 9, phase 10) |
| Playoff bracket | `playoff-bracket` | None | **api-web** |
| Season dates (`isPlayoffMode` follow-up) | `schedule/{date}`: the current season only | `season`: every season | **Either**. api-web needs no second client; the stats API also serves a season picker |
| Live game data | gamecenter | Unverified whether per-game rows exist during a game | **api-web** |
| Rating approach B inputs (first plan, decision 1) | Derived from play-by-play `faceoff` and `goal` plays | Per game: `faceoffwins` counts, `powerplay` `ppAssists` | **Stats API for finished games** (player page); play-by-play is still needed for live games on the game page |

## 4. Endpoint mapping

| Feature | Old (dead) | New |
|---|---|---|
| Team header, division | `statsapi /teams?teamId={id}&hydrate=…` | `NhlTeamUtils.getTeam(id)` (name, abbrev), logo/color utils, and `divisionName` / `conferenceName` from the `standings/now` row |
| Team form, schedule, next game | `statsapi /schedule?teamId&startDate&endDate` ×2, `/schedule?gamePk`, `/game/{id}/feed/live` | One `club-schedule-season/{abbrev}/now` (+ `previousSeason` fill-in for the form); `score/{gameDate}` for a live or today's next game |
| Team stats card (new) | none | `/api/nhl-stats/teams?season={season}&gameType=2` → stats API `team/summary` for all teams (decision 9) |
| Player header, bio | `statsapi /people/{id}?expand=person.stats` | api-web `player/{id}/landing` |
| Player season cards, career, recent games | `stats=yearByYear,yearByYearPlayoffs,gameLog,playoffGameLog` + team `/schedule` for scores | `/api/nhl-stats/player/{id}?position=…`: one backend request over the stats API reports and `game` (5.1) |
| Headshots (player page, leaderboards, search) | `cms.nhl.bamgrid.com` blob + FileReader | `headshot` URL from the response, or `NhlPlayerHeadshotUtils.getHeadshotUrl`, with `showBlankHeadshot` |
| Stat leaderboards | `statsapi /teams?hydrate=roster(person(stats…))` (32 rosters), sorted on the client | api-web `skater-stats-leaders` + `goalie-stats-leaders`; hits and shots from `/api/nhl-stats/leaders` (decision 3) |
| Search: teams | `statsapi /teams` | No request: `NhlTeamUtils` active teams |
| Search: players | `statsapi /teams?hydrate=roster(person)` loaded up front | `/api/nhl-search/player?q=…` → `search.d3.nhle.com/api/v1/search/player` per query |
| Playoffs page bracket | carousel for hard-coded `20222023` | `playoff-bracket/{year}`: the latest with series by default, or the season picked (2013-14 on, `?season=`) |

## 5. Foundation (phase 9, done)

Built on 2026-09-15 as described below, with these notes:
- The backend caches each upstream stats API call for 5 minutes (keyed by its URL) instead of caching the composed
  responses. The browser still makes one request, and `leaders` and `teams` are shared by every visitor.
- `recentGames` asks for `seasonId>={previous season}`, with the current season worked out from the date (a season is
  named after the year it starts in, and its first games are in September). That's only a lower bound for the last 10
  games, so the September boundary being fuzzy doesn't matter.
- Only the merged responses the browser sees are committed as fixtures (`player-stats-*`, `leaders-hits-shots-*`,
  `team-stats-*`, captured from the running app). The raw per-report captures were used to verify them, but no spec
  reads them, so they aren't in the repo.
- Extra fixtures beyond the list below: `player-stats-8477496-skater` (Lindholm, for the traded season and the career
  table) and `player-stats-8483548-goalie` (Bussi, who won game 2025030414, so a goalie row can be compared with that
  boxscore).
- Verified while capturing: the api-web leaders' `toi` value is in seconds (1664.2568 for 27:44), so
  `StatsUtils.formatSeconds` formats it; playoff leaders have 5 entries per category for a finished playoffs; and the
  stats API's per game numbers match the `2025030414` boxscore exactly for a skater (Barbashev) and a goalie (Bussi),
  including saves by strength.

### 5.1 Backend
- **Search proxy:** `GET /api/nhl-search/player` → `https://search.d3.nhle.com/api/v1/search/player`.
  - Only forward the `q`, `limit`, `active` and `culture` query parameters. Cap `limit` at 20 and default `culture` to
    `en-us`.
  - Cache for 5 minutes, keyed by the normalized query.
- **Stats API client:** base URL `https://api.nhle.com/stats/rest/en/`. The backend builds every stats API query
  itself; it **never forwards a client `cayenneExp` or `sort`**, so the routes aren't an open proxy. Cache for 5
  minutes. A failed required upstream call returns 502.
  - **`GET /api/nhl-stats/player/{id}?position={skater|goalie}`** returns
    `{ regularSeasons, playoffSeasons, recentGames }`. All upstream calls run in parallel, except `game`, which
    needs the recent game IDs:

    | Part | Skater reports | Goalie reports | Query |
    |---|---|---|---|
    | `regularSeasons` | `summary` + `realtime`, joined by `seasonId` | `summary` | `isAggregate=false&isGame=false&limit=-1`, `playerId={id} and gameTypeId=2`, newest season first |
    | `playoffSeasons` | same | same | same with `gameTypeId=3` |
    | `recentGames` | `summary` + `realtime`, joined by `gameId` | `summary` + `savesByStrength`, joined by `gameId` | `isAggregate=false&isGame=true&limit=10`, `playerId={id} and seasonId>={previous season}`, sorted by `gameDate` then `gameId` descending |
    | scores in `recentGames` | `game?cayenneExp=id in ({the 10 game IDs})` | same | adds `homeTeamId`, `visitingTeamId`, `homeScore`, `visitingScore`, and `gameType` from the game ID |

    That's 7 upstream calls for a skater and 5 for a goalie, cached as one response. The browser makes 1 request.
    If `game` fails, the games come back without scores.
  - **`GET /api/nhl-stats/leaders?season={season}&gameType={2|3}&limit=5`** (decision 3) returns `{ hits, shots }`.
    `skater/realtime` sorted by `hits` and `skater/summary` sorted by `shots`, with
    `isAggregate=false&isGame=false` and `seasonId={season} and gameTypeId={gameType}`.
  - **`GET /api/nhl-stats/teams?season={season}&gameType={2|3}`** (decision 9) returns every team's `team/summary`
    row (`limit=-1`, `seasonId={season} and gameTypeId={gameType}`). That's one upstream call.
    - Verified: 20252026 game type 2 has 32 rows (Utah is 68), game type 3 has 16, and 20262027 has none until games
      are played. Arizona's last row is 20232024, team 53.
    - The client picks its team and computes the ranks, so all team pages share one cached response.
- Both hosts use named `HttpClient`s next to `NhlApiClient`, and new controllers (`NhlSearchController`,
  `NhlStatsController`) or new actions on `NhlController`. Keep its 502 handling.
- **Allowlist:** no new api-web roots are needed for phases 10–14. `player`, `club-schedule-season`, `standings`,
  `score`, `gamecenter`, `playoff-bracket`, `skater-stats-leaders` and `goalie-stats-leaders` are already allowed.

### 5.2 Models (`shared/models/`)
- `nhl-web-api/player-landing.model.ts`: add what phase 6 didn't type: `draftDetails`, `featuredStats`,
  `currentTeamId` / `currentTeamAbbrev` / `fullTeamName`, `isActive`, `sweaterNumber`, `heightInInches`,
  `shootsCatches`. `seasonTotals` isn't needed.
- `nhl-web-api/stats-leaders.model.ts`: `SkaterStatsLeaders`, `GoalieStatsLeaders` (category → `StatsLeader[]`).
- `nhl-web-api/player-search.model.ts`: `PlayerSearchResult`. Note the string IDs: `playerId` and `teamId` are strings.
- New folder `nhl-stats-api/` for the backend's stats API responses:
  - `PlayerStats` (`regularSeasons`, `playoffSeasons`, `recentGames`);
  - `SkaterSeasonStats` / `GoalieSeasonStats`;
  - `SkaterGameStats` / `GoalieGameStats`, with the score fields;
  - `HitsAndShotsLeaders`;
  - `TeamSeasonStats` (a `team/summary` row).

  Use the stats API field names (`skaterFullName`, `teamAbbrevs`, `savePct`, `timeOnIcePerGame` in seconds) so
  they're easy to compare with raw responses.
- **Move `NhlTeamCustomModel`** out of `models/nhl-general/` (e.g. `models/nhl-team.model.ts`, not extending the old
  `NhlTeamModel`, and drop the dead `link` field). The old folders can only be deleted after this.

### 5.3 Utils
- `NhlTeamUtils.getActiveTeamIds()`: all IDs except Arizona (53), for search and for validating `/team/:id`.
- `StatsUtils.formatSeconds(seconds)` → "m:ss" (or "mm:ss"), for stats API times and the leaders' `toi` if it's in
  seconds (check when capturing).
- `StatsUtils.toBoxscoreSkater(row)` / `toBoxscoreGoalie(row)`: map a stats API game row to the boxscore models, so
  `calculateSkaterHokmobRating` / `calculateGoalieHokMobRating` are reused (7.4).

### 5.4 Fixtures (`shared/testing/nhl-api-mocks/`)
Capture with curl, trimming item counts only.
- api-web:
  - `player-8476945-landing` (Hellebuyck, goalie) and a retired player's landing (checks a missing `currentTeamId`);
  - `skater-stats-leaders-20252026-2`, `-3`, `goalie-stats-leaders-20252026-2`, `-3`;
  - `playoff-bracket-2023` and `playoff-bracket-2027` (empty), plus `playoff-bracket-2020` (qualifiers) and
    `playoff-bracket-2021` (no conferences);
  - `club-schedule-season-bos-now` if it differs from the existing `-20262027`.
- Search: `search-player-mac`.
- Stats API, raw responses for the backend checks and the merged fixtures:
  - skater summary and realtime per season for Lindholm (8477496, the traded `CGY,VAN` row) and Scheifele (8476460);
  - skater summary and realtime per game for Barbashev (8477964; playoffs and regular season mixed, includes
    `2025030414` to compare with its boxscore);
  - goalie summary per season, and summary and savesByStrength per game, for Hellebuyck (8476945);
  - `game` for Barbashev's 10 game IDs;
  - realtime by hits and summary by shots for 20252026 game type 2;
  - `team/summary` for all teams, 20252026 game type 2, plus the empty 20262027 response.
- Merged responses as the backend returns them (`player-stats-8477964-skater`, `player-stats-8476945-goalie`,
  `leaders-hits-shots-20252026-2`), for the Angular specs. Build them from the raw captures, not by hand.

Add accessors to `nhl-api-mocks.ts`.

## 6. Team page (phase 10, done)

Built on 2026-09-15 as described below, with these notes:
- `NhlGameService.getTeamSchedule(abbrev)` loads `club-schedule-season/{abbrev}/now`, and `getTeamFormGames` now takes
  a `TeamFormReference` (season and time, with the game ID and type only when there is a game) and an already loaded
  schedule, so the team page's form costs no second request for the current season.
- The form leads up to the next game, so its game type decides whether preseason games count: during the preseason
  the form is preseason games, like the game page's.
- `NhlGameInfoUtils` gained `getUpcomingGames` and `toScoreGame`, which the schedule and next game share.
- The team stats card is `app-team-stats`, fed by `NhlStatsApiService.getTeamStats` (the new service for the
  `/api/nhl-stats/*` endpoints, which phases 11 and 12 extend).
- Checked in the browser: `/team/6` (BOS: Atlantic Division, Eastern Conference standings, 5 preseason games, the
  2025-26 first round as its form, and PP 9th, PK 24th, GF/G 10th, GA/G 14th, exactly as this section says),
  `/team/68` (UTA, Central Division), `/team/53` (Arizona: name only, empty form and schedule, no standings or stats
  card) and `/team/999` ("Team not found"). Only the header search's dead statsapi calls still log errors (phase 13).



One `club-schedule-season/{abbrev}/now` response feeds the form, the schedule and the next game. The old page made
five requests to the dead API.

| Section | Old | New |
|---|---|---|
| Route | `/team/:id` | Unchanged. `abbrev = NhlTeamUtils.getTeam(id).triCode`; an unknown ID shows "Team not found" |
| Header | `teamData.name`, `teamData.division.name` | `NhlTeamUtils.getTeam(id).name` right away; "<divisionName> Division" once standings load |
| Logo, color | `teamData.id` | Route ID |
| Conference standings | `getNhlStandings(BY_CONFERENCE)`, picked by `conference.id === 5` | Same call; pick the group whose title is the team's `conferenceName` + " Conference" (found by `teamAbbrev`) |
| Team form (`app-single-team-form`) | `getTeamGames(30 days ago, yesterday)`, last 5 game days | The service's team form logic, generalized to take a reference time instead of a landing: finished games before now, most recent first, filled in from `previousSeason`. Inputs `teamId` + `games: ClubScheduleGame[]`; no `$any` |
| Team schedule (`app-team-schedule`) | `getTeamGames(today, +30 days)`, next 5 game days | The same response: next 5 games that aren't completed, by `startTimeUTC`. Convert `ClubScheduleGame` → `ScoreGame` for `app-scorecard` (like the series dialog does), since the teams use `commonName`/`placeName` instead of `name` |
| Next / ongoing game (`app-team-next-game`) | `getNhlGame` + `getNhlGameLiveFeed` of the first future game | The first game that isn't completed. If it's live or today: `NhlGameService.getNhlGames(date)` → match by `id` for `clock`, `periodDescriptor` and `seriesStatus`; refresh every 10s while live. The input becomes a `ScoreGame`; labels use `PeriodUtils`, `NhlGameInfoUtils.isLiveGame/isFutureGame/isCompletedGame` and `getSeriesStatusShort` |

- Off-season (now): `now` is 20262027 with only `FUT` games, so the form fills in from 2025-26, the schedule shows the
  first preseason games, and "Next Game" is the first of them.
- Remove the TODOs and `$any` casts on all four components, and the unused `nhlLeagueId` / `NhlImageService`
  injections.
- **Team stats card** (new, decision 9), e.g. `app-team-stats`:
  - Data: `/api/nhl-stats/teams?season={standings seasonId}&gameType=2`. The season is the `standings/now`
    `seasonId` that the page already loads, so the off-season shows 2025-26.
  - Rows, each with its league rank ("9th"): Power Play % (`powerPlayPct`), Penalty Kill % (`penaltyKillPct`),
    Goals For / Game (`goalsForPerGame`), Goals Against / Game (`goalsAgainstPerGame`), Shots For / Game
    (`shotsForPerGame`), Shots Against / Game (`shotsAgainstPerGame`) and Faceoff % (`faceoffWinPct`). Percentages
    are × 100 with one decimal, per-game values have two decimals.
  - Ranks: 1 + the number of teams strictly better, so ties share a rank. Lower is better for goals and shots
    against. Checked for BOS in 2025-26: PP 9th, PK 24th, GF/G 10th, GA/G 14th.
  - Title: "<season> Team Stats". There's no card when the team has no row (the first days of a season before its
    first game, Arizona) or when the request fails.
- Test inputs: BOS (6), UTA (68), ARI (53, former team: check what `club-schedule-season/ARI/now` returns and show an
  empty state), 999 (unknown).

## 7. Player page (phase 11, done)

Built on 2026-09-15 as described below, with these notes:
- The landing comes from `NhlGameService.getPlayerLanding` (already there for the player game dialog), the stats from
  the new `NhlStatsApiService.getPlayerStats(playerId, isGoalie)`. The page ignores a response of a player it has
  navigated away from.
- Recent games take the player's side of the score from the row's own `homeRoad` instead of comparing `teamAbbrev`
  with `homeTeamId`, which is the same answer without a team lookup (so it also works for `ARI` and other
  abbreviations the utils don't know).
- `app-player-stats` lost its `player` input (the template never used it), `app-player-career` takes `seasons` and
  `app-recent-player-games` takes `games`. Both build their rows in `ngOnChanges`, so the `imagesLoaded` flags, the
  `@ViewChild` resets and the `FileReader` code are gone, along with the `NhlStatsService` / `NhlImageService`
  injections.
- The career season cell holds one 34px logo per team (26px at phone width), with the season label on one line. A
  traded season fits at 375px without horizontal scrolling.
- Checked in the browser: `/player/8477964` (Barbashev, playoff recent games and both season cards),
  `/player/8476460` (Scheifele, no playoff card because WPG missed the 2026 playoffs), `/player/8476945`
  (Hellebuyck: goalie cards, saves by strength ratings, "Catches", and no playoff card since his last playoffs was
  2024-25), `/player/8477496` (Lindholm, the 2023-24 `CGY,VAN` row with both logos) and `/player/8470638` (Bergeron:
  no team link or color, his 2022-23 cards, career, and no recent games). `/player/1` shows "This player couldn't be
  loaded" and makes no stats request. Only the header search's dead statsapi calls still log errors (phase 13).
- One fixture was added: `player-8477964-landing.json`, so a skater's landing and stats fixtures are the same player.

Two requests: api-web `player/{id}/landing` for the header and bio, then `/api/nhl-stats/player/{id}?position=…`
(`skater`, or `goalie` when the landing's `position` is `G`) for the season cards, career and recent games.
- A failed landing shows "This player couldn't be loaded".
- A failed stats request keeps the header and bio and shows "Stats couldn't be loaded" in place of the cards, career
  and recent games.
- A player without stats API rows (e.g. no NHL games yet) hides those sections.

### 7.1 Header and bio (api-web landing)
| Field | Old (`NhlPersonModel`) | New (`PlayerLanding`) |
|---|---|---|
| Name | `fullName` | `firstName.default + " " + lastName.default` |
| Team link, logo, color | `currentTeam.id` / `.name` | `currentTeamId` / `fullTeamName.default`; hide the link when missing (retired players) |
| Headshot | `NhlImageService` blob | `headshot` + `showBlankHeadshot` |
| Position | `primaryPosition.abbreviation` | `position` |
| Age | `currentAge` | From `birthDate` (reuse the player dialog's age helper) |
| Height | `height` ("6' 3\"") | `heightInInches` → `6' 3"` |
| Weight | `weight` | `weightInPounds` + " lb" |
| Shoots | `shootsCatches` | Same ("Catches" for goalies) |
| Country / flag | `birthCountry` | Same |
| Number | `primaryNumber` | `sweaterNumber` |
| Captain / rookie tile | `captain`, `alternateCaptain`, `rookie` | **Not in either API.** Replace with "Draft": "2011 R1 #7 (WPG)" or "Undrafted" (decision 4) |

### 7.2 Season cards (`app-player-stats`)
- Season: the landing's `featuredStats.season`, not `DateTimeUtils`, so the off-season shows 2025-26.
- Rows: the `regularSeasons` / `playoffSeasons` row with `seasonId === featuredStats.season`. No card without a row.
  A traded season is already one row, so nothing is summed on the client.

| Skater stat | Old | New (stats API row) |
|---|---|---|
| Goals / Assists / Points / +/- / Shots | same names | `goals` / `assists` / `points` / `plusMinus` / `shots` |
| Games | `games` | `gamesPlayed` |
| Faceoff % | `faceOffPct` (0–100) | `faceoffWinPct` × 100, "-" when `null` |
| Hits | `hits` | `hits` (from `realtime`) |

| Goalie stat | Old | New (stats API row) |
|---|---|---|
| Save % | `savePercentage` | `savePct` (the pipe already expects 0–1) |
| GAA | `goalAgainstAverage` | `goalsAgainstAverage` |
| Shutouts / Shots Against / Wins / Losses / Starts | same names | `shutouts` / `shotsAgainst` / `wins` / `losses` / `gamesStarted` |
| OT Losses | `ot` | `otLosses` |

### 7.3 Career table (`app-player-career`)
- Rows: `regularSeasons`, newest first, NHL only (the stats API has no other leagues), one row per season.
- Logos: **one small logo per team** in `teamAbbrevs`, in the order given (`"CGY,VAN"` → CGY and VAN side by side).
  Each abbreviation goes through `NhlTeamUtils.getTeamIdByAbbrev` → `NhlTeamLogoUtils`, with the fallback logo for
  abbreviations the utils don't know (`ATL`, `PHX`, `HFD`, ...) (decision 5). The season cell needs room for 2–3
  logos, including at phone width.
- Skater columns: `gamesPlayed`, `goals`, `assists`, `points`. Goalie columns: `gamesPlayed`, `shutouts`,
  `goalsAgainstAverage`, `savePct`.
- Season label: `DateTimeUtils.getNhlSeasonDisplayValue(String(seasonId))`.

### 7.4 Recent games (`app-recent-player-games`)
| Field | Old | New (`recentGames` row) |
|---|---|---|
| Rows | `stats[3]` / `stats[4]` splits; up to 10 with playoffs first | As returned: the last 10 games, newest first, playoffs and regular season mixed |
| Date | `date` | `gameDate` |
| Game link | `game.gamePk` | `gameId` |
| Opponent / logo | `opponent.abbreviation` / `.id` | `opponentTeamAbbrev` → `NhlTeamUtils.getTeamIdByAbbrev` |
| Score | Team schedule by index (could mismatch, and missed games for a previous team) | `homeScore` / `visitingScore`, with the player's team first (`teamAbbrev` → ID vs `homeTeamId`); blank without scores |
| TOI | `timeOnIce` | `timeOnIcePerGame` (skaters) / `timeOnIce` (goalies), seconds → `StatsUtils.formatSeconds` |
| Goals / Assists / Shots / +/- | same names | `goals` / `assists` / `shots` / `plusMinus` |
| PIM | `pim` | `penaltyMinutes` |
| Hits | `hits` | `hits` |
| Goalie SV% / SA / GA | `savePercentage` / `shotsAgainst` / `goalsAgainst` | `savePct` / `shotsAgainst` / `goalsAgainst` |
| Goalie GAA | `goalsAgainst * 60 / Number("60:00".replace(":", "."))` (wrong for non-whole minutes) | `goalsAgainst * 3600 / timeOnIce` |
| Rating | `calculatePlayerHokmobRating(stat)` | `StatsUtils.toBoxscoreSkater(row)` → `calculateSkaterHokmobRating`, with `sog` ← `shots`, `pim` ← `penaltyMinutes`, `powerPlayGoals` ← `ppGoals`, `faceoffWinningPctg` ← `faceoffWinPct ?? 0`, `position` ← `positionCode`. Goalies: `toBoxscoreGoalie(row)` → `calculateGoalieHokMobRating`, with `evenStrengthShotsAgainst` ← `"{evSaves}/{evShotsAgainst}"` and `powerPlayShotsAgainst` ← `"{ppSaves}/{ppShotsAgainst}"`. Same formulas as the game page |

- The `imagesLoaded` flags, the `@ViewChild` resets in `PlayerComponent` and the `FileReader` code go away: logos and
  headshots are plain URLs now.

## 8. Stats page (phase 12, done)

Built on 2026-09-15 as described below, with these notes:
- The web API leaders are a new `NhlLeadersService` (`getSkaterLeaders` / `getGoalieLeaders`), and the hits and shots
  leaders are `NhlStatsApiService.getHitsAndShotsLeaders`, next to the other `/api/nhl-stats/*` methods.
- Both leader requests pass `categories` (`points,goals,assists,toi` and `savePctg,goalsAgainstAverage,wins`), which
  works for the goalie endpoint as well, so only the four and three categories shown come back.
- The season is read once from `standings/now`, so switching between the regular season and the playoffs reloads the
  three leader requests alone. `updateGameType` only sets the query parameter now: the page loads from the query
  parameter subscription, so a switch makes one set of requests instead of two as before.
- `app-stat-leaderboard` builds its rows in `ngOnChanges` from `LeaderboardEntry` (`playerId`, `name`, `teamId`,
  `headshot`, `value`) and a `format`. The `imagesLoaded` flags, the `@ViewChildren` reset and the `FileReader` code
  are gone. It shows up to 5 leaders, so a category with fewer (4 goalies had a playoff shutout in 2025-26) still
  renders.
- `savePctg` and `gaa` use the existing `SavePercentagePipe` / `GoalsAgainstAveragePipe`, and `toi` uses
  `StatsUtils.formatSeconds` (the value is in seconds).
- Checked in the browser: `/stats` in playoff mode (the 2025-26 playoff leaders, Marner 29 points, Barbashev 110
  hits), the Regular Season toggle (`?gameType=R`: McDavid 138 points, Trenin 413 hits, Hughes 27:44), one request
  per source and all 200, and a leader linking to `/player/8478402`. Only the header search's dead statsapi calls
  still log errors (phase 13).

Three requests replace downloading 32 hydrated rosters and sorting on the client:
- api-web `skater-stats-leaders/{season}/{gameType}?limit=5`;
- api-web `goalie-stats-leaders/{season}/{gameType}?limit=5`;
- `/api/nhl-stats/leaders?season={season}&gameType={gameType}&limit=5` for hits and shots (decision 3).

`season` is `standings/now` `seasonId` (already loaded and cached). `gameType` is 2 or 3, from the existing Playoffs /
Regular Season toggle.

| Leaderboard | Old field | New |
|---|---|---|
| Points / Goals / Assists | `points` / `goals` / `assists` | api-web `points` / `goals` / `assists` |
| Save Percentage | `savePercentage` (+ minimum saves) | api-web goalie `savePctg` (savePercentage pipe) |
| Goals Against Average | `goalAgainstAverage` | api-web goalie `goalsAgainstAverage` (2 decimals) |
| Wins | `wins` | api-web goalie `wins` |
| Time On Ice Per Game | `timeOnIcePerGame` ("22:15") | api-web `toi` (check the value's format) |
| Shots | `shots` | Stats API `shots` (decision 3) |
| Hits | `hits` | Stats API `hits` (decision 3) |

- `app-stat-leaderboard` takes a list of `LeaderboardEntry` (`playerId`, `name`, `teamId`, `headshot`, `value`) and
  a `format` (`number`, `savePctg`, `gaa`, `toi`). The stats component converts each source to entries:
  - api-web leaders: name from `firstName.default + " " + lastName.default`, team from `teamAbbrev` (the leader's
    `teamName` is the common name), headshot from `headshot`.
  - Stats API rows: name from `skaterFullName`, team from the last abbreviation in `teamAbbrevs`, headshot from
    `NhlPlayerHeadshotUtils.getHeadshotUrl(season, teamAbbrev, playerId)`.
  - Team name, color and logo come from the team ID (`NhlTeamUtils`).
- An empty category (like playoffs before they start) shows "No stats yet". A failed request clears the spinner and
  shows the empty state for its boards only.
- Delete `BetaNhlStatsService` and `NhlStatTypeEnum`. Nothing uses them.

## 9. Header search (phase 13, done)

Built on 2026-09-16 as described below, with these notes:
- `NhlSearchService` has `searchTeams(query)` (no request) and `searchPlayers(query, limit)`. Its old statsapi methods and
  the commented-out `suggest.svc` code are deleted, since `SearchResultModel` no longer has the old `team` field.
- `SearchResultModel` also lost `playerFirstName` / `playerLastName` (the search only has `name`, in `displayValue`).
  A player's `teamId` is `teamId`, or `lastTeamId` without one.
- The team matches take their share of the 10 first, and the player request asks for the rest (`limit=7` for "new",
  which matches three teams). No request is made while teams fill all 10.
- The search runs on the `input` event instead of `keyup`, so a paste or the search box's clear button also searches,
  and arrow keys in the result list don't. A failed player search keeps the team matches (the service logs once per
  request).
- A player result shows the position after the name. The headshot is cropped to a 30px circle, like the leaderboards,
  because the mugs have space around the player.
- Checked in the browser: "bos" (Boston Bruins, then the player Boston Buckberger, `limit=9`), "mac" (10 players,
  the blank headshot for Tomas Machu, Dylan MacKinnon and Mack Oliphant), "new" (3 teams, then Alex Newhook), a query
  without matches, and a click on a team result opening `/team/3`. The failed search is covered by the specs only.
  With this phase, no page load calls a dead API anymore.


| Result | Old | New |
|---|---|---|
| Teams | `statsapi /teams`, loaded on init | `NhlTeamUtils.getActiveTeamIds()` → `getTeam(id)`, no request; match on `name`, `shortName`, `teamName`, `triCode` |
| Players | Every roster loaded on init, filtered on the client | `NhlSearchService.searchPlayers(query)` → `/api/nhl-search/player?q={query}&limit=10&active=true` after the existing 500ms debounce, for 2+ characters |
| Player name / link | `person.fullName` / `player/{id}` | `name` / `player/{playerId}` |
| Player headshot | `NhlImageService` blob | `NhlPlayerHeadshotUtils.getHeadshotUrl(lastSeasonId, lastTeamAbbrev, playerId)` + `showBlankHeadshot` |
| Team logo / link | `NhlTeamLogoUtils` / `team/{id}` | Same |

- `SearchResultModel`: replace `team: NhlTeamModel` with `teamName`, and add `headshot` and `positionCode`. Drop the
  unused `playerActive` / `playerRookie`.
- Ignore late responses for an older query, and show teams first, then players, 10 total.
- A failed search logs once and shows only the team matches, not an error on every keystroke.
- Remove the TODOs on `SearchInputComponent` and `NhlSearchService`. The commented-out `suggest.svc` code goes away.
- Not the stats API `players`: it caps results at 5 and can't filter to active players (3).

## 10. Playoffs page (phase 14, done)

Built on 2026-09-16 as described below, with these notes:
- **The letters don't always match the tree.** Checked with every bracket from 2014 to 2026: in 2020 the second round
  was reseeded (I was fed by A and C, J by B and D, K by E and H, L by F and G), and in 2021 M was fed by K and L and
  N by I and J. So the template looks up series by *slot* (`slots['E']`), and the new
  `NhlPlayoffBracketUtils.arrangeSeries` fills the slots: each later round series gets the two earlier series that share
  a team with it (in letter order), and the conference final that leads back to series A is on the Eastern (right)
  side. Series whose teams aren't known yet fall back to their letter.
- The service has `getNhlPlayoffBracket(year)`, which returns a `PlayoffBracketSeason` (`year`, `season`, `series` of
  rounds 1–4, `hasQualifyingRound`), and `getLatestNhlPlayoffBracket(year)`, which falls back to the previous year once
  when the year has no series. `PlayoffCarouselSeries` gained an optional `conferenceName`; `seriesLink` is the
  bracket's `seriesUrl`.
- The default year is the end year of the current season (11.1), so from 2 weeks before the 2026-27 preseason
  `playoff-bracket/2027` is requested first and falls back to 2026. When the latest year falls back, it's dropped from the picker.
- Only the latest year falls back. An older season without series (not seen from 2014 on) shows "No playoff series
  yet", and a failed request shows "The playoff bracket couldn't be loaded".
- Labels: the conference finals and the final show their `seriesTitle` above the card ("Western Conference Finals",
  "Stanley Cup Semifinals" in 2021). The first two rounds have no labels, like before. The page title is
  "2025-26 Playoffs", and the picker's labels use the same short format.
- The picker is a native `<select>` (Material's select isn't in the app), with each option's `selected` bound, because
  `ngModel` didn't select an option rendered by `ngFor` reliably.
- `app-playoff-series` shows "TBD" for a missing team (also for an empty slot), loads no schedule and opens no dialog
  without both teams, and doesn't highlight on hover then.
- Checked in the browser: `/playoffs` (2025-26), every season in the picker from 2013-14 to 2025-26 (15 cards each, and
  every series winner appears in the series of the next round it feeds; 2019-20 shows the note; 2020-21 shows
  "Stanley Cup Semifinals"), `?season=abc` and `?season=20122013` (2025-26), the 2019-20 final's dialog, all requests 200
  with no console errors, and the 2020-21 tree at 375px without horizontal scrolling.


- **Default season:** `playoff-bracket/{end year of the current season}`. While its `series` is empty (before the
  playoffs, like 2027 today), load the previous year instead. The page title shows the season it's showing.
- **Season picker** (decision 7):
  - A dropdown of seasons from 2013-14 to the latest bracket with series, newest first, built locally from the years.
    No `season` request is needed.
  - The selection is a query parameter (`/playoffs?season=20222023`, like the stats page's `gameType`), so it survives
    a reload and can be shared. An invalid or out-of-range value falls back to the default.
  - Changing the season clears the bracket, shows the loading state and ignores late responses for the previous
    season.
- **2020:** show only rounds 1–4 (A–O). Series with `playoffRound` 0 (the S–Z qualifiers) are left out, with a note
  under the title: "2020 also had a qualifying round."
- **2021 (no conferences):** series have no `conferenceName`, and round 3 is "Stanley Cup Semifinals". Side and round
  labels come from the bracket (`seriesTitle`, `conferenceName` when present), never from fixed "East" / "West"
  text.
- **Service:** `NhlStandingAndPlayoffService.getNhlPlayoffBracket(year)` returns the bracket with its series converted
  to the existing card model, so `app-playoff-series` and the series dialog keep working:

  | `PlayoffCarouselSeries` | From `PlayoffBracketSeries` |
  |---|---|
  | `seriesLetter` / `roundNumber` / `seriesLabel` | `seriesLetter` / `playoffRound` / `seriesTitle` |
  | `topSeed.{id, abbrev, logo, darkLogo}` | `topSeedTeam.{id, abbrev, logo, darkLogo}` (undefined for TBD) |
  | `topSeed.wins` / `.rank` | `topSeedWins` / `topSeedRank` |
  | `bottomSeed.*` | `bottomSeedTeam`, `bottomSeedWins`, `bottomSeedRank` |
  | `neededToWin` | Not in the bracket: 4 |
  | `winningTeamId` / `losingTeamId` | same |

- **Template:** replace the `rounds[n]?.series[m]` index lookups with a lookup by letter (`series['E']`; built as a
  lookup by slot, see the notes above), using the facts from the first plan's 4.3: A–D East round 1, E–H West round 1, I/J East round 2, K/L West round 2, M East
  final, N West final, O Stanley Cup Final.
- **TBD series:** `app-playoff-series` must render a series without one or both seeds ("TBD", fallback logo, no
  dialog). The carousel never had these, so the component has never handled them.
- Remove the `PlayoffsComponent` TODO and the hard-coded `20222023`.
- Test inputs: 2023 (all finished), 2026 (existing fixture), 2027 (empty → falls back to 2026), 2020 (qualifiers
  hidden, note shown), 2021 (no conferences), `?season=20122013` and `?season=abc` (fall back to the default).

## 11. Cleanup (phase 15, done)

Built on 2026-09-16 as described below, with these notes:
- Already gone before this phase: the old half of `NhlSearchService` (phase 13) and every TODO pointing at a dead
  API (phases 10–14).
- `NhlImageService` was still injected, unused, by `ScoreboardComponent`, `ScorecardComponent` and
  `StandingsComponent`. The injections were removed with the service.
- The grep below used to say `models/nhl-(…|stats|…)` without a trailing `/`, which also matches the new
  `models/nhl-stats-api/`. It now ends in `/` and returns nothing. `NhlPlayerHeadshotUtils`' comment no longer names
  the old headshot host.
- Also deleted `StatsUtils.getPlayerLastName`, which had no callers.
- No spec tested the deleted code, so none were removed. `test:ci`: 526 specs pass; production `ng build` passes.
- The TODOs left are the live checks (`game`, `game-header` power play, `period-utils`, `nhl-game-info-utils`,
  `nhl-api-mocks`), rating approach B (`stats-utils`) and the Utah logo (`nhl-team-logo-utils`).
- The placeholder specs left are `about`, `footer`, `header`, `home` and `navigation-menu`, plus the CLI's
  `app` spec.
- Checked in the browser: `/`, `/game/2025030414`, `/team/6`, `/player/8476460`, `/player/8476945`,
  `/player/8477496`, `/stats`, `/playoffs`, `/standings` and a search for "mac": no console errors, 28 `/api/nhl*`
  responses all 200, no request to an `nhl.com` host.

### 11.1 Season dates (after phase 15, 2026-09-16)

`DateTimeUtils.getCurrentNhlSeason()` (October 10) and `isPlayoffMode()` (May 21 to September 30) were calendar
rules. They now work from season dates:
- **Backend:** `/api/nhl-stats/seasons` returns `{ seasons: [{ id, firstGameDate, firstPlayoffGameDate }] }` for the
  two latest seasons of the stats API `season` report, newest first (the newest can be listed before its games are
  scheduled). The dates come from the `game` report sorted by `gameDate` with `limit=1`: `gameType in (1,2)` (the
  first preseason game, or the first regular season game without a preseason, like 2020-21) and `gameType=3`. A
  date is null while no such game is scheduled. 5 upstream calls, cached 5 minutes; any failure is a 502, because a
  missing date would look like a season that hasn't started.
- **Rules** (`DateTimeUtils`, local days):
  - The current season is the newest one whose first game is at most 14 days away or played. Otherwise the oldest
    listed.
  - Playoff mode runs from 2 days before the current season's first playoff game until the next season starts.
  - With the capture of 2026-09-16 (2026-27 first game 2026-09-19; 2025-26 first playoff game 2026-04-18): 2026-27
    started on 2026-09-05, and 2025-26 playoff mode ran from 2026-04-16 to 2026-09-04.
- **Client:** `NhlStatsApiService.getSeasonDates()` shares one request for an hour (a failed one isn't reused), and
  `getCurrentSeason()` resolves `{ season, isPlayoffMode }` for today.
  - Home shows neither summary until it's known, and the standings summary when it fails.
  - The playoff summary takes the current season; the series dialog uses it when no season is passed.
  - `/stats` waits for playoff mode before loading, and falls back to the regular season without filters.
  - `/playoffs` waits for the latest year, and falls back to the calendar year, which the latest bracket with
    series always ends in or before.
- Tests: `date-time-utils` (new: boundaries on both sides, unscheduled dates, no seasons), the service (URL, shared
  and expiring request, today's season from the fixture, failures), fixture `seasons-2026-09-16`, and the `home`
  (was a placeholder), `playoff-summary`, `playoffs`, `stats` and `playoff-series-dialog` specs (waiting and
  failures). 554 specs pass.
- Checked in the browser on 2026-09-16: one `/api/nhl-stats/seasons` request per page load, home shows the standings
  summary, `/stats` the regular season without filters, `/playoffs` falls back from 2027 to 2025-26, no console
  errors. Playoff mode itself was only checked in unit tests.

The plan:

- Delete:
  - `NhlStatsService` and `NhlImageService` (and their providers in `AppModule` and `AppTestingModule`);
  - the old half of `NhlSearchService`;
  - `NhlGameService.getTeamGames` / `getNhlGame` / `getNhlGameLiveFeed` and their constants;
  - the old `StatsUtils` methods (`calculatePlayerHokmobRating`, `calculatePlayerGoalieHokMobRating`, `sortByField`,
    `sortByTimeField`);
  - all old model folders.
- `grep -r "statsapi\|bamgrid\|suggest.svc\|models/nhl-\(general\|stats\|schedule\|live-feed\|linescore\|boxscore\|playoffs\)/" src`
  returns nothing. No Angular code calls `api.nhle.com` directly.
- No TODO points at a dead API. The TODOs left are the live checks (first plan, section 10), rating approach B and
  the Utah logo.
- Every placeholder "should create" spec for a migrated component is replaced. The ones left are `about`, `footer`,
  `header`, `navigation-menu`, `home` and `app`, which call no API.
- Browser check: every route (`/`, `/game/:id`, `/team/6`, `/player/8476460`, `/player/8476945`, `/player/8477496`,
  `/stats`, `/playoffs`, `/standings`) plus a search loads with no console errors and only 200 `/api/nhl*` responses.
- Docs:
  - Mark both plans done.
  - In `CLAUDE.md`, remove the "unmigrated pages are expected noise" note and the old-model mentions, and add the
    search and stats proxies to the layout.
  - In the first plan, fix "preseason starts 2026-09-29" to 2026-09-19 (the regular season starts 2026-09-29).

## 12. Decisions (made 2026-09-15)

1. **Search goes through the backend** (phase 9). **Decided 2026-09-15.** Rejected: calling
   `search.d3.nhle.com` directly from the browser, even though it allows CORS. It keeps one
   convention (relative URLs), lets the backend cache popular queries, and survives a CORS change. The route only
   forwards allowlisted query parameters. The stats API's `players` isn't an alternative (3).
2. **Player season cards, career and recent games come from the stats API, in one backend request (phase 11).**
   **Decided 2026-09-15: A.**
   - **A (chosen):** `/api/nhl-stats/player/{id}` (5.1).
     - The browser makes 1 request besides the landing. Upstream, that's 7 calls for a skater or 5 for a goalie,
       cached 5 minutes, whatever the number of games.
     - It gives hits on the season cards and in recent games, ratings with the game page's formulas, correct scores
       (also for games with a previous team), career logos from abbreviations, and traded seasons combined by the
       API.
     - Checked against a boxscore fixture (2.2).
   - **B:** api-web only. Landing `seasonTotals` for the cards and career (sum traded seasons, match logos by team
     name, no hits), game logs for recent games (no hits or ratings) and `club-schedule-season` for scores (missing
     for games with a previous team). Recent-game ratings would need a boxscore per game: 10 requests.
   - Later, the same endpoint can add the `faceoffwins` and `powerplay` reports for rating approach B (faceoff counts
     and power-play assists) without new client requests.
3. **Stats page Shots and Hits come from the stats API (phase 12).** **Decided 2026-09-15: A.**
   - **A (chosen):** `/api/nhl-stats/leaders` returns both boards in one request (2 upstream
     calls, cached). The other seven boards stay on api-web, which has headshots, logos and the NHL's qualification
     rules. All nine old boards stay.
   - **B:** replace them with api-web categories, like "+/-" (`plusMinus`) and "Power Play Goals" (`goalsPp`). Pick
     this if 2B is taken, so the stats API isn't added for two boards.
4. **Bio "Captain/Rookie" tile becomes "Draft"** (phase 11). **Decided 2026-09-15.** Neither API has captaincy or
   rookie flags, and draft details are in the landing already. Rejected: birthplace, or removing the tile.
5. **Career rows show a logo for every team in `teamAbbrevs`** (phase 11). **Decided 2026-09-15.** A traded season
   (`"CGY,VAN"`) shows both teams' logos side by side, in the API's order. Historical teams the utils don't know
   (`ATL`, `PHX`, `HFD`, ...) get the fallback logo. Rejected: only the logo of the team at season end, which hides
   the trade.
6. **Seasons come from responses, not the calendar.** **Decided 2026-09-15** (not optional).
   `DateTimeUtils.getCurrentNhlSeason()` is wrong between the
   season start (2026-09-29) and October 10. New code uses `now`/`current` endpoints and the returned `seasonId` /
   `featuredStats.season`. The util stays only for display formatting until cleanup. After phase 15, the current
   season and playoff mode moved to season dates from the stats API (11.1).
7. **The playoffs page shows the latest bracket that has series, with a season picker from 2013-14 on** (phase 14).
   **Decided 2026-09-15.**
   - The picker covers the current divisional and wild card era, whose brackets use today's layout. In 2020, the
     qualifying round (series S–Z) is hidden behind a one-line note. In 2021 there are no conferences, so labels come
     from the bracket.
   - Rejected ranges: from 1979-80 (every A–O bracket, but older seeding and the letter placement are unverified) and
     every season with a bracket (4-, 8- and 12-team layouts).
   - Rejected: showing the 2020 qualifiers as an extra row of series cards.
8. **The team page's next game uses `score/{date}` for live data**, the same source as the home scoreboard.
   **Decided 2026-09-15.** Rejected: `gamecenter/{id}/landing`, which has no `seriesStatus`, so a playoff game would
   need `score/{date}` as well.
9. **The team page gets a team stats card in phase 10** (new, not on the old page). **Decided 2026-09-15.** The data
   comes from the stats API `team/summary` through `/api/nhl-stats/teams` (5.1): one upstream call for all teams, so
   league ranks come for free. Rejected: leaving it for a later follow-up.

## 13. Risks

- **Undocumented APIs.** `search.d3.nhle.com` isn't in the reference. The stats API's report names, `cayenneExp`
  syntax and fields are only verified by hand (2.2), and can change without notice. The backend owns every stats API
  query, so a change stays in one place.
- **Stats API timing:** unverified how soon after a game its per-game rows appear (a game played tonight may be
  missing from recent games for a while), and whether rows exist during a live game.
- **Stats API accuracy:** checked again in phase 9. For game `2025030414`, Barbashev's per game `summary` +
  `realtime` row and Bussi's `summary` + `savesByStrength` row match every field of the boxscore, saves by strength
  included, and both give the same HokMob rating.
- **Upstream volume:** a player view costs up to 7 stats API calls on a cache miss, in parallel. The 5-minute cache
  per player keeps repeat views free.
- **Historical abbreviations:** the stats API uses abbreviations like `ATL` and `PHX` that `NhlTeamUtils` doesn't
  know, so those rows get the fallback logo. `UTA` maps to 68 even for Utah Hockey Club (59) seasons.
- **Retired and inactive players:** `currentTeamId` and `featuredStats` may be missing from the landing. Checked in
  phase 11 with Bergeron (8470638), captured in phase 9: his page shows no team link or color, and the cards of his
  last season.
- **Relocated teams:** `/team/53` (Arizona) and Utah's first season's `previousSeason` fill-in, with the same caveat as
  the first plan's team form risk.
- **Brackets in the picker's range:** checked in phase 14 for every season from 2013-14 to 2025-26: every series is
  in the right slot of the tree (2020 and 2021 only thanks to the placement by team, see 10).
- **Bracket before series are set:** how `playoff-bracket` lists TBD series is unverified. Check during the 2027
  playoffs, together with the first plan's in-progress series follow-up.
- **Leaders format:** settled in phase 9 for a finished season: the api-web `toi` leader value is in seconds
  (1664.2568), and the playoff leaders of 2025-26 have 5 entries per category. Playoff leaders *before* any playoff
  game are still unverified.
- **Earlier live games:** preseason games start 2026-09-19. Team page next game and scorecard live labels depend on the
  same unverified live fields as the first plan (its section 10).

## 14. Phases

A phase is done when `ng build` passes, the affected UI is checked in the browser and `npm run test:ci` passes with the
phase's tests (first plan, section 7: real fixtures, services with `HttpTestingController`, components through
`AppTestingModule`, placeholder specs replaced). There's no backend test project: check the backend routes by hand, or
add one in phase 9.

| # | Phase | Status | Files | Check against | Tests |
|---|---|---|---|---|---|
| 9 | Foundation: search proxy, stats API client with the player stats and leaders endpoints, new models, move `NhlTeamCustomModel`, `NhlTeamUtils.getActiveTeamIds`, `StatsUtils` mappers, fixtures | **Done** | new `NhlSearchController.cs` / `NhlStatsController.cs` (or `NhlController.cs`), `NhlApiClient.cs` + new clients, `Program.cs`, `models/nhl-web-api/*`, `models/nhl-stats-api/*`, `nhl-team-utils`, `stats-utils`, `nhl-api-mocks/*` | `ng build`, `dotnet build`. `/api/nhl-search/player?q=mac` returns players, and disallowed parameters are dropped. `/api/nhl-stats/player/8477496?position=skater` has the 2023-24 `CGY,VAN` row with hits. `/api/nhl-stats/player/8477964?position=skater` returns 10 games starting with `2025030416`, with scores. `/api/nhl-stats/player/8476945?position=goalie` has saves by strength. `/api/nhl-stats/leaders?season=20252026&gameType=2` starts with Trenin (413 hits). `/api/nhl-stats/teams?season=20252026&gameType=2` returns 32 rows | `nhl-team-utils` (active IDs); `StatsUtils.toBoxscoreSkater/Goalie` + ratings vs the `2025030414` boxscore; `formatSeconds`; fixture accessors |
| 10 | Team page: header, conference standings, form, schedule, next game, team stats card (new) | **Done** | `team`, `team-next-game`, `single-team-form`, `team-schedule`, new `team-stats`, `nhl-game.service.ts`, new team stats service method, `nhl-game-info-utils` | `/team/6` (stats card ranks), `/team/68`, `/team/53` (no card), `/team/999`; off-season (form and stats from 2025-26) | Service schedule/form generalization and teams stats URL; `team` (loading, conference pick, failures, unknown team, 10s live refresh), real `team-next-game`, `single-team-form`, `team-schedule` specs; `team-stats` (values and ranks from the fixture, ties, lower-is-better stats, no row, failure) |
| 11 | Player page: header and bio (landing), season cards, career and recent games (stats endpoint) | **Done** | `player`, `player-bio`, `player-stats`, `player-career`, `recent-player-games`, new player service methods | `/player/8476460` (skater), `/player/8476945` (goalie), `/player/8477496` (traded season), `/player/8477964` (playoff games), a retired player | Service (landing, stats URL and position, failures); draft label, height, one logo per `teamAbbrevs` entry (traded season, unknown abbreviation), scores with the player's team first, GAA from TOI; real specs for all five components |
| 12 | Stats page: api-web leaders, hits and shots from the stats endpoint, leaderboard entries | **Done** | `stats`, `stat-leaderboard`, new `nhl-leaders.service`, `nhl-stats-api.service`, deleted `beta-nhl-stats.service` and `nhl-stat-type.enum` | `/stats` regular season, `?gameType=P` (2025-26 playoffs), empty categories, one source failing | Service URLs and categories; entry conversion for both sources; `stats` (toggle, failure clears spinner), real `stat-leaderboard` spec (formats, team from abbrev, empty) |
| 13 | Header search: static teams, player search via proxy, headshot URLs | **Done** | `nhl-search.service.ts`, `search-input`, `search-result`, `search-result.model.ts` | Typing "bos", "mac", "zz" (no results), a failed search | Service (URL, params, errors); `search-input` (debounce, min length, stale responses, teams first), real `search-result` spec |
| 14 | Playoffs page: bracket by year with fallback, season picker (2013-14 on), letter lookup, 2020 qualifiers note, labels from the bracket, TBD series cards | **Done** | `nhl-standing-and-playoff.service.ts`, `playoffs`, `playoff-series`, new `nhl-playoff-bracket-utils` | `/playoffs` today (falls back to 2025-26), `?season=` 20132014, 20192020 (note), 20202021 (no conferences), 20222023; an invalid season | Service conversion, fallback and round 0 filtering; `playoffs` (letters in the right slots, picker options and query parameter, invalid season, late responses, empty bracket, failure, 2020 note, 2021 labels), `playoff-series` TBD case |
| 15 | Cleanup: delete old services, methods, `StatsUtils` helpers and model folders; docs | **Done** | `nhl-stats.service`, `nhl-image.service`, `nhl-game.service.ts`, `stats-utils`, `models/nhl-*` (old), `app.module`, `app-testing.module`, `CLAUDE.md`, both plans | The grep in section 11 is empty; every route and search in the browser with no console errors | Remove specs for deleted code; full `test:ci` |

## 15. Open items

- The first plan's live game checklist (its section 10) still applies. Its runs can start with preseason games on
  2026-09-19. During a live game, also check whether the stats API has per-game rows for it (13).
- Carried over from the first plan:
  - HokMob rating approach B. For finished games, the stats API's `faceoffwins` and `powerplay` reports have the
    inputs (3); live games still need play-by-play.
  - A local Utah logo.
  - An in-progress playoff series check during the 2027 playoffs.
- Check playoff mode in the browser when it starts (2 days before the 2027 playoffs), or with the override in
  `CLAUDE.md`.

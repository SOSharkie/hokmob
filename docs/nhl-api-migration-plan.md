# NHL API Migration Plan: Home Page & Game Page

Status: **Plan** · Scope: home page (scoreboard, standings summary, playoff summary) and game page (header, goals, stats,
momentum, event timelines, top players, player dialog, team form). Player and team pages are out of scope.

Reference: [Zmalski/NHL-API-Reference](https://github.com/Zmalski/NHL-API-Reference/blob/main/README.md).
All new calls go through the backend proxy: `/api/nhl/<path>` → `https://api-web.nhle.com/v1/<path>`.

## 1. Key findings

- **Every old host is gone**, not just deprecated. `statsapi.web.nhl.com`, `cms.nhl.bamgrid.com` (headshots) and
  `suggest.svc.nhl.com` (search) no longer resolve in DNS. Nothing on these pages works today.
- **No 1:1 replacement.** The old `/game/{id}/feed/live` returned everything in one response. The new API splits it
  across four gamecenter endpoints: `landing`, `play-by-play`, `boxscore` and `right-rail`.
- **The shapes are completely different.** Old models under `shared/models/nhl-*` can't be reused for these pages.
  Plan on new models, not tweaks.
- **What stays the same:**
  - Game IDs use the same format (`2025021057`), so `/game/:id` routes keep working.
  - Team IDs are unchanged, so logo, color and team utils keyed by ID still work, with two exceptions:
    Utah Mammoth `UTA` is new as **ID 68**, and Arizona `ARI` (ID 53) no longer exists.
  - Country codes are still 3 letters (`CAN`), so the `assets/flags` images still work.
- **Localized strings.** Most names are now objects like `{ "default": "Jets", "fr": "..." }`, so read `.default`.
- **Live-game fields are unverified.** Every sample so far is a finished (`OFF`) or future (`FUT`) game.
  The preseason starts 2026-09-29. `clock` and intermission behavior must be checked against a real live game.

## 2. Endpoint mapping

| Feature | Old (dead) | New |
|---|---|---|
| Home scoreboard | `statsapi /schedule?date=…&hydrate=linescore,broadcasts,seriesSummary` | `score/{YYYY-MM-DD}` |
| Mini standings | `statsapi /standings?season=…&standingsType=byLeague` | `standings/now` (or `standings/{date}`) |
| Playoff summary | `statsapi /tournaments/playoffs?expand=round.series…` | `playoff-series/carousel/{season}/`, plus `playoff-bracket/{year}` for seed ranks and round titles |
| Playoff series games | `statsapi /schedule?teamId=a,b&gameType=P` | `schedule/playoff-series/{season}/{letter}/` |
| Game live feed | `statsapi /game/{id}/feed/live` | `gamecenter/{id}/landing`, `…/play-by-play`, `…/boxscore`, `…/right-rail` |
| Game model (broadcasts, series summary) | `statsapi /schedule?gamePk=…` | `landing.tvBroadcasts`; for playoffs, `seriesStatus` from `score/{gameDate}` (it's only in `score`, not `landing` or `right-rail`) |
| Team form | `statsapi /schedule?teamId=…&startDate&endDate` | `club-schedule-season/{abbrev}/now` |
| Player dialog bio | `statsapi /people/{id}` (via `nhl-stats.service`) | `player/{id}/landing` |
| Headshots | `cms.nhl.bamgrid.com/images/headshots/…jpg` | `headshot` URL from `rosterSpots`, `player/{id}/landing`, or `https://assets.nhle.com/mugs/nhl/{season}/{abbrev}/{id}.png` |

## 3. Cross-cutting changes

### Game state
| Old `status.abstractGameState` / `detailedState` | New |
|---|---|
| `Preview` | `gameState` = `FUT` or `PRE` |
| `Live` (`In Progress`, `In Progress - Critical`) | `gameState` = `LIVE` or `CRIT` |
| `Final` (`Game Over`, `Final`) | `gameState` = `FINAL` or `OFF` |
| `Scheduled (Time TBD)` / `Postponed` | `gameScheduleState` = `TBD` / `PPD` (`OK` otherwise) |

Replace `NhlGameInfoUtils.isFutureGame/isLiveGame/isCompletedGame(status)` with versions that take a `gameState` string.
Replace `NhlGameStateEnum` with the new values.

### Game type
The old code was a string: `"PR"` / `"R"` / `"P"`. The new `gameType` is a number: `1` preseason, `2` regular season, `3` playoffs.

### Period and clock (replaces `linescore`)
| Old | New |
|---|---|
| `linescore.currentPeriod` | `periodDescriptor.number` |
| `linescore.currentPeriodOrdinal` | Derive from `periodDescriptor.number` and `.periodType` (`REG`/`OT`/`SO`) |
| `linescore.currentPeriodTimeRemaining` / `"END"` | `clock.timeRemaining`, `clock.inIntermission` |
| `linescore.hasShootout` | `periodDescriptor.periodType === "SO"` or `gameOutcome.lastPeriodType === "SO"` |
| Final OT/SO label | `gameOutcome.lastPeriodType` (`REG`/`OT`/`SO`); multi-OT when `periodDescriptor.number > 4` and type `OT` |

Add one shared `PeriodUtils.getLabel(periodDescriptor)` for "1st", "OT", "2OT", "SO". The same logic is copied today
in scorecard, game-header, goal-scorers, event-timeline and mini-event-timeline.

### Team names
- `score`: `homeTeam.name.default` is the **common name only** ("Jets").
- `landing` and `boxscore`: `placeName.default` + `commonName.default` ("Winnipeg" + "Jets").
- `standings`: `teamName.default` is the full name, but **rows have no team ID**, only `teamAbbrev.default`.
- Action: extend `NhlTeamUtils` with an abbreviation-to-ID lookup, and add Utah (68) to the team, logo and color utils.
  The full name for scorecards can come from `NhlTeamUtils.getTeam(id).name`.

### Times
The old `gameDate` was a UTC datetime. Use `startTimeUTC` now. The new `gameDate` is a date-only local string.

## 4. Home page

### 4.1 Scoreboard (`home/scoreboard`) and scorecard (`shared/components/scorecard`)
- Service: `getNhlGames(date)` → `GET /api/nhl/score/{YYYY-MM-DD}` → `games[]`.
  `score/now` jumps ahead to the next game day, so keep the explicit date.
- The 10s poll matches games by `id` instead of `gamePk`, and copies `homeTeam`, `awayTeam`, `clock`,
  `periodDescriptor`, `gameState` and `gameOutcome`.

| Scorecard field | Old | New |
|---|---|---|
| Route | `game.gamePk` | `game.id` |
| Team IDs / logos | `teams.home.team.id` | `homeTeam.id` |
| Team name | `teams.home.team.name` | `NhlTeamUtils.getTeam(homeTeam.id).name` (API only gives "Jets") |
| Score | `teams.home.score` | `homeTeam.score` |
| Time / date | `gameDate` | `startTimeUTC` |
| TBD / postponed | `status.detailedState` | `gameScheduleState` |
| Playoff game | `gameType === "P" && seriesSummary` | `gameType === 3 && seriesStatus` |
| Series text | `seriesSummary.seriesStatusShort` | Build from `seriesStatus.topSeedTeamAbbrev/topSeedWins/bottomSeedTeamAbbrev/bottomSeedWins` (e.g. "CAR 2-2") |
| Final label | `linescore.currentPeriod`, `hasShootout` | `gameOutcome.lastPeriodType`, `periodDescriptor.number` |
| Live label | `currentPeriodOrdinal`, `currentPeriodTimeRemaining` | `PeriodUtils.getLabel(periodDescriptor)` + `clock.timeRemaining`; "End 1st" / intermission when `clock.inIntermission` |

The scorecard is also used by team and player pages. Those pages are already broken and will stay broken until they're migrated.

### 4.2 Standings summary (`home/standings-summary`) and shared `standings` component
- Service: `getNhlStandings()` → `GET /api/nhl/standings/now` → `standings[]`, a **flat list of 32 teams**.
  The old API returned records grouped by standings type.
- Group and rank on the client: by league (`leagueSequence`), conference (`conferenceName` + `conferenceSequence`),
  division (`divisionName` + `divisionSequence`), or wild card (`wildcardSequence`).
  Return the same grouped `[{ title, teams[] }]` array the component already loops over.

| Standings field | Old | New |
|---|---|---|
| Team ID (logo, `/team/:id` link) | `team.team.id` | Look up by `teamAbbrev.default` |
| Name | `team.team.name` | `teamName.default` (use `teamCommonName.default` for the short name instead of string slicing) |
| GP / W / L / OT | `gamesPlayed`, `leagueRecord.wins/losses/ot` | `gamesPlayed`, `wins`, `losses`, `otLosses` |
| RW | `regulationWins` | `regulationWins` |
| GD | `goalsScored - goalsAgainst` | `goalDifferential` |
| Points | `points` | `points` |
| Rank | `leagueRank` / `conferenceRank` / `divisionRank` / `wildCardRank` | `leagueSequence` / `conferenceSequence` / `divisionSequence` / `wildcardSequence` |
| Streak | `streak.steakNumber` + `streak.streakCode` | `streakCount` + `streakCode` |
| Clinch | `clinchIndicator` (`x`,`y`,`z`,`p`) | `clinchIndicator` (`x`,`y`,`z`,`p`,`e`); `e` = eliminated |
| Season title | `standings[0].season` | `seasonId` (number) |

The shared component is also used by the full standings page, which gets these changes for free.

### 4.3 Playoff summary (`home/playoff-summary`) and shared `playoff-series` component
- Service: `getNhlPlayoffs(season)` → `GET /api/nhl/playoff-series/carousel/{season}/`
  → `{ currentRound, rounds[{ roundNumber, roundLabel, roundAbbrev, series[] }] }`.
- Title: `rounds[currentRound - 1]`. `roundLabel` is a slug like `conference-finals`, so map it to display text,
  or use `seriesTitle` from `playoff-bracket/{year}`.
- Seed ranks aren't in the carousel. If they're wanted, merge `topSeedRank`/`bottomSeedRank` from
  `playoff-bracket/{year}`, matching on `seriesLetter`.

| Series field | Old | New (carousel) |
|---|---|---|
| Team abbrevs | `names.teamAbbreviationA/B` | `topSeed.abbrev`, `bottomSeed.abbrev` |
| Team IDs / logos | `matchupTeams[i].team.id` | `topSeed.id`, `bottomSeed.id` |
| Wins | `matchupTeams[i].seriesRecord.wins` | `topSeed.wins`, `bottomSeed.wins` |
| Series over | `wins === 4` | `winningTeamId` set (or `wins === neededToWin`) |
| Rank | `matchupTeams[i].seed.rank` | Bracket `topSeedRank` / `bottomSeedRank` |
| Next game date | `currentGame.seriesSummary.gameTime` | First non-final game's `startTimeUTC` in `schedule/playoff-series/{season}/{letter}/` |
| Series games | `getNhlPlayoffSeriesGames(teamA, teamB)` | `schedule/playoff-series/{season}/{seriesLetter}/` → `games[]` |

`DateTimeUtils.isPlayoffMode()` is hard-coded to dates. Optionally drive it from the `schedule/{date}` response instead
(`regularSeasonEndDate`, `playoffEndDate`).

## 5. Game page

### 5.1 Data loading (`game.component.ts`)
Replace `getNhlGameLiveFeed` and `getNhlGame` with:

| Call | Feeds |
|---|---|
| `gamecenter/{id}/landing` | Header (teams, score, state, clock, period), date/venue/TV, goal scorers (`summary.scoring`), three stars |
| `gamecenter/{id}/play-by-play` | Momentum chart, event timelines, OT length, player names (`rosterSpots`) |
| `gamecenter/{id}/boxscore` | Per-player stats → top players, HokMob ratings, player dialog |
| `gamecenter/{id}/right-rail` | Team stats (`teamGameStats`), shots/goals by period, season series |
| `score/{gameDate}` (playoffs only) | `seriesStatus` for the header and league label |
| `club-schedule-season/{abbrev}/now` (non-final only) | Team form |

- Polling every 10s for live games: landing, play-by-play, boxscore and right-rail. Gamecenter is cached 10s on the
  backend. Consider one `GameService.getGameBundle(id)` that runs all of them with `Promise.all`.
- **Scratches** no longer need filtering. `boxscore.playerByGameStats.{homeTeam,awayTeam}.{forwards,defense,goalies}`
  only lists dressed players.

### 5.2 Game header, info bar (`game-header`, `game.component`)
| Field | Old | New |
|---|---|---|
| State | `gameData.status` | `landing.gameState` |
| Team name / short name | `gameData.teams.home.name` / `.teamName` | `homeTeam.placeName.default + " " + commonName.default` / `commonName.default` |
| Team ID | `gameData.teams.home.id` | `landing.homeTeam.id` |
| Score | `linescore.teams.home.goals` | `landing.homeTeam.score` |
| Date/time | `gameData.datetime.dateTime` | `landing.startTimeUTC` |
| Venue | `gameData.venue.name` | `landing.venue.default` |
| TV | `gameModel.broadcasts[0].name` | `landing.tvBroadcasts[0].network` |
| Game type | `gameData.game.type` | `landing.gameType` |
| League label | Round from `gameId.charAt(7)` + `teams.home.conference.name` + `seriesSummary.seriesStatus` | `seriesStatus.seriesTitle` + wins text (no conference in `landing`) |
| Playoff series | `gameModel.seriesSummary.gameNumber/seriesStatusShort` | `seriesStatus.gameNumberOfSeries`, `topSeedWins`, `bottomSeedWins` |
| Final / live labels | `linescore.*` | Same as the scorecard (section 4.1) |
| Stream link | `gameData.teams.home.name` | `placeName` + `commonName` |
| Power play badge (TODO) | not implemented | Optional: derive from the latest play's `situationCode` |

### 5.3 Intermission countdown
The old code timed from the `PERIOD_END` play's wall-clock `about.dateTime`.
**New plays have no wall-clock timestamp**, so that approach can't be ported.
- Use `landing.clock.inIntermission` plus `clock.secondsRemaining`, which is expected to count down the intermission.
  **Verify during a live game.**
- The next-period label comes from `periodDescriptor.number + 1`.

### 5.4 Goal scorers (`goal-scorers`, `game.calculateGoals`)
Source: `landing.summary.scoring[]` → `{ periodDescriptor, goals[] }`. Skip `periodType === "SO"`.

| GoalModel | Old | New |
|---|---|---|
| period | `allPlays[i].about.period` | `periodDescriptor.number` |
| periodTime | `about.periodTime` | `timeInPeriod` |
| scorer name / last name | `players[0].player.fullName` | `firstName.default` + `lastName.default` |
| scorerId | `players[0].player.id` | `playerId` |
| home/away | `team.id === home.id` | `isHome` |

`numPeriods` used `linescore.periods.length`. Use `periodDescriptor.number`, capped so SO isn't shown as a period.

### 5.5 Game stats (`game-stats`)
Source: `right-rail.teamGameStats[]` (`{ category, awayValue, homeValue }`). Convert to a map keyed by `category`.

| Stat | Old (`teamSkaterStats`) | New `category` |
|---|---|---|
| Shots | `linescore.teams.*.shotsOnGoal` | `sog` (also `landing.*Team.sog`) |
| Faceoff % | `faceOffWinPercentage` ("65.9") | `faceoffWinningPctg` (0.659, so ×100) |
| Power plays | `powerPlayGoals` / `powerPlayOpportunities` | `powerPlay` (already `"0/3"`) |
| PP compare | `powerPlayPercentage` | `powerPlayPctg` |
| PIM | `pim` | `pim` |
| Hits | `hits` | `hits` |
| Blocks | `blocked` | `blockedShots` |
| Takeaways | `takeaways` | `takeaways` |
| (new) | none | `giveaways`, `faceoffWins` |

### 5.6 Momentum chart (`momentum`)
Source: `play-by-play.plays[]`.

| Old | New |
|---|---|
| `result.eventTypeId` `GOAL` / `SHOT` / `MISSED_SHOT` / `BLOCKED_SHOT` | `typeDescKey` `goal` / `shot-on-goal` / `missed-shot` / `blocked-shot` |
| `play.team.id` | `details.eventOwnerTeamId` |
| `about.period`, `about.periodTime` | `periodDescriptor.number`, `timeInPeriod` |
| `linescore.periods.length > 3` | Max `periodDescriptor.number` > 3 (exclude SO) |
| OT length: `currentPlay.about.periodTime` | Last play's `timeInPeriod` |
| Team colors: `gameData.teams.home/away.id` | `landing.homeTeam.id` / `awayTeam.id` |

**Verify:** whether `eventOwnerTeamId` on `blocked-shot` is the shooting team or the blocking team.
The old logic credits the team that took the shot.

### 5.7 Event timelines (`event-timeline`, `mini-event-timeline`, `event`, `mini-event`)
Source: `play-by-play.plays` filtered to `typeDescKey` `goal` or `penalty`, grouped by `periodDescriptor.number`.
This replaces the `scoringPlays` / `penaltyPlays` index arrays and `playsByPeriod`.
Build a `playerId → rosterSpot` map from `rosterSpots` for names and headshots.

| Field | Old | New |
|---|---|---|
| Home event | `event.team.id === homeTeamId` | `details.eventOwnerTeamId === homeTeamId` |
| Time | `about.periodTime` | `timeInPeriod` |
| Score after goal | `about.goals.home/away` | `details.homeScore` / `details.awayScore` |
| Scorer | `players[0].player` | `details.scoringPlayerId` → roster |
| Assists | `players[1..2].player` | `details.assist1PlayerId`, `details.assist2PlayerId` → roster |
| Penalized player | `players[0].player` | `details.committedByPlayerId` → roster (can be missing for bench minors) |
| Penalty text | `result.secondaryType` / `penaltySeverity` | `details.descKey` (`"interference-goalkeeper"`, so humanize it) / `details.typeCode` (`MIN`, `MAJ`) |
| Game final | `gameData.status` | `gameState` |

`landing.summary.penalties` has nicer text but **no player IDs**, so use play-by-play to keep click-to-open-dialog working.

### 5.8 Top players, HokMob rating, player dialog (`game-top-players`, `player-game-dialog`, `StatsUtils`)
Source: `boxscore.playerByGameStats.{homeTeam,awayTeam}.{forwards,defense,goalies}`.

| Skater field | Old | New |
|---|---|---|
| id / name | `person.id` / `person.fullName` | `playerId` / `name.default` ("A. Iafallo"; use `rosterSpots` for the full name) |
| position | `position.code` / `.abbreviation` | `position` (`C`,`L`,`R`,`D`,`G`) |
| goals, assists, plusMinus, hits, takeaways, giveaways, powerPlayGoals | same names | same names |
| shots | `shots` | `sog` |
| blocked | `blocked` | `blockedShots` |
| penaltyMinutes | `penaltyMinutes` | `pim` |
| timeOnIce | `timeOnIce` | `toi` |
| faceOffWins / faceoffTaken | counts | **not available** (only `faceoffWinningPctg`) |
| powerPlayAssists | count | **not available** |

| Goalie field | Old | New |
|---|---|---|
| savePercentage | 0–100 (template divides by 100) | `savePctg` (0–1), so drop the `/ 100` |
| saves / shots | `saves` / `shots` | `saves` / `shotsAgainst` |
| evenSaves | number | Parse `evenStrengthShotsAgainst` `"28/30"` → 28 |
| powerPlaySaves | number | Parse `powerPlayShotsAgainst` `"1/1"` → 1 |
| timeOnIce / pim | `timeOnIce` / `pim` | `toi` / `pim` |

The HokMob skater rating uses two fields that no longer exist. **Decision: use A for now.** B will be built later;
a TODO is in `StatsUtils.calculateSkaterHokmobRating`.
- **A (simple):** use `faceoffWinningPctg` for the faceoff term, only when the player is a C, and drop the
  `powerPlayAssists` correction from real plus/minus.
- **B (exact):** derive faceoff wins and losses from `faceoff` plays (`details.winningPlayerId` / `losingPlayerId`), and
  power-play assists from `goal` plays' `situationCode`.

Player dialog: `nhlStatsService.getNhlPlayerStats` (dead) → `GET /api/nhl/player/{id}/landing`. Use
`birthCountry` (`CAN`, flags still work), age from `birthDate`, `weightInPounds`, `position`, and `headshot`.
Put this call in the game service so it doesn't depend on the out-of-scope player service.

Headshots: `NhlImageService.getNhlPlayerHeadshot` (dead host, blob + FileReader) → use the `headshot` URL directly as the
`<img src>`, from `rosterSpots` or player landing, with `assets/blank_headshot.png` as the `onerror` fallback.

### 5.9 Team form (`team-form`, `previous-game`)
- Service: `getTeamGames(from, to, teamId)` → `GET /api/nhl/club-schedule-season/{abbrev}/now` → `games[]`.
  Filter `gameState` in `OFF`/`FINAL` with `startTimeUTC` before the current game, then take the last 5.
- The component inputs change from `NhlScheduleModel` (dates → games[0]) to a plain `ClubScheduleGame[]`.
- Field mapping: `gameDay.games[0].gamePk` → `id`, `teams.home.team.id` → `homeTeam.id`, `teams.home.score` → `homeTeam.score`.

## 6. Implementation approach

- **New models.** Add typed interfaces under `shared/models/nhl-web-api/` that mirror the new responses
  (`ScoreResponse`, `ScoreGame`, `StandingsTeam`, `PlayoffCarousel`, `GameLanding`, `PlayByPlay`, `Boxscore`,
  `RightRail`, `ClubScheduleGame`, `PlayerLanding`, and shared `LocalizedString`, `PeriodDescriptor`, `GameClock`).
  Don't adapt the new data into the old models; too many fields have no equivalent.
- **Keep the old models** for now. Player and team pages still import them, and they get removed when those pages migrate.
- **Services.** Update URLs in `NhlGameService` and `NhlStandingAndPlayoffService` to `/api/nhl/...`.
  Keep the existing Promise-based style.
- **Backend.** Add `playoff-bracket` to `AllowedRoots` in `NhlController.cs`. `score`, `schedule`, `standings`,
  `playoff-series`, `gamecenter`, `club-schedule-season` and `player` are already allowed.
- **Test fixtures (optional).** Commit a few captured responses (regular, OT/SO and playoff games; standings; carousel)
  under `ClientApp/src/assets/test-data/` for unit tests and offline development.

## 7. Phases

Each phase ends with the app compiling and the affected UI checked in the browser.

| # | Phase | Files | Check against |
|---|---|---|---|
| 0 | Foundation: new models, `PeriodUtils`, game-state utils, abbrev→ID map + Utah (68) in team/logo/color utils, backend allowlist | `shared/models/nhl-web-api/*`, `shared/utils/*`, `NhlController.cs` | `tsc` passes |
| 1 | Scoreboard + scorecard | `nhl-game.service.ts`, `home/scoreboard`, `shared/components/scorecard` | 2026-03-15 (final), a date with OT/SO, playoff date 2026-06-09, today (future) |
| 2 | Standings summary + shared standings component | `nhl-standing-and-playoff.service.ts`, `home/standings-summary`, `shared/components/standings` | `standings/now` |
| 3 | Playoff summary + playoff-series component | same service, `home/playoff-summary`, `playoffs/playoff-series` | 2025-26 carousel (force `isPlayoffMode` true to test) |
| 4 | Game page core: loading, header, info bar, goal scorers | `game.component`, `game-header`, `goal-scorers` | `2025021057` (reg), `2025020952` (SO), `2025030414` (playoff) |
| 5 | Play-by-play: momentum, event timelines, intermission | `momentum`, `event-timeline`, `mini-event-timeline`, `event`, `mini-event` | same games; intermission during a live preseason game |
| 6 | Boxscore + right-rail: game stats, top players, rating, player dialog, headshots | `game-stats`, `game-top-players`, `player-game-dialog`, `stats-utils`, `nhl-image.service` | same games |
| 7 | Team form | `team-form`, `previous-game` | a future game |
| 8 | Live validation + cleanup: run through a live preseason game (from 2026-09-29), remove the test call in `HomeComponent`, delete unused old models | — | live game |

## 8. Decisions

1. **HokMob rating:** use approach A (simple) for now. The exact version (B) comes later. See the TODO in
   `StatsUtils.calculateSkaterHokmobRating`.
2. **Out-of-scope pages that share components:** they stay broken until migrated. TODO comments with a short fix note
   are on `TeamComponent`, `TeamScheduleComponent`, `SingleTeamFormComponent`, `LeagueStandingsComponent`,
   `PlayoffsComponent` and `PlayoffSeriesDialogComponent`.
3. **Header search:** out of scope. TODO comments are on `SearchInputComponent` and `NhlSearchService`
   (replacement: `search.d3.nhle.com`, which needs backend proxy support for another host).

## 9. Risks

- **Undocumented API.** It can change without notice. The typed models plus backend proxy keep changes in one place.
- **Unverified live fields:** `clock.inIntermission`, `clock.secondsRemaining` during intermission, `CRIT` state, and
  `situationCode` for power plays.
- **Request volume:** the game page makes up to 4 requests per poll (was 1). The 10s backend cache keeps upstream load flat.

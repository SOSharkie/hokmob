# NHL API Migration Plan: Home Page & Game Page

Status: **In progress** · Phases 0–4 done with unit tests (2026-09-15), phases 5–8 to do.
Scope: home page (scoreboard, standings summary, playoff summary and series dialog) and game page (header, goals, stats,
momentum, event timelines, top players, player dialog, team form). Player and team pages are out of scope.

Reference: [Zmalski/NHL-API-Reference](https://github.com/Zmalski/NHL-API-Reference/blob/main/README.md).
All new calls go through the backend proxy: `/api/nhl/<path>` → `https://api-web.nhle.com/v1/<path>`
(`HokMob.App/Controllers/NhlController.cs`, cached by `HokMob.App/Services/NhlApiClient.cs`).

## 1. Key findings

- **Every old host is gone**, not just deprecated. `statsapi.web.nhl.com`, `cms.nhl.bamgrid.com` (headshots) and
  `suggest.svc.nhl.com` (search) no longer resolve in DNS. Unmigrated pages don't work.
- **No 1:1 replacement.** The old `/game/{id}/feed/live` returned everything in one response. The new API splits it
  across four gamecenter endpoints: `landing`, `play-by-play`, `boxscore` and `right-rail`.
- **The shapes are completely different.** Old models under `shared/models/nhl-*` can't be reused for these pages.
  New models live under `shared/models/nhl-web-api/`.
- **What stays the same:**
  - Game IDs use the same format (`2025021057`), so `/game/:id` routes keep working.
  - Team IDs are unchanged, so logo, color and team utils keyed by ID still work, with two exceptions:
    Utah Mammoth `UTA` is new as **ID 68**, and Arizona `ARI` (ID 53) no longer exists.
  - Country codes are still 3 letters (`CAN`), so the `assets/flags` images still work.
- **Localized strings.** Most names are now objects like `{ "default": "Jets", "fr": "..." }`, so read `.default`.
- **Trailing slashes don't matter.** The proxy drops empty path segments, and upstream accepts paths with or without
  the trailing `/` shown in the reference.
- **Live-game fields are unverified.** Every sample so far is a finished (`OFF`) or future (`FUT`) game.
  The preseason starts 2026-09-29. `clock` and intermission behavior must be checked against a real live game.

## 2. Endpoint mapping

| Feature | Old (dead) | New |
|---|---|---|
| Home scoreboard | `statsapi /schedule?date=…&hydrate=linescore,broadcasts,seriesSummary` | `score/{YYYY-MM-DD}` |
| Mini standings | `statsapi /standings?season=…&standingsType=byLeague` | `standings/now` (or `standings/{date}`) |
| Playoff summary | `statsapi /tournaments/playoffs?expand=round.series…` | `playoff-series/carousel/{season}/`, plus `playoff-bracket/{year}` for seed ranks |
| Playoff series games | `statsapi /schedule?teamId=a,b&gameType=P` | `schedule/playoff-series/{season}/{letter}/` |
| Game live feed | `statsapi /game/{id}/feed/live` | `gamecenter/{id}/landing`, `…/play-by-play`, `…/boxscore`, `…/right-rail` |
| Game model (broadcasts, series summary) | `statsapi /schedule?gamePk=…` | `landing.tvBroadcasts`; for playoffs, `seriesStatus` from `score/{gameDate}` (it's only in `score`, not `landing` or `right-rail`) |
| Team form | `statsapi /schedule?teamId=…&startDate&endDate` | `club-schedule-season/{abbrev}/now` |
| Player dialog bio | `statsapi /people/{id}` (via `nhl-stats.service`) | `player/{id}/landing` |
| Headshots | `cms.nhl.bamgrid.com/images/headshots/…jpg` | `headshot` URL from `rosterSpots`, `player/{id}/landing`, or `https://assets.nhle.com/mugs/nhl/{season}/{abbrev}/{id}.png` |

## 3. Cross-cutting changes (done in phase 0)

### Game state
| Old `status.abstractGameState` / `detailedState` | New |
|---|---|
| `Preview` | `gameState` = `FUT` or `PRE` |
| `Live` (`In Progress`, `In Progress - Critical`) | `gameState` = `LIVE` or `CRIT` |
| `Final` (`Game Over`, `Final`) | `gameState` = `FINAL` or `OFF` |
| `Scheduled (Time TBD)` / `Postponed` | `gameScheduleState` = `TBD` / `PPD` (`OK` otherwise; also `SUSP`, `CNCL`) |

- `NhlGameStateEnum` now holds the new values. New enums: `NhlGameScheduleStateEnum`, `NhlGameTypeEnum`,
  `NhlPeriodTypeEnum`.
- `NhlGameInfoUtils.isFutureGame/isLiveGame/isCompletedGame` take a `gameState`. They still accept the old status model
  (deprecated) so unmigrated pages compile. Remove that overload in phase 8.

### Game type
The old code was a string: `"PR"` / `"R"` / `"P"`. The new `gameType` is a number (`NhlGameTypeEnum`): `1` preseason,
`2` regular season, `3` playoffs.

### Period and clock (replaces `linescore`)
| Old | New |
|---|---|
| `linescore.currentPeriod` | `periodDescriptor.number` |
| `linescore.currentPeriodOrdinal` | Derive from `periodDescriptor.number` and `.periodType` (`REG`/`OT`/`SO`) |
| `linescore.currentPeriodTimeRemaining` / `"END"` | `clock.timeRemaining`, `clock.inIntermission` |
| `linescore.hasShootout` | `periodDescriptor.periodType === "SO"` or `gameOutcome.lastPeriodType === "SO"` |
| Final OT/SO label | `gameOutcome.lastPeriodType` (`REG`/`OT`/`SO`); multi-OT when `periodDescriptor.number > 4` and type `OT` |

`shared/utils/period-utils.ts` has the shared logic:
- `PeriodUtils.getLabel(periodDescriptor)`: "1st", "OT", "2OT", "SO".
- `PeriodUtils.getFinalLabel(gameOutcome, periodDescriptor)`: "Final", "OT", "2OT", "SO".
- `PeriodUtils.getLiveLabel(periodDescriptor, clock)`: "2nd - 5:32", "End 1st", "SO".

- `PeriodUtils.getNextPeriodLabel(periodDescriptor, gameType)`: "2nd", "OT", "2OT" in the playoffs, "SO" after
  regular season or preseason overtime. Used for the intermission countdown.

The scorecard, game header and goal scorers use it. Copies of the old logic remain in event-timeline and
mini-event-timeline until phase 5.

### Playoff series status
`NhlGameInfoUtils.getSeriesStatusShort(seriesStatus)` builds "CAR leads 3-1", "Tied 2-2", "CAR wins 4-2", or "(0-0)"
before the series starts, from `topSeedTeamAbbrev/topSeedWins/bottomSeedTeamAbbrev/bottomSeedWins/neededToWin`.

### Team names
- `score`: `homeTeam.name.default` is the **common name only** ("Jets").
- `landing` and `boxscore`: `placeName.default` + `commonName.default` ("Winnipeg" + "Jets").
- `standings`: `teamName.default` is the full name, but **rows have no team ID**, only `teamAbbrev.default`.
- `schedule/playoff-series`: series teams have `name` (common name); game teams have `commonName` and `placeName`.
- Done: `NhlTeamUtils.getTeamIdByAbbrev(abbrev)`, and Utah (68) in the team, logo and color utils. Utah's logo is the
  NHL-hosted SVG until a local `assets/logos/utah.png` is added (TODO in `NhlTeamLogoUtils`).
  The full name for scorecards comes from `NhlTeamUtils.getTeam(id).name`.

### Times
The old `gameDate` was a UTC datetime. Use `startTimeUTC` now. The new `gameDate` is a date-only local string.

## 4. Home page

### 4.1 Scoreboard (`home/scoreboard`) and scorecard (`shared/components/scorecard`): done (phase 1)
- Service: `NhlGameService.getNhlGames(date)` → `GET /api/nhl/score/{YYYY-MM-DD}` → `games[]`.
  `score/now` jumps ahead to the next game day, so keep the explicit date.
- The 10s poll matches games by `id` instead of `gamePk`, and copies `homeTeam`, `awayTeam`, `clock`,
  `periodDescriptor`, `gameState` and `gameOutcome`.

| Scorecard field | Old | New |
|---|---|---|
| Route | `game.gamePk` | `game.id` |
| Team IDs / logos | `teams.home.team.id` | `homeTeam.id` |
| Team name | `teams.home.team.name` | `NhlTeamUtils.getTeam(homeTeam.id).name`, falling back to `homeTeam.name.default` |
| Score | `teams.home.score` | `homeTeam.score` |
| Time / date | `gameDate` | `startTimeUTC` |
| TBD / postponed | `status.detailedState` | `gameScheduleState` |
| Playoff game | `gameType === "P" && seriesSummary` | `gameType === 3 && seriesStatus` |
| Series text | `seriesSummary.seriesStatusShort` | `NhlGameInfoUtils.getSeriesStatusShort(seriesStatus)` |
| Final label | `linescore.currentPeriod`, `hasShootout` | `PeriodUtils.getFinalLabel(gameOutcome, periodDescriptor)` |
| Live label | `currentPeriodOrdinal`, `currentPeriodTimeRemaining` | `PeriodUtils.getLiveLabel(periodDescriptor, clock)` |

The scorecard is also used by the team page's schedule, which casts its old models with `$any` so it compiles. It
stays broken until the team page is migrated.

`HomeComponent` still calls the temporary `NhlGameService.testNewNhlApi()`. Remove it in phase 8.

### 4.2 Standings summary (`home/standings-summary`) and shared `standings` component: done (phase 2)
- Service: `NhlStandingAndPlayoffService.getNhlStandings(standingsType)` → `GET /api/nhl/standings/now` →
  `standings[]`, a **flat list of 32 teams**. Between seasons it returns the last season's final standings.
- The service groups and ranks on the client and returns `StandingsGroup[]` (`{ title, teams[] }`):
  - `BY_LEAGUE` (default): one "NHL" group sorted by `leagueSequence`.
  - `BY_CONFERENCE`: "Eastern Conference", "Western Conference", sorted by `conferenceSequence`.
  - `BY_DIVISION`: one group per division (grouped by conference first, then divisions alphabetically), sorted by
    `divisionSequence`.
  - `WILD_CARD_WITH_LEADERS`: per conference, "<Division> Leaders" groups (teams with `wildcardSequence === 0`,
    sorted by `divisionSequence`), then "<Conference> Wild Card" (sorted by `wildcardSequence`).
- The component adds the season to the title (from `seasonId`). The old client-side wild card reordering was removed.

| Standings field | Old | New |
|---|---|---|
| Team ID (logo, `/team/:id` link) | `team.team.id` | `NhlTeamUtils.getTeamIdByAbbrev(teamAbbrev.default)` |
| Name | `team.team.name` | `teamName.default`; `teamCommonName.default` for the short name |
| GP / W / L / OT | `gamesPlayed`, `leagueRecord.wins/losses/ot` | `gamesPlayed`, `wins`, `losses`, `otLosses` |
| RW | `regulationWins` | `regulationWins` |
| GD | `goalsScored - goalsAgainst` | `goalDifferential` |
| Points | `points` | `points` |
| Rank | `leagueRank` / `conferenceRank` / `divisionRank` / `wildCardRank` | `leagueSequence` / `conferenceSequence` / `divisionSequence` / `wildcardSequence` |
| Streak | `streak.steakNumber` + `streak.streakCode` | `streakCount` + `streakCode` |
| Clinch | `clinchIndicator` (`x`,`y`,`z`,`p`) | `clinchIndicator` (`x`,`y`,`z`,`p`,`e`); `e` = eliminated |
| Season title | `standings[0].season` | `seasonId` (number) |

The full standings page (`LeagueStandingsComponent`) was migrated with it. The team page compiles against the new call,
but its team data still comes from the dead API (see its TODO).

### 4.3 Playoff summary (`home/playoff-summary`), shared `playoff-series` and series dialog: done (phase 3)
- Service: `NhlStandingAndPlayoffService.getNhlPlayoffs(season)` loads `playoff-series/carousel/{season}/` and
  `playoff-bracket/{season end year}` in parallel. It returns the `PlayoffCarousel` with each seed's `rank` set from the
  bracket, matching series by `seriesLetter` and teams by ID. If the bracket fails, the series come back without ranks.
- Service: `getNhlPlayoffSeriesSchedule(season, seriesLetter)` → `schedule/playoff-series/{season}/{letter}/`. The old
  `getNhlPlayoffSeriesGames(teamId1, teamId2)` was removed.
- Summary title: the round whose `roundNumber === currentRound`. `roundLabel` slugs are humanized
  (`1st-round` → "1st Round", `stanley-cup-final` → "Stanley Cup Final").

| Series card field | Old | New (carousel) |
|---|---|---|
| Team abbrevs | `names.teamAbbreviationA/B` | `topSeed.abbrev`, `bottomSeed.abbrev` |
| Team IDs / logos | `matchupTeams[i].team.id` | `topSeed.id`, `bottomSeed.id` |
| Wins | `matchupTeams[i].seriesRecord.wins` | `topSeed.wins`, `bottomSeed.wins` |
| Loser (dimmed) | other team's `wins === 4` | `winningTeamId` is the opponent (or opponent `wins >= neededToWin`) |
| Rank | `matchupTeams[i].seed.rank` | `topSeed.rank` / `bottomSeed.rank`, merged from the bracket's `topSeedRank` / `bottomSeedRank` |
| Next game date | `currentGame.seriesSummary.gameTime` | First non-final game's `startTimeUTC` from the series schedule; "TBD" if not scheduled, "Final" once won |
| Series games | `getNhlPlayoffSeriesGames(teamA, teamB)` | `getNhlPlayoffSeriesSchedule(season, seriesLetter)` → `games[]` |

- `app-playoff-series` has a new `season` input. The next game date is only loaded for full-size cards (not
  `smallerVersion`), and only for series that aren't won.
- **Series dialog** (`PlayoffSeriesDialogComponent`), moved into scope because the home cards open it:
  - Dialog data is `PlayoffSeriesDialogData { series, season }`.
  - Games come from the series schedule and are converted to `ScoreGame` for `app-scorecard`. Each game's
    `seriesStatus` is the status **after** that game. Unplayed games fall back to the current wins.
  - Title: "East Round 1" / "West Semifinals" / "East Finals" / "Stanley Cup Finals" + ": " + the series status
    ("BUF vs BOS" before any game). The conference comes from the schedule's `topSeedTeam.conference.name`, so it
    appears once the schedule loads.
- **Playoffs page** (`PlayoffsComponent`, out of scope) now compiles against the carousel. The old winner-backfill
  workaround was removed and the template uses `rounds[n]?.series[m]`. It still hard-codes season `20222023` and
  can't show series whose teams aren't known yet (see its TODO).
- Carousel facts: series `A`–`D` are East round 1, `E`–`H` West round 1, `I`/`J` East round 2, `K`/`L` West round 2,
  `M` East final, `N` West final, `O` Stanley Cup Final. Carousel and bracket agree on which team is the top seed.
  Bracket `topSeedRankAbbrev` looks like `D1` (division) or `WC1` (wild card), and `topSeedRank` is the number
  shown on the card. Both wild cards can have the same rank: BOS (`WC1`) and LAK (`WC2`) are both rank 4.

`DateTimeUtils.isPlayoffMode()` is still hard-coded to dates (May 21 to end of September). Optionally drive it from the
`schedule/{date}` response instead (`regularSeasonEndDate`, `playoffEndDate`).

## 5. Game page (phase 4 done, phases 5–7 to do)

### 5.1 Data loading (`game.component.ts`): done (phase 4)
The game page no longer calls `getNhlGameLiveFeed` or `getNhlGame` (the team page still does). It loads:

| Call | Feeds |
|---|---|
| `gamecenter/{id}/landing` | Header (teams, score, state, clock, period), date/venue/TV, goal scorers (`summary.scoring`), three stars |
| `gamecenter/{id}/play-by-play` | Momentum chart, event timelines, OT length, player names (`rosterSpots`) |
| `gamecenter/{id}/boxscore` | Per-player stats → top players, HokMob ratings, player dialog |
| `gamecenter/{id}/right-rail` | Team stats (`teamGameStats`), shots/goals by period, season series |
| `score/{gameDate}` (playoffs only) | `seriesStatus` for the header and league label |
| `club-schedule-season/{abbrev}/now` (non-final only) | Team form |

- Service: `NhlGameService.getGameBundle(gameId)` requests landing, play-by-play, boxscore and right-rail in parallel
  and returns a `GameBundle` (`models/nhl-web-api/game-bundle.model.ts`). The landing is required: if it fails, the
  promise rejects and the page shows "This game couldn't be loaded." The other three resolve as `undefined` when
  they fail, so the header still shows.
- Service: `NhlGameService.getSeriesStatus(gameId, gameDate)` → `score/{landing.gameDate}` → that game's
  `seriesStatus`, or `undefined`. Only called for playoff games. If it fails, the league label is "NHL Playoffs".
- Refresh: every 10s while the game isn't over and is live or starts today. It reloads the whole bundle (gamecenter
  is cached 10s on the backend). Once the game is over, the refresh stops and the series status is reloaded. A failed
  refresh keeps the data shown, and a failed optional response keeps the previous one.
- A route change loads the new game and ignores late responses for the previous one.
- The phase 5–7 sections (top players, momentum, event timelines, game stats, team form) are hidden behind
  `GameComponent.unmigratedSectionsEnabled` (`false`) and lost their old-model bindings. The component already keeps
  `playByPlay`, `boxscore` and `rightRail` for them. Clicking a scorer calls `openPlayerGameDialog`, which does
  nothing until phase 6. Remove the flag after phase 7.
- **Scratches** no longer need filtering. `boxscore.playerByGameStats.{homeTeam,awayTeam}.{forwards,defense,goalies}`
  only lists dressed players.

### 5.2 Game header, info bar (`game-header`, `game.component`): done (phase 4)
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
| League label | Round from `gameId.charAt(7)` + `teams.home.conference.name` + `seriesSummary.seriesStatus` | `NhlGameInfoUtils.getGameDescription(gameType, seriesStatus)`: "NHL Regular Season", "Stanley Cup Final: Tied 2-2", the seeds ("CAR vs VGK") before game 1, "NHL Playoffs" without a status (no conference in `landing`) |
| Playoff series | `gameModel.seriesSummary.gameNumber/seriesStatusShort` | `NhlGameInfoUtils.getSeriesStatusShort(seriesStatus)`; "Series (0-0)" before game 1; hidden without `seriesStatus` |
| Final / live labels | `linescore.*` | "Final", or "Final " + `PeriodUtils.getFinalLabel` ("Final SO", "Final 2OT"); `PeriodUtils.getLiveLabel` |
| Stream link | `gameData.teams.home.name` | `placeName` + `commonName` |
| Power play badge (TODO) | not implemented | Optional: derive from the latest play's `situationCode` |

`NhlGameInfoUtils.getNhlGameDescription` (old `NhlSeriesSummaryModel`) was replaced by `getGameDescription`.
`landing` has no `gameOutcome`, so final labels fall back to `periodDescriptor.periodType` (`SO`, `OT`).

### 5.3 Intermission countdown: built in phase 4, verify live
The old code timed from the `PERIOD_END` play's wall-clock `about.dateTime`.
**New plays have no wall-clock timestamp**, so that approach can't be ported.
- `isIntermission` is `landing.clock.inIntermission` for a live game. The countdown starts from
  `clock.secondsRemaining`, which is expected to count down the intermission, and a 1s timer moves it between
  refreshes ("16:40 till 2nd"). **Verify during a live game** (phase 5 or 8).
- The next-period label is `PeriodUtils.getNextPeriodLabel(periodDescriptor, gameType)`.

### 5.4 Goal scorers (`goal-scorers`): done (phase 4)
Source: `landing.summary.scoring[]` → `{ periodDescriptor, goals[] }`. It lists every period played, including
periods without goals (like the goalless OT before a shootout). The component's `scoring` input takes it directly and
skips `periodType === "SO"`. `GoalModel`, `game.calculateGoals` and the `numPeriods` input were removed.

| Goal field | Old (`GoalModel`) | New (`GameLandingGoal`) |
|---|---|---|
| period | `allPlays[i].about.period` | the scoring period's `periodDescriptor`, labeled with `PeriodUtils.getLabel` |
| periodTime | `about.periodTime` | `timeInPeriod` |
| scorer label | last name cut from `players[0].player.fullName` | `lastName.default`, like "Fleury (2:31)" |
| scorerId | `players[0].player.id`, looked up by last name on click | `playerId`, emitted on click |
| home/away | `team.id === home.id` | `isHome` |

The page shows goal scorers once any period other than the shootout has a goal.

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
- `SingleTeamFormComponent` (team page) also uses `app-previous-game`; its TODO describes the matching fix.

## 6. Implementation approach

- **New models (done).** Typed interfaces under `shared/models/nhl-web-api/` mirror the new responses:
  `score.model.ts`, `standings.model.ts` (plus `StandingsGroup`), `playoffs.model.ts` (carousel, bracket, series
  schedule; `PlayoffCarouselSeed.rank` is merged in by the service), `gamecenter-landing.model.ts`,
  `play-by-play.model.ts`, `boxscore.model.ts`, `right-rail.model.ts`, `club-schedule.model.ts`,
  `player-landing.model.ts`, `game-bundle.model.ts` (all gamecenter responses of a game), and shared `common.model.ts` (`LocalizedString`, `PeriodDescriptor`, `GameClock`,
  `GameOutcome`, `TvBroadcast`, `GamecenterTeam`, `SeriesStatus`).
  Don't adapt the new data into the old models; too many fields have no equivalent. Converting between new models is
  fine when a shared component needs it (the series dialog converts series schedule games to `ScoreGame`).
- **Keep the old models** for now. Player and team pages still import them, and they get removed when those pages migrate.
- **Services.** Use relative `/api/nhl/...` URLs and keep the Promise-based style. `NhlStandingAndPlayoffService` has a
  private `get<T>(url)` helper that wraps `HttpClient` the same way.
- **Backend (done).** `AllowedRoots` in `NhlController.cs` already allows `score`, `scoreboard`, `schedule`,
  `club-schedule`, `club-schedule-season`, `standings`, `gamecenter`, `player`, `roster`, `club-stats`,
  `playoff-series`, `playoff-bracket`, `skater-stats-leaders` and `goalie-stats-leaders`. Cache: 10s for
  `score`/`scoreboard`/`gamecenter`; 5 min for schedules, standings and `playoff-series`; 30 min for player and stats;
  1 min otherwise (including `playoff-bracket`).
- **Shared components used by unmigrated pages.** When a migrated shared component breaks an out-of-scope caller, make the
  caller compile with the smallest change (a `$any` cast, or the new service call) and leave a TODO that points here.
- **Unit tests (done for phases 0–4).** `npm run test:ci` runs all specs. See section 7 for what each phase must add.
  - Real API responses live in `shared/testing/nhl-api-mocks/` as JSON files (captured 2026-09-15; only item counts
    trimmed). `nhl-api-mocks.ts` returns fresh copies (`mockScoreResponse()`, `mockStandingsTeams()`,
    `mockRankedCarouselSeries('A')`, `mockGameBundle(2025021057)`, ...).
  - `derived*` helpers change real data into states that can't be captured yet: a live game, live and intermission landings,
    TBD/postponed games, and a series in progress. They're assumptions; replace them with captured responses when possible (phase 8).
  - Component specs use `AppTestingModule` (`shared/testing/app-testing.module.ts`) and `HttpTestingController`.
  - Specs for unmigrated components still skip rendering. Give them real tests when their phase migrates them.
- **Error handling.** Migrated components `.catch()` service promises (the service already logs), and show an empty
  or fallback state instead of stale data. Without it, a failed request is an unhandled promise rejection: an
  "Uncaught (in promise)" console error in the app, and a crashed Karma run in tests.

## 7. Phases

A phase is done only when all of these are true:
1. The app compiles (`ng build`, which runs strict template checks).
2. The affected UI is checked in the browser.
3. The phase's unit tests are added or updated and `npm run test:ci` passes.

### Testing requirements (every phase)
- **Real data.** Capture real responses for every endpoint the phase uses into `shared/testing/nhl-api-mocks/` with
  curl. Keep objects unchanged; only trim the number of items. Add accessors to `nhl-api-mocks.ts`. Use `derived*`
  helpers only for states that can't be captured, and keep their changes minimal.
- **Services:** with `HttpTestingController`, test the requested URL, the happy path, missing optional fields or empty
  lists, and that an HTTP error rejects.
- **Utils:** test with real data plus the edge cases the phase's mapping tables call out (multi-OT, shootout, missing
  fields, unknown teams).
- **Components:** render with fixture data via `setInput`. Test the happy path, empty data, a failed service call
  (the component handles the rejection and shows a sensible state), and the important edge cases. Replace the
  "Not rendered" placeholder spec of every component the phase migrates.
- **Existing tests:** update any spec whose component, service or model changed.

| # | Phase | Status | Files | Check against | Tests |
|---|---|---|---|---|---|
| 0 | Foundation: new models, enums, `PeriodUtils`, game-state utils, abbrev→ID map + Utah (68) in team/logo/color utils, backend proxy + allowlist | Done | `shared/models/nhl-web-api/*`, `shared/enums/*`, `shared/utils/*`, `NhlController.cs`, `NhlApiClient.cs` | `ng build` passes | Done: `period-utils`, `nhl-game-info-utils`, `nhl-team-utils`, `nhl-team-logo-utils`, `nhl-team-color-utils` specs |
| 1 | Scoreboard + scorecard | Done | `nhl-game.service.ts`, `home/scoreboard`, `shared/components/scorecard` | 2026-03-15 (final), a date with OT/SO, playoff date 2026-06-09, today (future) | Done: `nhl-game.service`, `scorecard`, `scoreboard` (incl. 10s refresh) specs; fixtures `score-2026-03-01`, `-06-09`, `-10-08` |
| 2 | Standings summary + shared standings component + full standings page | Done | `nhl-standing-and-playoff.service.ts`, `home/standings-summary`, `shared/components/standings`, `league-standings` | `standings/now` | Done: service grouping, `standings`, `standings-summary`, `league-standings` specs; fixture `standings-now` |
| 3 | Playoff summary + playoff-series component + series dialog; playoffs page compiles | Done | same service, `home/playoff-summary`, `playoffs/playoff-series`, `playoffs/playoff-series-dialog`, `playoffs` | 2025-26 carousel (force `isPlayoffMode` true to test), 2022-23 on the playoffs page | Done: service carousel/bracket merge and series schedule, `playoff-summary`, `playoff-series`, `playoff-series-dialog` specs; fixtures carousel, bracket, series A and O |
| 4 | Game page core: loading, header, info bar, goal scorers | Done | `nhl-game.service.ts`, `game.component`, `game-header`, `goal-scorers`, `period-utils`, `nhl-game-info-utils` | `2025021057` (reg), `2025020952` (SO), `2025030414` (playoff), `2026020056` (future), an unknown ID (error state) | Done: service bundle and series status, `PeriodUtils.getNextPeriodLabel`, `NhlGameInfoUtils.getGameDescription`, `game` (loading, errors, refresh, intermission, route change), `game-header`, `goal-scorers` specs; fixtures `gamecenter-{id}-{landing,play-by-play,boxscore,right-rail}` for the 4 games |
| 5 | Play-by-play: momentum, event timelines; verify the intermission countdown | To do | `momentum`, `event-timeline`, `mini-event-timeline`, `event`, `mini-event` | same games; intermission during a live preseason game | Real specs replacing the `event` and `mini-event` placeholders; `momentum`, `event-timeline`, `mini-event-timeline` specs; blocked-shot ownership and penalty text edge cases |
| 6 | Boxscore + right-rail: game stats, top players, rating, player dialog, headshots | To do | `game-stats`, `game-top-players`, `player-game-dialog`, `stats-utils`, `nhl-image.service` | same games | `StatsUtils` rating (skater, goalie, missing stats); `game-stats`, `game-top-players` specs; real spec replacing the `player-game-dialog` placeholder; `player/{id}/landing` fixture |
| 7 | Team form | To do | `team-form`, `previous-game` | a future game | `club-schedule-season` fixture; `team-form` spec (last 5 finished games before the game) and a real spec replacing the `previous-game` placeholder |
| 8 | Live validation + cleanup: run through a live preseason game (from 2026-09-29), remove `testNewNhlApi` and its call in `HomeComponent`, remove the deprecated old-status overload in `NhlGameInfoUtils`, delete unused old models | To do | — | live game | Capture live score and gamecenter responses (in period, intermission, `CRIT`) and replace the `derived*` live helpers; remove tests for the deprecated overload |

## 8. Decisions

1. **HokMob rating:** use approach A (simple) for now. The exact version (B) comes later. See the TODO in
   `StatsUtils.calculateSkaterHokmobRating`.
2. **Out-of-scope pages that share components:** they stay broken until migrated. TODO comments with a short fix note
   are on `TeamComponent`, `TeamScheduleComponent`, `SingleTeamFormComponent`, `PlayoffsComponent` and
   `GameComponent` (its phase 5–7 sections).
   `LeagueStandingsComponent` was migrated in phase 2, and `PlayoffSeriesDialogComponent` in phase 3.
3. **Header search:** out of scope. TODO comments are on `SearchInputComponent` and `NhlSearchService`
   (replacement: `search.d3.nhle.com`, which needs backend proxy support for another host). Its failing
   `statsapi.web.nhl.com` requests show up as console errors on every page.
4. **Series dialog moved into scope (phase 3).** Home series cards open it, so leaving it broken would break a home page
   feature.
5. **Next game date on series cards** is only loaded for full-size cards, since the home cards don't show it. That
   avoids 8 extra requests on the home page.
6. **Unit tests use real API responses.** Tests assert values from captured responses rather than hand-written
   objects, so a wrong assumption about the API shape fails a test. Each phase adds tests for what it migrates.
7. **Components handle service errors.** Every migrated component catches service rejections and shows an empty or
   fallback state. Loading a new day or standings type clears the old data; a failed scoreboard refresh keeps the
   games already shown.
8. **Game bundle:** only the landing is required. Failed play-by-play, boxscore or right-rail requests resolve as
   `undefined`, so a partial outage still shows the header and goal scorers.
9. **Unmigrated game page sections are hidden** (`unmigratedSectionsEnabled`) until their phase, instead of rendering
   old-model components without data. Scorer clicks don't open the player dialog until phase 6.
10. **Goal scorers read the landing's scoring summary directly** instead of converting goals into `GoalModel`.

## 9. Risks

- **Undocumented API.** It can change without notice. The typed models plus backend proxy keep changes in one place.
- **Unverified live fields:** `clock.inIntermission`, `clock.secondsRemaining` during intermission, `CRIT` state, and
  `situationCode` for power plays.
- **Live game page assumptions:** `landing.summary.scoring` is assumed to list the current period before it has a
  goal, and the intermission countdown assumes `clock.secondsRemaining` counts down the intermission. The derived
  live and intermission landings encode both.
- **Untested in-progress playoff series.** All 2025-26 series were finished when phase 3 was tested, so the next game
  date on series cards and unplayed games in the series dialog (no per-game `seriesStatus`) haven't run against real
  data. Check during the 2027 playoffs.
- **Carousel coverage.** It's unverified whether the carousel lists series before both teams are known. The home summary
  only shows known series; the playoffs page needs `playoff-bracket` for a full bracket.
- **Request volume:** the game page makes up to 4 requests per poll (was 1). The 10s backend cache keeps upstream load flat.
- **Derived test data.** The live game, TBD/postponed game and in-progress series fixtures are real responses edited to
  match the models, not captured states. Tests built on them can pass while the real live shape differs. Replace them
  with captured responses in phase 8 or the 2027 playoffs.
- **Stale fixtures.** Captured responses can drift from the live API. When a phase finds a changed field, re-capture
  the affected fixtures and fix the specs.

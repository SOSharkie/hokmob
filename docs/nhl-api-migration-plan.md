# NHL API Migration Plan: Home Page & Game Page

Status: **Done** · Phases 0–8 done with unit tests (2026-09-15). The live game checks in section 10 stay open until
the preseason starts on 2026-09-19 (the regular season starts 2026-09-29).
Scope: home page (scoreboard, standings summary, playoff summary and series dialog) and game page (header, goals, stats,
momentum, event timelines, top players, player dialog, team form). Player and team pages are out of scope.

Reference: [Zmalski/NHL-API-Reference](https://github.com/Zmalski/NHL-API-Reference/blob/main/README.md), section
[api-web.nhle.com](https://github.com/Zmalski/NHL-API-Reference#nhl-web-api-documentation). Phases 0–8 only use
api-web. The stats API (`api.nhle.com/stats/rest`) is compared with it in section 3 of
[`nhl-api-legacy-migration-plan.md`](nhl-api-legacy-migration-plan.md).
All new calls go through the backend proxy: `/api/nhl/<path>` → `https://api-web.nhle.com/v1/<path>`
(`HokMob.App/Controllers/NhlController.cs`, cached by `HokMob.App/Services/NhlApiClient.cs`).

## 1. Key findings

- **Every old host is gone**, not just deprecated. `statsapi.web.nhl.com`, `cms.nhl.bamgrid.com` (headshots) and
  `suggest.svc.nhl.com` (search) no longer resolve in DNS. Unmigrated pages don't work.
- **No 1:1 replacement.** The old `/game/{id}/feed/live` returned everything in one response. The new API splits it
  across four gamecenter endpoints: `landing`, `play-by-play`, `boxscore` and `right-rail`.
- **The shapes are completely different.** Old models under `shared/models/nhl-*` (deleted in the second plan's phase
  15) can't be reused for these pages.
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
  The preseason starts 2026-09-19. `clock` and intermission behavior must be checked against a real live game
  (checklist in section 10).

## 2. Endpoint mapping

| Feature | Old (dead) | New |
|---|---|---|
| Home scoreboard | `statsapi /schedule?date=…&hydrate=linescore,broadcasts,seriesSummary` | `score/{YYYY-MM-DD}` |
| Mini standings | `statsapi /standings?season=…&standingsType=byLeague` | `standings/now` (or `standings/{date}`) |
| Playoff summary | `statsapi /tournaments/playoffs?expand=round.series…` | `playoff-series/carousel/{season}/`, plus `playoff-bracket/{year}` for seed ranks |
| Playoff series games | `statsapi /schedule?teamId=a,b&gameType=P` | `schedule/playoff-series/{season}/{letter}/` |
| Game live feed | `statsapi /game/{id}/feed/live` | `gamecenter/{id}/landing`, `…/play-by-play`, `…/boxscore`, `…/right-rail` |
| Game model (broadcasts, series summary) | `statsapi /schedule?gamePk=…` | `landing.tvBroadcasts`; for playoffs, `seriesStatus` from `score/{gameDate}` (it's only in `score`, not `landing` or `right-rail`) |
| Team form | `statsapi /schedule?teamId=…&startDate&endDate` | `club-schedule-season/{abbrev}/{season}` (the game's season, plus the previous one early in a season) |
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
- `NhlGameInfoUtils.isFutureGame/isLiveGame/isCompletedGame` take a `gameState`. Phase 8 removed the old status model
  overload; the team page's `TeamNextGameComponent` compares the old `abstractGameState` directly (see its TODO).

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

The scorecard, game header, goal scorers, momentum chart and event timelines use it.

### Playoff series status
`NhlGameInfoUtils.getSeriesStatusShort(seriesStatus)` builds "CAR leads 3-1", "Tied 2-2", "CAR wins 4-2", or "(0-0)"
before the series starts, from `topSeedTeamAbbrev/topSeedWins/bottomSeedTeamAbbrev/bottomSeedWins/neededToWin`.

### Team names
- `score`: `homeTeam.name.default` is the **common name only** ("Jets").
- `landing` and `boxscore`: `placeName.default` + `commonName.default` ("Winnipeg" + "Jets").
- `standings`: `teamName.default` is the full name, but **rows have no team ID**, only `teamAbbrev.default`.
- `schedule/playoff-series`: series teams have `name` (common name); game teams have `commonName` and `placeName`.
- Done: `NhlTeamUtils.getTeamIdByAbbrev(abbrev)`, and Utah (68) in the team, logo and color utils. Utah's logo is
  `assets/logos/utah.png`, like every other team.
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

Phase 8 removed the temporary `NhlGameService.testNewNhlApi()` and its call in `HomeComponent`.

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

`DateTimeUtils.isPlayoffMode()` was hard-coded to dates (May 21 to end of September). It now works from season dates:
see section 11.1 of [`nhl-api-legacy-migration-plan.md`](nhl-api-legacy-migration-plan.md).

## 5. Game page (phases 4–8 done)

### 5.1 Data loading (`game.component.ts`): done (phase 4)
The game page no longer calls `getNhlGameLiveFeed` or `getNhlGame` (the team page still does). It loads:

| Call | Feeds |
|---|---|
| `gamecenter/{id}/landing` | Header (teams, score, state, clock, period), date/venue/TV, goal scorers (`summary.scoring`), three stars |
| `gamecenter/{id}/play-by-play` | Momentum chart, event timelines, OT length, player names (`rosterSpots`) |
| `gamecenter/{id}/boxscore` | Per-player stats → top players, HokMob ratings, player dialog |
| `gamecenter/{id}/right-rail` | Team stats (`teamGameStats`), shots/goals by period, season series |
| `score/{gameDate}` (playoff and finished games) | `seriesStatus` for the header and league label; the highlight videos (`threeMinRecap`, `condensedGame`) |
| `club-schedule-season/{abbrev}/{season}` per team (non-final only; the previous season too when needed) | Team form |

- Service: `NhlGameService.getGameBundle(gameId)` requests landing, play-by-play, boxscore and right-rail in parallel
  and returns a `GameBundle` (`models/nhl-web-api/game-bundle.model.ts`). The landing is required: if it fails, the
  promise rejects and the page shows "This game couldn't be loaded." The other three resolve as `undefined` when
  they fail, so the header still shows.
- Service: `NhlGameService.getScoreGame(gameId, gameDate)` → `score/{landing.gameDate}` → that game, or
  `undefined`. Called for playoff games (`seriesStatus`) and finished games (the recap video path). If it fails, the
  league label is "NHL Playoffs" and the watch link falls back to the NHL.com game center.
- Watch button (top right of the header): the API has no stream links. Games that aren't over link "Where to Watch"
  to `https://www.nhl.com/gamecenter/{id}`, which lists the broadcasters. Finished games show "Highlights", which
  opens `HighlightsDialogComponent`: the NHL's Brightcove player
  (`players.brightcove.net/6415718365001/D3UCGynRWU_default/index.html?videoId={id}`, the player nhl.com embeds) in
  an iframe, with Recap and Condensed Game tabs and a "Watch on NHL.com" link. The video IDs are the numbers at the
  end of the `score` paths (`NhlVideoUtils.getHighlightVideos`); `right-rail.gameVideo` has the same bare IDs. A path
  without an ID falls back to linking `https://www.nhl.com` + the path, and no video to "NHL.com Game Center". The
  player has no framing restrictions, plays from localhost and shows a pre-roll ad first (checked 2026-09-16).
  `nhl.com/video/{id}` without the slug is a 404, so the NHL.com link needs the `score` path.
- Refresh: every 10s while the game isn't over and is live or starts today. It reloads the whole bundle (gamecenter
  is cached 10s on the backend). Once the game is over, the refresh stops and the series status and highlights are
  reloaded. A failed refresh keeps the data shown, and a failed optional response keeps the previous one.
- A route change loads the new game and ignores late responses for the previous one.
- The momentum chart and both event timelines (phase 5) show for games that aren't in the future, once the
  play-by-play has loaded. They're hidden when it fails.
- Phase 6: each bundle builds `homePlayers` / `awayPlayers` (`StatsUtils.getGamePlayers`, using the play-by-play
  roster spots for full names). Top players show once both teams have players, for finished games and live games
  with more than 10 plays. Game stats show for games that aren't in the future, once the right-rail has
  `teamGameStats`. Clicking a scorer, timeline player or top player opens the player dialog, or does nothing for a
  player without boxscore stats.
- Phase 7: for a game that isn't over, the team form of both teams loads once (not on refresh) after the first bundle.
  A team whose request fails gets no games. The section shows while the game isn't over and at least one team has
  games. The `unmigratedSectionsEnabled` flag was removed.
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
| Watch link | Third-party stream URL built from `gameData.teams.home.name` | NHL.com game center, or the recap video for finished games (see 5.1) |
| Power play badge (TODO) | not implemented | Optional: derive from the latest play's `situationCode` |

`NhlGameInfoUtils.getNhlGameDescription` (old `NhlSeriesSummaryModel`) was replaced by `getGameDescription`.
`landing` has no `gameOutcome`, so final labels fall back to `periodDescriptor.periodType` (`SO`, `OT`).

### 5.3 Intermission countdown: built in phase 4, live check open (section 10)
The old code timed from the `PERIOD_END` play's wall-clock `about.dateTime`.
**New plays have no wall-clock timestamp**, so that approach can't be ported.
- `isIntermission` is `landing.clock.inIntermission` for a live game. The countdown starts from
  `clock.secondsRemaining`, which is expected to count down the intermission, and a 1s timer moves it between
  refreshes ("16:40 till 2nd"). **Not verified yet:** there are no live games before the preseason starts on
  2026-09-19, so phases 5 and 8 couldn't check it. It's the first check in section 10 (TODO in
  `GameComponent.updateIntermission`).
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

- **Goal highlight clips (done, see issue #85):** each goal has `highlightClip` (a Brightcove video ID), the matching
  `highlightClipSharingUrl` (its NHL.com page), and French/alternate variants (`highlightClipFr`,
  `highlightClipSharingUrlFr`, `discreteClip`, `discreteClipFr`, `pptReplayUrl`) not currently used. Clips are posted
  some time after the goal, so live games and recent goals may not have one yet. `scorerClicked` (goal scorers) and
  `playerClicked` (event timelines) now emit a `PlayerClick { playerId, eventId? }`: `eventId` is the play's/goal's
  `eventId` for a goal's main scorer, and missing for an assist or a penalized player.
  `NhlVideoUtils.getGoalHighlightVideo(goal)` builds the `HighlightVideo` from `highlightClip`/`highlightClipSharingUrl`,
  or returns undefined without a clip. `GameComponent.openGoalOrPlayerDialog` looks the clicked `eventId` up in
  `landing.summary.scoring`, opens the goal highlight dialog when a clip is found, and falls back to the player game
  dialog otherwise (including every non-goal click, which never carries an `eventId`).

### 5.5 Game stats (`game-stats`): done (phase 6)
Source: `right-rail.teamGameStats[]` (`{ category, awayValue, homeValue }`). Convert to a map keyed by `category`.
Inputs: `teamGameStats`, `homeTeamId`, `awayTeamId` (right-rail has no team IDs, so they come from the landing) and the
logos.

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
| (new) | none | `giveaways`, `faceoffWins` (not shown) |

- The rows are built from a table of definitions: the value shown, the value compared (`powerPlayPctg` for power
  plays) and whether lower is better (penalty minutes). The better team's value gets its color; equal values and
  missing stats aren't highlighted, and a missing stat shows "-".
- Faceoff % is shown with one decimal ("66.0%"). The shots doughnut is created on a `@ViewChild` canvas with the team
  colors (the old chart started red/blue and used a global `id`), updated on changes and destroyed with the component.

### 5.6 Momentum chart (`momentum`): done (phase 5)
Source: `play-by-play.plays[]`.

| Old | New |
|---|---|
| `result.eventTypeId` `GOAL` / `SHOT` / `MISSED_SHOT` / `BLOCKED_SHOT` | `typeDescKey` `goal` / `shot-on-goal` / `missed-shot` / `blocked-shot` |
| `play.team.id` | `details.eventOwnerTeamId` |
| `about.period`, `about.periodTime` | `periodDescriptor.number`, `timeInPeriod` |
| `linescore.periods.length > 3` | Max `periodDescriptor.number` > 3 (exclude SO) |
| OT length: `currentPlay.about.periodTime` | Last play's `timeInPeriod` in each overtime (a full regular season OT ends with `period-end` at `05:00`) |
| Team colors: `gameData.teams.home/away.id` | `playByPlay.homeTeam.id` / `awayTeam.id` (same IDs as the landing) |

- Input: `playByPlay`. The unused logo inputs were removed.
- **Blocked shots:** `eventOwnerTeamId` is the **shooting** team. That held for all 89 blocked shots in the three
  captured finished games, so crediting it matches the old logic.
- X-axis: one point per minute. The regulation periods are always shown (20 minutes each, even before they're
  played). Each overtime is added from its plays and lasts until its last play (up to 20 minutes), so every playoff
  overtime gets its own segment ("OT", "2OT"). The old chart only handled one overtime. Each period's label is at its
  first point, and "End" is at the last point.
- Shootout plays aren't counted. Weights are unchanged: goal 9, shot on goal 7, missed shot 5, blocked shot 4, capped
  at ±30 per minute.
- The chart is created on a `@ViewChild` canvas in `ngAfterViewInit` (the old code looked it up by a global `id`) and
  destroyed with the component.
- **Goal tooltip:** hovering a goal puck shows that minute's goals (scoring team logo, period and time, scorer,
  score, assists by full name) in a template tooltip. Chart.js's own tooltip stays disabled; its `external` callback
  (which still fires with `enabled: false`) sets the hovered goals and position, and a `filter` skips points without
  a goal. The tooltip opens below points in the top half of the chart and above the others, clamped to the chart
  width.

### 5.7 Event timelines (`event-timeline`, `mini-event-timeline`, `event`, `mini-event`): done (phase 5)
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

`landing.summary.penalties` has the same `descKey` text and **no player IDs**, so the timelines use play-by-play.

- **Shared helpers:** `PlayByPlayUtils` (`shared/utils/play-by-play-utils.ts`), with play types in `NhlPlayTypeEnum`.
  - `getKeyEventPeriods` returns `KeyEventPeriod[]`. It lists every period with plays, in `sortOrder`, including
    periods without goals or penalties, but never the shootout.
  - Also `getRosterSpotMap`, `getMainPlayerId` / `getMainPlayerLabel`, `getAssistPlayerIds` and `getPenaltyLabel`.
- **Inputs:** the timelines take `playByPlay` (the mini timeline also takes the logos). `app-event` and `app-mini-event`
  take `play`, `homeTeamId` and `rosterSpots` (a `Map` by player ID), and emit the clicked player ID.
- **Names:** scorers and penalized players show full names. Assists show full names in `event` and last names in
  `mini-event`.
- **Penalty text:** the humanized `descKey` ("Holding the stick"; `interference-goalkeeper` becomes "Goalkeeper
  interference"), with the severity unless it's a minor ("Too many men on the ice (bench minor)"). Without a
  `descKey`, the severity ("Minor") or "Penalty".
- **Bench minors** have no `committedByPlayerId`, only `servedByPlayerId` (real example: VGK's too many men in
  `2025030414`). They show "Ivan Barbashev (served)", and clicking opens that player. Without any player, the label is
  "Team penalty".
- "End" shows once `playByPlay.gameState` is final. The game page doesn't use the full `app-event-timeline`, but it
  was migrated with the same inputs.

### 5.8 Top players, HokMob rating, player dialog (`game-top-players`, `player-game-dialog`, `StatsUtils`): done (phase 6)
Source: `boxscore.playerByGameStats.{homeTeam,awayTeam}.{forwards,defense,goalies}`.

- **`GamePlayer`** (in `boxscore.model.ts`, not part of the response) replaces `NhlBoxscorePlayerModel` and
  `GamePlayerModel`: `playerId`, `teamId`, `isHome`, `name`, `position`, `headshot`, `hokmobRating`, and either
  `skaterStats` (`BoxscoreSkater`) or `goalieStats` (`BoxscoreGoalie`).
- **`StatsUtils.getGamePlayers(boxscore, isHome, rosterSpots?)`** returns a team's dressed skaters and goalies, best
  rated first. Names and headshots come from the play-by-play roster spots. Without them it uses the boxscore's
  short name ("M. Scheifele") and `NhlPlayerHeadshotUtils.getHeadshotUrl(season, abbrev, id)`. Backup goalies are
  listed with rating 0.
- **Top players** take `homePlayers` / `awayPlayers` and line up each team on a rink, like Fotmob's lineups: its best
  rated goalie, 2 defensemen and 3 forwards (C, L or R). Backup goalies who didn't play are rated 0, so a tie goes to
  the goalie with the most time on ice. The star goes to the best rated player on the rink; the home player wins a
  tie. It's no longer written into the stats objects.
  - The rink is drawn in feet from a 200.13ft by 98.42ft rink diagram. It lies across the card (home on the left) and
    is drawn 20% narrower (78.74ft) there, so it isn't too tall. Below the 700px phone breakpoint it stands up (home
    at the top) at full width, capped at 400px wide. Players are placed by distance from their own end boards
    (goalie 17ft, defense 52ft, forwards 85.6ft) and across the rink.
  - The benches below the lying rink show each team's logo and head coach from the right-rail
    `gameInfo.{homeTeam,awayTeam}.headCoach`. They're hidden on phones, and when neither coach is known.
  - Hovering a player in the goal scorers or the event timelines highlights their spot with a ring (`highlightedPlayer`,
    a `PlayerHighlight { playerId, goalIndex? }` passed through `GameComponent.highlightPlayer`). Hovering a goal also
    turns that goal's puck the same color (the rating blue, `StatsUtils.hokmobRatingBlue`, for the starred player, and
    the rating green for everyone else): `goalIndex` is its index among the scorer's goals in this game, in scoring
    order (the timelines use `PlayByPlayUtils.getGoalIndexes`), not `goalsToDate`. Assists and penalties have no index,
    and a 4th+ goal has no puck. It's desktop only: `highlightPlayer` ignores hovers unless `(hover: hover)` matches,
    because a tap fires `mouseenter` and would leave the player highlighted.
- **Player dialog** data is `PlayerGameDialogData { player }`. Its bio and game stats are the shared
  `PlayerGameStatsComponent` (`game/player-game-stats/`, extracted for issue #85): it takes `player` and loads
  `NhlGameService.getPlayerLanding` itself, filling in the country (flag) and age, which show "-" until it loads or
  when it fails. The team logo and headshot are the game's (Comrie played for WPG in `2025021057` but his landing now
  says SJS); the landing headshot is only a fallback. The skater "Face Offs" wins/taken row became "Faceoff %", shown
  for centers and for other skaters with a percentage above 0.
- **Goal highlight dialog** (`game/goal-highlight-dialog/`, issue #85): opened instead of the player dialog when the
  clicked goal has a posted highlight clip (see 5.4). It reuses `PlayerGameStatsComponent` for the scorer's bio and
  stats, with the goal's video below in the same embedded Brightcove player as the highlights dialog
  (`NhlVideoUtils.getEmbedUrl`). Data is `GoalHighlightDialogData { player, video: HighlightVideo }`.
  It passes `[compact]="true"` to `PlayerGameStatsComponent`, which lays the bio out on one row next to the headshot
  and the stats in a wide wrapping bar instead of the player dialog's tall scrolling list, so the 16:9 video still
  fits on screen below it. The panel class sizes the dialog to its video
  (`width: min(94vw, 1400px, calc((95vh - 210px) * 16 / 9))`, the subtraction being the header and stats above it),
  so the video fills the dialog's width, runs to its bottom edge, and the whole dialog comes within about 30px of the
  top and bottom of the window. The "Watch on NHL.com" link sits in the header, left of the close button. The compact
  bar measures
  itself on view init and on a window resize (`fitCompactStats`), and drops Giveaways, then Takeaways, then Blocks,
  to stay on one row; once all three are gone it wraps as before, which is what a phone gets. Its Time On Ice,
  Plus/Minus and Penalty Minutes labels shorten to "TOI", "+/-" and "PMs", with the full name as the `title` tooltip.
- **Headshots:** `NhlPlayerHeadshotUtils` (`shared/utils/nhl-player-headshot-utils.ts`) builds season headshot URLs and
  swaps a failed image for `assets/blank_headshot.png` (`(error)="showBlankHeadshot($event)"`).
  `NhlImageService.getNhlPlayerHeadshot` has a TODO; the player page, search results and stat leaderboards still call it.

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
- **Faceoffs (done 2026-09-16):** the faceoff term, `faceoffWinningPctg - 0.5`, is scaled by the faceoffs taken, up to
  10 (`StatsUtils.fullWeightFaceoffCount`), for any skater. A center who lost 2 of 2 now loses 0.1 instead of 0.5, and
  one who took none loses nothing. The game page counts faceoffs with `PlayByPlayUtils.getFaceoffCounts`, and player
  recent games use the stats API's `totalFaceoffs` (second plan, decision 2). Without a count (the play-by-play or the
  report failed), it falls back to A: the full term, for centers only. The power-play assists half of B is still open.

Player dialog: `nhlStatsService.getNhlPlayerStats` (dead) → `GET /api/nhl/player/{id}/landing`. Use
`birthCountry` (`CAN`, flags still work), age from `birthDate`, `weightInPounds`, `position`, and `headshot`.
Put this call in the game service so it doesn't depend on the out-of-scope player service.

Headshots: `NhlImageService.getNhlPlayerHeadshot` (dead host, blob + FileReader) → use the `headshot` URL directly as the
`<img src>`, from `rosterSpots` or player landing, with `assets/blank_headshot.png` as the `onerror` fallback.

### 5.9 Team form (`team-form`, `previous-game`): done (phase 7)
- Service: `NhlGameService.getTeamFormGames(teamAbbrev, landing)` → `GET /api/nhl/club-schedule-season/{abbrev}/{landing.season}`.
  It loads the game's season instead of `now`, so the form belongs to the game. When that season has fewer than 5
  form games (before and early in the preseason), it also loads the response's `previousSeason` and fills in from it.
  If only that second request fails, the games found so far are returned. The old `getTeamGames(from, to, teamId)`
  stays for the unmigrated team and player pages.
- Filter: `NhlGameInfoUtils.getTeamFormGames(games, game, count = 5)` keeps finished games (`OFF`/`FINAL`, via
  `isCompletedGame`) other than the game itself with `startTimeUTC` before the game, most recent first. Preseason games
  (`gameType` 1) only count for a preseason game.
- Facts from the captured schedules: on 2026-09-15, `now` and `20262027` return the same 88 games, all `FUT`. Finished
  preseason games have `gameState` `FINAL`; finished regular season and playoff games have `OFF`. Only a past season's
  response has `nextSeason`.
- `app-team-form` inputs: `homeTeamId`, `awayTeamId`, `homeTeamGames`, `awayTeamGames` (`ClubScheduleGame[]`, most
  recent first, rendered as given). A team without games shows "No recent games". The old version checked
  `homeTeamGames` for both columns.

| Previous game field | Old (`NhlGameDayModel`) | New (`ClubScheduleGame`) |
|---|---|---|
| Route | `gameDay.games[0].gamePk` | `id` |
| Team IDs / logos | `teams.home.team.id` | `homeTeam.id` (`NhlTeamLogoUtils`, fallback logo for unknown IDs) |
| Short name | `NhlTeamUtils.getTeam(id).teamName` | `homeTeam.commonName.default`, falling back to `NhlTeamUtils.getTeam(id).teamName` |
| Score | `teams.home.score` | `homeTeam.score`; "N/A" without scores |
| Result color | `team` input (`NhlTeamModel`) | `teamId` input: green for a win (OT and SO included), red for a loss, none without scores or if the team didn't play |

- `SingleTeamFormComponent` (team page) passes its old game days with `$any` so it compiles; its TODO describes the fix.

## 6. Implementation approach

- **New models (done).** Typed interfaces under `shared/models/nhl-web-api/` mirror the new responses:
  `score.model.ts`, `standings.model.ts` (plus `StandingsGroup`), `playoffs.model.ts` (carousel, bracket, series
  schedule; `PlayoffCarouselSeed.rank` is merged in by the service), `gamecenter-landing.model.ts`,
  `play-by-play.model.ts`, `boxscore.model.ts`, `right-rail.model.ts`, `club-schedule.model.ts`,
  `player-landing.model.ts`, `game-bundle.model.ts` (all gamecenter responses of a game), `GamePlayer` (a rated boxscore
  player, in `boxscore.model.ts`), and shared `common.model.ts` (`LocalizedString`, `PeriodDescriptor`, `GameClock`,
  `GameOutcome`, `TvBroadcast`, `GamecenterTeam`, `SeriesStatus`).
  Don't adapt the new data into the old models; too many fields have no equivalent. Converting between new models is
  fine when a shared component needs it (the series dialog converts series schedule games to `ScoreGame`).
- **Old models:** phase 8 deleted the ones nothing imported anymore: `game-player`, `nhl-general/nhl-standings` and
  the `nhl-playoffs` models except `nhl-series-summary`. Phase 15 (second plan) deleted the rest.
- **Services.** Use relative `/api/nhl/...` URLs and keep the Promise-based style. `NhlStandingAndPlayoffService` has a
  private `get<T>(url)` helper that wraps `HttpClient` the same way.
- **Backend (done).** `AllowedRoots` in `NhlController.cs` already allows `score`, `scoreboard`, `schedule`,
  `club-schedule`, `club-schedule-season`, `standings`, `gamecenter`, `player`, `roster`, `club-stats`,
  `playoff-series`, `playoff-bracket`, `skater-stats-leaders` and `goalie-stats-leaders`. Cache: 10s for
  `score`/`scoreboard`/`gamecenter`; 5 min for schedules, standings and `playoff-series`; 30 min for player and stats;
  1 min otherwise (including `playoff-bracket`).
- **Shared components used by unmigrated pages.** When a migrated shared component breaks an out-of-scope caller, make the
  caller compile with the smallest change (a `$any` cast, or the new service call) and leave a TODO that points here.
- **Unit tests (done for phases 0–8).** `npm run test:ci` runs all specs. See section 7 for what each phase must add.
  - Real API responses live in `shared/testing/nhl-api-mocks/` as JSON files (captured 2026-09-15; only item counts
    trimmed). `nhl-api-mocks.ts` returns fresh copies (`mockScoreResponse()`, `mockStandingsTeams()`,
    `mockRankedCarouselSeries('A')`, `mockGameBundle(2025021057)`, ...).
  - `derived*` helpers change real data into states that can't be captured yet: a live game, live and intermission landings,
    TBD/postponed games, and a series in progress. They're assumptions; replace them with captured responses when possible
    (section 10).
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
| 5 | Play-by-play: momentum, event timelines | Done | `momentum`, `event-timeline`, `mini-event-timeline`, `event`, `mini-event`, `play-by-play-utils`, `nhl-play-type.enum`, `game.component` | `2025021057` (reg), `2025020952` (OT + SO), `2025030414` (playoff, bench minor), `2026020056` (future). The intermission check moved to section 10 (no live games yet) | Done: `PlayByPlayUtils` (grouping, names, bench minors, penalty text), `momentum` (layout, weights, blocked-shot ownership, cap, OT and multi-OT, shootout, refresh), `event-timeline`, `mini-event-timeline`, real `event` and `mini-event` specs, `game` wiring; `derivedLivePlayByPlay` helper |
| 6 | Boxscore + right-rail: game stats, top players, rating, player dialog, headshots | Done | `game-stats`, `game-top-players`, `player-game-dialog`, `stats-utils`, `nhl-player-headshot-utils`, `nhl-image.service` (TODO only), `nhl-game.service.ts`, `game.component` | `2025021057` (reg; goalie swapped into STL's top 6), `2025030414` (playoff; star to the away team), `2026020056` (future: sections hidden) | Done: `StatsUtils` (skater and goalie rating, faceoff term, penalties, caps, missing stats, `getGamePlayers`, sorting), `NhlPlayerHeadshotUtils`, service `getPlayerLanding`, `game-stats`, `game-top-players`, real `player-game-dialog` spec, `game` wiring and dialog; fixtures `player-8476460-landing` (Scheifele), `player-8477480-landing` (Comrie) |
| 7 | Team form | Done | `team-form`, `previous-game`, `nhl-game.service.ts`, `nhl-game-info-utils`, `game.component`, `single-team-form` (compile fix) | `2026020056` (future, UTA @ BOS: filled in from 2025-26), a finished game (section hidden) | Done: `NhlGameInfoUtils.getTeamFormGames` (order, unfinished and preseason games, count, missing data), service `getTeamFormGames` (previous-season fill-in, failures), `team-form`, real `previous-game` spec, `game` wiring (fill-in, one team failing, late responses, no reload on refresh); fixtures `club-schedule-season-{bos,uta}-{20252026,20262027}` |
| 8 | Cleanup + live validation prep: remove `testNewNhlApi` and its call in `HomeComponent`, remove the deprecated old-status overload in `NhlGameInfoUtils`, delete unused old models, TODOs where live data is assumed, `capture-live-fixtures.js`. The live run itself moved to section 10 | Done (live checks open) | `home.component`, `nhl-game.service.ts`, `nhl-game-info-utils`, `team-next-game` (compile fix), old models, `game.component` / `period-utils` / `nhl-api-mocks.ts` (TODOs), `ClientApp/capture-live-fixtures.js` | `ng build`, `test:ci` (329 specs), the served dev bundle (no `testNewNhlApi`, `/api/nhl` calls return 200; the Browser pane check was skipped because another session held port 4200), capture script on `2025021057` (finished) and with no live game | Done: removed the overload test. Open (section 10): capture live responses and replace the `derived*` live helpers |

## 8. Decisions

1. **HokMob rating:** use approach A (simple) for now. The exact version (B) comes later. See the TODO in
   `StatsUtils.calculateSkaterHokmobRating`.
2. **Out-of-scope pages that share components:** they stay broken until migrated. TODO comments with a short fix note
   are on `TeamComponent`, `TeamScheduleComponent`, `SingleTeamFormComponent` and `PlayoffsComponent`.
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
9. **Unmigrated game page sections were hidden** (`unmigratedSectionsEnabled`) until their phase, instead of rendering
   old-model components without data. Team form was the last one; the flag was removed in phase 7.
10. **Goal scorers read the landing's scoring summary directly** instead of converting goals into `GoalModel`.
11. **Event timelines skip the shootout**, like the goal scorers. Bench minors show the player who served them.
    Penalty text is built from `descKey`, since no response has nicer text.
12. **Each overtime's length on the momentum chart comes from its last play**, so every playoff overtime is shown,
    not only the first.
13. **Rated players are built once per bundle on the game page** (`StatsUtils.getGamePlayers`) and shared by top
    players and the player dialog, like the old `homePlayerStats` / `awayPlayerStats`.
14. **The player dialog shows the game's team and headshot**, not the player's current team from `player/{id}/landing`,
    which is only used for the bio (country, age).
15. **Faceoffs in the player dialog are a percentage.** The rating uses play-by-play counts, but the dialog doesn't. Centers
    always show it; other skaters only with a percentage above 0.
16. **Team form fills in from the previous season.** `club-schedule-season/{abbrev}/now` has no finished games until
    the preseason starts, so a form limited to the current season would be empty or short for the first games. It uses
    the game's season and adds last season's games when there are fewer than 5, like 2026020056's form showing BOS's
    and UTA's 2026 playoff losses.
17. **Preseason games only count toward a preseason game's form.** Exhibition lineups say little about a regular season
    or playoff team, so early regular season games fill in from last season instead.
18. **The plan closed without a live game.** Phase 8 did the cleanup and turned the live checks into a checklist
    (section 10), with TODOs at each assumption in the code and a script that captures the responses, instead of
    waiting until 2026-09-19.
19. **Only unused old models were deleted.** Models still imported by the team, player, stats or search pages stayed until
    those pages migrated; phase 15 of the second plan deleted them.

## 9. Risks

- **Undocumented API.** It can change without notice. The typed models plus backend proxy keep changes in one place.
- **Unverified live fields:** `clock.inIntermission`, `clock.secondsRemaining` during intermission, `CRIT` state, and
  `situationCode` for power plays.
- **Live game page assumptions:** `landing.summary.scoring` is assumed to list the current period before it has a
  goal, and the intermission countdown assumes `clock.secondsRemaining` counts down the intermission. The derived
  live and intermission landings encode both. The derived live play-by-play assumes a live game lists only the plays
  so far, in the same shape as a finished game.
- **Untested in-progress playoff series.** All 2025-26 series were finished when phase 3 was tested, so the next game
  date on series cards and unplayed games in the series dialog (no per-game `seriesStatus`) haven't run against real
  data. Check during the 2027 playoffs.
- **Carousel coverage.** It's unverified whether the carousel lists series before both teams are known. The home summary
  only shows known series; the playoffs page needs `playoff-bracket` for a full bracket.
- **Rating approach A:** the faceoff term uses play-by-play counts since 2026-09-16, but real plus/minus still has no
  power-play assists correction.
- **Live boxscore and right-rail:** it's unverified that a live game's right-rail has `teamGameStats` and its boxscore
  has `playerByGameStats`. Without them, game stats and top players stay hidden. See section 10.
- **Team form across seasons:** filling in from the previous season only goes back one season, and assumes the team
  had the same abbreviation then. A renamed or relocated team gets fewer games (the failed request is ignored). The rows
  show no dates, so April games next to October games aren't marked as last season's.
- **Request volume:** the game page makes up to 4 requests per poll (was 1). The 10s backend cache keeps upstream load flat.
- **Derived test data.** The live game, TBD/postponed game and in-progress series fixtures are real responses edited to
  match the models, not captured states. Tests built on them can pass while the real live shape differs. Replace them
  with captured responses during a live game (section 10) or the 2027 playoffs.
- **Stale fixtures.** Captured responses can drift from the live API. When a phase finds a changed field, re-capture
  the affected fixtures and fix the specs.

## 10. Open items

### Live game checklist
Nothing below could be checked before the preseason starts on 2026-09-19. Each assumption has a `TODO` in the code
pointing here. During a live game, run this from `HokMob.App/ClientApp`:

```bash
npm run capture-live-fixtures -- --watch
```

It waits for a `LIVE` or `CRIT` game (or pass a game ID), then saves `score`, `landing`, `play-by-play`, `boxscore` and
`right-rail` to `shared/testing/nhl-api-mocks/live/` each time the state changes (`p1`, `intermission-1`,
`intermission-1-later` a minute later, `crit-p3`, `off`). For each capture it prints the fields below.

| Check | Assumed in | How to check |
|---|---|---|
| `clock.inIntermission` is true and `clock.secondsRemaining` counts down the intermission | `GameComponent.updateIntermission`, `derivedIntermissionLanding` | Compare `intermission-N` with `intermission-N-later`; the game page shows "16:40 till 2nd" |
| During an intermission, `periodDescriptor` is the period just ended | `PeriodUtils.getLiveLabel` / `getNextPeriodLabel` | "End 1st" on the scorecard and header, "till 2nd" in the countdown |
| `CRIT` shows up and is otherwise like `LIVE` | `NhlGameInfoUtils.isLiveGame` | A `crit-*` capture |
| `landing.summary.scoring` lists the current period before it has a goal | `derivedLiveLanding`, goal scorers | A `landing-pN` capture |
| A live play-by-play only has the plays so far, in the finished game shape; the momentum chart and timelines update on refresh | `derivedLivePlayByPlay`, momentum, mini event timeline | Game page during a period |
| A live boxscore has `playerByGameStats` and the right-rail has `teamGameStats` | `GameComponent.showTopPlayers` / `showGameStats` | Script output; both sections on the game page |
| The score response has `clock` and `periodDescriptor` for the scoreboard | `derivedLiveGame`, scorecard live label | A `score-*` capture; home scoreboard |
| Live plays have `situationCode` (for the power play badge) | `GameHeaderComponent` TODO (5.2) | Script output |
| A goal's `highlightClip` shows up in `landing.summary.scoring` once NHL.com posts the clip, without a full page refresh | `NhlVideoUtils.getGoalHighlightVideo`, `GameComponent.openGoalOrPlayerDialog` (5.4, issue #85) | Click a recent goal during a live game before and after its clip is posted |

When done: trim the captures (item counts only), move the ones worth keeping next to the other fixtures with accessors
in `nhl-api-mocks.ts`, replace the live `derived*` helpers, make the specs assert captured values, fix any wrong
assumption, remove the TODOs and update this section. Don't commit the untrimmed `live/` folder.

### Follow-ups outside this plan
- ~~Migrate the team, player, playoffs and stats pages and header search, then delete the old code.~~ Done in phases
  9–15 of [`nhl-api-legacy-migration-plan.md`](nhl-api-legacy-migration-plan.md).
- HokMob rating approach B (decision 1).
- A local Utah logo (`NhlTeamLogoUtils` TODO).
- ~~Drive `DateTimeUtils.isPlayoffMode()` from season dates (4.3).~~ Done (second plan, 11.1).
- Check an in-progress playoff series (next game date, unplayed games in the series dialog) during the 2027 playoffs.

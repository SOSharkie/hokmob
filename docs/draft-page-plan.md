# Draft Page Plan

Status: **Done** (planned 2026-09-17, decisions confirmed the same day; D1–D3 built 2026-09-17). Builds
`/draft`: the draft picks for one year and round, from 2006 on, with each player's NHL regular season career
assists, goals and points. The route, the `DraftComponent` shell (an empty `.draft-container`), its placeholder
spec, the "Draft" navigation menu entry and the router title already existed.

The conventions of [`nhl-api-migration-plan.md`](nhl-api-migration-plan.md) (sections 6 and 7) and
[`nhl-api-legacy-migration-plan.md`](nhl-api-legacy-migration-plan.md) (section 2.2, stats API query syntax) apply.

## 1. Requirements

- Filter by **year** (2006 to the latest draft) and by **round**. The page opens on the **latest draft, round 1**.
- A table of picks with these columns, in this order:

  | Pick | Team | (face) | Player | Pos | A | G | P |
  |---|---|---|---|---|---|---|---|
  | overall pick number | picking team | player headshot | player name | position | career assists | career goals | career points |

## 2. Key findings (checked with curl on 2026-09-17)

### 2.1 api-web `draft/picks/{year}/{round}`

- `draft/picks/now` is the latest draft's round 1 (on 2026-09-17: 2026, 32 picks, `state: "over"`).
  `draft/picks/{year}/{round}` gives any year and round; `round` can also be `all` (2015: 211 picks).
- Top level: `draftYear`, `draftYears` (every year, 1979–2026 ascending), `selectableRounds`, `state`, `picks[]`,
  and on `now` `broadcastStartTimeUTC`.
  - **Every year from 2006 to 2026 has 7 rounds**, 209–225 picks in total.
  - Round 1 has one pick per team: 30 through 2016, 31 from 2017 to 2020, 32 from 2021 (2014 has 29).
- `draft/picks/2027/1` returns **HTTP 404 (HTML)** until the 2027 draft exists.
- A pick: `round`, `pickInRound`, `overallPick`, `teamId`, `teamAbbrev`, `teamName.default`, `teamLogoLight` /
  `teamLogoDark`, `teamPickHistory` (`"CAR-NYR-CGY-WSH"` for a traded pick), `firstName.default`, `lastName.default`,
  `positionCode`, `countryCode`, `height`, `weight`, `amateurLeague`, `amateurClubName`.
  - The team name and logo are **as they were that year**: 2006 pick 1 is `STL_20002001-20072008_light.svg`, and
    2015 pick 1 is `EDM_20112012-20162017_light.svg`. Every pick from 2006 on has a logo.
- **Picks have no player ID** and no stats.
- **Forfeited picks are rows** with no `firstName` and no `positionCode`, and `lastName.default` `"Forfeited"`. There
  are 5 from 2006 on: 2009 #118, 2011 #69, 2020 #49, 2021 #11 (ARI), 2026 #63 (VGK).
- **`positionCode` values from 2006 on:**

  | Code | Picks |
  |---|---|
  | `D` | 1486 |
  | `C` | 1144 |
  | `LW` | 643 |
  | `RW` | 637 |
  | `G` | 476 |
  | `F` | 75: 26 in 2006, 28 in 2007, 6 in 2008, 9 in 2009, 5 in 2010, 1 in 2011 (e.g. 2006 #3 Toews) |
  | `C/LW` | 30 |
  | `C/RW` | 17 |
  | `LW/RW` | 13 (e.g. 2011 #58 Kucherov) |

### 2.2 Stats API: career stats by draft pick

- **`skater/bios`** with `isAggregate=true&isGame=false&limit=-1` and
  `cayenneExp=draftYear={year} and draftRound={round} and gameTypeId=2` returns one row per skater from that round
  who played an NHL game: `playerId`, `skaterFullName`, `lastName`, `positionCode` (`C`, `L`, `R`, `D`), `draftYear`,
  `draftRound`, **`draftOverall`**, `gamesPlayed`, `goals`, `assists`, `points`.
  - 2015 round 1: 29 rows, McDavid (`draftOverall` 1) 794 GP, 409 G, 811 A, 1220 P. Pick 22 (Samsonov, a goalie)
    isn't in it.
  - 2006 round 1: 23 skaters, Erik Johnson (#1) 95 G, 253 A, 348 P. Toews is `C` here (`F` in the pick).
  - **Without `gameTypeId`, rows split by game type**: 46 rows for 29 players (McDavid 102 GP / 156 P in a second
    row, the playoffs). Always filter.
  - Players who never played have no row: 2006 #19 Mitera, #20 Fischer, #24 Persson, and every 2026 pick. 2026
    round 1 returns `{"data":[],"total":0}`.
- **Goalies:** `goalie/bios` has `draftOverall` and `playerId` but no scoring; `goalie/summary` has `goals`,
  `assists`, `points` but no `draftOverall`. Both accept the same `draftYear` / `draftRound` / `gameTypeId` filter,
  so join them on `playerId`.
  - Samsonov (2015 #22): 200 GP, 0 G, 5 A, 5 P.
  - 2006 round 1 has 4 goalies: #11 Bernier, #15 Helenius, #23 Varlamov, #26 Irving.
- Joining 2006 round 1 by `draftOverall` gives no last-name mismatches.
- `roundNumber` is not a field (`Invalid path 'roundNumber'`). The `draft` report only returns `{draftYear, rounds}`.
- The stats API sends no CORS header (legacy plan 2.2), so these calls go through the backend.

### 2.3 Headshots

- The player landing's `headshot` is `https://assets.nhle.com/mugs/nhl/latest/{playerId}.png` (Toews: 8473604).
  That URL only needs the player ID, so the stats row's `playerId` is enough: no season, team or extra request.
- **A missing photo isn't an error.** `mugs/nhl/latest/99999999.png` returns **200** with a generic silhouette
  (11,875 bytes), so `(error)` only fires on network failures.
- 2006 round 1, `latest` vs the season/team URL of each skater's last season (`mugs/nhl/{season}/{team}/{id}.png`):
  both have real photos for the same 20 of 23 skaters. Wishart, Vishnevskiy and Corrente (last NHL season
  2009–2012) get a silhouette from both. `latest` is the newer photo where they differ (Summers, Okposo, Frolik).
- **Players without NHL games have no ID in either draft source.** The header search could find one by name (2026
  #1 McKenna is 8486067), but their `latest` headshot is the silhouette too (every 2026 pick has no NHL games), so the
  page doesn't look them up.

## 3. Design

### 3.1 Data flow

Two requests per year and round, joined on the client by overall pick:

1. `/api/nhl/draft/picks/{year}/{round}` (or `draft/picks/now` on first load): the picks. Add `draft` to
   `NhlController.AllowedRoots`.
2. `/api/nhl-stats/draft?year={year}&round={round}`: career rows keyed by `draftOverall`. New action in
   `NhlStatsController`.

Why two requests instead of one merged backend response: the picks render even if the stats API fails (the stat
cells show "-"), and the api-web proxy and its cache are already there. The stats request is the only new backend
code.

### 3.2 Backend: `GET /api/nhl-stats/draft?year=&round=`

- Validate `year` in 2006..2100 and `round` in 1..7, else `400`.
- Three stats API queries in parallel (`Task.WhenAll`), all `isAggregate=true&isGame=false&limit=-1` with
  `cayenneExp=draftYear={year} and draftRound={round} and gameTypeId=2`:
  - `skater/bios`
  - `goalie/bios`
  - `goalie/summary`
- Response, sorted by `draftOverall`:

  ```json
  { "players": [ { "draftOverall": 1, "playerId": 8478402, "name": "Connor McDavid", "lastName": "McDavid",
                   "positionCode": "C", "gamesPlayed": 794, "goals": 409, "assists": 811, "points": 1220 } ] }
  ```

  Goalie rows take `draftOverall` from `goalie/bios` and the scoring from `goalie/summary` (matched by `playerId`;
  a goalie missing from the summary gets 0s), with `positionCode` `"G"`.
- Cached by `NhlStatsApiClient` (5 minutes), like the other stats actions. An upstream `{ message }` or failure
  returns `502`, as the existing actions do.

### 3.3 Frontend

- **Models:**
  - `models/nhl-web-api/draft-picks.model.ts`: `DraftPicksResponse` (`draftYear`, `draftYears`,
    `selectableRounds`, `state`, `picks`) and `DraftPick`, with the fields in 2.1 (`LocalizedString` names;
    `firstName` and `positionCode` optional, for forfeited picks).
  - `models/nhl-stats-api/draft-stats.model.ts`: `DraftStatsResponse` / `DraftPlayerStats` (3.2).
- **Services:**
  - `NhlGameService` (or a new `NhlDraftService`, if it grows): `getDraftPicks(year?: number, round?: number)`:
    `now` when `year` is missing.
  - `NhlStatsApiService.getDraftStats(year, round)`. Both follow the Promise + `console.error` + reject convention.
- **`DraftComponent`:**
  - Query parameters `?year=2015&round=1`, subscribed like `PlayoffsComponent` (one load per change, late responses
    for an old selection ignored).
  - No parameters, or a `year` before 2006 or not in the list: load `draft/picks/now` (latest draft, round 1). A
    `round` not in `selectableRounds` falls back to round 1. The stats request runs after the picks, with the
    resolved year and round.
  - Header: title "{year} NHL Draft", and two native `<select>`s styled like the playoffs `season-picker`:
    - Year: `draftYears` from 2006 on, newest first (`DraftComponent.firstDraftYear = 2006`).
    - Round: `selectableRounds`, labelled "Round 1"...
  - Changing the year keeps the round if the new year has it, otherwise round 1.
  - Rows are built in the component (`DraftPickRow`):
    - Pick: `overallPick`.
    - Team: the pick's own `teamLogoLight` and `teamName.default` (as they were that year, decision 2), not
      `NhlTeamUtils`.
    - Player: `firstName.default + " " + lastName.default`, linked to `/player/{playerId}` when there's a stats row
      (the only source of the ID). A forfeited pick shows "Forfeited" in muted text, with "-" in the other cells
      and no headshot.
    - Face, before the name: a round headshot like `game-top-players`' `player-headshot`, from a new
      `NhlPlayerHeadshotUtils.getLatestHeadshotUrl(playerId)` (the 2.3 URL, or `blankHeadshot` without an ID), with
      `(error)="showBlankHeadshot($event)"`. A pick without a stats row gets `blankHeadshot` without a request.
      `loading="lazy"`, since a round has up to 32 rows. `alt=""`, since the name is next to it.
    - Pos: the pick's `positionCode` as-is (`LW`, `RW`, `C/LW`, ..., decision 4). When it's `F` and there's a stats
      row, use the stats position mapped `L` → `LW`, `R` → `RW` (Toews: `C`); otherwise `F`.
    - A, G, P: `assists`, `goals`, `points` from the stats row with the same `draftOverall`, or "-" (decision 3).
  - States: loading gif, "The draft couldn't be loaded" (picks failed), "No picks yet" (empty `picks`), and "-" in
    the stat cells when the stats request failed or the player has no NHL games.
- **Table:** styled like `player-career`'s `career-seasons-table`. Numbers right-aligned.
  - At phone width (700px and under) the Team column shows the logo only, the headshot and other columns shrink, and
    a long name wraps to two lines, so there's no horizontal page scroll.
- **Pickers** (restyled 2026-09-17, after Fotmob's season dropdown on its league stats page):
  - The button is a 32px pill (1px `$gray-01` border, 20px radius, `#1d1d1d` fill) with 14px weight-500 text and an
    inline SVG chevron as the background. The border lightens on hover, focus and while open.
  - It opens a `mat-menu` (`MatMenuModule`, added to `MaterialModule`), not a native `<select>`: a native list is drawn
    by the browser, can't be height-capped, and filled the screen with 21 years. The panel is capped at
    `min(320px, 55vh)` and scrolls, opens scrolled to the selected option, and flips above the button when there's no
    room below. Options are `menuitemradio` with `aria-checked`; the menu handles arrow keys, Escape and outside clicks.
  - The panel renders in the overlay, so its styles are global: `.draft-picker-menu` in `styles.scss`. It sets the
    page font explicitly, because the Material theme's font (GT Walsheim, not loaded, so Arial) would otherwise apply.
  - Each menu has its own class (`year-menu`, `round-menu`), so scrolling to the selected option can't pick the other
    menu while that one's close animation is still running.

## 4. Decisions (confirmed 2026-09-17)

1. **Career = regular season only** (`gameTypeId=2`).
2. **Drafts from 2006 on**, with each team's name and logo as they were that year (the pick's `teamName` and
   `teamLogoLight`). Traded picks don't show `teamPickHistory` for now.
3. **Players without NHL games** show "-" rather than 0.
4. **Position as `LW` / `RW`**: the pick's `positionCode`, not the stats API's `L` / `R`. The stats position only
   fills in for `F` (2.1).

## 5. Risks

- **Join by overall pick.** A player drafted twice (re-entered the draft) likely has only their last draft in the
  bios, so the earlier pick shows "-". To guard against a wrong match, only join when the pick's `lastName.default`
  equals the stats row's `lastName`, ignoring accents and case. Find a re-drafted player from 2006 on to confirm.
- **Draft day.** Picks during a live draft and the `state` values besides `"over"` are unverified (next draft: June
  2027). `draft/picks/now` before a year's picks exist should be checked then.
  - **The `draft` root is cached for 6 hours** in `NhlApiClient` (decided 2026-09-17), because picks only change
    during the draft. During a live draft, new picks would show up to 6 hours late, and `draft/picks/now` would stay
    on the old year for up to 6 hours after the new draft starts. Shorten it for draft days, or give `now` and the
    current year a short cache, when live drafts matter.

## 6. Tests

- **Fixtures** (`shared/testing/nhl-api-mocks/`, real responses):
  - `draft-picks-now-2026-09-17.json`
  - `draft-picks-2015-1.json`
  - `draft-picks-2006-1.json`: `F` positions, goalies, players with no NHL games.
  - `draft-picks-2021-1.json`: the forfeited ARI pick #11.
  - `draft-stats-2015-1.json` and `draft-stats-2006-1.json`: the backend responses, captured once it's built.

  Add accessors to `nhl-api-mocks.ts`.
- **Services:** URLs (`now` vs year and round), the response passed through, rejection on HTTP error.
- **`NhlPlayerHeadshotUtils.getLatestHeadshotUrl`:** the URL for an ID, and `blankHeadshot` for a missing one (pass
  `null`).
- **`DraftComponent`:**
  - The default load uses `now`, then stats for 2026 round 1.
  - Query parameters load the year and round. `?year=2005` and `?year=abc` load the latest draft, and `?round=9`
    loads round 1.
  - Year options are newest first and stop at 2006. Round options come from `selectableRounds`.
  - Rows are in fixture order, with the fixture's values (2015 pick 1: Edmonton Oilers, Connor McDavid, C, 811, 409,
    1220; the logo is the fixture's `teamLogoLight`).
  - The goalie row (2015 pick 22 Samsonov: 5 A, 0 G, 5 P).
  - Positions: `F` with a stats row becomes the stats position (2006 #3 Toews: `C`), and a combined code stays as-is.
  - "-" for a player without stats (2006 #19 Mitera), and the forfeited row (2021 #11).
  - A last-name mismatch doesn't join.
  - Headshots: McDavid's is `https://assets.nhle.com/mugs/nhl/latest/8478402.png`; a player without stats and a
    forfeited pick get the blank headshot or none; the error handler is bound.
  - Picks failure, stats failure (the table still renders), empty picks, and a late response for an old selection.
  - Replace the placeholder spec.
- **Backend:** check by hand (no test project):
  - `/api/nhl-stats/draft?year=2015&round=1` has 30 players, including Samsonov.
  - `?year=2006&round=1` has 27 players: 23 skaters and 4 goalies.
  - `?year=2026&round=1` returns `players: []`.
  - `?year=2005&round=1` and `?year=2015&round=8` return 400.

## 7. Phases

| # | Phase | Files | Check against |
|---|---|---|---|
| D1 | Backend: `draft` proxy root, `/api/nhl-stats/draft` | `NhlController.cs`, `NhlStatsController.cs` | The backend checks in 6; `/api/nhl/draft/picks/now` returns 200 |
| D2 | Models, service methods, fixtures | `models/*/draft-*.model.ts`, `nhl-game.service.ts`, `nhl-stats-api.service.ts`, `nhl-api-mocks/*` | `ng build`; service specs |
| D3 | `DraftComponent`: pickers, table with headshots, states, responsive layout | `draft/*`, `nhl-player-headshot-utils` | `/draft` (2026 round 1: blank headshots), `?year=2015&round=1`, `?year=2006&round=1` (`F` positions, old logos, silhouettes for Wishart and Vishnevskiy), `?year=2021&round=1` (forfeited pick), `?year=2005` (latest draft); a phone-width viewport; `test:ci` |

D1 was built on 2026-09-17 and checked through the dev server proxy:
- `/api/nhl-stats/draft?year=2015&round=1`: 30 players, picks 1–30 in order. McDavid 409 G, 811 A, 1220 P; Samsonov
  `G`, 0 G, 5 A, 5 P.
- `?year=2006&round=1`: 27 players, goalies #11 Bernier (8 A), #15 Helenius (0s, 1 GP), #23 Varlamov (8 A), #26
  Irving (1 A); Toews `C`.
- `?year=2026&round=1`: `{"players":[]}`. `?year=2005`, `?round=8`, `?round=0`, `?year=abc` and no parameters: 400.
- `/api/nhl/draft/picks/now` (2026, 32 picks) and `/api/nhl/draft/picks/2015/1` (30): 200, cached 6 hours (5).
  `draft/picks/2027/1` passes the upstream 404 through.
- Any of the three stats calls failing returns 502, so a goalie never silently loses their stats. `CLAUDE.md`'s
  layout lists the new action.

D2 was built on 2026-09-17:
- Models: `nhl-web-api/draft-picks.model.ts` (`firstName`, `positionCode` and the bio fields optional) and
  `nhl-stats-api/draft-stats.model.ts`.
- `NhlGameService.getDraftPicks(year?, round?)`: `draft/picks/now` without a year, round 1 when only the year is given.
  `NhlStatsApiService.getDraftStats(year, round)` resolves the `players` list (empty when it's missing). No separate
  draft service was needed.
- Fixtures: `draft-picks-now-2026-09-17`, `draft-picks-2006-1`, `draft-picks-2015-1`, `draft-picks-2021-1` (curl), and
  `draft-stats-2006-1`, `draft-stats-2015-1` (from the running backend). Accessors `mockDraftPicks('now' | 2006 | 2015 |
  2021)` and `mockDraftStats(2006 | 2015)`.
- Specs: both service methods (URLs, real values, forfeited pick, empty and missing lists, 404 / 502 rejections) and
  the new accessors. `ng build` and `test:ci` (690 tests) pass.

D3 was built on 2026-09-17:
- `NhlPlayerHeadshotUtils.getLatestHeadshotUrl(playerId)` (checked against a real `latest` landing headshot).
- `DraftComponent`:
  - With a `year` query parameter, the picks and stats requests start together. Without one, the stats wait for the
    latest draft's year.
  - A `year` before 2006, after the current calendar year or not a number loads the latest draft, round 1. A `round`
    that isn't 1–7 loads round 1. A year that's in range but has no picks yet (2027 before its draft) shows the error
    message, because api-web answers 404.
  - While the stats load, the stat cells are empty. After they load (or fail), a missing value is "-".
  - The year and round pickers keep their options while another year loads.
  - The last-name check ignores accents and case.
- Checked in the browser (this repo's dev server, 1400×1000 and 375×812):
  - `/draft`: 2026 round 1, 32 picks, blank headshots, "-" stats.
  - Picking 2015 in the year picker: `?year=2015&round=1`. McDavid 811 / 409 / 1220 with a headshot and a link to
    `/player/8478402`; Samsonov `G` 5 / 0 / 5.
  - `?year=2006&round=1`: STL's 2000–08 logo; Toews `C`, Frolik `RW`, Tlusty `LW` (all `F` in the picks); Bernier `G`;
    Mitera, Fischer and Persson "-" with blank headshots and no link.
  - `?year=2021&round=1`: #11 Arizona Coyotes "Forfeited", muted, no headshot.
  - `?year=2005&round=3` and `?year=abc&round=9`: 2026 round 1.
  - The round picker on 2015: `?year=2015&round=7`, 30 picks (#186 Lorentz `C/LW` 44 / 36 / 80).
  - Every `/api/nhl` request returned 200, and no console errors.
  - Phone width: no horizontal scroll, and every name fits (the first version cut names to 35px, so the phone columns
    were narrowed and names now wrap).
- Specs: the headshot helper, and a real `draft.component.spec.ts` (20 tests: default load and ordering, pickers and
  navigation, query parameter fallbacks, stats, goalie, `F` and combined positions, no-NHL player, forfeited pick,
  last-name mismatch and accents, late responses, stats failure, picks failure, empty picks). Production `ng build`
  (budgets) and `test:ci` (710 tests) pass.

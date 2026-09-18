# Draft page

`/draft` shows one round of one NHL draft (2006 to the latest), with each pick's NHL regular season career games
played, assists, goals and points. It opens on the latest draft, round 1. The general API conventions are in
[`nhl-api.md`](nhl-api.md).

| Pick | Team | (face) | Player | Pos | GP | A | G | P |
|---|---|---|---|---|---|---|---|---|
| overall pick number | picking team | headshot | player name | position | career games played | career assists | career goals | career points |

## Data

Two requests per year and round, joined on the client by overall pick. The picks render even when the stats request
fails (the stat cells show "-").

1. **`/api/nhl/draft/picks/{year}/{round}`** (`draft/picks/now` on first load) — the picks.
   - Top level: `draftYear`, `draftYears` (1979 onwards, ascending), `selectableRounds`, `state`, `picks[]`.
     Every year from 2006 on has 7 rounds and 209–225 picks. Round 1 has one pick per team: 30 through 2016
     (29 in 2014), 31 from 2017 to 2020, 32 from 2021.
   - A pick has `round`, `pickInRound`, `overallPick`, `teamId`, `teamAbbrev`, `teamName.default`, `teamLogoLight` /
     `teamLogoDark`, `teamPickHistory`, `firstName.default`, `lastName.default`, `positionCode`, `countryCode`,
     `height`, `weight`, `amateurLeague` and `amateurClubName` — but **no player ID and no stats**.
   - The team name and logo are the ones of that year (2006 pick 1 is St. Louis' 2000–08 logo).
   - **Forfeited picks are rows** with no `firstName` or `positionCode` and `lastName.default` `"Forfeited"`. There
     are 5 from 2006 on: 2009 #118, 2011 #69, 2020 #49, 2021 #11, 2026 #63.
   - `positionCode` is `C`, `D`, `LW`, `RW`, `G`, a combination like `C/LW`, or `F` (75 picks, almost all 2006–2010,
     e.g. 2006 #3 Toews).
   - A year whose draft hasn't happened yet answers **404** (`draft/picks/2027/1`, until the 2027 draft).
2. **`/api/nhl-stats/draft?year=&round=`** — career rows keyed by `draftOverall`, sorted by pick. The backend runs
   three stats API queries in parallel, all `isAggregate=true&isGame=false&limit=-1` with
   `cayenneExp=draftYear={year} and draftRound={round} and gameTypeId=2`:
   - `skater/bios` (has `draftOverall`, games, goals, assists and points),
   - `goalie/bios` (has `draftOverall` but no scoring) joined on `playerId` with `goalie/summary` (scoring but no
     `draftOverall`); a goalie missing from the summary gets zeros.

   ```json
   { "players": [ { "draftOverall": 1, "playerId": 8478402, "name": "Connor McDavid", "lastName": "McDavid",
                    "positionCode": "C", "gamesPlayed": 794, "goals": 409, "assists": 811, "points": 1220 } ] }
   ```

   `year` outside 2006..2100 or `round` outside 1..7 is a 400; an upstream failure is a 502, so a goalie never
   silently loses their stats. Players who never played an NHL game have no row at all, so a whole recent draft can
   come back empty.

Headshots use `NhlPlayerHeadshotUtils.getLatestHeadshotUrl(playerId)`
(`https://assets.nhle.com/mugs/nhl/latest/{id}.png`), which needs only the ID from the stats row. A player without a
stats row gets the blank headshot without a request.

## Behaviour

- Query parameters `?year=&round=`, subscribed like `PlayoffsComponent`: one load per change, and a late response for
  an old selection is ignored. A year before 2006, after the current year or not a number loads the latest draft;
  a round outside `selectableRounds` falls back to round 1. Changing the year keeps the round when the new year has it.
- The team column uses the pick's own `teamLogoLight` and `teamName.default`, not `NhlTeamUtils`, so it shows the
  team as it was that year. Traded picks don't show `teamPickHistory`.
- A player's name links to `/player/{playerId}` only when there's a stats row, since that's the only source of the ID.
- Position is the pick's `positionCode` as-is (`LW`, `RW`, `C/LW`, ...). `F` is replaced by the stats position,
  mapped `L` → `LW` and `R` → `RW`.
- GP, A, G and P come from the stats row with the same `draftOverall`. A pick with no row shows "-" rather than 0;
  the cells are empty while the stats are still loading. GP's column is a little wider than the others, since it can
  be four digits.
- The row is only joined when the pick's `lastName.default` equals the stats row's `lastName`, ignoring accents and
  case, so a player who re-entered the draft can't be matched to the wrong pick.
- A forfeited pick shows "Forfeited" in muted text, with "-" in the other cells and no headshot.
- States: a loading gif, "The draft couldn't be loaded" when the picks fail, and "No picks yet" for an empty round.
- The table is styled like `player-career`'s season table, with the numbers right-aligned. The Team column is a fixed
  210px, wide enough for the longest name beside the logo rather than growing with the table, and Pos is 48px. Nine
  columns leave too little room for the names before the usual 700px, so there are two narrow bands:
  - `$draft-mobile-screen-breakpoint` (900px) and under: the headshot, the logo, the paddings and the other columns
    shrink, and the Team column is 190px.
  - `$mobile-screen-breakpoint` (700px) and under: the Team column shows the logo only and a long player name wraps
    to two lines, so there's no horizontal scroll.

## Pickers

The year and round pickers are the shared pill pickers: `.pill-picker`, `.pill-picker-menu` and
`.pill-picker-option` in `styles.scss`, plus `PickerMenuUtils.scrollToSelectedOption(menuClass)`. The playoffs
season picker uses the same ones. Each is a `mat-menu`, not a native `<select>`: a native list can't be
height-capped and filled the screen with 21 years. The panel is capped at `min(320px, 55vh)`, opens scrolled to the
selected option, and flips above the button when there's no room below. Options are `menuitemradio` with
`aria-checked`, and the menu handles arrow keys, Escape and outside clicks. Panels render in the overlay, so their
styles are global and have to set the page font explicitly. Each menu needs its own class, so scrolling to the
selected option can't pick the other menu while its close animation is still running.

## Open items

- **Draft day is unverified.** Picks during a live draft, and the `state` values besides `"over"`, have never been
  seen (next draft: June 2027). The `draft` proxy root is cached for **6 hours**, because picks only change during
  the draft, so new picks would show up to 6 hours late and `draft/picks/now` would stay on the old year for up to 6
  hours after the new draft starts. Shorten it for draft days, or give `now` and the current year a short cache,
  when live drafts matter.
- No player drafted twice has been found from 2006 on to confirm the last-name guard.

---
name: update-history-season
description: Refresh the HokMob history page's current season file (HokMob.App/ClientApp/src/assets/history/{season}-2.json) to the latest final NHL games, by checking it against the stats API, rebuilding it with build-season-data.js --partial, validating it and updating its line in docs/nhl-api.md. Use this whenever the user wants the current season's ratings, history page or season data brought up to date, refreshed, regenerated or "updated through last night", even when they don't name the file or the script, and when the season in progress has ended and its file needs its final rebuild.
---

# Update the history season

The history page (`/history`) rates every player's game from a static file, so the season in progress only shows the
games that were final when its file was last built. The file says how far it goes in `throughDate`, which the page
shows as "Season in progress, through November 8". This skill brings the file up to the latest final games.

Read "History data" in `docs/nhl-api.md` if anything below surprises you: it covers the file format, the build script
and why the file holds rating inputs rather than ratings (so a rating formula change never needs a rebuild).

## 1. Check whether there's anything new

From the repo root:

```bash
node .claude/skills/update-history-season/scripts/season-status.js
```

It finds the file that is still in progress (or takes `[season] [gameType]`), asks the stats API for the season's
final games, and ends with `STATUS=...`:

- **`up-to-date`**: the file already has every final game. Stop here and tell the user the date it runs through, and
  when tonight's games will count (once they're final). Rebuilding anyway only changes the `generated` date.
- **`behind`**: go on to step 2 with the command it prints.
- **`finished`**: every game of the season is final. Rebuild with the command it prints, which has no `--partial`, so
  the file loses `throughDate` and the page stops calling the season in progress. Mention that the playoffs would be a
  separate file (game type 3), and only make one if the user asks.
- **`new-season`** or a season the page doesn't list: adding a season is more than a rebuild. The picker lists
  `SeasonHistoryService.seasons` newest first and opens on the first, so it also means editing that list, the specs that
  name the newest season (`season-history.service.spec.ts`, `history.component.spec.ts`) and the docs. Check with the
  user before doing it.
- **`not-started`**: no final games yet. Nothing to build.

"In play now" lists games under way. They're fine: the build keeps only final games.

## 2. Rebuild the file

From `HokMob.App/ClientApp`, run the printed command, for example:

```bash
npm run build-season-data -- 20262027 --partial
```

It takes about a minute and about 230 stats API requests, two at a time. Keep its last line, `file size: 628 KB (119 KB
gzipped)`, for the docs in step 4. Run it once rather than in a loop: the stats
API answers 429 to bursts, and the script already retries those.

The script validates the data before writing anything. If it fails, the file is untouched. The usual cause is a game
that just went final in the schedule while the per-game reports haven't caught up ("games don't have skaters and goalies
for both teams"). Wait half an hour and run it once more; if it fails the same way again, report the error rather than
working around the validation.

## 3. Check the rebuilt file

```bash
node .claude/skills/update-history-season/scripts/check-history-file.js HokMob.App/ClientApp/src/assets/history/20262027-2.json
```

It compares the file with the committed one (games added, the new `throughDate`), checks that every game's goals add
up to its score and that the top 5 scorers match the stats API's season totals, and prints the docs summary line. A top
scorer mismatch right after a game went final means the build missed it: rebuild once.

Also look at `git diff --stat`: only the season file (and the docs, next) should change. If the file's only change is
`generated`, there was nothing new, so restore it with `git checkout -- <file>`.

## 4. Update the docs line

In `docs/nhl-api.md`, under "History data" → "A season in progress", replace the sentence that starts with the
file's name (`` `20262027-2.json` runs through ... ``) with the line the check printed, filling in the sizes from the
build's `file size` line. Take them from the build rather than measuring the file yourself: `npm run` runs the
project's own Node, whose gzip size differs from a newer system Node's (119 KB against 118 KB for the same file), and
the docs have always used the build's. Keep the docs' CRLF line endings (the repo uses `core.autocrlf=true`).

Nothing else needs to change: no spec reads the season files, and the page picks up the new `throughDate` and games
on its own, including the leaderboard's minimum games, which scales with the games played so far.

## 5. Branch, commit and report

Work on a feature branch from the latest `master`, like `claude/history-20262027-through-2026-11-12`; never commit to
`master`. Commit, push and open a pull request only when the user asked for that. Otherwise stop with the changes in the
working tree and offer to.

A commit message in the repo's style:

```
Refresh the 2026-27 history through 2026-11-12

History data:
- Rebuild 20262027-2.json with the final games through 2026-11-12 (312 games, 30 more)

Docs:
- Update the season file's line in docs/nhl-api.md
```

Tell the user the old and new `throughDate`, how many games were added, that the checks passed, and anything that's
left (no commit yet, or games still in play that will count next time).

If a dev server is already running on port 4200, `http://localhost:4200/history` shows the new date under the lead.
There's no need to start one just for this: the check script covers the data.

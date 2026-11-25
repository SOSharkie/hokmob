// Builds one season's NHL EDGE file: every skater's EDGE season (top speed, bursts over 20 mph, distance, top shot
// speed, zone time), so the player page can rank a skater's EDGE stats against its own pool without asking EDGE for the
// whole league. EDGE has no league-wide list, only each player's skater-detail, so this asks for each skater of the
// season once. See "EDGE season data" in docs/nhl-api.md.
//
// Usage: npm run build-edge-data -- <season> [--partial] [--out <file>]
//   season    Like 20252026, from 2021-22 on (EDGE has nothing earlier).
//   --partial Build a season in progress: the file gets a throughDate, the day of the season's last final game.
//   --out     Output file. Default: src/assets/edge/<season>-2.json
//
// The skaters come from the stats API's skater/summary (paged with stats-api-pages.js). Then each one's
// edge/skater-detail/{playerId}/{season}/2 is read from api-web, one request at a time, about one a second: api-web
// answers 429 with "Retry-After: 60" past that (see build-play-by-play.js). About 1,000 skaters in a full season, about
// 15 minutes. A player who still fails after a few tries is listed at the end and left out, instead of failing the run.
// Don't run two copies at once: the limit is per IP address, and the running app's own api-web calls share it.
//
// The file is columnar, like the history files: { version, season, gameType, throughDate?, skaters: { playerId: [],
// gamesPlayed: [], ... } }, sorted by playerId. EdgeSeason in src/app/shared/models/nhl-edge/edge-season.model.ts
// describes it.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {getAllRows} = require('./stats-api-pages');

const statsUrl = 'https://api.nhle.com/stats/rest/en/';
const edgeUrl = (playerId, season) => `https://api-web.nhle.com/v1/edge/skater-detail/${playerId}/${season}/2`;
const fileVersion = 1;
/** EDGE's first season. */
const firstSeason = 20212022;
/** The stats API's gameStateId of a finished game. */
const finalGameState = 7;
/** Milliseconds between EDGE requests: where it starts, and how far it speeds up and slows down. */
const startInterval = 1100;
const minInterval = 800;
const maxInterval = 6000;
/** Tries per player before he's listed as missing. A 404 (no EDGE season for him) isn't tried again. */
const maxAttempts = 5;

const args = process.argv.slice(2);
const optionValue = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const positional = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--out');
const season = Number(positional[0]);
const partial = args.includes('--partial');
const outFile = optionValue('--out') ?? path.join(__dirname, `src/assets/edge/${season}-2.json`);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** One page of a stats API report, with retries. */
async function statsPage(url) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.json();
        if (!Array.isArray(json.data)) throw new Error(json.message ?? 'no data');
        return json;
      }
    } catch (error) {
      if (attempt === 9) throw error;
    }
    await sleep(15000);
  }
  throw new Error(`The stats API didn't answer for ${url}`);
}

/** Every row of a stats API report for a cayenne expression, in the given unique order. */
function statsRows(report, cayenneExp, sortFields) {
  const url = `${statsUrl}${report}?isAggregate=false&isGame=false&cayenneExp=${encodeURIComponent(cayenneExp)}`;
  return getAllRows(url, sortFields, statsPage);
}

/** The day of the season's last final regular season game, like "2026-11-23", or undefined before any. */
async function lastFinalGameDate() {
  const games = await getAllRows(`${statsUrl}game?cayenneExp=${encodeURIComponent(`season=${season} and gameType=2`)}`,
      ['id'], statsPage);
  return games.filter(game => game.gameStateId === finalGameState)
      .map(game => game.gameDate.substring(0, 10))
      .sort()
      .pop();
}

/** A number rounded to a few decimals, or null. */
const round = (value, decimals) => value == null || !isFinite(value) ? null : Number(value.toFixed(decimals));

/** The values kept from a skater-detail response. */
function readDetail(detail) {
  return {
    gamesPlayed: detail.player?.gamesPlayed ?? null,
    speedMax: round(detail.skatingSpeed?.speedMax?.imperial, 3),
    burstsOver20: detail.skatingSpeed?.burstsOver20?.value ?? null,
    distance: round(detail.totalDistanceSkated?.imperial, 3),
    topShotSpeed: round(detail.topShotSpeed?.imperial, 2),
    offensiveZonePctg: round(detail.zoneTimeDetails?.offensiveZonePctg, 4),
    defensiveZonePctg: round(detail.zoneTimeDetails?.defensiveZonePctg, 4)
  };
}

/**
 * Reads each skater's EDGE season, one request at a time, speeding up slowly while api-web answers and slowing down
 * after a 429. Returns the rows read and the players still missing.
 */
async function readSkaters(playerIds) {
  const rows = new Map();
  const missing = [];
  let interval = startInterval, streak = 0;
  const started = Date.now();
  for (const playerId of playerIds) {
    for (let attempt = 1; ; attempt++) {
      const sent = Date.now();
      let response = null;
      try {
        response = await fetch(edgeUrl(playerId, season));
      } catch (error) {
        // a dropped connection: try again below
      }
      if (response?.ok) {
        rows.set(playerId, readDetail(await response.json()));
        if (++streak >= 150) {
          interval = Math.max(minInterval, Math.round(interval * 0.93));
          streak = 0;
        }
        await sleep(Math.max(0, interval - (Date.now() - sent)));
        break;
      }
      if (response?.status === 404 || attempt >= maxAttempts) {
        missing.push({playerId, status: response?.status ?? 'no answer'});
        await sleep(Math.max(0, interval - (Date.now() - sent)));
        break;
      }
      if (response?.status === 429) {
        const wait = (Number(response.headers.get('retry-after')) || 60) + 3;
        interval = Math.min(maxInterval, Math.round(interval * 1.2));
        streak = 0;
        console.log(`429 after ${rows.size} skaters: waiting ${wait}s, then one request every ${interval} ms`);
        await sleep(wait * 1000);
      } else {
        await sleep(5000);
      }
    }
    const done = rows.size + missing.length;
    if (done % 100 === 0) {
      console.log(`${season}: ${done} of ${playerIds.length}, ${((Date.now() - started) / 60000).toFixed(1)} min, ` +
          `every ${interval} ms`);
    }
  }
  return {rows, missing};
}

/** The file's columns, in playerId order. */
function toColumns(rows) {
  const ids = [...rows.keys()].sort((a, b) => a - b);
  const fields = ['gamesPlayed', 'speedMax', 'burstsOver20', 'distance', 'topShotSpeed', 'offensiveZonePctg',
    'defensiveZonePctg'];
  const columns = {playerId: ids};
  fields.forEach(field => columns[field] = ids.map(id => rows.get(id)[field]));
  return columns;
}

async function main() {
  if (!(season >= firstSeason) || season % 10000 !== Math.floor(season / 10000) + 1) {
    console.error(`Usage: npm run build-edge-data -- <season> [--partial], with a season from ${firstSeason} on`);
    process.exit(1);
  }
  const started = Date.now();
  const skaters = await statsRows('skater/summary', `seasonId=${season} and gameTypeId=2`, ['playerId']);
  const playerIds = [...new Set(skaters.map(row => row.playerId))].sort((a, b) => a - b);
  const throughDate = partial ? await lastFinalGameDate() : undefined;
  console.log(`${season}: ${playerIds.length} skaters${throughDate ? `, through ${throughDate}` : ''}`);

  const {rows, missing} = await readSkaters(playerIds);
  if (!rows.size) {
    console.error(`${season}: no skater had EDGE stats, so nothing was written`);
    process.exit(1);
  }
  const file = {
    version: fileVersion,
    season,
    gameType: 2,
    ...(throughDate ? {throughDate} : {}),
    skaters: toColumns(rows)
  };
  const json = JSON.stringify(file);
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  fs.writeFileSync(outFile, json);
  const kb = bytes => (bytes / 1024).toFixed(0) + ' KB';
  console.log(`${season}: ${rows.size} skaters written to ${path.relative(process.cwd(), outFile)}, ` +
      `${kb(json.length)} (${kb(zlib.gzipSync(json).length)} gzipped), ` +
      `${((Date.now() - started) / 60000).toFixed(1)} min`);
  if (missing.length) {
    console.log(`${missing.length} without EDGE stats (left out): ` +
        missing.map(player => `${player.playerId} (${player.status})`).join(', '));
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

// Checks a rebuilt history file, compares it with the committed one, and prints the docs summary line.
//
// Usage (from the repo root): node .claude/skills/update-history-season/scripts/check-history-file.js <file>
//   file  The rebuilt file, like HokMob.App/ClientApp/src/assets/history/20262027-2.json. A copy elsewhere works too:
//         it's compared with the committed file of the same name.
//
// Checks, beyond what build-season-data.js already validates:
// - every table's columns have the same length, and the game IDs are unique
// - throughDate is the day of the last game (a season in progress), or missing (a finished season)
// - every game's skater and goalie goals add up to its score, or to one less for the shootout winner
// - the season's top 5 scorers have the same games, goals and assists as the stats API's season totals
// Exits with 1 when a check fails.
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const repoRoot = path.resolve(__dirname, '../../../..');
const committedDir = 'HokMob.App/ClientApp/src/assets/history';
const statsUrl = 'https://api.nhle.com/stats/rest/en/';

const failures = [];
const fail = message => {
  failures.push(message);
  console.log('FAIL: ' + message);
};

/** The committed copy of the file, or undefined for a new one. */
function readCommitted(name) {
  try {
    const text = execFileSync('git', ['show', `HEAD:${committedDir}/${name}`],
        {cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']});
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function summarize(history) {
  return {
    throughDate: history.throughDate ?? 'finished',
    games: history.games.id.length,
    players: history.players.id.length,
    skaters: history.skaters.player.length,
    goalies: history.goalies.player.length
  };
}

function checkTables(history) {
  for (const table of ['games', 'players', 'skaters', 'goalies']) {
    const lengths = new Set(Object.values(history[table]).map(column => column.length));
    if (lengths.size !== 1) {
      fail(`${table}: columns of different lengths (${[...lengths].join(', ')})`);
    }
  }
  if (new Set(history.games.id).size !== history.games.id.length) {
    fail('games: duplicate game IDs');
  }
  const lastDate = [...history.games.date].sort().at(-1);
  if (history.throughDate && history.throughDate !== lastDate) {
    fail(`throughDate is ${history.throughDate}, but the last game is on ${lastDate}`);
  }
}

function checkScores(history) {
  const goals = history.games.id.map(() => [0, 0]);
  for (const rows of [history.skaters, history.goalies]) {
    (rows.goals ?? []).forEach((count, row) => goals[rows.game[row]][rows.home[row] ? 0 : 1] += count);
  }
  let shootouts = 0;
  history.games.id.forEach((id, index) => {
    const homeExtra = history.games.homeScore[index] - goals[index][0];
    const awayExtra = history.games.awayScore[index] - goals[index][1];
    if (homeExtra === 0 && awayExtra === 0) {
      return;
    }
    if (homeExtra + awayExtra === 1 && Math.min(homeExtra, awayExtra) === 0) {
      shootouts++;
    } else {
      fail(`game ${id}: the players' goals don't add up to the score`);
    }
  });
  console.log(`Scores: every game adds up (${shootouts} shootout wins add one goal)`);
}

async function checkTopScorers(history) {
  const sort = encodeURIComponent(JSON.stringify([{property: 'points', direction: 'DESC'}]));
  const filter = encodeURIComponent(`seasonId=${history.season} and gameTypeId=${history.gameType}`);
  const response = await fetch(`${statsUrl}skater/summary?isAggregate=false&isGame=false&limit=5&sort=${sort}` +
      `&cayenneExp=${filter}`, {signal: AbortSignal.timeout(60000)});
  if (!response.ok) {
    fail(`top scorers: the stats API answered HTTP ${response.status}`);
    return;
  }
  for (const scorer of (await response.json()).data) {
    const playerIndex = history.players.id.indexOf(scorer.playerId);
    const totals = {games: 0, goals: 0, assists: 0};
    history.skaters.player.forEach((player, row) => {
      if (player === playerIndex) {
        totals.games++;
        totals.goals += history.skaters.goals[row];
        totals.assists += history.skaters.assists[row];
      }
    });
    const api = `${scorer.gamesPlayed} GP, ${scorer.goals} G, ${scorer.assists} A`;
    const file = `${totals.games} GP, ${totals.goals} G, ${totals.assists} A`;
    if (api === file) {
      console.log(`Top scorer ${scorer.skaterFullName}: ${file}, the same as the stats API`);
    } else {
      fail(`top scorer ${scorer.skaterFullName}: the stats API has ${api}, the file ${file}. A game that went ` +
          'final after the build does this: rebuild and check again');
    }
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node check-history-file.js <history file>');
    process.exitCode = 1;
    return;
  }
  const history = JSON.parse(fs.readFileSync(file, 'utf8'));
  const name = path.basename(file);
  const current = summarize(history);
  console.log(`${name}: season ${history.season}, game type ${history.gameType}, version ${history.version}, ` +
      `generated ${history.generated}`);

  const committed = readCommitted(name);
  if (committed) {
    const before = summarize(committed);
    console.log(`Committed: through ${before.throughDate}, ${before.games} games, ${before.players} players, ` +
        `${before.skaters} skater rows, ${before.goalies} goalie rows`);
    console.log(`Rebuilt:   through ${current.throughDate}, ${current.games} games (+${current.games - before.games}), ` +
        `${current.players} players, ${current.skaters} skater rows, ${current.goalies} goalie rows`);
    if (current.games < before.games) {
      fail(`the rebuilt file has fewer games than the committed one (${current.games} < ${before.games})`);
    }
  } else {
    console.log(`New file: through ${current.throughDate}, ${current.games} games`);
  }

  checkTables(history);
  checkScores(history);
  await checkTopScorers(history);

  // The sizes come from the build's output: npm run uses the project's own Node, whose zlib gzips the file to a
  // slightly different size than a newer system Node running this script (119 KB against 118 KB for 2026-11-08)
  const count = value => value.toLocaleString('en-US');
  console.log('\nDocs summary line (docs/nhl-api.md, "A season in progress"), with the "file size" the build printed:');
  console.log(`\`${name}\` runs through ${history.throughDate ?? 'the end of the season'}: ${count(current.games)} ` +
      `games, ${count(current.players)} players, ${count(current.skaters)} skater rows and ${count(current.goalies)} ` +
      'goalie rows, <file size> (<gzipped size> gzipped).');

  console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll checks passed');
  process.exitCode = failures.length ? 1 : 0;
}

main().catch(error => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});

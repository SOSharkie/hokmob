// Says whether the history page's season file is behind the stats API, before anything is rebuilt.
//
// Usage (from the repo root): node .claude/skills/update-history-season/scripts/season-status.js [season] [gameType]
//   season    Like 20262027. Default: the season of the file that is still in progress (it has a throughDate), or
//             the season of today's date.
//   gameType  2 for the regular season (the default) or 3 for the playoffs.
//
// The last line is STATUS=<status>, one of:
//   behind       The stats API has final games the file doesn't. Rebuild with --partial.
//   up-to-date   The file has every final game. Nothing to do.
//   finished     Every game is final and the file still says it's in progress. Rebuild once more.
//   complete     Every game is final and the file has them all. Nothing to do.
//   new-season   The season has final games and no file yet. Adding one is a bigger change (see SKILL.md).
//   not-started  The season has no final games yet.
const fs = require('fs');
const path = require('path');

const historyDir = path.resolve(__dirname, '../../../../HokMob.App/ClientApp/src/assets/history');
const statsUrl = 'https://api.nhle.com/stats/rest/en/';
const finalState = 7;
const futureState = 1;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Gets a stats API response, retrying a 429 or a network error a few times. */
async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(60000)});
      if (response.ok) {
        return await response.json();
      }
      if (response.status !== 429 || attempt >= 4) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
    } catch (error) {
      if (attempt >= 4) {
        throw error;
      }
    }
    await sleep(5000 * attempt);
  }
}

/** The season of a date: a season starts in September, with the preseason. */
function seasonOf(date) {
  const year = date.getFullYear();
  return date.getMonth() >= 8 ? year * 10000 + year + 1 : (year - 1) * 10000 + year;
}

function readFiles() {
  return fs.readdirSync(historyDir).filter(name => /^\d{8}-\d\.json$/.test(name)).map(name => {
    const history = JSON.parse(fs.readFileSync(path.join(historyDir, name), 'utf8'));
    return {
      name,
      season: history.season,
      gameType: history.gameType,
      generated: history.generated,
      throughDate: history.throughDate,
      games: history.games.id.length
    };
  });
}

async function main() {
  const files = readFiles();
  const inProgress = files.filter(file => file.throughDate).sort((fileA, fileB) => fileB.season - fileA.season)[0];
  const season = Number(process.argv[2]) || inProgress?.season || seasonOf(new Date());
  const gameType = Number(process.argv[3]) || (inProgress?.season === season ? inProgress.gameType : 2);
  const file = files.find(candidate => candidate.season === season && candidate.gameType === gameType);

  const filter = encodeURIComponent(`season=${season} and gameType=${gameType}`);
  const games = (await getJson(`${statsUrl}game?cayenneExp=${filter}`)).data;
  const finals = games.filter(game => game.gameStateId === finalState);
  const unfinished = games.length - finals.length;
  const inPlay = games.filter(game => game.gameStateId !== finalState && game.gameStateId !== futureState);
  const latestFinal = finals.map(game => game.gameDate).sort().at(-1);

  const gameTypeName = gameType === 3 ? 'playoffs' : 'regular season';
  console.log(`Season ${season}, ${gameTypeName} (game type ${gameType})`);
  console.log(file
      ? `File: ${file.name}, ${file.throughDate ? 'through ' + file.throughDate : 'finished'}, ${file.games} games ` +
        `(generated ${file.generated})`
      : 'File: none');
  console.log(`Stats API: ${finals.length} final games${latestFinal ? ' through ' + latestFinal : ''}, ` +
      `${unfinished} not final, ${inPlay.length} in play now` +
      (inPlay.length ? ` (${inPlay.map(game => game.id).join(', ')})` : ''));

  let status;
  if (finals.length === 0) {
    status = 'not-started';
  } else if (!file) {
    status = 'new-season';
  } else if (unfinished === 0) {
    status = file.throughDate || file.games < finals.length ? 'finished' : 'complete';
  } else {
    status = finals.length > file.games ? 'behind' : 'up-to-date';
  }
  if (status === 'behind' || status === 'finished' || status === 'new-season') {
    const missing = file ? ` (${finals.length - file.games} games missing)` : '';
    console.log(`Command (from HokMob.App/ClientApp): npm run build-season-data -- ${season}` +
        (gameType === 2 ? '' : ` ${gameType}`) + (status === 'finished' ? '' : ' --partial') + missing);
  }
  console.log(`STATUS=${status}`);
}

main().catch(error => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});

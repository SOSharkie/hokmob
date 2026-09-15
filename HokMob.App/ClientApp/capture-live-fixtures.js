// Captures live api-web.nhle.com responses as test fixtures, for the live checks in docs/nhl-api-migration-plan.md
// (section 10). Saves the score, landing, play-by-play, boxscore and right-rail of a game each time its state changes
// (a new period, an intermission, CRIT, final), and prints the fields the live game page relies on.
//
// Usage: npm run capture-live-fixtures -- [gameId] [--watch] [--out <dir>]
//   gameId   Game to capture. Default: the first LIVE or CRIT game in today's score.
//   --watch  Keep polling every 30s until the game is over. Without a gameId, waits for a game to go live.
//   --out    Output folder. Default: src/app/shared/testing/nhl-api-mocks/live (trim item counts before committing).
const fs = require('fs');
const path = require('path');

const apiUrl = 'https://api-web.nhle.com/v1/';
const pollMs = 30000;
const intermissionRecaptureMs = 60000;

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const outIndex = args.indexOf('--out');
const outDir = outIndex >= 0 ? args[outIndex + 1] : path.join(__dirname, 'src/app/shared/testing/nhl-api-mocks/live');
const gameIdArg = args.find((arg, i) => /^\d{10}$/.test(arg) && args[i - 1] !== '--out');

const isLive = gameState => gameState === 'LIVE' || gameState === 'CRIT';
const isOver = gameState => gameState === 'OFF' || gameState === 'FINAL';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(apiPath) {
  const response = await fetch(apiUrl + apiPath);
  if (!response.ok) {
    throw new Error(`${apiPath}: HTTP ${response.status}`);
  }
  return response.json();
}

function localDate() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-');
}

/**
 * A file name label for the game's state, like "p2", "intermission-1", "crit-p3", "so" or "off".
 */
function stateLabel(landing) {
  const period = landing.periodDescriptor ?? {};
  const periodLabel = period.periodType === 'SO' ? 'so' : 'p' + period.number;
  if (landing.clock?.inIntermission) {
    return 'intermission-' + period.number;
  }
  if (landing.gameState === 'CRIT') {
    return 'crit-' + periodLabel;
  }
  return landing.gameState === 'LIVE' ? periodLabel : String(landing.gameState).toLowerCase();
}

async function findLiveGameId() {
  const score = await get('score/' + localDate());
  const games = score.games ?? [];
  const live = games.find(game => isLive(game.gameState));
  if (!live) {
    console.log(`No live game on ${localDate()}:`,
        games.map(game => `${game.id} ${game.awayTeam.abbrev}@${game.homeTeam.abbrev} ${game.gameState}`).join(', ') || 'no games');
  }
  return live?.id;
}

async function capture(gameId, label) {
  const gameUrl = `gamecenter/${gameId}/`;
  const [landing, playByPlay, boxscore, rightRail] = await Promise.all(
      ['landing', 'play-by-play', 'boxscore', 'right-rail'].map(part => get(gameUrl + part)));
  const score = await get('score/' + landing.gameDate);
  label = label ?? stateLabel(landing);

  fs.mkdirSync(outDir, {recursive: true});
  const files = {
    [`score-${landing.gameDate}-${label}`]: score,
    [`gamecenter-${gameId}-landing-${label}`]: landing,
    [`gamecenter-${gameId}-play-by-play-${label}`]: playByPlay,
    [`gamecenter-${gameId}-boxscore-${label}`]: boxscore,
    [`gamecenter-${gameId}-right-rail-${label}`]: rightRail
  };
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(body, null, 2) + '\n');
  }

  const scoreGame = (score.games ?? []).find(game => game.id === gameId);
  const lastPlay = playByPlay.plays?.[playByPlay.plays.length - 1];
  const stats = boxscore.playerByGameStats;
  console.log(`\n[${new Date().toLocaleTimeString()}] Saved ${label} for ${gameId} to ${outDir}`);
  console.log('  landing gameState:', landing.gameState, '| periodDescriptor:', JSON.stringify(landing.periodDescriptor));
  console.log('  landing clock:', JSON.stringify(landing.clock));
  console.log('  score clock:', JSON.stringify(scoreGame?.clock), '| score gameState:', scoreGame?.gameState);
  console.log('  landing summary.scoring periods:',
      (landing.summary?.scoring ?? []).map(period => `${period.periodDescriptor?.number}(${period.goals?.length ?? 0})`).join(' '));
  console.log('  play-by-play plays:', playByPlay.plays?.length ?? 0, '| last play:',
      lastPlay && `${lastPlay.typeDescKey} ${lastPlay.periodDescriptor?.number} ${lastPlay.timeInPeriod} situationCode ${lastPlay.situationCode}`);
  console.log('  boxscore playerByGameStats:', stats
      ? `home ${Object.values(stats.homeTeam ?? {}).flat().length}, away ${Object.values(stats.awayTeam ?? {}).flat().length} players`
      : 'missing');
  console.log('  right-rail teamGameStats:', rightRail.teamGameStats?.length ?? 'missing');
  return landing;
}

async function main() {
  let gameId = gameIdArg ? Number(gameIdArg) : await findLiveGameId();
  while (!gameId && watch) {
    await sleep(pollMs);
    gameId = await findLiveGameId();
  }
  if (!gameId) {
    process.exitCode = 1;
    return;
  }

  const captured = new Set();
  let intermissionStart;
  for (;;) {
    const landing = await get(`gamecenter/${gameId}/landing`);
    const label = stateLabel(landing);
    if (!captured.has(label)) {
      captured.add(label);
      intermissionStart = landing.clock?.inIntermission ? Date.now() : undefined;
      await capture(gameId, label);
    } else if (intermissionStart && Date.now() - intermissionStart >= intermissionRecaptureMs) {
      // A second intermission capture shows whether clock.secondsRemaining counts down the intermission
      intermissionStart = undefined;
      await capture(gameId, label + '-later');
    }
    if (!watch || isOver(landing.gameState)) {
      return;
    }
    await sleep(pollMs);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

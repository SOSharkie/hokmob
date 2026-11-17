// Saves Natural Stat Trick's team game logs for one season: every team's every game, with shot attempts, goals,
// expected goals (xG) and scoring chances, as one CSV per strength state under data/natural-stat-trick/team-games at the
// repo root. A finished season never changes, so it's fetched once and kept; the power rating backtests read these
// files instead of asking NST again. See "Natural Stat Trick" in docs/nhl-api.md.
//
// Usage: npm run build-nst-team-games -- <season> [--sits 5v5,sva,all,pp,pk] [--html <dir>] [--out <dir>]
//   season  Like 20252026. Regular season only.
//   --sits  The strength states (NST's sit parameter). Default: 5v5,sva,all,pp,pk. sva is score and venue adjusted 5v5.
//   --html  Read already saved pages (<dir>/games-<season>-2-<sit>.html) instead of fetching them.
//   --out   Output folder. Default: ../../data/natural-stat-trick/team-games
//
// One page (games.php) holds a whole season at one strength state and costs 10 usage tokens, like any NST page, so a
// season is 5 pages. The key comes from the NST_KEY environment variable, or the app's user secrets
// (NaturalStatTrick:Key); it's never printed. Fetching stops once the token pools run low, so the app keeps working.
const fs = require('fs');
const path = require('path');

const nstUrl = 'https://data.naturalstattrick.com/';
const teamsUrl = 'https://api.nhle.com/stats/rest/en/team';
const userSecretsId = 'e810cda8-861d-42d8-a74b-8fe5f0c575b9';
const defaultSits = ['5v5', 'sva', 'all', 'pp', 'pk'];
/** Fetching stops below these, well above the app's own reserve of 100 (NaturalStatTrickClient). */
const minStandardTokens = 700;
const minBurstTokens = 300;
const delayMs = 4000;

/** The page's count columns kept, in the file's order. The percentages are left out: the counts give them. */
const columns = ['CF', 'CA', 'FF', 'FA', 'SF', 'SA', 'GF', 'GA', 'xGF', 'xGA', 'SCF', 'SCA', 'HDCF', 'HDCA', 'HDSF', 'HDSA',
  'HDGF', 'HDGA', 'MDCF', 'MDCA', 'MDSF', 'MDSA', 'MDGF', 'MDGA', 'LDCF', 'LDCA', 'LDSF', 'LDSA', 'LDGF', 'LDGA'];

function readArgs() {
  const args = process.argv.slice(2);
  const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
  const season = args.find(arg => /^\d{8}$/.test(arg));
  if (!season) {
    console.error('Usage: npm run build-nst-team-games -- <season> [--sits 5v5,sva,all,pp,pk] [--html <dir>] [--out <dir>]');
    process.exit(1);
  }
  return {
    season,
    sits: (option('--sits') ?? defaultSits.join(',')).split(','),
    htmlDir: option('--html'),
    outDir: option('--out') ?? path.join(__dirname, '..', '..', 'data', 'natural-stat-trick', 'team-games')
  };
}

/** The access key, from NST_KEY or the app's user secrets. Never logged. */
function readKey() {
  if (process.env.NST_KEY) {
    return process.env.NST_KEY;
  }
  const file = process.env.APPDATA && path.join(process.env.APPDATA, 'Microsoft', 'UserSecrets', userSecretsId, 'secrets.json');
  if (file && fs.existsSync(file)) {
    const secrets = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    return secrets['NaturalStatTrick:Key'] ?? secrets.NaturalStatTrick?.Key ?? null;
  }
  return null;
}

/** NST writes team names without periods or accents: "St Louis Blues", "Montreal Canadiens". */
function normalizeName(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\./g, '').trim().toLowerCase();
}

/** Every NHL team's ID by its normalized full name, from the stats API. */
async function getTeamIds() {
  const response = await fetch(teamsUrl);
  if (!response.ok) {
    throw new Error('The stats API team list answered ' + response.status);
  }
  const teams = (await response.json()).data;
  return new Map(teams.map(team => [normalizeName(team.fullName), team.id]));
}

async function getPage(season, sit, htmlDir, key) {
  if (htmlDir) {
    return fs.readFileSync(path.join(htmlDir, `games-${season}-2-${sit}.html`), 'utf8');
  }
  const url = `${nstUrl}games.php?fromseason=${season}&thruseason=${season}&stype=2&sit=${sit}&loc=B&team=All&rate=n`;
  const response = await fetch(url, {headers: {'nst-key': key}});
  const html = await response.text();
  const standard = Number(response.headers.get('tokens-remaining'));
  const burst = Number(response.headers.get('burst-remaining'));
  console.log(`  ${sit}: HTTP ${response.status}, ${standard} standard and ${burst} burst tokens left`);
  if (!response.ok) {
    throw new Error('Natural Stat Trick answered ' + response.status);
  }
  if (standard < minStandardTokens || burst < minBurstTokens) {
    throw new Error('The usage tokens are running low. Try again later.');
  }
  await new Promise(resolve => setTimeout(resolve, delayMs));
  return html;
}

const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
const cleanText = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Reads the page's table (id=teams): a row per team and game. The rows aren't closed, so they're split on "<tr". The
 * first cell is the date and score ("2025-10-07 - Blackhawks 2, Panthers 3"), and the report links give the game ID.
 */
function parsePage(season, html, teamIds) {
  const start = html.indexOf('<table id=teams');
  const bodyStart = html.indexOf('<tbody', start);
  if (start < 0 || bodyStart < 0) {
    throw new Error('The page has no team table');
  }
  const end = html.indexOf('</table>', bodyStart);
  const header = [...html.slice(start, bodyStart).matchAll(cellRegex)].map(cell => cleanText(cell[1]));
  const indexes = ['TOI', ...columns].map(column => {
    const index = header.indexOf(column);
    if (index < 0) {
      throw new Error('The table has no ' + column + ' column');
    }
    return index;
  });
  const rows = [];
  for (const rowHtml of html.slice(bodyStart, end < 0 ? undefined : end).split('<tr').slice(1)) {
    const cells = [...rowHtml.matchAll(cellRegex)].map(cell => cell[1]);
    if (cells.length !== header.length) {
      continue;
    }
    const date = cleanText(cells[0]).slice(0, 10);
    const game = /game=(\d+)/.exec(rowHtml);
    const teamId = teamIds.get(normalizeName(cleanText(cells[header.indexOf('Team')])));
    if (!game || !teamId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Unreadable row: ' + cleanText(rowHtml).slice(0, 120));
    }
    const [minutes, seconds] = cleanText(cells[indexes[0]]).split(':').map(Number);
    const values = indexes.slice(1).map(index => {
      const text = cleanText(cells[index]);
      return text === '-' || text === '' ? '' : String(Number(text));
    });
    rows.push({gameId: Number(season.slice(0, 4)) * 1000000 + Number(game[1]), date, teamId, toi: minutes * 60 + seconds, values});
  }
  rows.sort((rowA, rowB) => rowA.gameId - rowB.gameId || rowA.teamId - rowB.teamId);
  return rows;
}

(async () => {
  const {season, sits, htmlDir, outDir} = readArgs();
  const key = htmlDir ? null : readKey();
  if (!htmlDir && !key) {
    console.error('No Natural Stat Trick key: set NST_KEY, or the NaturalStatTrick:Key user secret');
    process.exit(1);
  }
  const teamIds = await getTeamIds();
  fs.mkdirSync(outDir, {recursive: true});
  console.log(season);
  for (const sit of sits) {
    const rows = parsePage(season, await getPage(season, sit, htmlDir, key), teamIds);
    const games = new Set(rows.map(row => row.gameId)).size;
    // A team that never had a power play (or was never short-handed) in a game has no row at that strength
    const keys = new Set(rows.map(row => row.gameId + ':' + row.teamId));
    if (keys.size !== rows.length || rows.length > 2 * games || (rows.length < 2 * games && sit !== 'pp' && sit !== 'pk')) {
      throw new Error(`${sit}: ${rows.length} rows for ${games} games`);
    }
    const lines = [['gameId', 'date', 'teamId', 'toi', ...columns].join(',')]
      .concat(rows.map(row => [row.gameId, row.date, row.teamId, row.toi, ...row.values].join(',')));
    const file = path.join(outDir, `${season}-2-${sit}.csv`);
    fs.writeFileSync(file, lines.join('\n') + '\n');
    console.log(`  ${sit}: ${games} games through ${rows[rows.length - 1]?.date} -> ${path.relative(process.cwd(), file)}`);
  }
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});

// Builds the history page's data for one finished season: every player's per game stat line from the stats API
// (api.nhle.com/stats/rest/en), the inputs of the HokMob rating rather than the ratings, so a formula change shows up
// on the history page without regenerating the file. See "History data" in docs/nhl-api.md.
//
// Usage: npm run build-season-data -- <season> [gameType] [--games <id,id,...>] [--out <file>]
//   season    Like 20252026.
//   gameType  2 for the regular season (the default) or 3 for the playoffs.
//   --games   Keep only these games, for a test fixture. Everything is still fetched and validated.
//   --out     Output file. Default: src/assets/history/<season>-<gameType>.json
//
// The file is columnar: each table (games, players, skaters, goalies) is an object of equally long arrays, one per
// field, and a skater or goalie row points at its player and game by their index in those tables. SeasonHistory in
// src/app/shared/models/nhl-history/season-history.model.ts describes it.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const statsUrl = 'https://api.nhle.com/stats/rest/en/';
const maxAttempts = 6;
const retryDelayMs = 5000;
const timeoutMs = 60000;
/** The stats API answers 429 to more than a few requests at once. */
const concurrency = 2;
/** The stats API returns at most this many rows per query, however high the limit, without saying so. */
const rowCap = 10000;
const fileVersion = 1;

/** The skater reports merged into one row per player and game, and the fields taken from each. */
const skaterReports = {
  'skater/summary': ['timeOnIcePerGame', 'goals', 'assists', 'plusMinus', 'penaltyMinutes', 'ppGoals', 'shots',
    'faceoffWinPct'],
  'skater/scoringpergame': ['totalPrimaryAssists', 'totalSecondaryAssists'],
  'skater/powerplay': ['ppAssists'],
  'skater/realtime': ['hits', 'blockedShots', 'takeaways', 'giveaways'],
  'skater/faceoffwins': ['totalFaceoffs'],
  'skater/penalties': ['penaltiesDrawn'],
  // The on-ice 5v5 Corsi and Fenwick counts. Not in the rating yet (#120)
  'skater/summaryshooting': ['satFor', 'satAgainst', 'usatFor', 'usatAgainst']
};

/**
 * Fields the stats API leaves null instead of 0: the faceoff percentage of a skater without faceoffs, and a Corsi or
 * Fenwick count of a skater with a few 5v5 shifts (satAgainst is null when satFor is 2). Stored as 0, which is how the
 * rating reads a missing faceoff percentage.
 */
const nullAsZeroFields = ['faceoffWinPct', 'satFor', 'satAgainst', 'usatFor', 'usatAgainst'];

/** The goalie reports, and the fields taken from each. The totals (saves, shots against) are the sums of these. */
const goalieReports = {
  'goalie/summary': ['timeOnIce'],
  'goalie/savesByStrength': ['evSaves', 'evShotsAgainst', 'ppSaves', 'ppShotsAgainst', 'shSaves', 'shShotsAgainst']
};

const args = process.argv.slice(2);
const optionValue = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const positional = args.filter((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--'));
const season = Number(positional[0]);
const gameType = Number(positional[1] ?? 2);
const onlyGameIds = optionValue('--games')?.split(',').map(Number);
const outFile = optionValue('--out') ?? path.join(__dirname, `src/assets/history/${season}-${gameType}.json`);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * An error that retrying won't fix, like a response at the row cap.
 */
function fatalError(message) {
  return Object.assign(new Error(message), {fatal: true});
}

/**
 * Fetches a stats API report's rows, retrying a few times, and waiting longer after a 429. Fails when the response
 * may have hit the row cap.
 */
async function getReport(report, params) {
  const query = Object.entries(params).map(([key, value]) => key + '=' + encodeURIComponent(value)).join('&');
  const url = statsUrl + report + '?' + query;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(timeoutMs)});
      if (response.status === 429 && attempt < maxAttempts) {
        const retryAfterMs = Number(response.headers.get('retry-after')) * 1000;
        const delay = Math.max(retryAfterMs || 0, retryDelayMs * attempt * 2);
        console.log(`  ${report}: HTTP 429, retrying in ${delay / 1000}s`);
        await sleep(delay);
        continue;
      }
      if (!response.ok) {
        throw new Error(`${report}: HTTP ${response.status}`);
      }
      const body = await response.json();
      if (!Array.isArray(body.data)) {
        throw new Error(`${report}: ${body.message ?? 'no data'} (${url})`);
      }
      if (body.total >= rowCap || body.data.length >= rowCap) {
        throw fatalError(`${report}: ${body.total} rows, at the stats API's ${rowCap} row cap, so some are missing ` +
            `(${url})`);
      }
      if (body.data.length !== body.total) {
        throw fatalError(`${report}: ${body.data.length} of ${body.total} rows (${url})`);
      }
      return body.data;
    } catch (error) {
      if (attempt >= maxAttempts || error.fatal) {
        throw error;
      }
      const delay = retryDelayMs * attempt;
      console.log(`  ${report}: ${error.cause?.code ?? error.message}, retrying in ${delay / 1000}s`);
      await sleep(delay);
    }
  }
}

/**
 * Runs the tasks, a few at a time, and resolves their results in order.
 */
async function runAll(tasks) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({length: Math.min(concurrency, tasks.length)}, worker));
  return results;
}

function gameRowParams(filter) {
  return {isAggregate: 'false', isGame: 'true', limit: '-1', cayenneExp: filter};
}

const rowKey = row => row.playerId + '-' + row.gameId;

/**
 * Merges the reports' rows into one row per player and game, with the fields listed for each report. Every report
 * must have exactly the same rows.
 */
function mergeReports(reportRows, reportFields, label) {
  const [firstReport, ...otherReports] = Object.keys(reportFields);
  const merged = new Map();
  for (const row of reportRows[firstReport]) {
    const key = rowKey(row);
    if (merged.has(key)) {
      throw new Error(`${label}: ${firstReport} has two rows for player ${row.playerId} in game ${row.gameId}`);
    }
    merged.set(key, {...row});
  }
  for (const report of otherReports) {
    const rows = reportRows[report];
    if (rows.length !== merged.size) {
      throw new Error(`${label}: ${report} has ${rows.length} rows, ${firstReport} has ${merged.size}`);
    }
    for (const row of rows) {
      const target = merged.get(rowKey(row));
      if (!target) {
        throw new Error(`${label}: ${report} has player ${row.playerId} in game ${row.gameId}, ${firstReport} doesn't`);
      }
      reportFields[report].forEach(field => target[field] = row[field]);
    }
  }
  return [...merged.values()];
}

/**
 * Checks a merged row's fields are all numbers, or null where nullAsZeroFields allows it.
 */
function checkNumbers(row, fields, label) {
  for (const field of fields) {
    const value = row[field];
    if (value == null && nullAsZeroFields.includes(field) && (field !== 'faceoffWinPct' || !row.totalFaceoffs)) {
      continue;
    }
    if (typeof value !== 'number' || !isFinite(value)) {
      throw new Error(`${label}: ${field} is ${value} for player ${row.playerId} in game ${row.gameId}`);
    }
  }
}

async function main() {
  const isSeason = /^\d{8}$/.test(String(season)) && season % 10000 - Math.floor(season / 10000) === 1;
  if (!isSeason || ![2, 3].includes(gameType)) {
    console.error('Usage: npm run build-season-data -- <season like 20252026> [gameType 2 or 3] [--games <ids>] ' +
        '[--out <file>]');
    process.exitCode = 1;
    return;
  }
  const seasonFilter = `seasonId=${season} and gameTypeId=${gameType}`;

  console.log(`Fetching the ${season} games (game type ${gameType})`);
  const gameRows = (await getReport('game', {cayenneExp: `season=${season} and gameType=${gameType}`}))
      .sort((gameA, gameB) => gameA.id - gameB.id);
  const unfinished = gameRows.filter(game => game.gameStateId !== 7);
  if (gameRows.length === 0 || unfinished.length > 0) {
    const examples = unfinished.slice(0, 5).map(game => game.id).join(', ');
    throw new Error(`${gameRows.length} games, ${unfinished.length} not final (${examples}). ` +
        'Only a finished season can be built.');
  }
  const teamIds = [...new Set(gameRows.flatMap(game => [game.homeTeamId, game.visitingTeamId]))]
      .sort((teamA, teamB) => teamA - teamB);

  // A team's season is about 1,500 skater rows, the whole league's about 47,000, well over the row cap
  const reports = Object.keys(skaterReports);
  console.log(`Fetching ${reports.length} skater reports for ${teamIds.length} teams`);
  const teamReports = teamIds.flatMap(teamId => reports.map(report => ({teamId, report})));
  const teamReportRows = await runAll(teamReports.map(({teamId, report}) => () =>
      getReport(report, gameRowParams(`${seasonFilter} and teamId=${teamId}`))));
  const skaterRows = teamIds.flatMap(teamId => {
    const reportRows = Object.fromEntries(reports.map(report =>
        [report, teamReportRows[teamReports.findIndex(task => task.teamId === teamId && task.report === report)]]));
    return mergeReports(reportRows, skaterReports, `team ${teamId}`).map(row => ({...row, teamId}));
  });

  console.log('Fetching the goalie reports');
  const goalieReportNames = Object.keys(goalieReports);
  const goalieReportRows = await runAll(goalieReportNames.map(report => () =>
      getReport(report, gameRowParams(seasonFilter))));
  const goalieReportsByName = Object.fromEntries(goalieReportNames.map((report, i) => [report, goalieReportRows[i]]));
  const goalieRows = mergeReports(goalieReportsByName, goalieReports, 'goalies');

  const gamesById = new Map(gameRows.map(game => [game.id, game]));
  const skaterFields = Object.values(skaterReports).flat();
  const goalieFields = Object.values(goalieReports).flat();

  // Validation: every row's game is known, and its team is the side homeRoad says
  const teamsSeen = new Map(gameRows.map(game => [game.id, {skaters: new Set(), goalies: new Set()}]));
  for (const row of skaterRows) {
    const game = gamesById.get(row.gameId);
    if (!game) {
      throw new Error(`Skater ${row.playerId} has game ${row.gameId}, which isn't in the game report`);
    }
    const teamId = row.homeRoad === 'H' ? game.homeTeamId : game.visitingTeamId;
    if (teamId !== row.teamId) {
      throw new Error(`Skater ${row.playerId} in game ${row.gameId} is on team ${row.teamId}, but homeRoad ` +
          `${row.homeRoad} says ${teamId}`);
    }
    checkNumbers(row, skaterFields, 'skaters');
    if (row.totalPrimaryAssists + row.totalSecondaryAssists !== row.assists) {
      throw new Error(`Skater ${row.playerId} in game ${row.gameId}: ${row.totalPrimaryAssists} primary and ` +
          `${row.totalSecondaryAssists} secondary assists, but ${row.assists} assists`);
    }
    teamsSeen.get(row.gameId).skaters.add(row.homeRoad);
  }
  for (const row of goalieRows) {
    if (!gamesById.has(row.gameId)) {
      throw new Error(`Goalie ${row.playerId} has game ${row.gameId}, which isn't in the game report`);
    }
    checkNumbers(row, goalieFields, 'goalies');
    if (row.evShotsAgainst + row.ppShotsAgainst + row.shShotsAgainst !== row.shotsAgainst ||
        row.evSaves + row.ppSaves + row.shSaves !== row.saves) {
      throw new Error(`Goalie ${row.playerId} in game ${row.gameId}: the saves by strength don't add up to ` +
          `${row.saves} saves on ${row.shotsAgainst} shots`);
    }
    teamsSeen.get(row.gameId).goalies.add(row.homeRoad);
  }
  const incomplete = [...teamsSeen].filter(([, seen]) => seen.skaters.size !== 2 || seen.goalies.size !== 2);
  if (incomplete.length > 0) {
    throw new Error(`${incomplete.length} games don't have skaters and goalies for both teams: ` +
        incomplete.slice(0, 10).map(([gameId]) => gameId).join(', '));
  }

  // A player's position is the same in every game (checked), so it's stored once
  const players = new Map();
  const addPlayer = (playerId, name, position) => {
    const player = players.get(playerId);
    if (player && player.position !== position) {
      throw new Error(`Player ${playerId} (${name}) is both ${player.position} and ${position}`);
    }
    players.set(playerId, {id: playerId, name, position});
  };
  skaterRows.forEach(row => addPlayer(row.playerId, row.skaterFullName, row.positionCode));
  goalieRows.forEach(row => addPlayer(row.playerId, row.goalieFullName, 'G'));

  // The output, optionally trimmed to a few games for a test fixture
  const keptGames = onlyGameIds ? gameRows.filter(game => onlyGameIds.includes(game.id)) : gameRows;
  if (onlyGameIds && keptGames.length !== onlyGameIds.length) {
    throw new Error(`Only ${keptGames.length} of the ${onlyGameIds.length} --games are in the season`);
  }
  const gameIndex = new Map(keptGames.map((game, index) => [game.id, index]));
  const bySideAndPlayer = (rowA, rowB) => gameIndex.get(rowA.gameId) - gameIndex.get(rowB.gameId) ||
      rowA.homeRoad.localeCompare(rowB.homeRoad) || rowA.playerId - rowB.playerId;
  const keptSkaters = skaterRows.filter(row => gameIndex.has(row.gameId)).sort(bySideAndPlayer);
  const keptGoalies = goalieRows.filter(row => gameIndex.has(row.gameId)).sort(bySideAndPlayer);
  const keptPlayerIds = new Set([...keptSkaters, ...keptGoalies].map(row => row.playerId));
  const keptPlayers = [...players.values()]
      .filter(player => keptPlayerIds.has(player.id))
      .sort((playerA, playerB) => playerA.id - playerB.id);
  const playerIndex = new Map(keptPlayers.map((player, index) => [player.id, index]));

  const columns = (rows, fields) => Object.fromEntries(fields.map(([name, value]) => [name, rows.map(value)]));
  const rowColumns = [
    ['player', row => playerIndex.get(row.playerId)],
    ['game', row => gameIndex.get(row.gameId)],
    ['home', row => row.homeRoad === 'H' ? 1 : 0]
  ];
  const history = {
    version: fileVersion,
    season,
    gameType,
    generated: new Date().toISOString().slice(0, 10),
    games: columns(keptGames, [
      ['id', game => game.id],
      ['date', game => game.gameDate],
      ['homeTeamId', game => game.homeTeamId],
      ['awayTeamId', game => game.visitingTeamId],
      ['homeScore', game => game.homeScore],
      ['awayScore', game => game.visitingScore]
    ]),
    players: columns(keptPlayers, [
      ['id', player => player.id],
      ['name', player => player.name],
      ['position', player => player.position]
    ]),
    skaters: columns(keptSkaters, [
      ...rowColumns,
      ...skaterFields.map(field => [field, row => row[field] ?? 0])
    ]),
    goalies: columns(keptGoalies, [...rowColumns, ...goalieFields.map(field => [field, row => row[field]])])
  };

  const json = serialize(history);
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  fs.writeFileSync(outFile, json);

  const kilobytes = bytes => Math.round(bytes / 1024).toLocaleString('en-US') + ' KB';
  console.log(`\nWrote ${path.relative(process.cwd(), outFile)}`);
  console.log(`  games:        ${keptGames.length}`);
  console.log(`  players:      ${keptPlayers.length}`);
  console.log(`  skater rows:  ${keptSkaters.length}`);
  console.log(`  goalie rows:  ${keptGoalies.length}`);
  const gzippedSize = zlib.gzipSync(json).length;
  console.log(`  file size:    ${kilobytes(Buffer.byteLength(json))} (${kilobytes(gzippedSize)} gzipped)`);
}

/**
 * Writes the history as JSON with each table's columns on their own line, so a regenerated file diffs by column.
 */
function serialize(history) {
  const lines = Object.entries(history).map(([key, value]) => {
    if (value && typeof value === 'object') {
      const columnLines = Object.entries(value)
          .map(([name, column]) => `    ${JSON.stringify(name)}: ${JSON.stringify(column)}`);
      return `  ${JSON.stringify(key)}: {\n${columnLines.join(',\n')}\n  }`;
    }
    return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}

main().catch(error => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});

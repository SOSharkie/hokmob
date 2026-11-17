// Saves one regular season of the NHL's play-by-play and per game player logs under data/nhl-play-by-play at the repo
// root, for research on the team power rating (stats the NHL and Natural Stat Trick don't publish). A finished game
// never changes, so each is fetched once and kept. The app doesn't read these files. See "Stored play-by-play" in
// docs/nhl-api.md for the file formats.
//
// Usage: npm run build-play-by-play -- <season> [<season> ...] [--out <dir>] [--only <parts>]
//   season  Like 20252026. Regular season only. Several seasons are done one after another.
//   --out   Output folder. Default: ../../data/nhl-play-by-play
//   --only  Comma separated parts to save. Default: totals,logs,play-by-play.
//             totals        every skater's and goalie's season totals and the skaters' bios (3 requests,
//                           refetched every run)
//             logs          every skater's ice time and every goalie's shots in each game (about 15 requests)
//             play-by-play  every game's plays (one request per game)
//           Not in the default: edge, every team's season totals from the NHL's EDGE tracking (zone time, skating
//           and shot speed; 2 requests per team, refetched every run, 2021-22 and later).
//
// It resumes: games already in a season's file are skipped, so rerun it after an interruption, or to add a season in
// progress's new games. Only finished games are fetched.
//
// api-web allows only about one play-by-play request a second. Past that it answers 429 with "Retry-After: 60", and
// requests sent during those 60 seconds keep failing, so the script sends one request at a time, waits out every 429
// and slows down after one. A full season (1,312 games) takes 25 to 40 minutes. Don't run two copies at once, and
// expect the running app's own api-web calls to fail now and then while it runs: the limit is per IP address.
const fs = require('fs');
const path = require('path');

const playByPlayUrl = id => `https://api-web.nhle.com/v1/gamecenter/${id}/play-by-play`;
const statsUrl = 'https://api.nhle.com/stats/rest/en/';
/** The stats API's gameStateId of a finished game. */
const finalGameState = 7;
/** Milliseconds between play-by-play requests: where it starts, and how far it speeds up and slows down. */
const startInterval = 1100;
const minInterval = 700;
const maxInterval = 6000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const seconds = time => { const [m, s] = (time ?? '0:0').split(':').map(Number); return m * 60 + s; };

/**
 * Keeps what a game's play-by-play says about the play, and drops the rest (names, clips, broadcasts): about 25 KB
 * instead of 120 KB. See docs/nhl-api.md for the keys.
 */
function compactGame(game) {
  const plays = (game.plays ?? []).map(play => {
    const d = play.details ?? {};
    const out = {
      t: play.typeDescKey, p: play.periodDescriptor?.number, s: seconds(play.timeInPeriod), sit: play.situationCode,
      side: play.homeTeamDefendingSide === 'left' ? 'L' : play.homeTeamDefendingSide === 'right' ? 'R' : undefined,
      tm: d.eventOwnerTeamId, x: d.xCoord, y: d.yCoord, z: d.zoneCode
    };
    switch (play.typeDescKey) {
      case 'goal':
        Object.assign(out, {pl: d.scoringPlayerId, a1: d.assist1PlayerId, a2: d.assist2PlayerId, g: d.goalieInNetId, st: d.shotType});
        break;
      case 'shot-on-goal':
        Object.assign(out, {pl: d.shootingPlayerId, g: d.goalieInNetId, st: d.shotType});
        break;
      case 'missed-shot':
        Object.assign(out, {pl: d.shootingPlayerId, g: d.goalieInNetId, st: d.shotType, r: d.reason});
        break;
      case 'blocked-shot':
        Object.assign(out, {pl: d.shootingPlayerId, b: d.blockingPlayerId, r: d.reason});
        break;
      case 'faceoff':
        Object.assign(out, {pl: d.winningPlayerId, b: d.losingPlayerId});
        break;
      case 'hit':
        Object.assign(out, {pl: d.hittingPlayerId, b: d.hitteePlayerId});
        break;
      case 'giveaway':
      case 'takeaway':
        out.pl = d.playerId;
        break;
      case 'penalty':
        Object.assign(out, {pl: d.committedByPlayerId, b: d.drawnByPlayerId, r: d.descKey, pt: d.typeCode, dur: d.duration});
        break;
      case 'stoppage':
        Object.assign(out, {r: d.reason, r2: d.secondaryReason});
        break;
    }
    return out;
  });
  return {
    id: game.id, date: game.gameDate, home: game.homeTeam?.id, away: game.awayTeam?.id,
    roster: (game.rosterSpots ?? []).map(spot => [spot.playerId, spot.teamId, spot.positionCode]),
    plays
  };
}

/** A stats API report, every row of it. Retries, since it shares api-web's limit. */
async function statsRows(report, expression, isGame) {
  const url = `${statsUrl}${report}?${isGame ? 'isAggregate=false&isGame=true&' : ''}limit=-1&cayenneExp=${encodeURIComponent(expression)}`;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.json();
        if (json.total != null && json.data.length !== json.total) throw new Error(`${report}: ${json.data.length} of ${json.total} rows`);
        return json.data;
      }
    } catch (error) {
      if (attempt === 19) throw error;
    }
    await sleep(15000);
  }
  throw new Error(`The stats API didn't answer for ${report}`);
}

/** The season's finished regular season games, by date. */
async function finishedGames(season) {
  const games = await statsRows('game', `season=${season} and gameType=2`, false);
  return games.filter(game => game.gameStateId === finalGameState)
    .sort((a, b) => a.gameDate < b.gameDate ? -1 : a.gameDate > b.gameDate ? 1 : a.id - b.id);
}

/** Fetches the games' play-by-play that the file doesn't have yet, one request at a time. */
async function savePlayByPlay(season, games, file) {
  const have = new Set();
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) if (line) have.add(JSON.parse(line).id);
  }
  const ids = games.map(game => game.id).filter(id => !have.has(id));
  console.log(`${season}: ${have.size} games saved, ${ids.length} to fetch`);
  let interval = startInterval, streak = 0, saved = 0;
  const started = Date.now();
  for (const id of ids) {
    for (let attempt = 0; ; attempt++) {
      const sent = Date.now();
      let response = null;
      try {
        response = await fetch(playByPlayUrl(id));
      } catch (error) {
        // a dropped connection: try again below
      }
      if (response?.ok) {
        const game = compactGame(await response.json());
        if (game.plays.length) {
          fs.appendFileSync(file, JSON.stringify(game) + '\n');
          saved++;
        } else {
          console.log(`${id}: no plays, skipped`);
        }
        if (++streak >= 150) { interval = Math.max(minInterval, Math.round(interval * 0.93)); streak = 0; }
        await sleep(Math.max(0, interval - (Date.now() - sent)));
        break;
      }
      if (response?.status === 404 || attempt >= 15) {
        console.log(`${id}: ${response?.status ?? 'no answer'}, skipped`);
        break;
      }
      if (response?.status === 429) {
        const wait = (Number(response.headers.get('retry-after')) || 60) + 3;
        interval = Math.min(maxInterval, Math.round(interval * 1.2));
        streak = 0;
        console.log(`429 after ${saved} games: waiting ${wait}s, then one request every ${interval} ms`);
        await sleep(wait * 1000);
      } else {
        await sleep(5000);
      }
    }
    if (saved && saved % 100 === 0) {
      console.log(`${season}: ${saved} of ${ids.length} fetched, ${((Date.now() - started) / 60000).toFixed(1)} min, every ${interval} ms`);
    }
  }
  console.log(`${season}: play-by-play done, ${have.size + saved} of ${games.length} games in ${path.basename(file)}`);
}

const csv = (header, rows) => [header.join(','), ...rows.map(row => row.join(','))].join('\n') + '\n';
const addDays = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);

/** Every skater's ice time and every goalie's shots in each game, from the stats API's per game reports. */
async function saveLogs(season, games, dir) {
  const skaterFile = path.join(dir, `${season}-2-skater-toi.csv`), goalieFile = path.join(dir, `${season}-2-goalies.csv`);
  const gameCount = file => fs.existsSync(file) ? new Set(fs.readFileSync(file, 'utf8').split('\n').slice(1).filter(Boolean).map(l => l.split(',')[0])).size : 0;
  if (gameCount(skaterFile) < games.length) {
    // a season is about 47,000 rows and a query gives 10,000 at most, so ask two weeks at a time
    const rows = [];
    for (let from = games[0].gameDate; from <= games[games.length - 1].gameDate; from = addDays(from, 14)) {
      const data = await statsRows('skater/timeonice',
        `seasonId=${season} and gameTypeId=2 and gameDate>="${from}" and gameDate<="${addDays(from, 13)} 23:59:59"`, true);
      data.forEach(r => rows.push([r.gameId, r.playerId, r.teamAbbrev, r.positionCode, r.timeOnIce, r.evTimeOnIce, r.ppTimeOnIce,
        r.shTimeOnIce, r.shifts]));
      await sleep(1500);
    }
    rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    fs.writeFileSync(skaterFile, csv(['gameId', 'playerId', 'team', 'position', 'toi', 'evToi', 'ppToi', 'shToi', 'shifts'], rows));
    console.log(`${season}: ${rows.length} skater rows in ${path.basename(skaterFile)}`);
  }
  if (gameCount(goalieFile) < games.length) {
    const data = await statsRows('goalie/summary', `seasonId=${season} and gameTypeId=2`, true);
    const rows = data.map(r => [r.gameId, r.playerId, r.teamAbbrev, r.gamesStarted, r.shotsAgainst, r.saves, r.goalsAgainst, r.timeOnIce])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    fs.writeFileSync(goalieFile, csv(['gameId', 'playerId', 'team', 'started', 'shotsAgainst', 'saves', 'goalsAgainst', 'toi'], rows));
    console.log(`${season}: ${rows.length} goalie rows in ${path.basename(goalieFile)}`);
  }
}

/** Every skater's and goalie's totals for the season: what a player had done before a later season, for rating a lineup. */
async function saveTotals(season, dir) {
  const skaters = await statsRows('skater/summary', `seasonId=${season} and gameTypeId=2`, false);
  fs.writeFileSync(path.join(dir, `${season}-2-skater-totals.csv`), csv(
    ['playerId', 'position', 'games', 'goals', 'assists', 'points', 'evPoints', 'shots', 'toiPerGame'],
    skaters.map(r => [r.playerId, r.positionCode, r.gamesPlayed, r.goals, r.assists, r.points, r.evPoints, r.shots,
      Math.round(r.timeOnIcePerGame)]).sort((a, b) => a[0] - b[0])));
  await sleep(1500);
  const goalies = await statsRows('goalie/summary', `seasonId=${season} and gameTypeId=2`, false);
  fs.writeFileSync(path.join(dir, `${season}-2-goalie-totals.csv`), csv(
    ['playerId', 'games', 'started', 'shotsAgainst', 'saves', 'goalsAgainst', 'toi'],
    goalies.map(r => [r.playerId, r.gamesPlayed, r.gamesStarted, r.shotsAgainst, r.saves, r.goalsAgainst, r.timeOnIce])
      .sort((a, b) => a[0] - b[0])));
  await sleep(1500);
  const bios = await statsRows('skater/bios', `seasonId=${season} and gameTypeId=2`, false);
  fs.writeFileSync(path.join(dir, `${season}-2-skater-bios.csv`), csv(
    ['playerId', 'birthDate', 'height', 'weight', 'firstSeason', 'draftYear', 'draftOverall'],
    bios.map(r => [r.playerId, r.birthDate, r.height, r.weight, r.firstSeasonForGameType, r.draftYear ?? '', r.draftOverall ?? ''])
      .sort((a, b) => a[0] - b[0])));
  console.log(`${season}: ${skaters.length} skaters' and ${goalies.length} goalies' season totals, ${bios.length} bios`);
  await sleep(1500);
}

/** An api-web response, one request at a time: waits out a 429, and null when there's nothing (404). */
async function apiWeb(pathAndQuery) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const sent = Date.now();
    let response = null;
    try {
      response = await fetch(`https://api-web.nhle.com/v1/${pathAndQuery}`);
    } catch (error) {
      // a dropped connection: try again below
    }
    if (response?.ok) {
      const json = await response.json();
      await sleep(Math.max(0, startInterval - (Date.now() - sent)));
      return json;
    }
    if (response?.status === 404) return null;
    await sleep(response?.status === 429 ? ((Number(response.headers.get('retry-after')) || 60) + 3) * 1000 : 5000);
  }
  return null;
}

/**
 * Every team's season totals from the NHL's EDGE puck and player tracking: the share of time in each zone, skating
 * and shot speed, and shots on goal by distance. EDGE only gives a season so far, never a game or a date range.
 */
async function saveEdge(season, games, dir) {
  const teamIds = [...new Set(games.map(game => game.homeTeamId))].sort((a, b) => a - b);
  const rows = [];
  for (const teamId of teamIds) {
    const detail = await apiWeb(`edge/team-detail/${teamId}/${season}/2`);
    const zones = await apiWeb(`edge/team-zone-time-details/${teamId}/${season}/2`);
    if (!detail || !zones) { console.log(`${season}: no EDGE data for team ${teamId}`); continue; }
    const zone = code => zones.zoneTimeDetails?.find(z => z.strengthCode === code) ?? {};
    const sog = code => detail.sogSummary?.find(s => s.locationCode === code) ?? {};
    const all = zone('all'), ev = zone('es');
    rows.push([teamId, detail.team?.abbrev, detail.team?.gamesPlayed,
      all.offensiveZonePctg, all.neutralZonePctg, all.defensiveZonePctg, ev.offensiveZonePctg, ev.neutralZonePctg, ev.defensiveZonePctg,
      detail.skatingSpeed?.burstsOver22?.value, detail.skatingSpeed?.burstsOver20?.value, detail.skatingSpeed?.speedMax?.imperial,
      detail.distanceSkated?.total?.imperial, detail.shotSpeed?.shotAttemptsOver90?.value, detail.shotSpeed?.topShotSpeed?.imperial,
      sog('high').shots, sog('high').goals, sog('mid').shots, sog('mid').goals, sog('long').shots, sog('long').goals]
      .map(value => value ?? ''));
  }
  fs.writeFileSync(path.join(dir, `${season}-2-team-edge.csv`), csv(
    ['teamId', 'team', 'games', 'oz', 'nz', 'dz', 'ozEv', 'nzEv', 'dzEv', 'burstsOver22', 'burstsOver20', 'maxSpeed', 'distance',
      'shotsOver90', 'topShotSpeed', 'sogHigh', 'goalsHigh', 'sogMid', 'goalsMid', 'sogLong', 'goalsLong'], rows));
  console.log(`${season}: EDGE totals of ${rows.length} teams`);
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const dir = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : path.join(__dirname, '..', '..', 'data', 'nhl-play-by-play');
  const seasons = args.filter((arg, i) => /^\d{8}$/.test(arg) && (outIndex < 0 || i !== outIndex + 1));
  if (!seasons.length) {
    console.error('Usage: npm run build-play-by-play -- <season> [<season> ...] [--out <dir>] [--only totals,logs,play-by-play,edge]');
    process.exit(1);
  }
  const onlyIndex = args.indexOf('--only');
  const parts = onlyIndex >= 0 ? args[onlyIndex + 1].split(',') : ['totals', 'logs', 'play-by-play'];
  fs.mkdirSync(dir, {recursive: true});
  for (const season of seasons) {
    if (parts.includes('totals')) await saveTotals(season, dir);
    if (!parts.includes('logs') && !parts.includes('play-by-play') && !parts.includes('edge')) continue;
    const games = await finishedGames(season);
    if (!games.length) { console.log(`${season}: no finished games`); continue; }
    if (parts.includes('edge')) await saveEdge(season, games, dir);
    if (parts.includes('logs')) await saveLogs(season, games, dir);
    if (parts.includes('play-by-play')) await savePlayByPlay(season, games, path.join(dir, `${season}-2.ndjson`));
  }
}

main().catch(error => { console.error(error.message); process.exit(1); });

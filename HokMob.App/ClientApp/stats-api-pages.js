// Reads every row of a stats API (api.nhle.com/stats/rest/en) query, page by page, for the data scripts
// (build-season-data.js, build-play-by-play.js). Since 2026-11 the stats API returns at most 100 rows per request,
// whatever the limit, while its total still counts every row; without a sort each request returns a different 100.
// A query still sees 10,000 rows at most (rowCap), so a bigger one has to be split.
// The backend does the same in NhlStatsApiClient.GetAllReportRowsAsync. See "Stats API" in docs/nhl-api.md.

/** The most rows the stats API returns per request. */
const pageSize = 100;

/**
 * The most rows a query sees, even page by page: a query with more says its total is 10,000 and stops there, without
 * an error. A query that reaches it has to be split (by team, or by dates).
 */
const rowCap = 10000;

/** How many times a query is read again when its rows change between pages (a game went final meanwhile). */
const maxReads = 3;

/**
 * The least time between two page requests, across every query in flight. A burst of about 13 requests a second
 * gets 429 with "Retry-After: 60" after 50 of them; 3 a second didn't, over hundreds.
 */
const minIntervalMs = 250;

let nextRequestAt = 0;

/** Waits for the next free slot, so the page requests start at most every minIntervalMs. */
async function pace() {
  const now = Date.now();
  const at = Math.max(now, nextRequestAt);
  nextRequestAt = at + minIntervalMs;
  if (at > now) {
    await new Promise(resolve => setTimeout(resolve, at - now));
  }
}

/**
 * Every row of a stats API query, read in pages of 100 in the given order, which must be unique per row (like playerId
 * then gameId), so the pages neither overlap nor skip a row. The pages are paced at most 4 a second (minIntervalMs),
 * whatever the number of queries in flight. Throws when the rows don't add up to the total or repeat
 * a key, after reading the query again in case it changed while it was read.
 *
 * @param {string} url The query's URL, with its parameters but without limit, start or sort.
 * @param {string[]} sortFields The fields to sort by, ascending, which together are unique per row.
 * @param {(url: string) => Promise<{data: object[], total: number}>} fetchPage Fetches one page's body, with the
 *     script's own retries.
 * @returns {Promise<object[]>} The rows, in the sort order.
 */
async function getAllRows(url, sortFields, fetchPage) {
  const sort = JSON.stringify(sortFields.map(property => ({property, direction: 'ASC'})));
  const baseUrl = `${url}${url.includes('?') ? '&' : '?'}sort=${encodeURIComponent(sort)}&limit=${pageSize}`;
  const keyOf = row => sortFields.map(field => row[field]).join('-');
  const pacedPage = async pageUrl => {
    await pace();
    return fetchPage(pageUrl);
  };
  let problem;
  for (let read = 1; read <= maxReads; read++) {
    const first = await pacedPage(`${baseUrl}&start=0`);
    if (first.total >= rowCap) {
      throw Object.assign(new Error(`${first.total} rows, at the stats API's ${rowCap} row cap, so some are missing; ` +
          `split the query (${url})`), {fatal: true});
    }
    const rows = [...first.data];
    let changed = false;
    for (let start = pageSize; start < first.total && !changed; start += pageSize) {
      const page = await pacedPage(`${baseUrl}&start=${start}`);
      changed = page.total !== first.total;
      rows.push(...page.data);
    }
    const keys = new Set(rows.map(keyOf));
    if (changed) {
      problem = 'the total changed between pages';
    } else if (rows.length !== first.total) {
      problem = `${rows.length} of ${first.total} rows`;
    } else if (keys.size !== rows.length) {
      problem = `${rows.length - keys.size} rows repeat a ${sortFields.join(' + ')}`;
    } else {
      return rows;
    }
    if (read < maxReads) {
      console.log(`  ${problem}, reading it again (${url})`);
    }
  }
  throw Object.assign(new Error(`${problem} (${url})`), {fatal: true});
}

module.exports = {getAllRows, pageSize, rowCap};

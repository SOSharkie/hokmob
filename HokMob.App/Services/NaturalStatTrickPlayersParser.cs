using System.Text.RegularExpressions;

namespace HokMob.App.Services
{
    /// <summary>
    /// Every skater's individual stats of a regular season from Natural Stat Trick's player season page, the ones the
    /// NHL's APIs don't have. Sent as columns of equally long arrays, one row per skater, sorted by player ID, since a
    /// full season is about 1,000 skaters.
    /// </summary>
    /// <param name="Season">The season ID, like 20262027.</param>
    public record NstPlayers(int Season, NstPlayerColumns Players);

    /// <summary>
    /// The columns of <see cref="NstPlayers"/>, all situations. A traded skater's season is one row. A cell NST shows as
    /// "-" is null.
    /// </summary>
    /// <param name="PlayerId">The NHL player ID, from the row's link to NST's player report.</param>
    /// <param name="GamesPlayed">His games.</param>
    /// <param name="TimeOnIce">His ice time over the season, in seconds.</param>
    /// <param name="ExpectedGoals">His own expected goals (ixG), the xG of his unblocked shot attempts.</param>
    /// <param name="HighDangerAttempts">His own high danger shot attempts (iHDCF).</param>
    /// <param name="RushAttempts">His shot attempts off the rush.</param>
    /// <param name="ReboundsCreated">His shots that gave a rebound.</param>
    /// <param name="HitsTaken">The hits he took.</param>
    /// <param name="OnIceTimeOnIce">His 5v5 ice time over the season, in seconds, from the on-ice page. Null without
    /// it, as are the other on-ice columns.</param>
    /// <param name="OnIceExpectedGoalsFor">His team's 5v5 expected goals while he was on the ice (on-ice xGF).</param>
    /// <param name="OnIceExpectedGoalsAgainst">The opponents' 5v5 expected goals while he was on the ice (on-ice
    /// xGA).</param>
    public record NstPlayerColumns(List<long> PlayerId, List<int?> GamesPlayed, List<double?> TimeOnIce,
        List<double?> ExpectedGoals, List<int?> HighDangerAttempts, List<int?> RushAttempts,
        List<int?> ReboundsCreated, List<int?> HitsTaken, List<double?> OnIceTimeOnIce,
        List<double?> OnIceExpectedGoalsFor, List<double?> OnIceExpectedGoalsAgainst);

    /// <summary>A skater's 5v5 season from NST's on-ice page: his ice time, and the xG for and against meanwhile.</summary>
    /// <param name="TimeOnIce">Seconds at 5v5.</param>
    public record NstOnIceStats(double? TimeOnIce, double? ExpectedGoalsFor, double? ExpectedGoalsAgainst);

    /// <summary>
    /// Reads Natural Stat Trick's player season pages, HTML meant for people like its other pages: the individual page
    /// (playerteams.php with stdoi=std), one table, id=indreg, with a row per skater and his individual counts, and the
    /// on-ice page (stdoi=oi), one table, id=players, with what happened while he was on the ice. The NHL player ID is
    /// in each row's link to NST's player report (playerreport.php?...&amp;playerid=8470613). See "Player season page"
    /// in docs/nhl-api.md.
    /// </summary>
    public static class NaturalStatTrickPlayersParser
    {
        /// <summary>The player ID in a row's report link.</summary>
        private static readonly Regex PlayerIdRegex = new(@"playerid=(\d+)", RegexOptions.Compiled);

        /// <summary>
        /// The skaters with their on-ice columns filled from the on-ice page, by player ID: null for a skater it doesn't
        /// have, and for every skater without it. A skater only on the on-ice page is left out.
        /// </summary>
        public static NstPlayers WithOnIce(NstPlayers players, IReadOnlyDictionary<long, NstOnIceStats>? onIce)
        {
            var skaters = players.Players.PlayerId
                .Select(playerId => onIce != null && onIce.TryGetValue(playerId, out var stats) ? stats : null)
                .ToList();
            return players with
            {
                Players = players.Players with
                {
                    OnIceTimeOnIce = skaters.Select(stats => stats?.TimeOnIce).ToList(),
                    OnIceExpectedGoalsFor = skaters.Select(stats => stats?.ExpectedGoalsFor).ToList(),
                    OnIceExpectedGoalsAgainst = skaters.Select(stats => stats?.ExpectedGoalsAgainst).ToList()
                }
            };
        }

        /// <summary>
        /// Reads every skater's row of the individual page, with the on-ice columns null (see WithOnIce), or returns
        /// null when the page has no skaters (no games yet, or a page without the table).
        /// </summary>
        /// <param name="season">The season ID, like 20262027.</param>
        /// <param name="html">playerteams.php with stdoi=std and rate=n.</param>
        public static NstPlayers? Parse(int season, string html)
        {
            var table = ReadTable(html, "indreg");
            if (table == null)
            {
                return null;
            }
            var (header, rows) = table.Value;
            int Column(string name) => header.IndexOf(name);
            var gamesIndex = Column("GP");
            var timeOnIceIndex = Column("TOI");
            var expectedGoalsIndex = Column("ixG");
            var highDangerIndex = Column("iHDCF");
            var rushIndex = Column("Rush Attempts");
            var reboundsIndex = Column("Rebounds Created");
            var hitsTakenIndex = Column("Hits Taken");
            if (new[] {gamesIndex, timeOnIceIndex, expectedGoalsIndex, highDangerIndex, rushIndex, reboundsIndex,
                    hitsTakenIndex}.Any(index => index < 0))
            {
                return null;
            }

            var columns = new NstPlayerColumns(new(), new(), new(), new(), new(), new(), new(), new(), new(), new(),
                new());
            foreach (var (playerId, cells) in rows.OrderBy(row => row.PlayerId))
            {
                columns.PlayerId.Add(playerId);
                columns.GamesPlayed.Add(NaturalStatTrickGameParser.ToInt(cells[gamesIndex]));
                columns.TimeOnIce.Add(ToSeconds(cells[timeOnIceIndex]));
                columns.ExpectedGoals.Add(NaturalStatTrickGameParser.ToDouble(cells[expectedGoalsIndex]));
                columns.HighDangerAttempts.Add(NaturalStatTrickGameParser.ToInt(cells[highDangerIndex]));
                columns.RushAttempts.Add(NaturalStatTrickGameParser.ToInt(cells[rushIndex]));
                columns.ReboundsCreated.Add(NaturalStatTrickGameParser.ToInt(cells[reboundsIndex]));
                columns.HitsTaken.Add(NaturalStatTrickGameParser.ToInt(cells[hitsTakenIndex]));
                columns.OnIceTimeOnIce.Add(null);
                columns.OnIceExpectedGoalsFor.Add(null);
                columns.OnIceExpectedGoalsAgainst.Add(null);
            }
            return new NstPlayers(season, columns);
        }

        /// <summary>
        /// Reads every skater's row of the on-ice page (stdoi=oi, at 5v5): his ice time, and the xG for and against
        /// while he was on the ice, by NHL player ID. Null when the page has no skaters or lacks one of the columns.
        /// </summary>
        /// <param name="html">playerteams.php with stdoi=oi, sit=5v5 and rate=n.</param>
        public static Dictionary<long, NstOnIceStats>? ParseOnIce(string html)
        {
            var table = ReadTable(html, "players");
            if (table == null)
            {
                return null;
            }
            var (header, rows) = table.Value;
            var timeOnIceIndex = header.IndexOf("TOI");
            var expectedGoalsForIndex = header.IndexOf("xGF");
            var expectedGoalsAgainstIndex = header.IndexOf("xGA");
            if (timeOnIceIndex < 0 || expectedGoalsForIndex < 0 || expectedGoalsAgainstIndex < 0)
            {
                return null;
            }
            var onIce = new Dictionary<long, NstOnIceStats>();
            foreach (var (playerId, cells) in rows)
            {
                onIce[playerId] = new NstOnIceStats(ToSeconds(cells[timeOnIceIndex]),
                    NaturalStatTrickGameParser.ToDouble(cells[expectedGoalsForIndex]),
                    NaturalStatTrickGameParser.ToDouble(cells[expectedGoalsAgainstIndex]));
            }
            return onIce;
        }

        /// <summary>
        /// A player table's header cells, and its rows that have a player ID and every cell, or null when the page has
        /// no such table or it has no rows.
        /// </summary>
        private static (List<string> Header, List<(long PlayerId, List<string> Cells)> Rows)? ReadTable(string html,
            string tableId)
        {
            var start = html.IndexOf("<table id=" + tableId, StringComparison.Ordinal);
            var bodyStart = start < 0 ? -1 : html.IndexOf("<tbody", start, StringComparison.Ordinal);
            if (bodyStart < 0)
            {
                return null;
            }
            var end = html.IndexOf("</table>", bodyStart, StringComparison.Ordinal);
            var header = ReadCells(html[start..bodyStart]);
            var rows = new List<(long PlayerId, List<string> Cells)>();
            foreach (var rowHtml in (end < 0 ? html[bodyStart..] : html[bodyStart..end]).Split("<tr").Skip(1))
            {
                var cells = ReadCells(rowHtml);
                var playerId = PlayerIdRegex.Match(rowHtml);
                if (cells.Count != header.Count || !playerId.Success)
                {
                    continue;
                }
                rows.Add((long.Parse(playerId.Groups[1].Value), cells));
            }
            return rows.Count == 0 ? null : (header, rows);
        }

        /// <summary>NST's minutes with decimals (like 197.71666666667) as whole seconds, or null.</summary>
        private static double? ToSeconds(string cell)
        {
            var minutes = NaturalStatTrickGameParser.ToDouble(cell);
            return minutes == null ? null : Math.Round(minutes.Value * 60);
        }

        private static List<string> ReadCells(string html)
        {
            return NaturalStatTrickGameParser.CellRegex.Matches(html)
                .Select(cell => NaturalStatTrickGameParser.CleanText(cell.Groups[1].Value))
                .ToList();
        }
    }
}

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
    public record NstPlayerColumns(List<long> PlayerId, List<int?> GamesPlayed, List<double?> TimeOnIce,
        List<double?> ExpectedGoals, List<int?> HighDangerAttempts, List<int?> RushAttempts,
        List<int?> ReboundsCreated, List<int?> HitsTaken);

    /// <summary>
    /// Reads Natural Stat Trick's player season page (playerteams.php with stdoi=std), HTML meant for people like its
    /// other pages: one table, id=indreg, with a row per skater and his individual counts. The NHL player ID is in
    /// each row's link to NST's player report (playerreport.php?...&amp;playerid=8470613). See "Player season page" in
    /// docs/nhl-api.md.
    /// </summary>
    public static class NaturalStatTrickPlayersParser
    {
        /// <summary>The player ID in a row's report link.</summary>
        private static readonly Regex PlayerIdRegex = new(@"playerid=(\d+)", RegexOptions.Compiled);

        /// <summary>
        /// Reads every skater's row, or returns null when the page has no skaters (no games yet, or a page without the
        /// table).
        /// </summary>
        /// <param name="season">The season ID, like 20262027.</param>
        /// <param name="html">playerteams.php with stdoi=std and rate=n.</param>
        public static NstPlayers? Parse(int season, string html)
        {
            var start = html.IndexOf("<table id=indreg", StringComparison.Ordinal);
            var bodyStart = start < 0 ? -1 : html.IndexOf("<tbody", start, StringComparison.Ordinal);
            if (bodyStart < 0)
            {
                return null;
            }
            var end = html.IndexOf("</table>", bodyStart, StringComparison.Ordinal);
            var header = ReadCells(html[start..bodyStart]);
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
            if (rows.Count == 0)
            {
                return null;
            }

            var columns = new NstPlayerColumns(new(), new(), new(), new(), new(), new(), new(), new());
            foreach (var (playerId, cells) in rows.OrderBy(row => row.PlayerId))
            {
                var minutes = NaturalStatTrickGameParser.ToDouble(cells[timeOnIceIndex]);
                columns.PlayerId.Add(playerId);
                columns.GamesPlayed.Add(NaturalStatTrickGameParser.ToInt(cells[gamesIndex]));
                columns.TimeOnIce.Add(minutes == null ? null : Math.Round(minutes.Value * 60));
                columns.ExpectedGoals.Add(NaturalStatTrickGameParser.ToDouble(cells[expectedGoalsIndex]));
                columns.HighDangerAttempts.Add(NaturalStatTrickGameParser.ToInt(cells[highDangerIndex]));
                columns.RushAttempts.Add(NaturalStatTrickGameParser.ToInt(cells[rushIndex]));
                columns.ReboundsCreated.Add(NaturalStatTrickGameParser.ToInt(cells[reboundsIndex]));
                columns.HitsTaken.Add(NaturalStatTrickGameParser.ToInt(cells[hitsTakenIndex]));
            }
            return new NstPlayers(season, columns);
        }

        private static List<string> ReadCells(string html)
        {
            return NaturalStatTrickGameParser.CellRegex.Matches(html)
                .Select(cell => NaturalStatTrickGameParser.CleanText(cell.Groups[1].Value))
                .ToList();
        }
    }
}

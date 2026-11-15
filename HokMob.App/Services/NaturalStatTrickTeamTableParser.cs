namespace HokMob.App.Services
{
    /// <summary>
    /// Every team's 5v5 expected goals over a season from Natural Stat Trick's team table, in NST's order (by points %).
    /// </summary>
    /// <param name="Season">The season ID, like 20262027.</param>
    public record NstTeamTable(int Season, List<NstTeamSeasonStats> Teams);

    /// <param name="Name">NST's full team name, like "St Louis Blues" or "Montreal Canadiens" (no periods or accents).</param>
    /// <param name="ExpectedGoalsFor">The team's 5v5 xG, to two decimals.</param>
    /// <param name="ExpectedGoalsAgainst">Its opponents' 5v5 xG, to two decimals.</param>
    public record NstTeamSeasonStats(string Name, int? GamesPlayed, double? ExpectedGoalsFor, double? ExpectedGoalsAgainst);

    /// <summary>
    /// Reads Natural Stat Trick's team table (teamtable.php), HTML meant for people like its game pages: one table,
    /// id=teams, with a row per team. Its rows aren't closed (no &lt;/tr&gt;), so they're split on &lt;tr. The 72
    /// columns include points, Corsi, Fenwick, goals, xG and scoring chances; only the team, games and xG are read. See
    /// "Natural Stat Trick" in docs/nhl-api.md.
    /// </summary>
    public static class NaturalStatTrickTeamTableParser
    {
        /// <summary>
        /// Reads every team's row, or returns null when the page has no team table.
        /// </summary>
        public static NstTeamTable? Parse(int season, string html)
        {
            var start = html.IndexOf("<table id=teams", StringComparison.Ordinal);
            if (start < 0)
            {
                return null;
            }
            var end = html.IndexOf("</table>", start, StringComparison.Ordinal);
            var table = end < 0 ? html[start..] : html[start..end];
            var bodyStart = table.IndexOf("<tbody", StringComparison.Ordinal);
            if (bodyStart < 0)
            {
                return null;
            }

            var header = ReadCells(table[..bodyStart]);
            var teams = table[bodyStart..]
                .Split("<tr", StringSplitOptions.RemoveEmptyEntries)
                .Select(ReadCells)
                .Where(row => row.Count == header.Count)
                .Select(row => new NstTeamSeasonStats(
                    Cell(header, row, "Team") ?? "",
                    NaturalStatTrickGameParser.ToInt(Cell(header, row, "GP")),
                    NaturalStatTrickGameParser.ToDouble(Cell(header, row, "xGF")),
                    NaturalStatTrickGameParser.ToDouble(Cell(header, row, "xGA"))))
                .Where(team => team.Name.Length > 0)
                .ToList();
            return teams.Count == 0 ? null : new NstTeamTable(season, teams);
        }

        private static List<string> ReadCells(string html)
        {
            return NaturalStatTrickGameParser.CellRegex.Matches(html)
                .Select(cell => NaturalStatTrickGameParser.CleanText(cell.Groups[1].Value))
                .ToList();
        }

        private static string? Cell(List<string> header, List<string> row, string column)
        {
            var index = header.IndexOf(column);
            return index < 0 ? null : row.ElementAtOrDefault(index);
        }
    }
}

using System.Text.RegularExpressions;

namespace HokMob.App.Services
{
    /// <summary>
    /// Every team's games of a regular season from Natural Stat Trick's team game logs, with each game's 5v5 expected
    /// goals. Sent as columns of equally long arrays, one row per team and game, sorted by game, since a full season is
    /// about 2,600 rows.
    /// </summary>
    /// <param name="Season">The season ID, like 20262027.</param>
    /// <param name="Teams">NST's full team names, like "St Louis Blues" (no periods or accents), which the rows point at.</param>
    public record NstTeamGames(int Season, List<string> Teams, NstTeamGameColumns Games);

    /// <param name="GameId">The NHL game ID, like 2026020110.</param>
    /// <param name="Team">The team's index in <see cref="NstTeamGames.Teams"/>.</param>
    /// <param name="ExpectedGoalsFor">The team's 5v5 xG in the game, to two decimals.</param>
    /// <param name="ExpectedGoalsAgainst">Its opponent's 5v5 xG.</param>
    public record NstTeamGameColumns(List<long> GameId, List<int> Team, List<double> ExpectedGoalsFor,
        List<double> ExpectedGoalsAgainst);

    /// <summary>
    /// Reads Natural Stat Trick's team game logs (games.php), HTML meant for people like its other pages: one table,
    /// id=teams, with a row per team and game for one strength state. Its rows aren't closed (no &lt;/tr&gt;), so
    /// they're split on &lt;tr. Each row has the counts of shot attempts, goals, xG and scoring chances; only the game,
    /// team and xG are read. See "Natural Stat Trick" in docs/nhl-api.md.
    /// </summary>
    public static class NaturalStatTrickTeamGamesParser
    {
        /// <summary>The game number in a row's report links: game.php?season=20262027&amp;game=20110.</summary>
        private static readonly Regex GameRegex = new(@"game=(\d+)", RegexOptions.Compiled);

        private record TeamGameRow(long GameId, string Team, double ExpectedGoalsFor, double ExpectedGoalsAgainst);

        /// <summary>
        /// Reads every team's row of every game, or returns null when the page has no games.
        /// </summary>
        /// <param name="season">The season ID, like 20262027.</param>
        /// <param name="html">games.php with sit=5v5.</param>
        public static NstTeamGames? Parse(int season, string html)
        {
            var rows = ReadRows(season, html);
            if (rows.Count == 0)
            {
                return null;
            }

            var teams = rows.Select(row => row.Team).Distinct().OrderBy(team => team, StringComparer.Ordinal).ToList();
            var teamIndexes = teams.Select((team, index) => (team, index)).ToDictionary(item => item.team, item => item.index);
            var columns = new NstTeamGameColumns(new(), new(), new(), new());
            foreach (var row in rows.OrderBy(row => row.GameId).ThenBy(row => teamIndexes[row.Team]))
            {
                columns.GameId.Add(row.GameId);
                columns.Team.Add(teamIndexes[row.Team]);
                columns.ExpectedGoalsFor.Add(row.ExpectedGoalsFor);
                columns.ExpectedGoalsAgainst.Add(row.ExpectedGoalsAgainst);
            }
            return new NstTeamGames(season, teams, columns);
        }

        /// <summary>
        /// Reads the page's rows. A page without the table gives none, and a row that can't be read is left out.
        /// </summary>
        private static List<TeamGameRow> ReadRows(int season, string html)
        {
            var rows = new List<TeamGameRow>();
            var start = html.IndexOf("<table id=teams", StringComparison.Ordinal);
            var bodyStart = start < 0 ? -1 : html.IndexOf("<tbody", start, StringComparison.Ordinal);
            if (bodyStart < 0)
            {
                return rows;
            }
            var end = html.IndexOf("</table>", bodyStart, StringComparison.Ordinal);
            var header = ReadCells(html[start..bodyStart]);
            var teamIndex = header.IndexOf("Team");
            var forIndex = header.IndexOf("xGF");
            var againstIndex = header.IndexOf("xGA");
            if (teamIndex < 0 || forIndex < 0 || againstIndex < 0)
            {
                return rows;
            }

            var seasonStart = (long)(season / 10000) * 1_000_000;
            foreach (var rowHtml in (end < 0 ? html[bodyStart..] : html[bodyStart..end]).Split("<tr").Skip(1))
            {
                var cells = ReadCells(rowHtml);
                var game = GameRegex.Match(rowHtml);
                if (cells.Count != header.Count || !game.Success || cells[teamIndex].Length == 0)
                {
                    continue;
                }
                rows.Add(new TeamGameRow(
                    seasonStart + long.Parse(game.Groups[1].Value),
                    cells[teamIndex],
                    NaturalStatTrickGameParser.ToDouble(cells[forIndex]) ?? 0,
                    NaturalStatTrickGameParser.ToDouble(cells[againstIndex]) ?? 0));
            }
            return rows;
        }

        private static List<string> ReadCells(string html)
        {
            return NaturalStatTrickGameParser.CellRegex.Matches(html)
                .Select(cell => NaturalStatTrickGameParser.CleanText(cell.Groups[1].Value))
                .ToList();
        }
    }
}

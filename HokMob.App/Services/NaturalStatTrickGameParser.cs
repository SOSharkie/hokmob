using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;

namespace HokMob.App.Services
{
    /// <summary>
    /// A game's all situations Corsi and expected goals (xG) from Natural Stat Trick, for both teams and each skater.
    /// </summary>
    /// <param name="IsFinal">Whether NST marks the game final. A game in progress has partial numbers.</param>
    /// <param name="Shots">Every skater's goals, shots on goal and missed shots, with each one's xG.</param>
    public record NstGameStats(long GameId, bool IsFinal, NstTeamGameStats HomeTeam, NstTeamGameStats AwayTeam,
        List<NstShot> Shots);

    /// <param name="Name">NST's team name, like "Red Wings".</param>
    public record NstTeamGameStats(string Name, int? CorsiFor, int? CorsiAgainst, double? ExpectedGoalsFor,
        double? ExpectedGoalsAgainst, List<NstPlayerGameStats> Players);

    /// <summary>
    /// A skater's game. The Corsi and xG for/against are on-ice (everything that happened while he was on the ice);
    /// the individual ones are his own shot attempts and the xG of his own shots.
    /// </summary>
    /// <param name="PlayerId">The NHL player ID, or null when NST's page doesn't link the name to one.</param>
    /// <param name="TimeOnIce">In minutes, like 20.2.</param>
    public record NstPlayerGameStats(long? PlayerId, string Name, string Position, double? TimeOnIce, int? CorsiFor,
        int? CorsiAgainst, double? ExpectedGoalsFor, double? ExpectedGoalsAgainst, double? IndividualExpectedGoals,
        int? IndividualCorsiFor);

    /// <summary>
    /// A skater's unblocked shot attempt, from the tooltip on his all situations individual event map.
    /// </summary>
    /// <param name="PlayerId">The shooter's NHL player ID.</param>
    /// <param name="Period">The period number: 4 for the first overtime.</param>
    /// <param name="Time">The time elapsed in the period, like "7:05", as on the NHL play-by-play.</param>
    /// <param name="Type">"goal", "shot" (on goal) or "miss".</param>
    /// <param name="Distance">How far from the net it was taken, in feet.</param>
    /// <param name="ExpectedGoals">NST's xG for the shot, to two decimals.</param>
    public record NstShot(long PlayerId, int Period, string Time, string Type, int? Distance, double? ExpectedGoals);

    /// <summary>
    /// Reads a game page of Natural Stat Trick (game.php), which is HTML meant for people: data.naturalstattrick.com
    /// mirrors the public site exactly, there's no JSON. The tables are found by their IDs: tbtsall for the teams, and
    /// tb{TEAM}oiall (on-ice) and tb{TEAM}stall (individual) for each team's skaters, home team first. NST's team codes
    /// drop the dots of its abbreviations (TB, LA, NJ, SJ). See "Natural Stat Trick" in docs/nhl-api.md.
    /// </summary>
    public static class NaturalStatTrickGameParser
    {
        private static readonly Regex HeadingRegex = new(@"<h1>([^<]*)</h1>\s*<h2>([\s\S]*?)</h2>", RegexOptions.Compiled);

        private static readonly Regex OnIceTableRegex = new(@"<table id=tb([A-Z]+)oiall ", RegexOptions.Compiled);

        private static readonly Regex RowRegex = new(@"<tr[^>]*>([\s\S]*?)</tr>", RegexOptions.Compiled);

        private static readonly Regex CellRegex = new(@"<t[hd][^>]*>([\s\S]*?)</t[hd]>", RegexOptions.Compiled);

        private static readonly Regex LineBreakRegex = new(@"<br\s*/?>|<hr\s*/?>", RegexOptions.Compiled);

        private static readonly Regex TagRegex = new(@"<[^>]*>", RegexOptions.Compiled);

        /// <summary>
        /// The CSS that labels each skater's shot chart picker with his name, keyed by team and sweater number:
        /// input.sDET55:checked ~ul li #sDETlb:after { content:"Keegan Kolesar"; }
        /// </summary>
        private static readonly Regex PlayerNumberRegex = new(
            @"input\.s([A-Z]+)(\d+):checked ~ul li #s\1lb:after \{ content:""([^""]*)""", RegexOptions.Compiled);

        /// <summary>
        /// A skater's shot chart, whose image is named after his NHL player ID:
        /// &lt;div class=DET55 ...&gt;&lt;a class="lightbox" ...&gt;&lt;div ... url(/shotcharts/players/games/20262027/8478434-20110-...
        /// </summary>
        private static readonly Regex PlayerIdRegex = new(
            @"<div class=([A-Z]+)(\d+) [^>]*><a class=""lightbox""[^>]*><div[^>]*url\(/shotcharts/players/games/\d+/(\d+)-",
            RegexOptions.Compiled);

        /// <summary>
        /// A skater's individual event map, whose image is named after his NHL player ID and the situation it shows:
        /// background-image: url(/shotcharts/players/games/20252026/8475188-30414-eventmap-all.png)
        /// </summary>
        private static readonly Regex EventMapRegex = new(
            @"url\(/shotcharts/players/games/\d+/(\d+)-\d+-eventmap-([a-z0-9]+)\.png\)", RegexOptions.Compiled);

        /// <summary>
        /// An event's tooltip on an event map, its lines separated by &lt;br&gt;:
        /// &lt;div class=popup style="..."&gt;&lt;span class=popupr&gt;&lt;span&gt;Shot&amp;nbsp;-&amp;nbsp;Wrist,&amp;nbsp;26&amp;nbsp;ft&lt;br&gt;0.11&amp;nbsp;xG&lt;br&gt;19:22&amp;nbsp;Per.&amp;nbsp;1&lt;br&gt;5&amp;nbsp;on&amp;nbsp;4&lt;/span&gt;...
        /// </summary>
        private static readonly Regex PopupRegex = new(
            @"<div class=popup [^>]*><span class=popup[lr]><span>([\s\S]*?)</span></span></div>", RegexOptions.Compiled);

        private static readonly Regex ShotTimeRegex = new(@"^(\d+:\d\d) Per\. (\d+)$", RegexOptions.Compiled);

        private static readonly Regex ShotExpectedGoalsRegex = new(@"^([\d.]+) xG$", RegexOptions.Compiled);

        private static readonly Regex ShotDistanceRegex = new(@"(\d+) ft$", RegexOptions.Compiled);

        /// <summary>
        /// The shot types kept, by the tooltip's text before " - ". A blocked shot ("Shot blocked") has no xG.
        /// </summary>
        private static readonly Dictionary<string, string> ShotTypes = new()
        {
            ["Goal"] = "goal",
            ["Shot"] = "shot",
            ["Miss"] = "miss"
        };

        /// <summary>
        /// Reads the game's stats, or returns null when the page has no stats tables (a game NST hasn't started
        /// tracking, or a page for a game that doesn't exist).
        /// </summary>
        public static NstGameStats? Parse(long gameId, string html)
        {
            var teamRows = ReadTable(html, "tbtsall");
            var teamCodes = OnIceTableRegex.Matches(html).Select(match => match.Groups[1].Value).Distinct().ToList();
            if (teamRows.Count < 3 || teamCodes.Count != 2)
            {
                return null;
            }

            var heading = HeadingRegex.Match(html);
            var isFinal = heading.Success && heading.Groups[2].Value.Contains("Final");
            var playerIds = ReadPlayerIds(html);
            var header = teamRows[0];
            NstTeamGameStats ReadTeam(int index) => new(
                teamRows[index].ElementAtOrDefault(0) ?? "",
                ToInt(FinalLine(GetCell(header, teamRows[index], "CF"))),
                ToInt(FinalLine(GetCell(header, teamRows[index], "CA"))),
                ToDouble(FinalLine(GetCell(header, teamRows[index], "xGF"))),
                ToDouble(FinalLine(GetCell(header, teamRows[index], "xGA"))),
                ReadPlayers(html, teamCodes[index - 1], playerIds));

            return new NstGameStats(gameId, isFinal, ReadTeam(1), ReadTeam(2), ReadShots(gameId, html));
        }

        /// <summary>
        /// Reads every skater's goals, shots on goal and missed shots from the tooltips on his all situations
        /// individual event map: "Shot - Rebound, Wrist, 39 ft", "0.04 xG", "1:37 Per. 3", "5 on 5" (a goal adds an
        /// "Assisted by" line). A map's tooltips run until the next map. Goalies have no event map, so their shots
        /// aren't listed, and neither is a tooltip without a time. A regular season or preseason game's shootout
        /// attempts are listed as period 5 at 0:00; they're left out, as NST's team totals leave them out. A playoff
        /// game's period 5 is its second overtime.
        /// </summary>
        private static List<NstShot> ReadShots(long gameId, string html)
        {
            var isPlayoffs = gameId / 10_000 % 100 == 3;
            var maps = EventMapRegex.Matches(html).ToList();
            var shots = new List<NstShot>();
            for (var index = 0; index < maps.Count; index++)
            {
                if (maps[index].Groups[2].Value != "all")
                {
                    continue;
                }
                var start = maps[index].Index;
                var end = index + 1 < maps.Count ? maps[index + 1].Index : html.Length;
                var playerId = long.Parse(maps[index].Groups[1].Value);
                foreach (Match popup in PopupRegex.Matches(html[start..end]))
                {
                    var lines = LineBreakRegex.Split(popup.Groups[1].Value).Select(CleanText).ToList();
                    var kind = lines[0].Split(" - ")[0];
                    var time = lines.Select(line => ShotTimeRegex.Match(line)).FirstOrDefault(match => match.Success);
                    if (!ShotTypes.TryGetValue(kind, out var type) || time == null)
                    {
                        continue;
                    }
                    var period = int.Parse(time.Groups[2].Value);
                    if (!isPlayoffs && period > 4)
                    {
                        continue;
                    }
                    var distance = ShotDistanceRegex.Match(lines[0]);
                    var expectedGoals = lines.Select(line => ShotExpectedGoalsRegex.Match(line))
                        .FirstOrDefault(match => match.Success);
                    shots.Add(new NstShot(playerId, period, time.Groups[1].Value, type,
                        distance.Success ? int.Parse(distance.Groups[1].Value) : null,
                        expectedGoals == null ? null : ToDouble(expectedGoals.Groups[1].Value)));
                }
            }
            return shots;
        }

        /// <summary>
        /// Reads a team's skaters from its on-ice table, with the individual xG and shot attempts of the individual
        /// table, matched by name.
        /// </summary>
        private static List<NstPlayerGameStats> ReadPlayers(string html, string teamCode,
            IReadOnlyDictionary<string, long> playerIds)
        {
            var onIceRows = ReadTable(html, "tb" + teamCode + "oiall");
            var individualRows = ReadTable(html, "tb" + teamCode + "stall");
            if (onIceRows.Count < 2)
            {
                return new List<NstPlayerGameStats>();
            }
            var onIceHeader = onIceRows[0];
            var individualHeader = individualRows.FirstOrDefault() ?? new List<string>();
            var individualByName = individualRows.Skip(1)
                .GroupBy(row => row.ElementAtOrDefault(0) ?? "")
                .ToDictionary(group => group.Key, group => group.First());

            return onIceRows.Skip(1).Select(row =>
            {
                var name = row.ElementAtOrDefault(0) ?? "";
                individualByName.TryGetValue(name, out var individual);
                return new NstPlayerGameStats(
                    playerIds.TryGetValue(teamCode + "|" + name, out var playerId) ? playerId : null,
                    name,
                    GetCell(onIceHeader, row, "Position") ?? "",
                    ToDouble(GetCell(onIceHeader, row, "TOI")),
                    ToInt(GetCell(onIceHeader, row, "CF")),
                    ToInt(GetCell(onIceHeader, row, "CA")),
                    ToDouble(GetCell(onIceHeader, row, "xGF")),
                    ToDouble(GetCell(onIceHeader, row, "xGA")),
                    individual == null ? null : ToDouble(GetCell(individualHeader, individual, "ixG")),
                    individual == null ? null : ToInt(GetCell(individualHeader, individual, "iCF")));
            }).ToList();
        }

        /// <summary>
        /// Maps "{TEAM}|{name}" to the NHL player ID, through the sweater number that both the shot chart picker's
        /// label and the shot chart itself are keyed by.
        /// </summary>
        private static Dictionary<string, long> ReadPlayerIds(string html)
        {
            var idsByNumber = new Dictionary<string, long>();
            foreach (Match match in PlayerIdRegex.Matches(html))
            {
                idsByNumber.TryAdd(match.Groups[1].Value + match.Groups[2].Value, long.Parse(match.Groups[3].Value));
            }
            var idsByName = new Dictionary<string, long>();
            foreach (Match match in PlayerNumberRegex.Matches(html))
            {
                var team = match.Groups[1].Value;
                if (idsByNumber.TryGetValue(team + match.Groups[2].Value, out var playerId))
                {
                    idsByName.TryAdd(team + "|" + CleanText(match.Groups[3].Value), playerId);
                }
            }
            return idsByName;
        }

        /// <summary>
        /// Reads the rows of the table with this ID as cell text, the header row first. Empty when there's no such
        /// table. A cell's lines (a team cell lists each period, then the final total) stay separated by "\n".
        /// </summary>
        private static List<List<string>> ReadTable(string html, string id)
        {
            var start = html.IndexOf("<table id=" + id + " ", StringComparison.Ordinal);
            if (start < 0)
            {
                return new List<List<string>>();
            }
            var end = html.IndexOf("</table>", start, StringComparison.Ordinal);
            var table = end < 0 ? html[start..] : html[start..end];
            return RowRegex.Matches(table)
                .Select(row => CellRegex.Matches(row.Groups[1].Value)
                    .Select(cell => CleanText(LineBreakRegex.Replace(cell.Groups[1].Value, "\n")))
                    .ToList())
                .Where(cells => cells.Count > 0)
                .ToList();
        }

        private static string CleanText(string html)
        {
            var text = WebUtility.HtmlDecode(TagRegex.Replace(html, "")).Replace(' ', ' ');
            return string.Join("\n", text.Split('\n').Select(line => line.Trim())).Trim();
        }

        private static string? GetCell(List<string> header, List<string> row, string column)
        {
            var index = header.IndexOf(column);
            return index < 0 ? null : row.ElementAtOrDefault(index);
        }

        /// <summary>
        /// The last line of a team cell, which is the game total below the periods.
        /// </summary>
        private static string? FinalLine(string? cell)
        {
            return cell?.Split('\n', StringSplitOptions.RemoveEmptyEntries).LastOrDefault();
        }

        private static int? ToInt(string? value)
        {
            return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number) ? number : null;
        }

        /// <summary>
        /// Parses a number, or null for NST's "-" (a percentage without attempts) and missing cells.
        /// </summary>
        private static double? ToDouble(string? value)
        {
            return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number)
                ? Math.Round(number, 2)
                : null;
        }
    }
}

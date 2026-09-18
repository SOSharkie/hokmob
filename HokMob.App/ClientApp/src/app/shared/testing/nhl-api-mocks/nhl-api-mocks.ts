import {ScoreGame, ScoreResponse} from "@shared/models/nhl-web-api/score.model";
import {StandingsResponse, StandingsTeam} from "@shared/models/nhl-web-api/standings.model";
import {
  PlayoffBracket,
  PlayoffCarousel,
  PlayoffCarouselSeries,
  PlayoffSeriesSchedule
} from "@shared/models/nhl-web-api/playoffs.model";
import {GameLanding} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {PlayByPlay} from "@shared/models/nhl-web-api/play-by-play.model";
import {Boxscore} from "@shared/models/nhl-web-api/boxscore.model";
import {RightRail} from "@shared/models/nhl-web-api/right-rail.model";
import {GameBundle} from "@shared/models/nhl-web-api/game-bundle.model";
import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {NhlGameScheduleStateEnum} from "@shared/enums/nhl-game-schedule-state.enum";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import scoreWithOvertimeAndShootout from './score-2026-03-01.json';
import scorePlayoffs from './score-2026-06-09.json';
import scoreFuture from './score-2026-10-08.json';
import scoreRegularSeason from './score-2026-03-15.json';
import scorePreseason from './score-2026-09-19.json';
import standingsNow from './standings-now.json';
import playoffCarousel from './playoff-series-carousel-20252026.json';
import playoffBracket from './playoff-bracket-2026.json';
import seriesScheduleA from './schedule-playoff-series-20252026-a.json';
import seriesScheduleO from './schedule-playoff-series-20252026-o.json';
import gamecenter2025021057Landing from './gamecenter-2025021057-landing.json';
import gamecenter2025021057PlayByPlay from './gamecenter-2025021057-play-by-play.json';
import gamecenter2025021057Boxscore from './gamecenter-2025021057-boxscore.json';
import gamecenter2025021057RightRail from './gamecenter-2025021057-right-rail.json';
import gamecenter2025020952Landing from './gamecenter-2025020952-landing.json';
import gamecenter2025020952PlayByPlay from './gamecenter-2025020952-play-by-play.json';
import gamecenter2025020952Boxscore from './gamecenter-2025020952-boxscore.json';
import gamecenter2025020952RightRail from './gamecenter-2025020952-right-rail.json';
import gamecenter2025030414Landing from './gamecenter-2025030414-landing.json';
import gamecenter2025030414PlayByPlay from './gamecenter-2025030414-play-by-play.json';
import gamecenter2025030414Boxscore from './gamecenter-2025030414-boxscore.json';
import gamecenter2025030414RightRail from './gamecenter-2025030414-right-rail.json';
import gamecenter2026020056Landing from './gamecenter-2026020056-landing.json';
import gamecenter2026020056PlayByPlay from './gamecenter-2026020056-play-by-play.json';
import gamecenter2026020056Boxscore from './gamecenter-2026020056-boxscore.json';
import gamecenter2026020056RightRail from './gamecenter-2026020056-right-rail.json';
import playerLanding8476460 from './player-8476460-landing.json';
import playerLanding8477480 from './player-8477480-landing.json';
import {PlayerLanding} from "@shared/models/nhl-web-api/player-landing.model";
import {ClubScheduleSeason} from "@shared/models/nhl-web-api/club-schedule.model";
import clubScheduleBos20252026 from './club-schedule-season-bos-20252026.json';
import clubScheduleBos20262027 from './club-schedule-season-bos-20262027.json';
import clubScheduleUta20252026 from './club-schedule-season-uta-20252026.json';
import clubScheduleUta20262027 from './club-schedule-season-uta-20262027.json';
import playerLanding8476945 from './player-8476945-landing.json';
import playerLanding8470638 from './player-8470638-landing.json';
import playerLanding8477964 from './player-8477964-landing.json';
import skaterLeaders20252026Regular from './skater-stats-leaders-20252026-2.json';
import skaterLeaders20252026Playoffs from './skater-stats-leaders-20252026-3.json';
import goalieLeaders20252026Regular from './goalie-stats-leaders-20252026-2.json';
import goalieLeaders20252026Playoffs from './goalie-stats-leaders-20252026-3.json';
import playoffBracket2023 from './playoff-bracket-2023.json';
import playoffBracket2021 from './playoff-bracket-2021.json';
import playoffBracket2020 from './playoff-bracket-2020.json';
import playoffBracket2027 from './playoff-bracket-2027.json';
import searchPlayerMac from './search-player-mac.json';
import playerStats8477964 from './player-stats-8477964-skater.json';
import playerStats8477496 from './player-stats-8477496-skater.json';
import playerStats8476945 from './player-stats-8476945-goalie.json';
import playerStats8483548 from './player-stats-8483548-goalie.json';
import hitsAndShotsLeaders20252026 from './leaders-hits-shots-20252026-2.json';
import teamStats20252026 from './team-stats-20252026-2.json';
import teamStats20262027 from './team-stats-20262027-2.json';
import seasonDates from './seasons-2026-09-16.json';
import {GoalieStatsLeaders, SkaterStatsLeaders} from "@shared/models/nhl-web-api/stats-leaders.model";
import {PlayerSearchResult} from "@shared/models/nhl-web-api/player-search.model";
import {PlayerStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {HitsAndShotsLeaders} from "@shared/models/nhl-stats-api/leaders.model";
import {TeamStatsResponse} from "@shared/models/nhl-stats-api/team-stats.model";
import {SeasonDatesResponse} from "@shared/models/nhl-stats-api/season-dates.model";
import draftPicksNow from './draft-picks-now-2026-09-17.json';
import draftPicks2006 from './draft-picks-2006-1.json';
import draftPicks2015 from './draft-picks-2015-1.json';
import draftPicks2021 from './draft-picks-2021-1.json';
import draftStats2006 from './draft-stats-2006-1.json';
import draftStats2015 from './draft-stats-2015-1.json';
import {DraftPicksResponse} from "@shared/models/nhl-web-api/draft-picks.model";
import {DraftStatsResponse} from "@shared/models/nhl-stats-api/draft-stats.model";

/*
 * Real responses for unit tests, captured on 2026-09-15: api-web.nhle.com responses, the player search
 * (search-player-mac, through /api/nhl-search/player) and the backend's stats API responses (player-stats-*,
 * leaders-hits-shots-*, team-stats-*, seasons-*, captured from a running app because the browser only ever sees the merged
 * shape). The draft-picks-* and draft-stats-* responses were captured the same way on 2026-09-17. The JSON files are
 * unchanged responses, except score-2026-03-01 (trimmed to 3 games), score-2026-10-08 and score-2026-09-19 (trimmed to
 * 2 games, the latter captured on 2026-09-18) and the club-schedule-season-* responses (trimmed games, see
 * mockClubScheduleSeason). The
 * gamecenter-* responses are unchanged. To refresh one, download it again with curl and re-check the values the specs
 * assert.
 *
 * Every function returns a fresh deep copy, so tests can change the data. "derived" helpers turn real data into states
 * that couldn't be captured (live games, postponed games, series in progress). Keep those changes minimal.
 */

function copy<T>(response: unknown): T {
  return JSON.parse(JSON.stringify(response));
}

/**
 * score/2026-03-01, trimmed to 3 finals: VGK 0 @ PIT 5 (regulation), WPG 1 @ SJS 2 (overtime), CGY 2 @ ANA 3 (shootout).
 */
export function mockScoreResponse(): ScoreResponse {
  return copy(scoreWithOvertimeAndShootout);
}

/** Game 2025020947: VGK 0 @ PIT 5, final in regulation. */
export function mockRegulationFinal(): ScoreGame {
  return mockScoreResponse().games[0];
}

/** Game 2025020950: WPG 1 @ SJS 2, final in overtime. */
export function mockOvertimeFinal(): ScoreGame {
  return mockScoreResponse().games[1];
}

/** Game 2025020952: CGY 2 @ ANA 3, final in a shootout. */
export function mockShootoutFinal(): ScoreGame {
  return mockScoreResponse().games[2];
}

/**
 * score/2026-03-15, trimmed to 2 finals: STL @ WPG (game 2025021057, like the gamecenter fixtures) and SJS @ OTT. Both
 * have their recap and condensed game video paths.
 */
export function mockRegularSeasonScoreResponse(): ScoreResponse {
  return copy(scoreRegularSeason);
}

/**
 * score/2026-06-09: Stanley Cup Final game 4, CAR 5 @ VGK 3, series tied 2-2.
 */
export function mockPlayoffScoreResponse(): ScoreResponse {
  return copy(scorePlayoffs);
}

/** Game 2025030414: CAR 5 @ VGK 3, with seriesStatus. */
export function mockPlayoffGame(): ScoreGame {
  return mockPlayoffScoreResponse().games[0];
}

/**
 * score/2026-10-08, trimmed to 2 future games: UTA @ BOS and DAL @ BUF. They have no score, clock or period yet.
 */
export function mockFutureScoreResponse(): ScoreResponse {
  return copy(scoreFuture);
}

/** Game 2026020056: UTA (68) @ BOS, not started. */
export function mockFutureGame(): ScoreGame {
  return mockFutureScoreResponse().games[0];
}

/**
 * score/2026-09-19, the first day of the 2026-27 preseason, trimmed to 2 games that haven't started: DAL @ STL and
 * MTL @ TOR.
 */
export function mockPreseasonScoreResponse(): ScoreResponse {
  return copy(scorePreseason);
}

/** Game 2026010001: DAL @ STL, a preseason game that hasn't started. */
export function mockPreseasonGame(): ScoreGame {
  return mockPreseasonScoreResponse().games[0];
}

/**
 * standings/now between seasons: the final 2025-26 regular season standings, all 32 teams.
 */
export function mockStandingsResponse(): StandingsResponse {
  return copy(standingsNow);
}

export function mockStandingsTeams(): StandingsTeam[] {
  return mockStandingsResponse().standings;
}

/**
 * playoff-series/carousel/20252026/: all 15 series are finished and currentRound is 4.
 */
export function mockPlayoffCarousel(): PlayoffCarousel {
  return copy(playoffCarousel);
}

/**
 * A carousel series by letter ("A" to "O"), without seed ranks.
 */
export function mockCarouselSeries(seriesLetter: string): PlayoffCarouselSeries {
  return mockPlayoffCarousel().rounds.flatMap(round => round.series).find(series => series.seriesLetter === seriesLetter);
}

/**
 * A carousel series by letter with seed ranks from the bracket, as NhlStandingAndPlayoffService.getNhlPlayoffs returns it.
 */
export function mockRankedCarouselSeries(seriesLetter: string): PlayoffCarouselSeries {
  const series = mockCarouselSeries(seriesLetter);
  const bracketSeries = mockPlayoffBracket().series.find(item => item.seriesLetter === seriesLetter);
  [series.topSeed, series.bottomSeed].forEach(seed => {
    seed.rank = seed.id === bracketSeries.topSeedTeam.id ? bracketSeries.topSeedRank : bracketSeries.bottomSeedRank;
  });
  return series;
}

/** Years with a captured playoff-bracket response. */
export type MockBracketYear = 2026 | 2023 | 2021 | 2020 | 2027;

const playoffBrackets = {
  2026: playoffBracket, 2023: playoffBracket2023, 2021: playoffBracket2021, 2020: playoffBracket2020,
  2027: playoffBracket2027
};

/**
 * playoff-bracket/{year}, by the year the season ends in:
 * - 2026 (the default): all 15 series with seed ranks, like BUF D1 (rank 1) vs BOS WC1 (rank 4) in series A.
 * - 2023: all 15 series, finished, with the era's "1st Round" titles.
 * - 2021: 15 series without conferences, and "Stanley Cup Semifinals" in round 3.
 * - 2020: 23 series, the extra 8 (S to Z) being the qualifying round, with playoffRound 0.
 * - 2027: no series yet (the 2026-27 playoffs are months away).
 */
export function mockPlayoffBracket(year: MockBracketYear = 2026): PlayoffBracket {
  return copy(playoffBrackets[year]);
}

/**
 * schedule/playoff-series/20252026/{a|o}/. A: BUF beat BOS 4-2 (Eastern round 1). O: CAR beat VGK 4-2 (Stanley Cup Final).
 */
export function mockPlayoffSeriesSchedule(seriesLetter: 'A' | 'O'): PlayoffSeriesSchedule {
  return copy(seriesLetter === 'A' ? seriesScheduleA : seriesScheduleO);
}

/** Games with captured gamecenter/{id}/landing, play-by-play, boxscore and right-rail responses. */
export type MockGamecenterGameId = 2025021057 | 2025020952 | 2025030414 | 2026020056;

const gamecenterResponses = {
  2025021057: {landing: gamecenter2025021057Landing, playByPlay: gamecenter2025021057PlayByPlay, boxscore: gamecenter2025021057Boxscore, rightRail: gamecenter2025021057RightRail},
  2025020952: {landing: gamecenter2025020952Landing, playByPlay: gamecenter2025020952PlayByPlay, boxscore: gamecenter2025020952Boxscore, rightRail: gamecenter2025020952RightRail},
  2025030414: {landing: gamecenter2025030414Landing, playByPlay: gamecenter2025030414PlayByPlay, boxscore: gamecenter2025030414Boxscore, rightRail: gamecenter2025030414RightRail},
  2026020056: {landing: gamecenter2026020056Landing, playByPlay: gamecenter2026020056PlayByPlay, boxscore: gamecenter2026020056Boxscore, rightRail: gamecenter2026020056RightRail}
};

/**
 * gamecenter/{id}/landing for:
 * - 2025021057: STL 2 @ WPG 3, final in regulation. Goals in the 1st and 3rd, none in the 2nd.
 * - 2025020952: CGY 2 @ ANA 3, final in a shootout. The scoring summary has a goalless OT and the SO goal.
 * - 2025030414: CAR 5 @ VGK 3, Stanley Cup Final game 4. No series status (only in score/2026-06-09).
 * - 2026020056: UTA @ BOS on 2026-10-08, not started. No score, period, clock or summary.
 */
export function mockGameLanding(gameId: MockGamecenterGameId): GameLanding {
  return copy(gamecenterResponses[gameId].landing);
}

/** gamecenter/{id}/play-by-play, with every play and the roster spots. */
export function mockGamePlayByPlay(gameId: MockGamecenterGameId): PlayByPlay {
  return copy(gamecenterResponses[gameId].playByPlay);
}

/** gamecenter/{id}/boxscore. The future game has no playerByGameStats. */
export function mockGameBoxscore(gameId: MockGamecenterGameId): Boxscore {
  return copy(gamecenterResponses[gameId].boxscore);
}

/** gamecenter/{id}/right-rail. The future game has no teamGameStats. */
export function mockGameRightRail(gameId: MockGamecenterGameId): RightRail {
  return copy(gamecenterResponses[gameId].rightRail);
}

/** All gamecenter responses for a game, as NhlGameService.getGameBundle returns them. */
export function mockGameBundle(gameId: MockGamecenterGameId): GameBundle {
  return {
    landing: mockGameLanding(gameId),
    playByPlay: mockGamePlayByPlay(gameId),
    boxscore: mockGameBoxscore(gameId),
    rightRail: mockGameRightRail(gameId)
  };
}

/** Players with a captured player/{id}/landing response. */
export type MockPlayerId = 8476460 | 8477480 | 8476945 | 8470638 | 8477964;

const playerLandings = {
  8476460: playerLanding8476460, 8477480: playerLanding8477480, 8476945: playerLanding8476945,
  8470638: playerLanding8470638, 8477964: playerLanding8477964
};

/**
 * player/{id}/landing for:
 * - 8476460: Mark Scheifele, WPG center, born 1993-03-15 in Canada. Drafted 2011, round 1, 7th overall.
 * - 8477480: Eric Comrie, goalie, born 1995-07-06 in Canada. He played for WPG in 2025021057, but his current team is
 *   now SJS (28). Both played in 2025021057 (STL @ WPG).
 * - 8476945: Connor Hellebuyck, WPG goalie, with goalie featuredStats (save percentage and goals against average).
 * - 8470638: Patrice Bergeron, retired. No currentTeamId, isActive is false, and featuredStats is his last season
 *   (2022-23).
 * - 8477964: Ivan Barbashev, VGK left wing, drafted 2014 round 2, 33rd overall by STL. His stats are
 *   mockPlayerStats(8477964), so the two together make up a whole player page.
 */
export function mockPlayerLanding(playerId: MockPlayerId): PlayerLanding {
  return copy(playerLandings[playerId]);
}

/**
 * skater-stats-leaders/20252026/{gameType}?limit=5: 9 categories of 5 leaders each, like McDavid with 138 points in
 * the regular season. Values are numbers, and the time on ice is in seconds.
 */
export function mockSkaterStatsLeaders(gameType: 2 | 3 = 2): SkaterStatsLeaders {
  return copy(gameType === 2 ? skaterLeaders20252026Regular : skaterLeaders20252026Playoffs);
}

/**
 * goalie-stats-leaders/20252026/{gameType}?limit=5: wins, shutouts, save percentage (0 to 1) and goals against
 * average, 5 leaders each.
 */
export function mockGoalieStatsLeaders(gameType: 2 | 3 = 2): GoalieStatsLeaders {
  return copy(gameType === 2 ? goalieLeaders20252026Regular : goalieLeaders20252026Playoffs);
}

/**
 * search.d3.nhle.com/api/v1/search/player?q=mac&limit=10&active=true, through /api/nhl-search/player: 10 active
 * players, starting with Mackenzie Blackwood (COL). Tomas Machu has no lastSeasonId (he hasn't played a game).
 */
export function mockPlayerSearchResults(): PlayerSearchResult[] {
  return copy(searchPlayerMac);
}

/** Players with a captured /api/nhl-stats/player/{id} response. */
export type MockPlayerStatsId = 8477964 | 8477496 | 8476945 | 8483548;

const playerStats = {
  8477964: playerStats8477964, 8477496: playerStats8477496, 8476945: playerStats8476945, 8483548: playerStats8483548
};

/**
 * /api/nhl-stats/player/{id}?position={skater|goalie}, as the backend merges it from the stats API reports:
 * - 8477964 (skater): Ivan Barbashev, VGK. His 10 recent games are the 2026 playoff run, newest (2025030416) first,
 *   with hits and scores. Game 2025030414 is the one with a captured boxscore.
 * - 8477496 (skater): Elias Lindholm, whose 2023-24 season is the one combined "CGY,VAN" row (75 games, 44 points).
 * - 8476945 (goalie): Connor Hellebuyck, with saves by strength in his recent (regular season) games.
 * - 8483548 (goalie): Brandon Bussi, CAR. He won game 2025030414, so his row can be compared with that boxscore.
 */
export function mockPlayerStats(playerId: MockPlayerStatsId): PlayerStats {
  return copy(playerStats[playerId]);
}

/**
 * /api/nhl-stats/leaders?season=20252026&gameType=2: the top 5 skaters by hits (Yakov Trenin, 413) and by shots
 * (Nathan MacKinnon, 350).
 */
export function mockHitsAndShotsLeaders(): HitsAndShotsLeaders {
  return copy(hitsAndShotsLeaders20252026);
}

/** Seasons with a captured /api/nhl-stats/teams response. */
export type MockTeamStatsSeason = 20252026 | 20262027;

/**
 * /api/nhl-stats/teams?season={season}&gameType=2:
 * - 20252026: all 32 teams, Utah as 68. Boston (6) is 9th on the power play and 24th on the penalty kill.
 * - 20262027: no rows, because no game of that season has been played yet.
 */
export function mockTeamStats(season: MockTeamStatsSeason = 20252026): TeamStatsResponse {
  return copy(season === 20252026 ? teamStats20252026 : teamStats20262027);
}

/**
 * /api/nhl-stats/seasons, captured on 2026-09-16: 2026-27 (first game, a preseason game, on 2026-09-19; no playoff game
 * yet) and 2025-26 (first game 2025-09-20, first playoff game 2026-04-18).
 */
export function mockSeasonDates(): SeasonDatesResponse {
  return copy(seasonDates);
}

/** Draft years and rounds with a captured draft/picks response. "now" is draft/picks/now, captured on 2026-09-17. */
export type MockDraftPicksKey = 'now' | 2006 | 2015 | 2021;

/**
 * Round 1 of draft/picks/{year}/1, captured on 2026-09-17. Every response lists the draft years 1979–2026 and rounds
 * 1–7.
 * - now: the 2026 draft (state "over"), 32 picks. #1 Gavin McKenna (LW) by the Toronto Maple Leafs. None of its
 *   players has an NHL game.
 * - 2006: 30 picks. #3 Toews, #10 Frolik and #13 Tlusty are "F". #19 Mitera, #20 Fischer and #24 Persson never played.
 * - 2015: 30 picks. #1 Connor McDavid (C) by the Edmonton Oilers, #22 Ilya Samsonov (G) by the Washington Capitals.
 * - 2021: 32 picks. #11 (Arizona Coyotes) is forfeited: no firstName or positionCode, lastName "Forfeited".
 */
export function mockDraftPicks(key: MockDraftPicksKey = 'now'): DraftPicksResponse {
  const responses = {now: draftPicksNow, 2006: draftPicks2006, 2015: draftPicks2015, 2021: draftPicks2021};
  return copy(responses[key]);
}

/** Draft years with a captured /api/nhl-stats/draft response for round 1. */
export type MockDraftStatsYear = 2006 | 2015;

/**
 * /api/nhl-stats/draft?year={year}&round=1, captured from the running app on 2026-09-17, sorted by overall pick:
 * - 2006: 27 players (23 skaters, 4 goalies: #11 Bernier 8 A, #15 Helenius 0 A, #23 Varlamov 8 A, #26 Irving 1 A).
 *   Toews (#3) is "C" with 383 G, 529 A, 912 P. No rows for #19, #20 and #24.
 * - 2015: 30 players, one per pick. McDavid (#1) 409 G, 811 A, 1220 P; Samsonov (#22) "G" with 0 G, 5 A, 5 P.
 */
export function mockDraftStats(year: MockDraftStatsYear = 2015): DraftStatsResponse {
  return copy(year === 2006 ? draftStats2006 : draftStats2015);
}

/** Teams with captured club-schedule-season responses: the teams of the future game 2026020056 (UTA @ BOS). */
export type MockClubScheduleTeam = 'BOS' | 'UTA';

export type MockClubScheduleSeasonId = 20252026 | 20262027;

const clubScheduleResponses = {
  BOS: {20252026: clubScheduleBos20252026, 20262027: clubScheduleBos20262027},
  UTA: {20252026: clubScheduleUta20252026, 20262027: clubScheduleUta20262027}
};

/**
 * club-schedule-season/{abbrev}/{season} for BOS and UTA:
 * - 20262027 (same games as .../now on 2026-09-15), trimmed to the first 10 games: 4 preseason games, then regular
 *   season games up to 2026020056 and the one after it. None has been played (all FUT), and previousSeason is 20252026.
 * - 20252026, BOS trimmed to its first 8 games (6 preseason games with gameState FINAL, then 2025020005 and 2025020008)
 *   and its last 8 (2025021278 and 2025021292, then the 6-game 1st round loss to BUF, game 5 won in OT). UTA trimmed to
 *   its last 8 (2 regular season games, then the 6-game 1st round loss to VGK, games 4 and 5 lost in OT).
 */
export function mockClubScheduleSeason(teamAbbrev: MockClubScheduleTeam, season: MockClubScheduleSeasonId): ClubScheduleSeason {
  return copy(clubScheduleResponses[teamAbbrev][season]);
}

// TODO: The live derived helpers below (derivedLiveLanding, derivedIntermissionLanding, derivedLivePlayByPlay,
//  derivedLiveGame) edit finished games because no live game could be captured before the 2026-27 preseason. Replace
//  them with responses captured by `npm run capture-live-fixtures` during a live game (see
//  docs/nhl-api.md, "Live game checks").

/**
 * Derived: the regulation final (STL @ WPG) landing as if live in the 2nd period with 5:32 left, WPG leading 2-0 after
 * its two 1st period goals.
 */
export function derivedLiveLanding(): GameLanding {
  const landing = mockGameLanding(2025021057);
  landing.gameState = NhlGameStateEnum.LIVE;
  landing.homeTeam.score = 2;
  landing.awayTeam.score = 0;
  landing.periodDescriptor = {...landing.periodDescriptor, number: 2};
  landing.clock = {timeRemaining: '05:32', secondsRemaining: 332, running: true, inIntermission: false};
  landing.summary.scoring = landing.summary.scoring.slice(0, 2);
  return landing;
}

/**
 * Derived: the live landing in the 1st intermission with 16:40 left. Assumes clock.secondsRemaining counts down the
 * intermission, which isn't verified yet.
 */
export function derivedIntermissionLanding(): GameLanding {
  const landing = derivedLiveLanding();
  landing.periodDescriptor = {...landing.periodDescriptor, number: 1};
  landing.clock = {timeRemaining: '16:40', secondsRemaining: 1000, running: false, inIntermission: true};
  landing.summary.scoring = landing.summary.scoring.slice(0, 1);
  return landing;
}

/**
 * Derived: the regulation final (STL @ WPG) play-by-play at the same moment as derivedLiveLanding (2nd period, 5:32
 * left, WPG leading 2-0): only the plays up to 14:28 of the 2nd, and no game outcome.
 */
export function derivedLivePlayByPlay(): PlayByPlay {
  const playByPlay = mockGamePlayByPlay(2025021057);
  playByPlay.gameState = NhlGameStateEnum.LIVE;
  playByPlay.homeTeam.score = 2;
  playByPlay.awayTeam.score = 0;
  playByPlay.periodDescriptor = {...playByPlay.periodDescriptor, number: 2};
  playByPlay.clock = {timeRemaining: '05:32', secondsRemaining: 332, running: true, inIntermission: false};
  delete playByPlay.gameOutcome;
  playByPlay.plays = playByPlay.plays.filter(play => play.periodDescriptor.number === 1 ||
      (play.periodDescriptor.number === 2 && play.timeInPeriod <= '14:28'));
  return playByPlay;
}

/**
 * Derived: the regulation final (VGK 0 @ PIT 5) as if live in the 2nd period with 5:32 left. The live shape is based
 * on the model and not yet verified against a live game (see docs/nhl-api.md, "Live game checks").
 */
export function derivedLiveGame(): ScoreGame {
  const game = mockRegulationFinal();
  game.gameState = NhlGameStateEnum.LIVE;
  game.periodDescriptor = {...game.periodDescriptor, number: 2, periodType: NhlPeriodTypeEnum.REGULATION};
  game.clock = {timeRemaining: '05:32', secondsRemaining: 332, running: true, inIntermission: false};
  delete game.gameOutcome;
  return game;
}

/**
 * Derived: the future UTA @ BOS game with another schedule state, like TBD or postponed.
 */
export function derivedScheduleStateGame(gameScheduleState: NhlGameScheduleStateEnum): ScoreGame {
  const game = mockFutureGame();
  game.gameScheduleState = gameScheduleState;
  return game;
}

/**
 * Derived: series A (BUF vs BOS) after game 4, with BUF leading 3-1. The carousel series has no winner yet. The schedule
 * keeps games 1-4 and turns game 5 into an unplayed game (no score, period, outcome or series status).
 */
export function derivedSeriesInProgress(): {series: PlayoffCarouselSeries, schedule: PlayoffSeriesSchedule} {
  const series = mockRankedCarouselSeries('A');
  series.topSeed.wins = 3;
  series.bottomSeed.wins = 1;
  delete series.winningTeamId;
  delete series.losingTeamId;

  const schedule = mockPlayoffSeriesSchedule('A');
  schedule.games = schedule.games.slice(0, 5);
  const nextGame = schedule.games[4];
  nextGame.gameState = NhlGameStateEnum.FUTURE;
  delete nextGame.homeTeam.score;
  delete nextGame.awayTeam.score;
  delete nextGame.periodDescriptor;
  delete nextGame.gameOutcome;
  delete nextGame.seriesStatus;
  return {series, schedule};
}

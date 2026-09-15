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

/*
 * Real api-web.nhle.com responses for unit tests, captured on 2026-09-15. The JSON files are unchanged responses, except
 * score-2026-03-01 (trimmed to 3 games) and score-2026-10-08 (trimmed to 2 games). The gamecenter-* responses are
 * unchanged. To refresh one, download it again
 * with curl and re-check the values the specs assert.
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

/**
 * playoff-bracket/2026: all 15 series with seed ranks, like BUF D1 (rank 1) vs BOS WC1 (rank 4) in series A.
 */
export function mockPlayoffBracket(): PlayoffBracket {
  return copy(playoffBracket);
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
 * on the model and not yet verified against a live game (see the migration plan's risks).
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

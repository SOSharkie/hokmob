import {ScoreGame, ScoreResponse} from "@shared/models/nhl-web-api/score.model";
import {StandingsResponse, StandingsTeam} from "@shared/models/nhl-web-api/standings.model";
import {
  PlayoffBracket,
  PlayoffCarousel,
  PlayoffCarouselSeries,
  PlayoffSeriesSchedule
} from "@shared/models/nhl-web-api/playoffs.model";
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

/*
 * Real api-web.nhle.com responses for unit tests, captured on 2026-09-15. The JSON files are unchanged responses, except
 * score-2026-03-01 (trimmed to 3 games) and score-2026-10-08 (trimmed to 2 games). To refresh one, download it again
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

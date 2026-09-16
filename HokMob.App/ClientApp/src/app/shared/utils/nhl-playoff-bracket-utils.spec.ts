import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NhlPlayoffBracketUtils, PlayoffBracketSlots} from '@shared/utils/nhl-playoff-bracket-utils';
import {NhlStandingAndPlayoffService} from '@shared/services/nhl-standing-and-playoff.service';
import {PlayoffCarouselSeries} from '@shared/models/nhl-web-api/playoffs.model';
import {MockBracketYear, mockPlayoffBracket} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

describe('NhlPlayoffBracketUtils', () => {
  const allSlots = 'ABCDEFGHIJKLMNO'.split('');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NhlStandingAndPlayoffService]
    });
  });

  /** A real bracket's series, converted by the service as the playoffs page gets them. */
  async function bracketSeries(year: MockBracketYear): Promise<PlayoffCarouselSeries[]> {
    const bracket = TestBed.inject(NhlStandingAndPlayoffService).getNhlPlayoffBracket(year);
    TestBed.inject(HttpTestingController).expectOne('/api/nhl/playoff-bracket/' + year).flush(mockPlayoffBracket(year));
    return (await bracket).series;
  }

  /** The letter of the series in each slot, like "A B C ..." ("-" for an empty slot). */
  function slotLetters(slots: PlayoffBracketSlots): string {
    return allSlots.map(slot => slots[slot]?.seriesLetter ?? '-').join(' ');
  }

  function removeTeams(series: PlayoffCarouselSeries): void {
    delete series.topSeed;
    delete series.bottomSeed;
    delete series.winningTeamId;
    delete series.losingTeamId;
  }

  it('should place every series in the slot of its letter in the usual bracket', async () => {
    expect(slotLetters(NhlPlayoffBracketUtils.arrangeSeries(await bracketSeries(2026))))
        .toBe('A B C D E F G H I J K L M N O');
    expect(slotLetters(NhlPlayoffBracketUtils.arrangeSeries(await bracketSeries(2023))))
        .toBe('A B C D E F G H I J K L M N O');
  });

  it('should put the Eastern final on the Eastern side', async () => {
    const slots = NhlPlayoffBracketUtils.arrangeSeries(await bracketSeries(2026));
    expect(slots['M'].conferenceName).toBe('Eastern');
    expect([slots['M'].topSeed.abbrev, slots['M'].bottomSeed.abbrev]).toEqual(['CAR', 'MTL']);
    expect(slots['N'].conferenceName).toBe('Western');
  });

  it('should place the 2020 first round under the reseeded second round', async () => {
    const slots = NhlPlayoffBracketUtils.arrangeSeries(await bracketSeries(2020));
    // I (PHI-NYI) was fed by A (PHI-MTL) and C (WSH-NYI), K (VGK-VAN) by E and H
    expect(slotLetters(slots)).toBe('A C B D E H F G I J K L M N O');
    expect([slots['B'].topSeed.abbrev, slots['B'].bottomSeed.abbrev]).toEqual(['WSH', 'NYI']);
  });

  it('should put the 2021 semifinal that leads back to series A on the Eastern side', async () => {
    const slots = NhlPlayoffBracketUtils.arrangeSeries(await bracketSeries(2021));
    // M (VGK-MTL) was fed by K and L, N (TBL-NYI) by I and J
    expect(slotLetters(slots)).toBe('A B C D E F G H I J K L N M O');
    expect(slots['M'].seriesLabel).toBe('Stanley Cup Semifinals');
    expect([slots['M'].topSeed.abbrev, slots['M'].bottomSeed.abbrev]).toEqual(['TBL', 'NYI']);
  });

  it('should use the letters for series whose teams are not known yet', async () => {
    const series = await bracketSeries(2020);
    series.filter(item => item.roundNumber > 1).forEach(removeTeams);
    expect(slotLetters(NhlPlayoffBracketUtils.arrangeSeries(series))).toBe('A B C D E F G H I J K L M N O');
  });

  it('should still find the Eastern side from the semifinals while the final is TBD', async () => {
    const series = await bracketSeries(2021);
    series.filter(item => item.roundNumber === 4).forEach(removeTeams);
    expect(slotLetters(NhlPlayoffBracketUtils.arrangeSeries(series))).toBe('A B C D E F G H I J K L N M O');
  });

  it('should fill the slots of the series the bracket lists so far', async () => {
    const firstRound = (await bracketSeries(2026)).filter(item => item.roundNumber === 1);
    expect(slotLetters(NhlPlayoffBracketUtils.arrangeSeries(firstRound))).toBe('A B C D E F G H - - - - - - -');
  });

  it('should return no slots without series', () => {
    expect(NhlPlayoffBracketUtils.arrangeSeries([])).toEqual({});
    expect(NhlPlayoffBracketUtils.arrangeSeries(null)).toEqual({});
  });
});

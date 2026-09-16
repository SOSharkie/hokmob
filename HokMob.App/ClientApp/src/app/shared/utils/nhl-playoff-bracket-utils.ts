import {PlayoffCarouselSeries} from "@shared/models/nhl-web-api/playoffs.model";

/**
 * The series in each slot of a 16-team playoff tree. Slots are named after the series that usually fills them: A–D
 * the Eastern first round, E–H the Western first round, I/J and K/L their second rounds, M the Eastern final, N the
 * Western final and O the Stanley Cup Final.
 */
export type PlayoffBracketSlots = Partial<Record<string, PlayoffCarouselSeries>>;

export class NhlPlayoffBracketUtils {

  /** The two slots that feed each later round slot, in tree order. */
  private static readonly feederSlots: Record<string, string[]> = {
    I: ["A", "B"], J: ["C", "D"], K: ["E", "F"], L: ["G", "H"], M: ["I", "J"], N: ["K", "L"]
  };

  /**
   * Places a bracket's series (rounds 1 to 4) in the slots of the tree.
   *
   * The letters don't always match the tree: 2020 was reseeded after the first round (I was fed by A and C), and in
   * 2021 M was fed by K and L. So each later round series gets the two earlier series that share a team with it, in
   * letter order, and the conference final that leads back to series A goes on the Eastern side. While a series'
   * teams aren't known yet, its letter decides.
   *
   * @param series - The series of rounds 1 to 4.
   */
  public static arrangeSeries(series: PlayoffCarouselSeries[]): PlayoffBracketSlots {
    const allSeries = series ?? [];
    const byLetter = new Map(allSeries.map(item => [item.seriesLetter, item]));

    const getFeeders = (parent: PlayoffCarouselSeries): PlayoffCarouselSeries[] => {
      const teamIds = NhlPlayoffBracketUtils.getTeamIds(parent);
      const matches = allSeries
          .filter(item => item.roundNumber === parent.roundNumber - 1)
          .filter(item => NhlPlayoffBracketUtils.getTeamIds(item).some(id => teamIds.includes(id)))
          .sort((a, b) => a.seriesLetter.localeCompare(b.seriesLetter));
      if (matches.length === 2) {
        return matches;
      }
      return (NhlPlayoffBracketUtils.feederSlots[parent.seriesLetter] ?? []).map(letter => byLetter.get(letter));
    };

    const leadsToSeriesA = (item: PlayoffCarouselSeries): boolean =>
        !!item && (item.seriesLetter === "A" || (item.roundNumber > 1 && getFeeders(item).some(leadsToSeriesA)));

    const slots: PlayoffBracketSlots = {};
    const place = (slot: string, item: PlayoffCarouselSeries): void => {
      if (item) {
        slots[slot] = item;
      }
      const feeders = item ? getFeeders(item) : [];
      NhlPlayoffBracketUtils.feederSlots[slot]?.forEach((feederSlot, index) =>
          place(feederSlot, feeders[index] ?? byLetter.get(feederSlot)));
    };

    const final = allSeries.find(item => item.roundNumber === 4);
    const finalFeeders = final ? getFeeders(final) : [];
    let eastFinal = finalFeeders[0] ?? byLetter.get("M");
    let westFinal = finalFeeders[1] ?? byLetter.get("N");
    if (leadsToSeriesA(westFinal) && !leadsToSeriesA(eastFinal)) {
      [eastFinal, westFinal] = [westFinal, eastFinal];
    }
    if (final) {
      slots["O"] = final;
    }
    place("M", eastFinal);
    place("N", westFinal);
    return slots;
  }

  private static getTeamIds(series: PlayoffCarouselSeries): number[] {
    return [series?.topSeed?.id, series?.bottomSeed?.id].filter(id => id != null);
  }
}

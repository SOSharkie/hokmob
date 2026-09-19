/**
 * The two star players of each NHL team: the players fans open a game to watch. The list is taken from TSN's top 50
 * players ranking, topped up with each team's biggest draw where the ranking has fewer than two of its players, and
 * checked against the current rosters. Within a team the bigger star comes first.
 *
 * Skaters only: the top players card always shows a team's goalie, so naming one would never change anything.
 *
 * They only break ties: a star player is shown ahead of a teammate with the same HokMob rating
 * (StatsUtils.sortByStarPlayer), never ahead of a better rated one. Update it when a star retires or is traded; a
 * player who is no longer on the team's roster just never comes up.
 */
export class NhlStarPlayerUtils {

  /**
   * The star players' IDs by team ID, biggest star first.
   */
  private static readonly starPlayerIdsByTeamId: Record<number, number[]> = {
    1: [8481559, 8480002],  // NJD: Jack Hughes, Nico Hischier
    2: [8485366, 8478445],  // NYI: Matthew Schaefer, Mathew Barzal
    3: [8479323, 8476459],  // NYR: Adam Fox, Mika Zibanejad
    4: [8484387, 8478439],  // PHI: Matvei Michkov, Travis Konecny
    5: [8471675, 8471215],  // PIT: Sidney Crosby, Evgeni Malkin
    6: [8477956, 8479325],  // BOS: David Pastrnak, Charlie McAvoy
    7: [8480839, 8479420],  // BUF: Rasmus Dahlin, Tage Thompson
    8: [8480018, 8481540],  // MTL: Nick Suzuki, Cole Caufield
    9: [8482105, 8482116],  // OTT: Jake Sanderson, Tim Stützle
    10: [8479318, 8477939], // TOR: Auston Matthews, William Nylander
    12: [8478427, 8476958], // CAR: Sebastian Aho, Jaccob Slavin
    13: [8477493, 8479314], // FLA: Aleksander Barkov, Matthew Tkachuk
    14: [8476453, 8479542], // TBL: Nikita Kucherov, Brandon Hagel
    15: [8471214, 8476880], // WSH: Alex Ovechkin, Tom Wilson
    16: [8484144, 8474141], // CHI: Connor Bedard, Patrick Kane
    17: [8481542, 8477946], // DET: Moritz Seider, Dylan Larkin
    18: [8476887, 8474600], // NSH: Filip Forsberg, Roman Josi
    19: [8480023, 8482077], // STL: Robert Thomas, Dylan Holloway
    20: [8482679, 8474150], // CGY: Matt Coronato, Mikael Backlund
    21: [8477492, 8480069], // COL: Nathan MacKinnon, Cale Makar
    22: [8478402, 8477934], // EDM: Connor McDavid, Leon Draisaitl
    23: [8480012, 8478444], // VAN: Elias Pettersson, Brock Boeser
    24: [8484153, 8483445], // ANA: Leo Carlsson, Cutter Gauthier
    25: [8478420, 8480027], // DAL: Mikko Rantanen, Jason Robertson
    26: [8478550, 8477960], // LAK: Artemi Panarin, Adrian Kempe
    28: [8484801, 8484227], // SJS: Macklin Celebrini, Will Smith
    29: [8478460, 8480893], // CBJ: Zach Werenski, Kirill Marchenko
    30: [8480800, 8478864], // MIN: Quinn Hughes, Kirill Kaprizov
    52: [8476460, 8478398], // WPG: Mark Scheifele, Kyle Connor
    54: [8478403, 8478483], // VGK: Jack Eichel, Mitch Marner
    55: [8482665, 8474586], // SEA: Matty Beniers, Jordan Eberle
    68: [8479343, 8482699]  // UTA: Clayton Keller, Dylan Guenther
  };

  private static starRanksByPlayerId: Map<number, number>;

  /**
   * Gets a team's star player IDs, biggest star first. Returns an empty list for a team without stars, like the
   * former Arizona (53).
   *
   * @param teamId - The team's ID.
   */
  public static getStarPlayerIds(teamId: number): number[] {
    return NhlStarPlayerUtils.starPlayerIdsByTeamId[teamId] ?? [];
  }

  /**
   * Gets how big a star a player is: 1 for a team's biggest, 2 for its second, and undefined for everyone else. A
   * traded star keeps his rank until the list is updated, which is what we want, since he is still a star.
   *
   * @param playerId - The player's ID.
   */
  public static getStarRank(playerId: number): number {
    if (!NhlStarPlayerUtils.starRanksByPlayerId) {
      NhlStarPlayerUtils.starRanksByPlayerId = new Map(Object.values(NhlStarPlayerUtils.starPlayerIdsByTeamId)
          .flatMap(playerIds => playerIds.map((id, index): [number, number] => [id, index + 1])));
    }
    return NhlStarPlayerUtils.starRanksByPlayerId.get(playerId);
  }

  /**
   * Whether the player is one of his team's star players.
   *
   * @param playerId - The player's ID.
   */
  public static isStarPlayer(playerId: number): boolean {
    return !!NhlStarPlayerUtils.getStarRank(playerId);
  }

}

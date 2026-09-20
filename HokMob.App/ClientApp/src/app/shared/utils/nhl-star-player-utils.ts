/**
 * A team's star players: the three forwards and two defensemen shown in the top players card's star lineup.
 */
export interface TeamStarPlayers {
  forwards: number[];
  defense: number[];
}

/**
 * The star players of each NHL team: the three forwards and two defensemen fans open a game to watch. They fill the
 * top players card when it is switched to its star lineup, and a star takes a spot from a teammate with the same
 * HokMob rating in the rating lineup (StatsUtils.sortByStarPlayer).
 *
 * The list starts from TSN's top 50 players ranking and is filled out with each team's leading scorers at that
 * position, favoring the bigger name where they are close. Every ID is checked against the team's current roster.
 * No goalies: the card always shows the goalie who played.
 *
 * Update it when a star retires or is traded; a player who is no longer on the team's roster just never comes up.
 */
export class NhlStarPlayerUtils {

  /**
   * Each team's star forwards and defensemen by team ID, the bigger star first in each line.
   */
  private static readonly starPlayersByTeamId: Record<number, TeamStarPlayers> = {
    1: {forwards: [8481559, 8479407, 8480002], defense: [8482684, 8476462]}, // NJD: Jack Hughes, Jesper Bratt, Nico Hischier | Luke Hughes, Dougie Hamilton
    2: {forwards: [8478445, 8477500, 8481601], defense: [8485366, 8477506]}, // NYI: Mathew Barzal, Bo Horvat, Simon Holmstrom | Matthew Schaefer, Ryan Pulock
    3: {forwards: [8476459, 8476468, 8482109], defense: [8479323, 8478882]}, // NYR: Mika Zibanejad, J.T. Miller, Alexis Lafrenière | Adam Fox, Vladislav Gavrikov
    4: {forwards: [8478439, 8481533, 8484387], defense: [8477948, 8482142]}, // PHI: Travis Konecny, Trevor Zegras, Matvei Michkov | Travis Sanheim, Jamie Drysdale
    5: {forwards: [8471675, 8471215, 8475810], defense: [8474578, 8471724]}, // PIT: Sidney Crosby, Evgeni Malkin, Bryan Rust | Erik Karlsson, Kris Letang
    6: {forwards: [8477956, 8479987, 8478401], defense: [8479325, 8476854]}, // BOS: David Pastrnak, Morgan Geekie, Pavel Zacha | Charlie McAvoy, Hampus Lindholm
    7: {forwards: [8479420, 8480802, 8482659], defense: [8480839, 8482671]}, // BUF: Tage Thompson, Ryan McLeod, Josh Doan | Rasmus Dahlin, Owen Power
    8: {forwards: [8480018, 8481540, 8483515], defense: [8483457, 8480865]}, // MTL: Nick Suzuki, Cole Caufield, Juraj Slafkovský | Lane Hutson, Noah Dobson
    9: {forwards: [8482116, 8480208, 8481528], defense: [8482105, 8478469]}, // OTT: Tim Stützle, Drake Batherson, Dylan Cozens | Jake Sanderson, Thomas Chabot
    10: {forwards: [8479318, 8477939, 8475166], defense: [8478178, 8476853]}, // TOR: Auston Matthews, William Nylander, John Tavares | Darren Raddysh, Morgan Rielly
    12: {forwards: [8478427, 8477940, 8480830], defense: [8476958, 8476906]}, // CAR: Sebastian Aho, Nikolaj Ehlers, Andrei Svechnikov | Jaccob Slavin, Shayne Gostisbehere
    13: {forwards: [8477493, 8479314, 8477933], defense: [8477932, 8478055]}, // FLA: Aleksander Barkov, Matthew Tkachuk, Sam Reinhart | Aaron Ekblad, Gustav Forsling
    14: {forwards: [8476453, 8477404, 8479542], defense: [8475167, 8474590]}, // TBL: Nikita Kucherov, Jake Guentzel, Brandon Hagel | Victor Hedman, John Carlson
    15: {forwards: [8471214, 8477949, 8476880], defense: [8479345, 8480873]}, // WSH: Alex Ovechkin, Alex Tuch, Tom Wilson | Jakob Chychrun, Rasmus Sandin
    16: {forwards: [8484144, 8474141, 8477479], defense: [8481524, 8484783]}, // CHI: Connor Bedard, Patrick Kane, Tyler Bertuzzi | Bowen Byram, Artyom Levshunov
    17: {forwards: [8479337, 8482078, 8477946], defense: [8481542, 8475753]}, // DET: Alex DeBrincat, Lucas Raymond, Dylan Larkin | Moritz Seider, Justin Faulk
    18: {forwards: [8476887, 8475158, 8474564], defense: [8474600, 8476869]}, // NSH: Filip Forsberg, Ryan O'Reilly, Steven Stamkos | Roman Josi, Brady Skjei
    19: {forwards: [8480023, 8482077, 8483516], defense: [8476892, 8481598]}, // STL: Robert Thomas, Dylan Holloway, Jimmy Snuggerud | Colton Parayko, Philip Broberg
    20: {forwards: [8482679, 8474150, 8480028], defense: [8483495, 8484768]}, // CGY: Matt Coronato, Mikael Backlund, Morgan Frost | Simon Nemec, Zayne Parekh
    21: {forwards: [8477492, 8480039, 8475754], defense: [8480069, 8470613]}, // COL: Nathan MacKinnon, Martin Necas, Brock Nelson | Cale Makar, Brent Burns
    22: {forwards: [8478402, 8477934, 8476454], defense: [8480803, 8475218]}, // EDM: Connor McDavid, Leon Draisaitl, Ryan Nugent-Hopkins | Evan Bouchard, Mattias Ekholm
    23: {forwards: [8480012, 8478444, 8478498], defense: [8479425, 8484798]}, // VAN: Elias Pettersson, Brock Boeser, Jake DeBrusk | Filip Hronek, Zeev Buium
    24: {forwards: [8483445, 8484153, 8484762], defense: [8481605, 8483490]}, // ANA: Cutter Gauthier, Leo Carlsson, Beckett Sennecke | Jackson LaCombe, Pavel Mintyukov
    25: {forwards: [8480027, 8482740, 8478420], defense: [8480036, 8481581]}, // DAL: Jason Robertson, Wyatt Johnston, Mikko Rantanen | Miro Heiskanen, Thomas Harley
    26: {forwards: [8478550, 8477960, 8475692], defense: [8474563, 8482730]}, // LAK: Artemi Panarin, Adrian Kempe, Mats Zuccarello | Drew Doughty, Brandt Clarke
    28: {forwards: [8484801, 8484227, 8477505], defense: [8475200, 8476885]}, // SJS: Macklin Celebrini, Will Smith, Alexander Wennberg | Dmitry Orlov, Jacob Trouba
    29: {forwards: [8480893, 8475745, 8477501], defense: [8478460, 8483485]}, // CBJ: Kirill Marchenko, Charlie Coyle, Valeri Nichushkin | Zach Werenski, Denton Mateychuk
    30: {forwards: [8478864, 8481557, 8478493], defense: [8480800, 8482122]}, // MIN: Kirill Kaprizov, Matt Boldy, Joel Eriksson Ek | Quinn Hughes, Brock Faber
    52: {forwards: [8476460, 8478398, 8480014], defense: [8477504, 8476331]}, // WPG: Mark Scheifele, Kyle Connor, Gabriel Vilardi | Josh Morrissey, Dylan DeMelo
    54: {forwards: [8478403, 8478483, 8475913], defense: [8478397, 8477447]}, // VGK: Jack Eichel, Mitch Marner, Mark Stone | Rasmus Andersson, Shea Theodore
    55: {forwards: [8474586, 8482665, 8476905], defense: [8478407, 8477986]}, // SEA: Jordan Eberle, Matty Beniers, Chandler Stephenson | Vince Dunn, Brandon Montour
    68: {forwards: [8479343, 8477951, 8482699], defense: [8479410, 8477346]}, // UTA: Clayton Keller, Nick Schmaltz, Dylan Guenther | Mikhail Sergachev, MacKenzie Weegar
  };

  private static starRanksByPlayerId: Map<number, number>;

  /**
   * Gets a team's three star forwards, the bigger star first. Returns an empty list for a team without stars, like
   * the former Arizona (53).
   *
   * @param teamId - The team's ID.
   */
  public static getStarForwardIds(teamId: number): number[] {
    return NhlStarPlayerUtils.starPlayersByTeamId[teamId]?.forwards ?? [];
  }

  /**
   * Gets a team's two star defensemen, the bigger star first.
   *
   * @param teamId - The team's ID.
   */
  public static getStarDefenseIds(teamId: number): number[] {
    return NhlStarPlayerUtils.starPlayersByTeamId[teamId]?.defense ?? [];
  }

  /**
   * Gets all five of a team's star players, its forwards first.
   *
   * @param teamId - The team's ID.
   */
  public static getStarPlayerIds(teamId: number): number[] {
    return [...NhlStarPlayerUtils.getStarForwardIds(teamId), ...NhlStarPlayerUtils.getStarDefenseIds(teamId)];
  }

  /**
   * Gets how big a star a player is in his line: 1 for the biggest, up to 3 for a forward and 2 for a defenseman,
   * and undefined for everyone else. A traded star keeps his rank until the list is updated, which is what we want,
   * since he is still a star.
   *
   * @param playerId - The player's ID.
   */
  public static getStarRank(playerId: number): number {
    if (!NhlStarPlayerUtils.starRanksByPlayerId) {
      NhlStarPlayerUtils.starRanksByPlayerId = new Map(Object.values(NhlStarPlayerUtils.starPlayersByTeamId)
          .flatMap(team => [team.forwards, team.defense])
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

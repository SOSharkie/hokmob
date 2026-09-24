import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild} from '@angular/core';
import {Location} from "@angular/common";
import {ActivatedRoute} from "@angular/router";
import {BoxscoreGoalie, BoxscoreSkater} from "@shared/models/nhl-web-api/boxscore.model";
import {SkaterRatingContext, StatsUtils} from "@shared/utils/stats-utils";
import {RatingBreakdown, RatingBreakdownUtils, RatingTerm} from "@app/ratings/rating-breakdown";

/** Which rating formula the page is showing. */
export type RatingSubject = "skater" | "goalie";

/** A stat line, by stat name, so one stepper template drives every stat. */
export interface StatLine {
  [stat: string]: number;
}

/** One stepper in the stat line editor. */
export interface StatControl {
  /** The key in the stat line the stepper edits. */
  key: string;
  label: string;
  /** What the stat is worth, like "+1.2 each". */
  weight: string;
  min: number;
  max: number;
  /**
   * A stat this one can never pass, like the assists a power play assist has to be one of. "assists" is the primary
   * and secondary assists together.
   */
  maxStat?: string;
}

/** A stat line to load with one click, like a hat trick. */
export interface StatLinePreset {
  name: string;
  line: StatLine;
}

/** The player whose stat line the page was opened on from a game page (RatingStatLineUtils.getQueryParams). */
export interface GameStatLineSource {
  /** The formula whose stat line came from the game. */
  subject: RatingSubject;
  name: string;
  /** The rating the game page gave him. */
  rating: number;
}

/** A band of the rating color scale (StatsUtils.getHokmobRatingColor), drawn under the rating. */
export interface RatingBand {
  from: number;
  to: number;
  color: string;
}

/**
 * The Ratings page (`/ratings`): the HokMob rating explorer, which builds a stat line and shows how
 * `StatsUtils.calculateSkaterHokmobRating` and `calculateGoalieHokMobRating` turn it into a rating, term by term
 * ({@link RatingBreakdownUtils}). A game page's player dialog can open it on a player's stat line from that game,
 * through the query parameters of {@link RatingStatLineUtils.getQueryParams}.
 */
@Component({
  selector: 'app-ratings',
  templateUrl: './ratings.component.html',
  styleUrls: ['./ratings.component.scss']
})
export class RatingsComponent implements OnInit, AfterViewInit {

  /** The lowest and highest rating the chart's axis always covers, whatever the stat line does. */
  public static readonly axisFloor = 0;

  public static readonly axisCeiling = 10;

  /** The room, in pixels, a term's value needs after its bar, margin included, before it goes before the bar. */
  public static readonly valueAfterBarRoom = 44;

  public subject: RatingSubject = "skater";

  /**
   * The position the stat line is rated at. The formula only reads a skater's position to decide whether a skater
   * without a faceoff count gets the faceoff term, and the page always gives it one, so the position never changes a
   * rating here and isn't worth a picker.
   */
  public static readonly skaterPosition = "C";

  /** The stat lines on screen. Both are loaded from their first preset in ngOnInit. */
  public skaterLine: StatLine;

  public goalieLine: StatLine;

  public readonly skaterControls: StatControl[] = [
    {key: "goals", label: "Goals", weight: "+1.2 each", min: 0, max: 6},
    {key: "powerPlayGoals", label: "Power play goals", weight: "Added back to plus/minus", min: 0, max: 4},
    {key: "primaryAssists", label: "Primary assists", weight: "+0.6 each", min: 0, max: 6},
    {key: "secondaryAssists", label: "Secondary assists", weight: "+0.4 each", min: 0, max: 6},
    {key: "powerPlayAssists", label: "Power play assists", weight: "Added back to plus/minus", min: 0, max: 6,
      maxStat: "assists"},
    {key: "sog", label: "Shots on goal", weight: "+0.3 each, goals aside", min: 0, max: 15},
    {key: "hits", label: "Hits", weight: "+0.2 each", min: 0, max: 15},
    {key: "blockedShots", label: "Blocked shots", weight: "+0.2 each", min: 0, max: 12},
    {key: "takeaways", label: "Takeaways", weight: "+0.2 each", min: 0, max: 10},
    {key: "giveaways", label: "Giveaways", weight: "-0.2 each", min: 0, max: 10},
    {key: "pim", label: "Penalty minutes", weight: "-0.25 each, at most 3", min: 0, max: 20},
    {key: "plusMinus", label: "Plus/minus", weight: "+0.3 a plus, -0.5 a minus", min: -5, max: 5},
    {key: "faceoffsTaken", label: "Faceoffs taken", weight: "Full weight at 10", min: 0, max: 40},
    {key: "faceoffWins", label: "Faceoffs won", weight: "+/- 0.5 at 100% / 0%", min: 0, max: 40,
      maxStat: "faceoffsTaken"}
  ];

  public readonly goalieControls: StatControl[] = [
    {key: "evenStrengthShots", label: "Even strength shots", weight: "+1/6 a save", min: 0, max: 45},
    {key: "evenStrengthGoals", label: "Even strength goals against", weight: "-1 each", min: 0, max: 10},
    {key: "penaltyKillShots", label: "Penalty kill shots", weight: "+1/5 a save", min: 0, max: 20},
    {key: "penaltyKillGoals", label: "Penalty kill goals against", weight: "-1 each", min: 0, max: 8},
    {key: "powerPlayShots", label: "Power play shots", weight: "+1/6 a save", min: 0, max: 10},
    {key: "powerPlayGoals", label: "Power play goals against", weight: "-1 each", min: 0, max: 4}
  ];

  public readonly skaterPresets: StatLinePreset[] = [
    {
      name: "First star",
      line: {goals: 1, primaryAssists: 1, secondaryAssists: 0, powerPlayAssists: 0, sog: 4, hits: 3, blockedShots: 2,
        takeaways: 1, giveaways: 1, pim: 0, plusMinus: 1, powerPlayGoals: 0, faceoffsTaken: 14, faceoffWins: 8}
    },
    {
      name: "Quiet night",
      line: {goals: 0, primaryAssists: 0, secondaryAssists: 0, powerPlayAssists: 0, sog: 1, hits: 1, blockedShots: 0,
        takeaways: 0, giveaways: 1, pim: 0, plusMinus: 0, powerPlayGoals: 0, faceoffsTaken: 0, faceoffWins: 0}
    },
    {
      name: "Three points",
      line: {goals: 1, primaryAssists: 1, secondaryAssists: 1, powerPlayAssists: 1, sog: 5, hits: 2, blockedShots: 1,
        takeaways: 2, giveaways: 1, pim: 0, plusMinus: 3, powerPlayGoals: 1, faceoffsTaken: 22, faceoffWins: 13}
    },
    {
      name: "Hat trick",
      line: {goals: 3, primaryAssists: 0, secondaryAssists: 1, powerPlayAssists: 1, sog: 7, hits: 1, blockedShots: 0,
        takeaways: 1, giveaways: 2, pim: 0, plusMinus: 4, powerPlayGoals: 1, faceoffsTaken: 1, faceoffWins: 0}
    },
    {
      name: "Shutdown D",
      line: {goals: 0, primaryAssists: 1, secondaryAssists: 0, powerPlayAssists: 0, sog: 2, hits: 4, blockedShots: 5,
        takeaways: 1, giveaways: 2, pim: 0, plusMinus: 1, powerPlayGoals: 0, faceoffsTaken: 0, faceoffWins: 0}
    },
    {
      name: "Heavyweight",
      line: {goals: 0, primaryAssists: 0, secondaryAssists: 0, powerPlayAssists: 0, sog: 1, hits: 8, blockedShots: 1,
        takeaways: 0, giveaways: 1, pim: 5, plusMinus: 0, powerPlayGoals: 0, faceoffsTaken: 0, faceoffWins: 0}
    },
    {
      name: "Rough night",
      line: {goals: 0, primaryAssists: 0, secondaryAssists: 0, powerPlayAssists: 0, sog: 0, hits: 1, blockedShots: 1,
        takeaways: 0, giveaways: 5, pim: 4, plusMinus: -4, powerPlayGoals: 0, faceoffsTaken: 0, faceoffWins: 0}
    }
  ];

  public readonly goaliePresets: StatLinePreset[] = [
    {
      name: "Routine win",
      line: {evenStrengthShots: 22, evenStrengthGoals: 2, penaltyKillShots: 5, penaltyKillGoals: 0,
        powerPlayShots: 0, powerPlayGoals: 0}
    },
    {
      name: "Shutout",
      line: {evenStrengthShots: 26, evenStrengthGoals: 0, penaltyKillShots: 6, penaltyKillGoals: 0,
        powerPlayShots: 1, powerPlayGoals: 0}
    },
    {
      name: "Stolen game",
      line: {evenStrengthShots: 38, evenStrengthGoals: 1, penaltyKillShots: 9, penaltyKillGoals: 0,
        powerPlayShots: 2, powerPlayGoals: 0}
    },
    {
      name: "Pulled early",
      line: {evenStrengthShots: 11, evenStrengthGoals: 4, penaltyKillShots: 3, penaltyKillGoals: 1,
        powerPlayShots: 0, powerPlayGoals: 0}
    },
    {
      name: "Never faced a shot",
      line: {evenStrengthShots: 0, evenStrengthGoals: 0, penaltyKillShots: 0, penaltyKillGoals: 0,
        powerPlayShots: 0, powerPlayGoals: 0}
    }
  ];

  /** The color scale the rating badge uses, from `StatsUtils.getHokmobRatingColor`. */
  public readonly ratingBands: RatingBand[] = [
    {from: 0, to: 6, color: StatsUtils.getHokmobRatingColor(0)},
    {from: 6, to: 7, color: StatsUtils.getHokmobRatingColor(6)},
    {from: 7, to: 8.5, color: StatsUtils.getHokmobRatingColor(7)},
    {from: 8.5, to: 10, color: StatsUtils.getHokmobRatingColor(10)}
  ];

  /** The quirks of the formulas that are easy to trip over while working on them. */
  public readonly quirks: string[] = [
    "A skater's rating has no floor. It stops at 10, but a bad enough night goes below 0, and the game page shows it.",
    "A goalie who faced no shots is rated 0, not 5, so a backup who never played doesn't outrank his starter.",
    "A plus is worth 0.3 and a minus 0.5, and the plus is paid on top of goals and assists that have already scored.",
    "The five minutes of a fighting major are forgiven, which 5, 7, 9 and 11 penalty minutes are each read as holding.",
    "Plus/minus doesn't count a power play goal at all, so a skater's power play goals and assists are added back " +
        "before the term is weighted.",
    "The stat line above assumes all of a game's details are loaded. A game page only has the draw count once the " +
        "play-by-play is in, and only has the assist split and the power play assists once the scoring summary is.",
    "Without a draw count, only a center gets the faceoff term, and he gets all of it rather than a share scaled by " +
        "the draws he took.",
    "Without the assist split — or with one that doesn't add up to the boxscore's assist count — every assist " +
        "counts a flat 0.5, so one game is never rated two ways while a second request is still out.",
    "Without the power play assists, the correction to plus/minus is skipped rather than guessed."
  ];

  public breakdown: RatingBreakdown;

  /**
   * The player the stat line came from, when a game page opened the page on one. It is forgotten once that stat line
   * is cleared or swapped for a preset; editing it stat by stat keeps it.
   */
  public gameStatLine: GameStatLineSource;

  /** The rating axis the waterfall is drawn on, widened past 0 to 10 when a stat line runs off either end. */
  public axisMin: number = RatingsComponent.axisFloor;

  public axisMax: number = RatingsComponent.axisCeiling;

  public axisTicks: number[] = [];

  /** The rating in the color it is shown in on a game page. */
  public get ratingColor(): string {
    return StatsUtils.getHokmobRatingColor(this.breakdown?.rating ?? 0);
  }

  /** The stat line being edited. */
  public get statLine(): StatLine {
    return this.subject === "skater" ? this.skaterLine : this.goalieLine;
  }

  /** The steppers for the stat line being edited. */
  public get statControls(): StatControl[] {
    return this.subject === "skater" ? this.skaterControls : this.goalieControls;
  }

  /** Whether to say which player's game the stat line on screen came from. */
  public get showGameStatLine(): boolean {
    return this.gameStatLine?.subject === this.subject;
  }

  public get presets(): StatLinePreset[] {
    return this.subject === "skater" ? this.skaterPresets : this.goaliePresets;
  }

  /** The skater's assists, the primary and secondary ones together. */
  public get assists(): number {
    return this.skaterLine["primaryAssists"] + this.skaterLine["secondaryAssists"];
  }

  /**
   * What the formula is told beyond the boxscore. The page always fills it in; what a rating does without one of
   * these is in the notes below the chart, rather than in another control.
   */
  public get ratingContext(): SkaterRatingContext {
    return {
      faceoffsTaken: this.skaterLine["faceoffsTaken"],
      primaryAssists: this.skaterLine["primaryAssists"],
      secondaryAssists: this.skaterLine["secondaryAssists"],
      powerPlayAssists: this.skaterLine["powerPlayAssists"]
    };
  }

  /** Whether every stat is already 0, so the Clear button has nothing left to do. */
  public get isStatLineClear(): boolean {
    return Object.values(this.statLine).every(value => value === 0);
  }

  /** The waterfall's plot, whose width tells whether a term's value fits after its bar. */
  @ViewChild("waterfallPlot") public waterfallPlot: ElementRef<HTMLElement>;

  /** The plot's width in pixels, 0 until it has been laid out. */
  public plotWidth = 0;

  constructor(private route: ActivatedRoute, private location: Location, private changeDetector: ChangeDetectorRef) {}

  public ngOnInit(): void {
    this.skaterLine = {...this.skaterPresets[0].line};
    this.goalieLine = {...this.goaliePresets[0].line};
    this.loadGameStatLine();
    this.updateBreakdown();
  }

  public ngAfterViewInit(): void {
    this.measurePlot();
  }

  /**
   * Measures the plot again when the window is resized, since how much room a value has after its bar depends on it.
   */
  @HostListener("window:resize")
  public measurePlot(): void {
    const width = this.waterfallPlot?.nativeElement?.clientWidth ?? 0;
    if (width !== this.plotWidth) {
      this.plotWidth = width;
      this.changeDetector.detectChanges();
    }
  }

  /**
   * Switches between the skater and the goalie formula.
   *
   * @param subject - The formula to show.
   */
  public selectSubject(subject: RatingSubject): void {
    this.subject = subject;
    this.updateBreakdown();
  }

  /**
   * Moves a stat up or down by one, inside the stepper's range. Faceoffs won never pass faceoffs taken, and a goal
   * against is never one of a shot that wasn't faced.
   *
   * @param control - The stepper that was clicked.
   * @param change - 1 for the plus button, -1 for the minus.
   */
  public step(control: StatControl, change: number): void {
    const line = this.statLine;
    line[control.key] = this.clamp(control, (line[control.key] ?? 0) + change);
    this.keepStatLineConsistent(control.key);
    this.updateBreakdown();
  }

  /**
   * Whether a stepper button is at the end of its range, or would break the stat line.
   *
   * @param control - The stepper.
   * @param change - 1 for the plus button, -1 for the minus.
   */
  public isStepDisabled(control: StatControl, change: number): boolean {
    const value = this.statLine[control.key] ?? 0;
    return this.clamp(control, value + change) === value;
  }

  /**
   * Loads a preset stat line, like a hat trick.
   *
   * @param preset - The preset that was clicked.
   */
  public selectPreset(preset: StatLinePreset): void {
    if (this.subject === "skater") {
      this.skaterLine = {...preset.line};
    } else {
      this.goalieLine = {...preset.line};
    }
    this.forgetGameStatLine();
    this.updateBreakdown();
  }

  /**
   * Clears the stat line: every stat back to 0. It leaves a skater on the base 5, and a goalie who faced no shots on
   * the 0 the formula gives him.
   */
  public clearStatLine(): void {
    const line = this.statLine;
    Object.keys(line).forEach(stat => line[stat] = 0);
    this.forgetGameStatLine();
    this.updateBreakdown();
  }

  /**
   * Whether a preset is the stat line on screen, so the button can be shown as picked.
   *
   * @param preset - The preset.
   */
  public isPresetSelected(preset: StatLinePreset): boolean {
    const line = this.statLine;
    return Object.keys(preset.line).every(stat => preset.line[stat] === line[stat]);
  }

  /**
   * Where a rating sits on the chart's axis, as a percentage from its left edge.
   *
   * @param rating - The rating.
   */
  public getAxisPercent(rating: number): number {
    const span = this.axisMax - this.axisMin;
    return span > 0 ? ((rating - this.axisMin) / span) * 100 : 0;
  }

  /**
   * Where a term's bar starts, as a percentage from the chart's left edge. A bar runs from the running total before
   * the term to the one after it, so the terms stack up into the rating.
   *
   * @param term - The term.
   * @param index - The term's place in the breakdown.
   */
  public getBarStart(term: RatingTerm, index: number): number {
    return this.getAxisPercent(Math.min(this.getPreviousTotal(index), term.total));
  }

  /**
   * How wide a term's bar is, as a percentage of the chart. A term worth nothing still gets a hairline, so the
   * running total stays readable.
   *
   * @param term - The term.
   * @param index - The term's place in the breakdown.
   */
  public getBarWidth(term: RatingTerm, index: number): number {
    const span = this.axisMax - this.axisMin;
    const width = Math.abs(term.total - this.getPreviousTotal(index));
    return span > 0 ? Math.max(0.4, (width / span) * 100) : 0;
  }

  /**
   * Where a term's bar ends, as a percentage from the chart's left edge. The term's value is shown just past it.
   *
   * @param term - The term.
   * @param index - The term's place in the breakdown.
   */
  public getBarEnd(term: RatingTerm, index: number): number {
    return this.getBarStart(term, index) + this.getBarWidth(term, index);
  }

  /**
   * Whether a term's value goes before its bar instead of after it, because the bar ends too close to the plot's
   * right edge to fit the value there (valueAfterBarRoom). Before the plot is laid out, only a bar that runs to the
   * edge does.
   *
   * @param term - The term.
   * @param index - The term's place in the breakdown.
   */
  public isValueBeforeBar(term: RatingTerm, index: number): boolean {
    const room = (100 - this.getBarEnd(term, index)) / 100 * this.plotWidth;
    return this.plotWidth > 0 ? room < RatingsComponent.valueAfterBarRoom : this.getBarEnd(term, index) >= 100;
  }

  /**
   * A term's value with its sign, like "+2.2" or "-0.8", and "0" for a term worth nothing.
   *
   * @param value - The term's value.
   */
  public getSignedValue(value: number): string {
    if (!value) {
      return "0";
    }
    return (value > 0 ? "+" : "") + value.toFixed(2).replace(/\.?0+$/, "");
  }

  /**
   * Loads the stat line a game page opened the page on, from the query parameters: the formula, the player, his
   * rating there and every stat. A stat that is missing or not a number is 0. Without a known formula it does nothing.
   */
  private loadGameStatLine(): void {
    const params = this.route.snapshot?.queryParamMap;
    const subject = params?.get("subject");
    if (subject !== "skater" && subject !== "goalie") {
      return;
    }
    const keys = Object.keys(subject === "skater" ? this.skaterPresets[0].line : this.goaliePresets[0].line);
    const line: StatLine = {};
    keys.forEach(stat => {
      const value = parseInt(params.get(stat), 10);
      line[stat] = Number.isFinite(value) ? value : 0;
    });
    this.subject = subject;
    if (subject === "skater") {
      this.skaterLine = line;
    } else {
      this.goalieLine = line;
    }
    const rating = parseFloat(params.get("rating"));
    this.gameStatLine = {subject, name: params.get("name") || "A player",
      rating: Number.isFinite(rating) ? rating : undefined};
  }

  /**
   * Forgets the game's stat line once the one on screen replaces it, and takes it out of the address, so reloading
   * the page doesn't bring it back. The other formula's stat line doesn't replace it.
   */
  private forgetGameStatLine(): void {
    if (!this.showGameStatLine) {
      return;
    }
    this.gameStatLine = undefined;
    this.location.replaceState(this.location.path().split("?")[0]);
  }

  /**
   * Recalculates the rating breakdown from the stat line on screen, and the axis the waterfall is drawn on.
   */
  private updateBreakdown(): void {
    this.breakdown = this.subject === "skater"
        ? RatingBreakdownUtils.getSkaterBreakdown(this.toBoxscoreSkater(), this.ratingContext)
        : RatingBreakdownUtils.getGoalieBreakdown(this.toBoxscoreGoalie());
    this.updateAxis();
  }

  /**
   * Widens the chart's axis past 0 to 10 when a running total runs off either end, and lays out its ticks, every
   * rating on a short axis and every second one on a long one.
   */
  private updateAxis(): void {
    const totals = this.breakdown.terms.map(term => term.total);
    this.axisMin = Math.floor(Math.min(RatingsComponent.axisFloor, ...totals));
    this.axisMax = Math.ceil(Math.max(RatingsComponent.axisCeiling, ...totals));
    const step = this.axisMax - this.axisMin > 14 ? 2 : 1;
    this.axisTicks = [];
    for (let tick = this.axisMin; tick <= this.axisMax; tick += step) {
      this.axisTicks.push(tick);
    }
  }

  /**
   * The running total before a term, which the term's bar starts from. The base starts from 0.
   */
  private getPreviousTotal(index: number): number {
    return index > 0 ? (this.breakdown.terms[index - 1]?.total ?? 0) : 0;
  }

  /**
   * Holds a stat inside its stepper's range, and under the stat that caps it (a power play assist is one of the
   * assists, a won draw one of the draws taken).
   */
  private clamp(control: StatControl, value: number): number {
    const cap = control.maxStat === "assists" ? this.assists : this.statLine[control.maxStat];
    const max = control.maxStat != null ? Math.min(control.max, cap ?? 0) : control.max;
    return Math.max(control.min, Math.min(max, value));
  }

  /**
   * Keeps the stats that depend on each other in step: a won draw and a power play assist are each one of the draws or
   * assists the skater had, goals against never pass the shots faced at that strength, and power play goals never
   * pass the goals scored.
   */
  private keepStatLineConsistent(changedStat: string): void {
    const line = this.statLine;
    if (this.subject === "skater") {
      line["faceoffWins"] = Math.min(line["faceoffWins"], line["faceoffsTaken"]);
      line["powerPlayAssists"] = Math.min(line["powerPlayAssists"], this.assists);
      if (changedStat === "goals") {
        line["sog"] = Math.max(line["sog"], line["goals"]);
      } else {
        line["goals"] = Math.min(line["goals"], line["sog"]);
      }
      line["powerPlayGoals"] = Math.min(line["powerPlayGoals"], line["goals"]);
      return;
    }
    for (const strength of ["evenStrength", "penaltyKill", "powerPlay"]) {
      line[strength + "Goals"] = Math.min(line[strength + "Goals"], line[strength + "Shots"]);
    }
  }

  /**
   * The stat line on screen as a boxscore skater, which the rating formula reads.
   */
  private toBoxscoreSkater(): BoxscoreSkater {
    const line = this.skaterLine;
    return {
      playerId: 0,
      sweaterNumber: undefined,
      name: {default: "Stat line"},
      position: RatingsComponent.skaterPosition,
      goals: line["goals"],
      assists: this.assists,
      points: line["goals"] + this.assists,
      plusMinus: line["plusMinus"],
      pim: line["pim"],
      hits: line["hits"],
      powerPlayGoals: line["powerPlayGoals"],
      sog: line["sog"],
      faceoffWinningPctg: line["faceoffsTaken"] ? line["faceoffWins"] / line["faceoffsTaken"] : 0,
      toi: "18:00",
      blockedShots: line["blockedShots"],
      shifts: undefined,
      giveaways: line["giveaways"],
      takeaways: line["takeaways"]
    };
  }

  /**
   * The stat line on screen as a boxscore goalie, which the rating formula reads. The boxscore's strength splits are
   * "saves/shots" strings, and its power play split is the shots faced on the penalty kill.
   */
  private toBoxscoreGoalie(): BoxscoreGoalie {
    const line = this.goalieLine;
    const shots = line["evenStrengthShots"] + line["penaltyKillShots"] + line["powerPlayShots"];
    const goals = line["evenStrengthGoals"] + line["penaltyKillGoals"] + line["powerPlayGoals"];
    const saves = shots - goals;
    const split = (strength: string) =>
        (line[strength + "Shots"] - line[strength + "Goals"]) + "/" + line[strength + "Shots"];
    return {
      playerId: 0,
      sweaterNumber: undefined,
      name: {default: "Stat line"},
      position: "G",
      evenStrengthShotsAgainst: split("evenStrength"),
      powerPlayShotsAgainst: split("penaltyKill"),
      shorthandedShotsAgainst: split("powerPlay"),
      saveShotsAgainst: saves + "/" + shots,
      savePctg: shots ? saves / shots : undefined,
      evenStrengthGoalsAgainst: line["evenStrengthGoals"],
      powerPlayGoalsAgainst: line["penaltyKillGoals"],
      shorthandedGoalsAgainst: line["powerPlayGoals"],
      pim: 0,
      goalsAgainst: goals,
      toi: "60:00",
      starter: true,
      decision: undefined,
      shotsAgainst: shots,
      saves: saves
    };
  }
}

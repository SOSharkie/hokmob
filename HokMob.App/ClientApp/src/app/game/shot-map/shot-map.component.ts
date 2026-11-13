import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {PlayByPlay, RosterSpot} from "@shared/models/nhl-web-api/play-by-play.model";
import {GameLandingScoringPeriod} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {GameShot} from "@shared/models/game-shot.model";
import {PlayerClick} from "@shared/models/player-highlight.model";
import {ShotMapUtils} from "@shared/utils/shot-map-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {NhlVideoUtils} from "@shared/utils/nhl-video-utils";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";
import {NstGameStats} from "@shared/models/natural-stat-trick/nst-game-stats.model";
import {RinkComponent} from "@app/game/rink/rink.component";

/**
 * A shot on the rink, in percent of the lying rink: along it from home's end boards, and across it from the top.
 */
export interface ShotMarker {
  shot: GameShot;
  along: number;
  across: number;
  color: string;
}

/**
 * The selected shot's line, from the shot (x1, y1) towards the net, in percent of the shot layer. Its end depends on
 * how the rink is drawn, since the crease is a different size in percent on the lying rink and the standing one
 * (phones): `lyingEnd` and `standingEnd`, or null where a missed shot's line has nowhere to go.
 */
export interface ShotLine {
  x1: number;
  y1: number;
  missed: boolean;
  lyingEnd: {x: number, y: number};
  standingEnd: {x: number, y: number};
}

/**
 * Which shots the map shows, picked in the card's header: every unblocked shot (missed ones too), the shots on goal and
 * goals, or only the goals.
 */
export type ShotFilter = "all" | "onTarget" | "goals";

/**
 * The game's shots on a rink, home's shots at the left end and away's at the right (standing up on phones, home's at
 * the top): the shots on goal and goals to start with, and the header's filter adds the missed shots or keeps only the
 * goals. A shot clicked on the rink (the last one to start with) shows its shooter, time, shot type, result and goalie
 * above the rink, and a goal with a posted clip can open its highlight.
 */
@Component({
  selector: 'app-shot-map',
  templateUrl: './shot-map.component.html',
  styleUrls: ['./shot-map.component.scss']
})
export class ShotMapComponent implements OnChanges, AfterViewInit, OnDestroy {

  /**
   * Where the goal lines and the faceoff dots are on the drawn rink, so a shot lines up with the markings: the goal
   * line 89ft from center ice in api-web's coordinates is drawn 86.97ft out (RinkComponent's 187.03ft goal line), and
   * the dots 22ft either side of the middle are drawn 22.35% of the rink's width out.
   */
  private static readonly goalLineX = 89;
  private static readonly drawnGoalLineFeet = 187.03 - 100.065;
  private static readonly dotY = 22;
  private static readonly drawnDotPercent = 22 / RinkComponent.standingRinkWidth * 100;

  @Input()
  public playByPlay: PlayByPlay;

  /**
   * The landing's scoring summary, for the goals with a posted highlight clip.
   */
  @Input()
  public scoring: GameLandingScoringPeriod[];

  /**
   * The game's stats from Natural Stat Trick, whose shots give each shot its xG (a live game's only up to how far NST
   * has got). Undefined until they load, and for a game NST has no stats for.
   */
  @Input()
  public advancedStats: NstGameStats;

  @Input()
  public homeTeamLogo: string;

  @Input()
  public awayTeamLogo: string;

  @Output()
  public playerClicked = new EventEmitter<number>();

  @Output()
  public goalClicked = new EventEmitter<PlayerClick>();

  /** The small logo beside each team's shot count, and on the shooter's headshot. */
  public readonly logoSize: number = 20;

  public markers: ShotMarker[] = [];

  /**
   * The header's filter options, in the order they're shown.
   */
  public readonly shotFilters: {value: ShotFilter, label: string, title: string}[] = [
    {value: "all", label: "All", title: "Show every shot, missed ones too"},
    {value: "onTarget", label: "On target", title: "Show the shots on goal and goals"},
    {value: "goals", label: "Goals", title: "Show only the goals"}
  ];

  /**
   * Which shots the map shows. The header's filter picks it.
   */
  public shotFilter: ShotFilter = "onTarget";

  /**
   * The selected shot's event ID. Kept across refreshes, and falls back to the last shown shot when it isn't shown.
   */
  public selectedEventId: number;

  /**
   * The shot details' facts that are left out when they would squeeze the shooter's name, first to last. The details
   * stay on one row beside the shooter (fitShotDetails).
   */
  private static readonly factDropOrder: string[] = ["goalie", "shotType"];

  /**
   * How many of factDropOrder the shot details are leaving out.
   */
  public droppedFacts: number = 0;

  @ViewChild("shotDetails")
  public shotDetails: ElementRef<HTMLElement>;

  private refitFrameId: number;

  /** Refits the shot details when the card changes width, with the window or the page's layout. */
  private resizeObserver: ResizeObserver;

  private cardWidth: number;

  private rosterSpots = new Map<number, RosterSpot>();

  private homeTeamId: number;

  private awayTeamId: number;

  constructor(private changeDetector: ChangeDetectorRef,
              private host: ElementRef<HTMLElement>) {}

  public ngOnChanges(changes: SimpleChanges): void {
    this.homeTeamId = this.playByPlay?.homeTeam?.id;
    this.awayTeamId = this.playByPlay?.awayTeam?.id;
    this.rosterSpots = PlayByPlayUtils.getRosterSpotMap(this.playByPlay);
    const homeColor = NhlTeamColorUtils.getTeamPrimaryColor(this.homeTeamId);
    const awayColor = NhlTeamColorUtils.getTeamSecondaryColor(this.homeTeamId, this.awayTeamId);
    this.markers = ShotMapUtils.getShots(this.playByPlay, this.advancedStats, true).map(shot => ({
      shot,
      ...ShotMapComponent.getRinkPosition(shot),
      color: shot.isHomeTeam ? homeColor : awayColor
    }));
    // A refresh can change the selected shot, once the view shows it
    this.scheduleFit();
  }

  public ngAfterViewInit(): void {
    this.fitShotDetails();
    this.resizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width !== this.cardWidth) {
        this.cardWidth = width;
        this.fitShotDetails();
      }
    });
    this.resizeObserver.observe(this.host.nativeElement);
  }

  public ngOnDestroy(): void {
    cancelAnimationFrame(this.refitFrameId);
    this.resizeObserver?.disconnect();
  }

  /**
   * Shows every fact in the shot details, then leaves out the goalie, then the shot type, until the shooter's name fits
   * beside them and the row fits the card. If it still doesn't, the name is cut short. Runs when the view is built,
   * when the card changes width and whenever the selected shot changes, since the names' lengths change with it.
   */
  public fitShotDetails(): void {
    for (let dropped = 0; dropped <= ShotMapComponent.factDropOrder.length; dropped++) {
      this.droppedFacts = dropped;
      this.changeDetector.detectChanges();
      const details = this.shotDetails?.nativeElement;
      const name = details?.querySelector(".shooter-name");
      if (!details || (details.scrollWidth <= details.clientWidth && name?.scrollWidth <= name?.clientWidth)) {
        return;
      }
    }
  }

  /**
   * Whether the shot details show a fact of factDropOrder. Every other fact is always shown.
   */
  public isFactShown(fact: string): boolean {
    const dropIndex = ShotMapComponent.factDropOrder.indexOf(fact);
    return dropIndex < 0 || dropIndex >= this.droppedFacts;
  }

  /**
   * Returns where a shot goes on the lying rink, in percent: home attacks the left end and away the right, and both
   * are turned half a turn from their own shooting direction so they keep their side of the net.
   */
  public static getRinkPosition(shot: GameShot): {along: number, across: number} {
    const turn = shot.isHomeTeam ? -1 : 1;
    const feetAlong = 100.065 + shot.x * turn * ShotMapComponent.drawnGoalLineFeet / ShotMapComponent.goalLineX;
    const along = feetAlong / RinkComponent.rinkLength * 100;
    const across = 50 - shot.y * turn * ShotMapComponent.drawnDotPercent / ShotMapComponent.dotY;
    const clamp = (value: number, min: number, max: number) => Math.round(Math.min(Math.max(value, min), max) * 100) / 100;
    return {along: clamp(along, 1, 99), across: clamp(across, 2, 98)};
  }

  /**
   * The shots shown on the rink, in play order: every shot, the shots on goal and goals, or only the goals
   * (shotFilter).
   */
  public get shownMarkers(): ShotMarker[] {
    switch (this.shotFilter) {
      case "all":
        return this.markers;
      case "goals":
        return this.markers.filter(marker => marker.shot.isGoal);
      default:
        return this.markers.filter(marker => !marker.shot.isMissed);
    }
  }

  /**
   * The selected shot, or the last shot shown when none is selected or the selected one isn't shown.
   */
  public get selectedMarker(): ShotMarker {
    const shown = this.shownMarkers;
    return shown.find(marker => marker.shot.eventId === this.selectedEventId) ?? shown[shown.length - 1];
  }

  public get selectedShot(): GameShot {
    return this.selectedMarker?.shot;
  }

  /**
   * The line from the selected shot towards the net it was shot at. A shot on goal's reaches the middle of the net. A
   * missed shot's is dashed (missed) and stops where it meets the crease, since the puck didn't get to the net
   * (getCreaseEnd).
   */
  public get selectedShotLine(): ShotLine {
    const marker = this.selectedMarker;
    if (!marker) {
      return undefined;
    }
    const net = ShotMapComponent.getRinkPosition({...marker.shot, x: ShotMapComponent.goalLineX, y: 0});
    const end = (standing: boolean) => marker.shot.isMissed ?
        ShotMapComponent.getCreaseEnd(marker, net, standing) : {x: net.along, y: net.across};
    return {
      x1: marker.along,
      y1: marker.across,
      missed: marker.shot.isMissed,
      lyingEnd: end(false),
      standingEnd: end(true)
    };
  }

  /**
   * Where the line from a shot to the middle of the net meets the edge of the drawn crease, in percent of the shot
   * layer, or null for a shot from inside the crease. The crease is round on the drawn rink, so in percent it's an
   * ellipse, of a different size on the lying rink and the standing one.
   *
   * @param marker - The shot.
   * @param net - The middle of the net it was shot at, in percent (getRinkPosition).
   * @param standing - Whether the rink stands up, as on phones.
   */
  public static getCreaseEnd(marker: ShotMarker, net: {along: number, across: number},
                             standing: boolean): {x: number, y: number} {
    const radius = RinkComponent.getCreaseRadiusPercent(standing);
    const along = marker.along - net.along;
    const across = marker.across - net.across;
    // How far along the line from the net to the shot the crease's edge is, as a share of the whole line
    const edge = 1 / Math.hypot(along / radius.along, across / radius.across);
    if (!(edge < 1)) {
      return null;
    }
    const round = (value: number) => Math.round(value * 100) / 100;
    return {x: round(net.along + along * edge), y: round(net.across + across * edge)};
  }

  public get homeShotsLabel(): string {
    return this.getShotsLabel(true);
  }

  public get awayShotsLabel(): string {
    return this.getShotsLabel(false);
  }

  public get shooterName(): string {
    return PlayByPlayUtils.getFullName(this.rosterSpots.get(this.selectedShot?.shooterId)) || "Unknown";
  }

  public get shooterHeadshot(): string {
    return this.rosterSpots.get(this.selectedShot?.shooterId)?.headshot || NhlPlayerHeadshotUtils.blankHeadshot;
  }

  public get shooterTeamLogo(): string {
    return NhlTeamLogoUtils.getTeamPrimaryLogo(this.selectedShot?.teamId);
  }

  public get timeLabel(): string {
    return ShotMapUtils.getTimeLabel(this.selectedShot);
  }

  public get shotTypeLabel(): string {
    return ShotMapUtils.getShotTypeLabel(this.selectedShot?.shotType);
  }

  /**
   * "Goal", "Saved", or why a missed shot missed, like "Wide" or "Hit the post".
   */
  public get resultLabel(): string {
    return ShotMapUtils.getResultLabel(this.selectedShot);
  }

  /**
   * Whether the shots have Natural Stat Trick's xG, so the details show it and the card credits NST.
   */
  public get hasExpectedGoals(): boolean {
    return this.markers.some(marker => marker.shot.expectedGoals != null);
  }

  /**
   * The selected shot's xG, like "0.30", "Pending" for a live game's shot NST hasn't got to yet, or "-" for a shot NST
   * doesn't list.
   */
  public get expectedGoalsLabel(): string {
    if (this.selectedShot?.expectedGoalsPending) {
      return "Pending";
    }
    return NstStatsUtils.formatExpectedGoals(this.selectedShot?.expectedGoals);
  }

  /**
   * Explains a pending xG, which Natural Stat Trick adds a few minutes after the shot.
   */
  public get expectedGoalsTitle(): string {
    return this.selectedShot?.expectedGoalsPending ?
        "Natural Stat Trick runs a few minutes behind live games, so this shot's xG isn't in yet" : null;
  }

  /**
   * NST's game page, credited for the xG.
   */
  public get expectedGoalsSourceUrl(): string {
    return this.hasExpectedGoals ? NstStatsUtils.getGamePageUrl(this.advancedStats?.gameId) : "";
  }

  /**
   * The goalie the shot was on, or "Empty net".
   */
  public get goalieLabel(): string {
    const goalieId = this.selectedShot?.goalieId;
    if (goalieId == null) {
      return "Empty net";
    }
    return PlayByPlayUtils.getFullName(this.rosterSpots.get(goalieId)) || "Unknown";
  }

  /**
   * Whether the selected shot is a goal with a posted highlight clip, which the watch button opens.
   */
  public get selectedGoalHasClip(): boolean {
    const shot = this.selectedShot;
    if (!shot?.isGoal) {
      return false;
    }
    const goal = (this.scoring ?? []).flatMap(period => period.goals ?? []).find(item => item.eventId === shot.eventId);
    return !!NhlVideoUtils.getGoalHighlightVideo(goal);
  }

  /**
   * Shows the filter's shots. The selected shot stays selected if it's still shown, else the last shown shot is.
   */
  public selectShotFilter(filter: ShotFilter): void {
    this.shotFilter = filter;
    this.fitShotDetails();
  }

  public selectShot(marker: ShotMarker): void {
    this.selectedEventId = marker?.shot?.eventId;
    this.fitShotDetails();
  }

  public clickShooter(): void {
    if (this.selectedShot?.shooterId != null) {
      this.playerClicked.emit(this.selectedShot.shooterId);
    }
  }

  public clickWatchGoal(): void {
    const shot = this.selectedShot;
    if (shot) {
      this.goalClicked.emit({playerId: shot.shooterId, eventId: shot.eventId});
    }
  }

  /**
   * Describes a shot for screen readers, like "Kyle Connor, 2nd 4:12, goal" or "Kyle Connor, 2nd 5:30, missed, wide".
   */
  public getMarkerLabel(marker: ShotMarker): string {
    const name = PlayByPlayUtils.getFullName(this.rosterSpots.get(marker.shot.shooterId)) || "Unknown";
    const result = ShotMapUtils.getResultLabel(marker.shot).toLowerCase();
    const resultLabel = marker.shot.isMissed && result !== "missed" ? "missed, " + result : result;
    return name + ", " + ShotMapUtils.getTimeLabel(marker.shot) + ", " + resultLabel;
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  private scheduleFit(): void {
    cancelAnimationFrame(this.refitFrameId);
    this.refitFrameId = requestAnimationFrame(() => this.fitShotDetails());
  }

  public trackByShot(index: number, marker: ShotMarker): number {
    return marker.shot.eventId;
  }

  /**
   * A team's shots on goal and goals, like "28 shots · 3 goals" or "1 shot · 0 goals", with its missed shots between
   * them while the map shows every shot ("28 shots · 12 missed · 3 goals"). Shots count goals, like the boxscore.
   */
  private getShotsLabel(isHomeTeam: boolean): string {
    const shots = this.markers.filter(marker => marker.shot.isHomeTeam === isHomeTeam).map(marker => marker.shot);
    const missed = shots.filter(shot => shot.isMissed).length;
    const onTarget = shots.length - missed;
    const goals = shots.filter(shot => shot.isGoal).length;
    return [
      onTarget + (onTarget === 1 ? " shot" : " shots"),
      ...(this.shotFilter === "all" ? [missed + " missed"] : []),
      goals + (goals === 1 ? " goal" : " goals")
    ].join(" · ");
  }
}

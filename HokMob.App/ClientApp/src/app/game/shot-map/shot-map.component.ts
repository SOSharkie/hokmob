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
 * The game's shots on goal and goals on a rink, home's shots at the left end and away's at the right (standing up on
 * phones, home's at the top). A shot clicked on the rink (the last one to start with) shows its shooter, time, shot
 * type, result and goalie above the rink, and a goal with a posted clip can open its highlight.
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
   * Whether the map only shows the goals. The header toggle switches it.
   */
  public showGoalsOnly = false;

  /**
   * The selected shot's event ID. Kept across refreshes, and falls back to the last shown shot when it isn't shown.
   */
  public selectedEventId: number;

  /**
   * Whether the shot details show the goalie. They stay on one row beside the shooter, so the goalie is left out when
   * it would squeeze the shooter's name (fitShotDetails).
   */
  public showGoalie = true;

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
    this.markers = ShotMapUtils.getShots(this.playByPlay).map(shot => ({
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
   * Shows the goalie in the shot details, and leaves it out when the shooter's name no longer fits beside the facts
   * or the row overflows the card. Runs when the view is built, when the card changes width and whenever the selected
   * shot changes, since the names' lengths change with it.
   */
  public fitShotDetails(): void {
    this.showGoalie = true;
    this.changeDetector.detectChanges();
    const details = this.shotDetails?.nativeElement;
    const name = details?.querySelector(".shooter-name");
    if (details && (details.scrollWidth > details.clientWidth || name?.scrollWidth > name?.clientWidth)) {
      this.showGoalie = false;
      this.changeDetector.detectChanges();
    }
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
   * The shots shown on the rink, in play order: all of them, or only the goals.
   */
  public get shownMarkers(): ShotMarker[] {
    return this.showGoalsOnly ? this.markers.filter(marker => marker.shot.isGoal) : this.markers;
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
   * The line from the selected shot to the net it was shot at, in percent of the lying rink.
   */
  public get selectedShotLine(): {x1: number, y1: number, x2: number, y2: number} {
    const marker = this.selectedMarker;
    if (!marker) {
      return undefined;
    }
    const net = ShotMapComponent.getRinkPosition({...marker.shot, x: ShotMapComponent.goalLineX, y: 0});
    return {x1: marker.along, y1: marker.across, x2: net.along, y2: net.across};
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

  public get resultLabel(): string {
    return this.selectedShot?.isGoal ? "Goal" : "Saved";
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

  public toggleGoalsOnly(): void {
    this.showGoalsOnly = !this.showGoalsOnly;
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
   * Describes a shot for screen readers, like "Kyle Connor, 2nd 4:12, goal".
   */
  public getMarkerLabel(marker: ShotMarker): string {
    const name = PlayByPlayUtils.getFullName(this.rosterSpots.get(marker.shot.shooterId)) || "Unknown";
    return name + ", " + ShotMapUtils.getTimeLabel(marker.shot) + ", " + (marker.shot.isGoal ? "goal" : "saved");
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
   * A team's shots on goal and goals, like "28 shots · 3 goals" or "1 shot · 0 goals".
   */
  private getShotsLabel(isHomeTeam: boolean): string {
    const shots = this.markers.filter(marker => marker.shot.isHomeTeam === isHomeTeam).map(marker => marker.shot);
    const goals = shots.filter(shot => shot.isGoal).length;
    return shots.length + (shots.length === 1 ? " shot" : " shots") + " · " + goals + (goals === 1 ? " goal" : " goals");
  }
}

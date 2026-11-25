import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {DomSanitizer} from '@angular/platform-browser';
import {MatIconRegistry} from '@angular/material/icon';
import {registerLucideIcons} from '@shared/icons/lucide-icons';
import {AppTestingModule} from '@shared/testing/app-testing.module';
import {
  mockEdgeSeason,
  mockLeagueGoalies,
  mockLeaguePlayerRows,
  mockLeagueSkaters,
  mockNstPlayerRows
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {PlayerPercentileUtils, PlayerTraits} from '@shared/utils/player-percentile-utils';

import {PlayerTraitsComponent} from './player-traits.component';

describe('PlayerTraitsComponent', () => {
  let component: PlayerTraitsComponent;
  let fixture: ComponentFixture<PlayerTraitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppTestingModule],
      declarations: [PlayerTraitsComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();
    registerLucideIcons(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
    fixture = TestBed.createComponent(PlayerTraitsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  function skaterTraits(playerId: number): PlayerTraits {
    return PlayerPercentileUtils.getPlayerTraits(mockLeaguePlayerRows(mockLeagueSkaters()), playerId);
  }

  /** A skater's traits with Natural Stat Trick and the EDGE season file. */
  function fullSkaterTraits(playerId: number): PlayerTraits {
    return PlayerPercentileUtils.getPlayerTraits(mockLeaguePlayerRows(mockLeagueSkaters()), playerId,
        {nstPlayers: mockNstPlayerRows(), edgeSeason: mockEdgeSeason()});
  }

  function goalieTraits(playerId: number): PlayerTraits {
    return PlayerPercentileUtils.getPlayerTraits(mockLeaguePlayerRows(mockLeagueGoalies()), playerId);
  }

  function render(traits: PlayerTraits, teamId: number = 22, loading: boolean = false): void {
    fixture.componentRef.setInput('traits', traits);
    fixture.componentRef.setInput('teamId', teamId);
    fixture.componentRef.setInput('season', 20262027);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  /** Each vertex's label as its name and percentile, like "Goals 95%". */
  function labels(): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.trait-label'))
        .map(label => label.querySelector('.trait-name').textContent.trim() + ' ' +
            label.querySelector('.trait-percentile').textContent.trim());
  }

  it('should chart a forward\'s six percentiles against the forwards', () => {
    // Leon Draisaitl, second of 32 forwards in goals per 60
    render(skaterTraits(8477934));
    expect(text('.traits-title')).toBe('Player Traits');
    expect(text('.traits-subtitle')).toBe('Compared to other forwards');
    expect(labels()[0]).toBe('Goals 95%');
    expect(component.labels.map(label => label.label))
        .toEqual(['Goals', 'Shot attempts', 'Playmaking', 'Possession', 'Defense', 'Physical']);
    // The pool is in the (?) explanation, and a player in it gets no note under the chart
    expect(text('.traits-help')).toContain('Among 32 forwards with at least 7 games in 2026-2027.');
    expect(fixture.nativeElement.querySelector('.traits-small-sample')).toBeNull();
    // The stat behind each percentile is in its title
    expect(fixture.nativeElement.querySelector('.trait-label').getAttribute('title'))
        .toBe('Goals per 60 minutes, and his expected goals (ixG) per 60 at half weight, each ranked and averaged: ' +
            '2.41 goals per 60');
    // Without Natural Stat Trick, no credit
    expect(fixture.nativeElement.querySelector('.traits-source')).toBeNull();
    expect(text('.traits-help')).not.toContain('Natural Stat Trick');
  });

  it('should chart Speed and Possession for a skater in the EDGE season file, and credit NST', () => {
    render(fullSkaterTraits(8477934));
    expect(component.labels.map(label => label.label))
        .toEqual(['Goals', 'Possession', 'Playmaking', 'Speed', 'Defense', 'Physical']);
    // The file's date is in Speed's title and the explanation
    const speed = fixture.nativeElement.querySelectorAll('.trait-label')[3];
    expect(speed.getAttribute('title')).toContain('(NHL EDGE)');
    expect(speed.getAttribute('title')).toMatch(/, through [A-Z][a-z]+ \d+$/);
    expect(text('.traits-help')).toContain("Speed is NHL EDGE's bursts over 20 mph per 60, with top speed at half weight, through");
    expect(text('.traits-help')).toContain("like Possession's shot attempts and 5v5 Corsi For %");
    expect(text('.traits-help')).toContain('come from Natural Stat Trick');
    const source: HTMLAnchorElement = fixture.nativeElement.querySelector('.traits-source');
    expect(source.textContent.replace(/\s+/g, ' ').trim()).toBe('ixG, hits taken and xGA from Natural Stat Trick');
    expect(source.href).toContain('naturalstattrick.com/playerteams.php?fromseason=20262027');
  });

  it('should draw the rings, the spokes and the shape, with the top vertex at the top', () => {
    render(skaterTraits(8477934));
    expect(fixture.nativeElement.querySelectorAll('.trait-ring').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.trait-spoke').length).toBe(6);
    expect(fixture.nativeElement.querySelectorAll('.trait-dot').length).toBe(6);
    // 90 is the outer ring's radius: the top vertex is 95.3% of it above the center
    const goals = skaterTraits(8477934).traits[0].percentile;
    expect(component.dots[0].x).toBe(170);
    expect(component.dots[0].y).toBeCloseTo(129 - 90 * goals / 100, 1);
    expect(fixture.nativeElement.querySelector('.trait-shape').getAttribute('points')).toBe(component.shape);
    // The top label sits above its vertex, the second to the right of it
    expect(component.labels[0].anchor).toBe('top');
    expect(component.labels[1].anchor).toBe('right');
    expect(component.labels[3].anchor).toBe('bottom');
    expect(component.labels[4].anchor).toBe('left');
  });

  it('should draw the shape in the team\'s color, lightened on the card', () => {
    // Oilers navy
    render(skaterTraits(8477934), 22);
    expect(fixture.nativeElement.querySelector('.trait-shape').getAttribute('fill')).toBe('#5C6D84');
    // A player without a current team
    render(skaterTraits(8477934), null);
    expect(fixture.nativeElement.querySelector('.trait-shape').getAttribute('fill')).toBe('#A4A4A4');
  });

  it('should chart a goalie against the goalies', () => {
    // Connor Hellebuyck, 7th of 14 in save percentage
    render(goalieTraits(8476945));
    expect(text('.traits-subtitle')).toBe('Compared to other goalies');
    expect(labels()[0]).toBe('Save % 54%');
    expect(labels().length).toBe(6);
    expect(text('.traits-help')).toContain('Among 14 goalies with at least 7 games in 2026-2027.');
  });

  it('should note that a player under the minimum is a small sample', () => {
    // Vladislav Namestnikov, 6 games
    render(skaterTraits(8476480));
    expect(text('.traits-small-sample')).toBe('Only 6 games, small sample');
    // The pool he's charted against, without him
    expect(text('.traits-help')).toContain('Among 32 forwards with at least 7 games');
    expect(labels().length).toBe(6);
  });

  it('should show a dash for a stat that can\'t be worked out', () => {
    const traits = skaterTraits(8477934);
    traits.traits[3].percentile = undefined;
    render(traits);
    expect(labels()[3]).toBe('Possession -');
  });

  it('should explain the numbers when the (?) is clicked, and close on a click elsewhere or Escape', () => {
    render(skaterTraits(8477934));
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.traits-help-button');
    const help: HTMLElement = fixture.nativeElement.querySelector('.traits-help');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(help.textContent).toContain('the share of them this player is ahead of');
    expect(help.textContent).toContain('per 60 minutes');

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(help.classList).toContain('open');

    document.body.click();
    fixture.detectChanges();
    expect(help.classList).not.toContain('open');

    button.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    fixture.detectChanges();
    expect(help.classList).not.toContain('open');
  });

  it('should show a skeleton at the card\'s size while it loads', () => {
    render(undefined, 22, true);
    const skeleton = fixture.nativeElement.querySelector('app-skeleton-card');
    expect(skeleton).not.toBeNull();
    expect(skeleton.getAttribute('shape')).toBe('block');
    expect(skeleton.getAttribute('cardTitle')).toBe('Player Traits');
    expect(skeleton.layout).toEqual(component.skeletonLayout);
    expect(fixture.nativeElement.querySelector('.player-traits')).toBeNull();
  });

  it("should keep a place for a skater's NST credit in the skeleton, and not for a goalie's", () => {
    render(undefined, 22, true);
    const skaterPadding = component.skeletonLayout.paddingBottom;
    fixture.componentRef.setInput('isGoalie', true);
    fixture.detectChanges();
    expect(skaterPadding - component.skeletonLayout.paddingBottom).toBe(24);
    expect(fixture.nativeElement.querySelector('app-skeleton-card').layout).toEqual(component.skeletonLayout);
  });

  it('should show nothing without traits', () => {
    render(undefined);
    expect(fixture.nativeElement.querySelector('.player-traits')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-skeleton-card')).toBeNull();
    expect(component.labels).toEqual([]);
  });
});

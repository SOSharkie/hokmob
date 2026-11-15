import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { mockTeamGameRows } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { TeamGameStats } from '@shared/models/nhl-stats-api/team-games.model';
import { TeamRatingUtils } from '@shared/utils/team-rating-utils';

import { TeamChartLine, TeamRatingChartComponent } from './team-rating-chart.component';

describe('TeamRatingChartComponent', () => {
  let component: TeamRatingChartComponent;
  let fixture: ComponentFixture<TeamRatingChartComponent>;
  let games: TeamGameStats[];

  /** San Jose: 22 games through 2026-11-14 in the fixture, so 20 points from its 3rd game. */
  const sharks = 28;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamRatingChartComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamRatingChartComponent);
    component = fixture.componentInstance;
    games = mockTeamGameRows();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(teamIds: number[] = [sharks], teamGames: TeamGameStats[] = games): void {
    fixture.componentRef.setInput('games', teamGames);
    fixture.componentRef.setInput('teamIds', teamIds);
    fixture.detectChanges();
  }

  /** The chart's datasets, read from the Chart.js instance. */
  function datasets(): any[] {
    return (component as any).chart.data.datasets;
  }

  function toggle(label: string): HTMLButtonElement {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.line-toggle'));
    return buttons.find(button => button.textContent.trim() === label);
  }

  function line(id: string): TeamChartLine {
    return component.lines.find(item => item.id === id);
  }

  it('should chart the power rating after each game from the 3rd', () => {
    show();
    expect(datasets().length).toBe(1);
    expect(datasets()[0].label).toBe('Power rating');
    expect(datasets()[0].data.length).toBe(20);
    const season = TeamRatingUtils.getLeagueRatings(games).find(rating => rating.teamId === sharks);
    const last = datasets()[0].data[19];
    expect(last.y).toBeCloseTo(season.rating, 10);
    // The x axis counts days from the season's first game day, 2026-09-29, to the last game, 2026-11-14
    expect(last.x).toBe(46);
    expect((component as any).chart.options.scales.x.max).toBe(46);
  });

  it('should offer the power rating and 8 stats, each in its own color', () => {
    show();
    expect(component.lines.map(item => item.label)).toEqual([
      'Power rating', 'Points %', 'Goal diff', 'Corsi %', 'Special teams', 'Fenwick %', 'Save %', 'Shooting %', 'PDO'
    ]);
    expect(new Set(component.lines.map(item => item.color)).size).toBe(9);
    expect(toggle('Power rating').getAttribute('aria-pressed')).toBe('true');
  });

  it('should add a stat\'s line on its scale, in the toggles\' order', () => {
    show();
    toggle('Fenwick %').click();
    toggle('Points %').click();
    fixture.detectChanges();
    expect(datasets().map(dataset => dataset.label)).toEqual(['Power rating', 'Points %', 'Fenwick %']);
    const season = TeamRatingUtils.getLeagueRatings(games).find(rating => rating.teamId === sharks);
    expect(datasets()[2].data[19].y).toBeCloseTo(season.scores.fenwick, 10);
    expect(datasets()[2].borderColor).toBe(TeamRatingUtils.getMetric('fenwick').color);
  });

  it('should show up to 4 lines', () => {
    show();
    ['Points %', 'Goal diff', 'Fenwick %'].forEach(label => toggle(label).click());
    fixture.detectChanges();
    expect(component.selectedLines.length).toBe(4);
    expect(toggle('PDO').disabled).toBeTrue();
    expect(toggle('PDO').title).toContain('Up to 4 lines');
    component.toggleLine(line('pdo'));
    expect(component.selectedLines).not.toContain('pdo');

    toggle('Goal diff').click();
    fixture.detectChanges();
    expect(toggle('PDO').disabled).toBeFalse();
  });

  it('should keep the last line shown', () => {
    show();
    toggle('Power rating').click();
    fixture.detectChanges();
    expect(component.selectedLines).toEqual(['rating']);
    expect(datasets().length).toBe(1);
  });

  it('should rate each team\'s last 10 games', () => {
    show();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.window-toggle .toggle-option'));
    buttons.find(button => button.textContent.trim() === 'Last 10').click();
    fixture.detectChanges();
    expect(component.window).toBe('last10');
    const lastTen = TeamRatingUtils.getLeagueRatings(games, {lastGames: 10}).find(rating => rating.teamId === sharks);
    expect(datasets()[0].data[19].y).toBeCloseTo(lastTen.rating, 10);
  });

  it('should label the tooltip with the game, each stat and its rank', () => {
    show();
    component.toggleLine(line('pointPct'));
    const chart = (component as any).chart;
    const point = datasets()[1].data[19];
    const item = {raw: point, datasetIndex: 1, dataset: datasets()[1]};
    expect(chart.options.plugins.tooltip.callbacks.title([item])).toBe('Nov 14 · Game 22');
    expect(chart.options.plugins.tooltip.callbacks.label(item))
        .toBe('Points %: 45.5% (' + TeamRatingUtils.getOrdinal(point.point.ranks.pointPct) + ')');
    const ratingItem = {raw: datasets()[0].data[19], datasetIndex: 0, dataset: datasets()[0]};
    expect(chart.options.plugins.tooltip.callbacks.label(ratingItem)).toMatch(/^Power rating: \d+\.\d \(\d+(st|nd|rd|th)\)$/);
  });

  it('should not redraw for a new list of the same teams', () => {
    show();
    const timeline = component.timeline;
    fixture.componentRef.setInput('teamIds', [sharks]);
    fixture.detectChanges();
    expect(component.timeline).toBe(timeline);
  });

  it('should chart one stat for several teams, a line per team', () => {
    show([sharks, 6]);
    expect(component.isMultiTeam).toBeTrue();
    expect(datasets().map(dataset => dataset.label)).toEqual(['SJS', 'BOS']);
    toggle('Fenwick %').click();
    fixture.detectChanges();
    expect(component.selectedLines).toEqual(['fenwick']);
    expect(datasets().length).toBe(2);
  });

  it('should say when no team has 3 games yet', () => {
    show([sharks], games.filter(game => game.gameDate <= '2026-10-01'));
    expect(component.hasPoints).toBeFalse();
    expect(fixture.nativeElement.querySelector('.chart-message').textContent.trim())
        .toBe('The chart starts after 3 games');
  });

  it('should chart nothing without games', () => {
    show([sharks], []);
    expect(datasets().length).toBe(1);
    expect(datasets()[0].data).toEqual([]);
  });
});

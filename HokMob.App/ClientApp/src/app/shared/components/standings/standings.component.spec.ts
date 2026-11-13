import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { StandingsGroup, StandingsTeam } from '@shared/models/nhl-web-api/standings.model';
import { NhlStandingsTypeEnum } from '@shared/enums/nhl-standings-type.enum';
import { NhlTeamColorUtils } from '@shared/utils/nhl-team-color-utils';
import { mockStandingsTeams } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { StandingsComponent } from './standings.component';

describe('StandingsComponent', () => {
  let component: StandingsComponent;
  let fixture: ComponentFixture<StandingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ StandingsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StandingsComponent);
    component = fixture.componentInstance;
  });

  /** The whole league from the real standings, ranked like the service's league group. */
  function leagueGroup(): StandingsGroup {
    return {title: 'NHL', teams: mockStandingsTeams().sort((a, b) => a.leagueSequence - b.leagueSequence)};
  }

  function divisionGroup(divisionName: string): StandingsGroup {
    const teams = mockStandingsTeams().filter(team => team.divisionName === divisionName)
        .sort((a, b) => a.divisionSequence - b.divisionSequence);
    return {title: divisionName + ' Division', teams};
  }

  function team(abbrev: string): StandingsTeam {
    return mockStandingsTeams().find(standingsTeam => standingsTeam.teamAbbrev.default === abbrev);
  }

  function render(standings: StandingsGroup[], inputs: Partial<StandingsComponent> = {}): void {
    fixture.componentRef.setInput('standings', standings);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.standings-row'));
  }

  function cell(rowIndex: number, selector: string): string {
    return rows()[rowIndex].querySelector(selector)?.textContent.trim();
  }

  /** The row's app-team-logo. It isn't declared here, so its inputs are read off the element. */
  function logoCell(rowIndex: number): HTMLElement & {teamId: number} {
    return rows()[rowIndex].querySelector('app-team-logo');
  }

  it('should show the group title with the season and a row per team', () => {
    render([divisionGroup('Central')], {defaultStandingsType: NhlStandingsTypeEnum.BY_DIVISION});
    expect(fixture.nativeElement.querySelector('.standings-type-container').textContent)
        .toContain('Central Division 2025-2026');
    expect(rows().length).toBe(8);
    expect(cell(0, '.rank-cell')).toBe('1');
    expect(cell(0, '.team-name-text')).toBe('Colorado Avalanche');
    expect(cell(0, '.gp-cell')).toBe('82');
    expect(cell(0, '.wins-cell')).toBe('55');
    expect(cell(0, '.losses-cell')).toBe('16');
    expect(cell(0, '.ot-cell')).toBe('11');
    expect(cell(0, '.rw-cell')).toBe('48');
    expect(cell(0, '.gfga-cell')).toBe('302 / 203');
    expect(cell(0, '.gd-cell')).toBe('99');
    expect(cell(0, '.form-cell')).toBe('3W');
    expect(cell(0, '.points-cell')).toBe('121');
  });

  it('should look up team IDs, logos and links from abbreviations, including Utah', () => {
    const group = leagueGroup();
    render([group]);
    const utahIndex = group.teams.findIndex(standingsTeam => standingsTeam.teamAbbrev.default === 'UTA');
    expect(component.teamIds[0][0]).toBe(21);
    expect(component.teamIds[0][utahIndex]).toBe(68);
    // The logo itself comes from app-team-logo, which is given the ID
    expect(logoCell(0).teamId).toBe(21);
    expect(logoCell(utahIndex).teamId).toBe(68);
    const routerLink = fixture.debugElement.queryAll(By.css('.team-name-cell'))[0].injector.get(RouterLink);
    expect(routerLink.urlTree.toString()).toBe('/team/21');
  });

  it('should rank rows by the standings type', () => {
    const colorado = team('COL');
    const dallas = team('DAL');
    const utah = team('UTA');
    component.defaultStandingsType = NhlStandingsTypeEnum.BY_LEAGUE;
    expect(component.getTeamRank(dallas)).toBe(dallas.leagueSequence);
    component.defaultStandingsType = NhlStandingsTypeEnum.BY_CONFERENCE;
    expect(component.getTeamRank(dallas)).toBe(dallas.conferenceSequence);
    component.defaultStandingsType = NhlStandingsTypeEnum.BY_DIVISION;
    expect(component.getTeamRank(colorado)).toBe(1);
    component.defaultStandingsType = NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS;
    // Division leaders have wildcardSequence 0, so they show their division rank
    expect(component.getTeamRank(dallas)).toBe(2);
    expect(component.getTeamRank(utah)).toBe(1);
  });

  it('should mark clinched teams as playoff positions, but not eliminated teams', () => {
    expect(['COL', 'CAR', 'BUF', 'UTA'].map(abbrev => component.isPlayoffPosition(team(abbrev))))
        .toEqual([true, true, true, true]);
    expect(component.isPlayoffPosition(team('STL'))).toBeFalse();
    const noClinch = team('STL');
    delete noClinch.clinchIndicator;
    expect(component.isPlayoffPosition(noClinch)).toBeFalse();

    render([leagueGroup()]);
    expect(rows()[0].querySelector('.rank-cell').classList).toContain('playoffPosition');
    expect(rows()[31].querySelector('.rank-cell').classList).not.toContain('playoffPosition');
  });

  it('should mark eliminated teams and explain both bars in the legend', () => {
    expect(component.isEliminated(team('STL'))).toBeTrue();
    expect(component.isEliminated(team('COL'))).toBeFalse();

    render([leagueGroup()]);
    expect(rows()[31].querySelector('.rank-cell').classList).toContain('eliminated');
    expect(rows()[0].querySelector('.rank-cell').classList).not.toContain('eliminated');
    const legendItems = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.standings-legend .legend-item'))
        .map(item => item.textContent.trim());
    expect(legendItems).toEqual(['Clinched playoff spot', 'Eliminated']);
  });

  it('should show no legend before any team clinches or is eliminated', () => {
    const group = leagueGroup();
    group.teams.forEach(standingsTeam => delete standingsTeam.clinchIndicator);
    render([group]);
    expect(component.hasPlayoffPositions).toBeFalse();
    expect(component.hasEliminatedTeams).toBeFalse();
    expect(fixture.nativeElement.querySelector('.standings-legend')).toBeNull();
  });

  it('should put every group and the legend in one card', () => {
    render([divisionGroup('Central'), divisionGroup('Pacific')], {defaultStandingsType: NhlStandingsTypeEnum.BY_DIVISION});
    expect(fixture.nativeElement.querySelectorAll('.standings-container').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.standings-group').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.standings-legend').length).toBe(1);
  });

  it('should show common names and hide record columns in mini standings', () => {
    render([leagueGroup()], {miniStandings: true, showFormAndNext: false});
    expect(fixture.nativeElement.querySelector('.standings-type-container')).toBeNull();
    expect(cell(0, '.team-name-text')).toBe('Avalanche');
    expect(rows()[0].querySelector('.wins-cell')).toBeNull();
    expect(rows()[0].querySelector('.gfga-cell')).toBeNull();
    expect(rows()[0].querySelector('.gd-cell')).toBeNull();
    expect(rows()[0].querySelector('.form-cell')).toBeNull();
    expect(cell(0, '.points-cell')).toBe('121');
  });

  it('should highlight the selected team', () => {
    render([leagueGroup()], {selectedTeamId: 21});
    expect(rows()[0].classList).toContain('selected-row');
    expect(rows()[1].classList).not.toContain('selected-row');
    expect(component.selectedTeamColor).toBe(NhlTeamColorUtils.getTeamPrimaryColor(21));
    // Colorado's burgundy keeps white text
    expect(rows()[0].querySelector<HTMLElement>('.points-value').style.color).toBe('rgb(255, 255, 255)');
  });

  it("should put dark text on a light team's points", () => {
    render([leagueGroup()], {selectedTeamId: 55});
    // The Kraken's ice blue is too light for white text
    expect(component.selectedTeamTextColor).toBe('#1B1B1B');
  });

  it('should render nothing for empty standings', () => {
    render([]);
    expect(fixture.nativeElement.querySelector('.standings-container')).toBeNull();
    expect(component.seasonString).toBe('');
  });

  it('should use the fallback logo for a team with an unknown abbreviation', () => {
    const group = leagueGroup();
    group.teams[0].teamAbbrev.default = 'XYZ';
    render([group]);
    expect(component.teamIds[0][0]).toBeUndefined();
    expect(logoCell(0).teamId).toBeUndefined();
    expect(cell(0, '.team-name-text')).toBe('Colorado Avalanche');
  });

  describe('points percentage', () => {
    function header(selector: string): HTMLElement {
      return fixture.nativeElement.querySelector(selector);
    }

    function clickSort(selector: string): void {
      header(selector).querySelector<HTMLButtonElement>('.sort-button').click();
      fixture.detectChanges();
    }

    function abbrevs(): string[] {
      return component.sortedStandings[0].teams.map(standingsTeam => standingsTeam.teamAbbrev.default);
    }

    /**
     * The final standings with Carolina 12 games behind the rest, as early in a season: the same 113 points in 70
     * games is the league's best percentage, though still second in points.
     */
    function leagueGroupWithCarolinaBehind(): StandingsGroup {
      const group = leagueGroup();
      const carolina = group.teams.find(standingsTeam => standingsTeam.teamAbbrev.default === 'CAR');
      carolina.gamesPlayed = 70;
      carolina.pointPctg = carolina.points / (2 * carolina.gamesPlayed);
      return group;
    }

    it('should not show the column or sort buttons unless asked', () => {
      render([leagueGroup()]);
      expect(header('.pctg-header')).toBeNull();
      expect(rows()[0].querySelector('.pctg-cell')).toBeNull();
      expect(header('.points-header .sort-button')).toBeNull();
      expect(header('.points-header').textContent.trim()).toBe('PTS');
    });

    it('should show each team\'s points percentage, sorted by points first', () => {
      render([leagueGroup()], {showPointsPercentage: true});
      expect(header('.pctg-header').textContent.trim()).toBe('P%');
      expect(cell(0, '.pctg-cell')).toBe('.738');
      expect(cell(31, '.pctg-cell')).toBe('.354');
      expect(component.sortColumn).toBe('points');
      expect(header('.points-header').getAttribute('aria-sort')).toBe('descending');
      expect(header('.pctg-header').getAttribute('aria-sort')).toBeNull();
      expect(header('.points-header .sort-indicator').classList).toContain('visible');
      expect(header('.pctg-header .sort-indicator').classList).not.toContain('visible');
    });

    it('should sort by points percentage and back to the NHL order by points', () => {
      render([leagueGroupWithCarolinaBehind()], {showPointsPercentage: true});
      expect(abbrevs().slice(0, 2)).toEqual(['COL', 'CAR']);

      clickSort('.pctg-header');
      expect(component.sortColumn).toBe('pointPctg');
      expect(abbrevs().slice(0, 3)).toEqual(['CAR', 'COL', 'DAL']);
      expect(cell(0, '.team-name-text')).toBe('Carolina Hurricanes');
      expect(cell(0, '.pctg-cell')).toBe('.807');
      expect(cell(0, '.points-cell')).toBe('113');
      // The rank is the row's place, and the logo and link follow the row
      expect(cell(0, '.rank-cell')).toBe('1');
      expect(cell(1, '.rank-cell')).toBe('2');
      expect(component.teamIds[0][0]).toBe(12);
      expect(logoCell(0).teamId).toBe(12);
      expect(header('.pctg-header').getAttribute('aria-sort')).toBe('descending');
      expect(header('.points-header').getAttribute('aria-sort')).toBeNull();
      expect(rows()[0].querySelector('.pctg-cell').classList).toContain('sorted-column');
      // The input isn't reordered
      expect(component.standings[0].teams[0].teamAbbrev.default).toBe('COL');

      clickSort('.points-header');
      expect(component.sortColumn).toBe('points');
      expect(abbrevs().slice(0, 2)).toEqual(['COL', 'CAR']);
      expect(cell(0, '.rank-cell')).toBe('1');
      expect(component.teamIds[0][0]).toBe(21);
    });

    it('should keep the NHL order for teams with the same points percentage', () => {
      const nhlOrder = leagueGroup().teams.map(standingsTeam => standingsTeam.teamAbbrev.default);
      render([leagueGroup()], {showPointsPercentage: true});
      clickSort('.pctg-header');
      // Every team played 82 games, so ties like Tampa Bay and Montreal (106 points) stay in the NHL's order
      expect(abbrevs()).toEqual(nhlOrder);
      expect(abbrevs().slice(4, 6)).toEqual(['TBL', 'MTL']);
    });

    it('should sort each group on its own', () => {
      const metropolitan = divisionGroup('Metropolitan');
      const rangers = metropolitan.teams.find(standingsTeam => standingsTeam.teamAbbrev.default === 'NYR');
      rangers.pointPctg = 0.9;
      render([divisionGroup('Central'), metropolitan],
          {defaultStandingsType: NhlStandingsTypeEnum.BY_DIVISION, showPointsPercentage: true});
      clickSort('.pctg-header');
      expect(component.sortedStandings[0].teams[0].teamAbbrev.default).toBe('COL');
      expect(component.sortedStandings[1].teams[0].teamAbbrev.default).toBe('NYR');
      expect(component.sortedStandings[1].teams.length).toBe(8);
      expect(rows()[8].querySelector('.rank-cell').textContent.trim()).toBe('1');
    });

    it('should keep the sort when the standings change, and reset it when the column is turned off', () => {
      render([leagueGroupWithCarolinaBehind()], {showPointsPercentage: true});
      clickSort('.pctg-header');
      render([leagueGroupWithCarolinaBehind()]);
      expect(abbrevs()[0]).toBe('CAR');

      render([leagueGroupWithCarolinaBehind()], {showPointsPercentage: false});
      expect(component.sortColumn).toBe('points');
      expect(abbrevs()[0]).toBe('COL');
    });

    it('should format points percentages like the NHL', () => {
      expect(component.formatPointPctg(0.737805)).toBe('.738');
      expect(component.formatPointPctg(0.5)).toBe('.500');
      expect(component.formatPointPctg(0)).toBe('.000');
      expect(component.formatPointPctg(1)).toBe('1.000');
      expect(component.formatPointPctg(null)).toBe('-');
      expect(component.formatPointPctg(undefined)).toBe('-');
    });

    it('should put a team with no points percentage last', () => {
      const group = leagueGroup();
      delete group.teams[0].pointPctg;
      render([group], {showPointsPercentage: true});
      clickSort('.pctg-header');
      expect(abbrevs()[31]).toBe('COL');
      expect(cell(31, '.pctg-cell')).toBe('-');
    });
  });
});

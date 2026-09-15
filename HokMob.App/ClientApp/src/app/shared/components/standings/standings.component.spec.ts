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
    expect(cell(0, '.gd-cell')).toBe('99');
    expect(cell(0, '.form-cell')).toBe('3W');
    expect(cell(0, '.points-cell')).toBe('121');
  });

  it('should look up team IDs, logos and links from abbreviations, including Utah', () => {
    const group = leagueGroup();
    render([group]);
    const utahIndex = group.teams.findIndex(standingsTeam => standingsTeam.teamAbbrev.default === 'UTA');
    expect(component.teamIds[0][0]).toBe(21);
    expect(component.teamLogos[0][0]).toBe('assets/logos/colorado.png');
    expect(component.teamIds[0][utahIndex]).toBe(68);
    expect(component.teamLogos[0][utahIndex]).toBe('https://assets.nhle.com/logos/nhl/svg/UTA_light.svg');
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

  it('should show common names and hide record columns in mini standings', () => {
    render([leagueGroup()], {miniStandings: true, showFormAndNext: false});
    expect(fixture.nativeElement.querySelector('.standings-type-container')).toBeNull();
    expect(cell(0, '.team-name-text')).toBe('Avalanche');
    expect(rows()[0].querySelector('.wins-cell')).toBeNull();
    expect(rows()[0].querySelector('.gd-cell')).toBeNull();
    expect(rows()[0].querySelector('.form-cell')).toBeNull();
    expect(cell(0, '.points-cell')).toBe('121');
  });

  it('should highlight the selected team', () => {
    render([leagueGroup()], {selectedTeamId: 21});
    expect(rows()[0].classList).toContain('selected-row');
    expect(rows()[1].classList).not.toContain('selected-row');
    expect(component.selectedTeamColor).toBe(NhlTeamColorUtils.getTeamPrimaryColor(21));
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
    expect(component.teamLogos[0][0]).toBe('assets/logos/team_fallback.png');
    expect(cell(0, '.team-name-text')).toBe('Colorado Avalanche');
  });
});

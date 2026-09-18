import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';

import { TeamLogoComponent } from './team-logo.component';

describe('TeamLogoComponent', () => {
  let component: TeamLogoComponent;
  let fixture: ComponentFixture<TeamLogoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamLogoComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamLogoComponent);
    component = fixture.componentInstance;
  });

  function render(inputs: {[input: string]: unknown}): void {
    Object.entries(inputs).forEach(([input, value]) => fixture.componentRef.setInput(input, value));
    fixture.detectChanges();
  }

  function image(): HTMLImageElement {
    return fixture.nativeElement.querySelector('img');
  }

  function host(): HTMLElement {
    return fixture.nativeElement;
  }

  it('should show the logo of the given team', () => {
    render({teamId: 6, size: 24});
    expect(image().getAttribute('src')).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(6));
    expect(image().getAttribute('alt')).toBe('');
  });

  it('should show an already resolved logo URL instead of looking one up', () => {
    render({teamId: 6, src: 'assets/logos/toronto.png'});
    expect(image().getAttribute('src')).toBe('assets/logos/toronto.png');
  });

  it('should use the local logo for Utah', () => {
    render({teamId: 68});
    expect(image().getAttribute('src')).toBe('assets/logos/utah.png');
  });

  it('should fit the logo inside a square box the size of the given size', () => {
    render({teamId: 12, size: 40});
    expect(host().style.width).toBe('40px');
    expect(host().style.height).toBe('40px');
    expect(getComputedStyle(image()).objectFit).toBe('contain');
  });

  it('should widen the box past the size when a width is given', () => {
    render({teamId: 12, size: 35, width: 46});
    expect(host().style.width).toBe('46px');
    expect(host().style.height).toBe('35px');
  });

  it('should give every team the same box whatever the shape of its crest', () => {
    // Anaheim is the widest crest at 1.79:1 and Ottawa the narrowest at 0.83:1
    const boxes = [24, 9].map(teamId => {
      render({teamId: teamId, size: 30, width: 39});
      return host().style.width + 'x' + host().style.height;
    });
    expect(boxes).toEqual(['39pxx30px', '39pxx30px']);
  });

  it('should keep the box but render no image until the team is known', () => {
    render({size: 40});
    expect(image()).toBeNull();
    expect(host().style.width).toBe('40px');
    expect(host().style.height).toBe('40px');
  });

  it('should fall back to the placeholder logo for an unknown team id', () => {
    render({teamId: 999});
    expect(image().getAttribute('src')).toBe('assets/logos/team_fallback.png');
  });
});

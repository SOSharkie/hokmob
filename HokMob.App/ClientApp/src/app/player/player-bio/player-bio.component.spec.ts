import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayerLanding } from '@shared/models/nhl-web-api/player-landing.model';
import { mockPlayerLanding } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayerBioComponent } from './player-bio.component';

describe('PlayerBioComponent', () => {
  let component: PlayerBioComponent;
  let fixture: ComponentFixture<PlayerBioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayerBioComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerBioComponent);
    component = fixture.componentInstance;
    // The ages below are the ones of 2026-09-15
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 15));
  });

  afterEach(() => {
    fixture.destroy();
    jasmine.clock().uninstall();
  });

  function show(player: PlayerLanding): void {
    fixture.componentRef.setInput('player', player);
    fixture.componentRef.setInput('countryFlagPath', player?.birthCountry ? 'assets/flags/' + player.birthCountry + '.png' : null);
    fixture.detectChanges();
  }

  /** The bio tiles as [title, value]. */
  function items(): string[][] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.bio-item')).map(item => [
      item.querySelector('.item-title').textContent.trim(),
      item.querySelector('.item-value').textContent.trim()
    ]);
  }

  it('should show the real bio of a skater, with his draft', () => {
    show(mockPlayerLanding(8476460));
    expect(items()).toEqual([
      ['Position', 'C'],
      ['Age', '33'],
      ['Height', '6\' 3"'],
      ['Shoots', 'Right'],
      ['Country', 'CAN'],
      ['Number', '55'],
      ['Weight', '207 lb'],
      ['Draft', '2011 R1 #7 (WPG)']
    ]);
    expect(fixture.nativeElement.querySelector('.country-flag').getAttribute('src')).toBe('assets/flags/CAN.png');
  });

  it('should say Catches for a goalie', () => {
    show(mockPlayerLanding(8476945));
    expect(items()[3]).toEqual(['Catches', 'Left']);
    expect(items()[0]).toEqual(['Position', 'G']);
    // Hellebuyck is 6' 4", 1993-05-19
    expect(items()[2]).toEqual(['Height', '6\' 4"']);
    expect(items()[1]).toEqual(['Age', '33']);
  });

  it('should show the draft of a player drafted in a later round', () => {
    show(mockPlayerLanding(8477964));
    expect(items()[7]).toEqual(['Draft', '2014 R2 #33 (STL)']);
    expect(items()[2]).toEqual(['Height', '6\' 0"']);
  });

  it('should say Undrafted for a player without draft details', () => {
    const player = mockPlayerLanding(8476460);
    delete player.draftDetails;
    show(player);
    expect(items()[7]).toEqual(['Draft', 'Undrafted']);
  });

  it('should show dashes and no flag before the player is loaded', () => {
    show(null);
    expect(items().map(item => item[1])).toEqual(['-', '-', '-', '-', '-', '-', '-', 'Undrafted']);
    expect(fixture.nativeElement.querySelector('.country-flag')).toBeNull();
  });
});

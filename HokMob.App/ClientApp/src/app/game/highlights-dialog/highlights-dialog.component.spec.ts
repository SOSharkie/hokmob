import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlVideoUtils } from '@shared/utils/nhl-video-utils';
import { mockPlayoffGame } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { HighlightsDialogComponent, HighlightsDialogData } from './highlights-dialog.component';

describe('HighlightsDialogComponent', () => {
  let component: HighlightsDialogComponent;
  let fixture: ComponentFixture<HighlightsDialogComponent>;
  let close: jasmine.Spy;

  beforeEach(async () => {
    close = jasmine.createSpy('close');
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ HighlightsDialogComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();
    TestBed.overrideProvider(MatDialogRef, {useValue: {close}});
  });

  function show(data: HighlightsDialogData): void {
    TestBed.overrideProvider(MAT_DIALOG_DATA, {useValue: data});
    fixture = TestBed.createComponent(HighlightsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function element(selector: string): any {
    return fixture.nativeElement.querySelector(selector);
  }

  function tabs(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.video-tab'));
  }

  /** The videos of 2025030414 (CAR @ VGK), from the real score response. */
  function realGameData(): HighlightsDialogData {
    return {videos: NhlVideoUtils.getHighlightVideos(mockPlayoffGame()), subtitle: 'CAR at VGK'};
  }

  it('should play the recap of a real game first', () => {
    show(realGameData());
    expect(element('.highlights-subtitle').textContent).toBe('CAR at VGK');
    expect(tabs().map(tab => tab.textContent.trim())).toEqual(['Recap', 'Condensed Game']);
    expect(tabs()[0].classList).toContain('selected');
    expect(element('.video-frame').getAttribute('src')).toBe(
        'https://players.brightcove.net/6415718365001/D3UCGynRWU_default/index.html?videoId=6398034433112&autoplay=true');
    expect(element('.nhl-link').getAttribute('href')).toBe('https://www.nhl.com/video/car-at-vgk-recap-6398034433112');
  });

  it('should switch to the condensed game when its tab is clicked', () => {
    show(realGameData());
    tabs()[1].click();
    fixture.detectChanges();
    expect(tabs()[1].classList).toContain('selected');
    expect(element('.video-frame').getAttribute('src')).toContain('videoId=6398034955112');
    expect(element('.nhl-link').getAttribute('href'))
        .toBe('https://www.nhl.com/video/car-at-vgk-condensed-game-6398034955112');
  });

  it('should keep the player URL when the selected tab is clicked again', () => {
    show(realGameData());
    const embedUrl = component.embedUrl;
    tabs()[0].click();
    fixture.detectChanges();
    expect(component.embedUrl).toBe(embedUrl);
  });

  it('should hide the tabs with only one video', () => {
    const data = realGameData();
    data.videos = data.videos.slice(1);
    show(data);
    expect(tabs().length).toBe(0);
    expect(element('.video-frame').getAttribute('src')).toContain('videoId=6398034955112');
  });

  it('should show no player without videos', () => {
    show({videos: [], subtitle: ''});
    expect(element('.video-frame')).toBeNull();
    expect(element('.nhl-link')).toBeNull();
  });

  it('should close when the close button is clicked', () => {
    show(realGameData());
    element('.close-button').click();
    expect(close).toHaveBeenCalled();
  });
});

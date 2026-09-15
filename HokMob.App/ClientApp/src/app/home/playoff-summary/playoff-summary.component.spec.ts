import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayoffCarousel } from '@shared/models/nhl-web-api/playoffs.model';
import { DateTimeUtils } from '@shared/utils/date-time-utils';
import { mockPlayoffBracket, mockPlayoffCarousel } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayoffSummaryComponent } from './playoff-summary.component';

describe('PlayoffSummaryComponent', () => {
  let component: PlayoffSummaryComponent;
  let fixture: ComponentFixture<PlayoffSummaryComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayoffSummaryComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    spyOn(DateTimeUtils, 'getCurrentNhlSeason').and.returnValue('20252026');
    spyOn(console, 'error');
    fixture = TestBed.createComponent(PlayoffSummaryComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Loads the playoffs, answering the carousel request with the given carousel, or with an error for null. */
  async function load(carousel: PlayoffCarousel | null = mockPlayoffCarousel()): Promise<void> {
    fixture.detectChanges();
    const carouselRequest = httpMock.expectOne('/api/nhl/playoff-series/carousel/20252026/');
    if (carousel) {
      carouselRequest.flush(carousel);
    } else {
      carouselRequest.flush('Not found', {status: 404, statusText: 'Not Found'});
    }
    httpMock.expectOne('/api/nhl/playoff-bracket/2026').flush(mockPlayoffBracket());
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function title(): string {
    return fixture.nativeElement.querySelector('.playoffs-title').textContent.trim();
  }

  function seriesCards(): any[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-playoff-series'));
  }

  it('should show the current round title and its series as small cards', async () => {
    await load();
    expect(title()).toBe('Playoffs: Stanley Cup Final');
    expect(seriesCards().length).toBe(1);
    const finalCard = seriesCards()[0];
    expect(finalCard.seriesData.seriesLetter).toBe('O');
    expect(finalCard.seriesData.topSeed.rank).toBe(1);
    expect(finalCard.season).toBe(20252026);
    expect(finalCard.smallerVersion).toBeTrue();
  });

  it('should turn earlier round labels into titles', async () => {
    const carousel = mockPlayoffCarousel();
    carousel.currentRound = 1;
    await load(carousel);
    expect(title()).toBe('Playoffs: 1st Round');
    expect(seriesCards().length).toBe(8);

    component.playoffsData.currentRound = 3;
    fixture.detectChanges();
    expect(title()).toBe('Playoffs: Conference Finals');
    expect(seriesCards().length).toBe(2);
  });

  it('should find the current round by round number, not position', async () => {
    const carousel = mockPlayoffCarousel();
    carousel.rounds.reverse();
    await load(carousel);
    expect(title()).toBe('Playoffs: Stanley Cup Final');
  });

  it('should show a plain title when the current round is not listed yet', async () => {
    const carousel = mockPlayoffCarousel();
    carousel.rounds = carousel.rounds.slice(0, 3);
    await load(carousel);
    expect(title()).toBe('Playoffs');
    expect(seriesCards().length).toBe(0);
  });

  it('should show a plain title and no series when the carousel fails', async () => {
    await load(null);
    expect(title()).toBe('Playoffs');
    expect(seriesCards().length).toBe(0);
  });

  it('should link the title to the playoffs page', async () => {
    await load();
    const routerLink = fixture.debugElement.query(By.css('.playoffs-title')).injector.get(RouterLink);
    expect(routerLink.urlTree.toString()).toBe('/playoffs');
  });
});

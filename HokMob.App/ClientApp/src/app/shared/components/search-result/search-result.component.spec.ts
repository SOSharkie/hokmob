import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { SearchResultModel } from '@shared/models/search-result.model';
import { NhlSearchService } from '@shared/services/nhl-search.service';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import { NhlPlayerHeadshotUtils } from '@shared/utils/nhl-player-headshot-utils';
import { mockPlayerSearchResults } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { SearchResultComponent } from './search-result.component';

describe('SearchResultComponent', () => {
  let component: SearchResultComponent;
  let fixture: ComponentFixture<SearchResultComponent>;
  let searchService: NhlSearchService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ SearchResultComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    searchService = TestBed.inject(NhlSearchService);
    fixture = TestBed.createComponent(SearchResultComponent);
    component = fixture.componentInstance;
  });

  /** The real player results, converted by the service. */
  async function playerResults(): Promise<SearchResultModel[]> {
    const httpMock = TestBed.inject(HttpTestingController);
    const search = searchService.searchPlayers('mac');
    httpMock.expectOne(() => true).flush(mockPlayerSearchResults());
    return search;
  }

  function render(searchResult: SearchResultModel): void {
    fixture.componentRef.setInput('searchResult', searchResult);
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.trim();
  }

  it('should show a team with its logo and link', () => {
    const [bruins] = searchService.searchTeams('bos');
    render(bruins);
    expect(component.isTeam).toBeTrue();
    expect(component.isPlayer).toBeFalse();
    expect(text('.result-text')).toBe('Boston Bruins');
    expect(fixture.nativeElement.querySelector('.team-logo').getAttribute('src'))
        .toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(6));
    expect(fixture.nativeElement.querySelector('.player-headshot')).toBeNull();
    expect(fixture.nativeElement.querySelector('[ng-reflect-router-link]').getAttribute('ng-reflect-router-link'))
        .toBe('team/6');
  });

  it('should show a player with their headshot and position', async () => {
    const results = await playerResults();
    render(results[1]);
    expect(component.isPlayer).toBeTrue();
    expect(text('.result-text')).toBe('Macklin Celebrini');
    expect(text('.result-detail')).toBe('C');
    expect(fixture.nativeElement.querySelector('.player-headshot').getAttribute('src'))
        .toBe('https://assets.nhle.com/mugs/nhl/20262027/SJS/8484801.png');
    expect(fixture.nativeElement.querySelector('.team-logo')).toBeNull();
    expect(fixture.nativeElement.querySelector('[ng-reflect-router-link]').getAttribute('ng-reflect-router-link'))
        .toBe('player/8484801');
  });

  it('should show the blank headshot for a player who has not played a game', async () => {
    const machu = (await playerResults()).find(result => result.displayValue === 'Tomas Machu');
    render(machu);
    expect(fixture.nativeElement.querySelector('.player-headshot').getAttribute('src'))
        .toBe(NhlPlayerHeadshotUtils.blankHeadshot);
  });

  it('should fall back to the blank headshot when the image fails to load', async () => {
    render((await playerResults())[1]);
    const image: HTMLImageElement = fixture.nativeElement.querySelector('.player-headshot');
    image.dispatchEvent(new Event('error'));
    expect(image.src).toContain(NhlPlayerHeadshotUtils.blankHeadshot);
  });

  it('should render nothing inside the link without a result type', () => {
    render(new SearchResultModel());
    expect(fixture.nativeElement.querySelector('.search-result-container')).toBeNull();
  });
});

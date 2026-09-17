import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { registerLucideIcons } from '@shared/icons/lucide-icons';
import { SearchResultTypeEnum } from '@shared/enums/search-result-type.enum';
import { mockPlayerSearchResults } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { SearchInputComponent } from './search-input.component';

describe('SearchInputComponent', () => {
  let component: SearchInputComponent;
  let fixture: ComponentFixture<SearchInputComponent>;
  let httpMock: HttpTestingController;

  const playerSearchUrl = '/api/nhl-search/player';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ SearchInputComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    registerLucideIcons(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
    spyOn(console, 'error');
    fixture = TestBed.createComponent(SearchInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Types a value and waits for the debounce. */
  function type(value: string): void {
    component.searchValue = value;
    component.onInput();
    tick(component.doneTypingInterval);
  }

  function playerRequests() {
    return httpMock.match(request => request.url.startsWith(playerSearchUrl));
  }

  function names(): string[] {
    return component.filterResults.map(result => result.displayValue);
  }

  it('should make no request on load', () => {
    expect(playerRequests().length).toBe(0);
    expect(component.filterResults).toEqual([]);
  });

  it('should wait until the user stops typing before searching', fakeAsync(() => {
    component.searchValue = 'ma';
    component.onInput();
    tick(300);
    component.searchValue = 'mac';
    component.onInput();
    tick(300);
    expect(playerRequests().length).toBe(0);

    tick(200);
    const requests = playerRequests();
    expect(requests.length).toBe(1);
    expect(requests[0].request.urlWithParams).toBe(playerSearchUrl + '?q=mac&limit=10&active=true');
    requests[0].flush(mockPlayerSearchResults());
    flushMicrotasks();

    expect(component.filterResults.length).toBe(10);
    expect(names()[0]).toBe('Mackenzie Blackwood');
    fixture.destroy();
  }));

  it('should search when the input changes, also without key events (a paste)', fakeAsync(() => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.search-input');
    input.value = 'bos';
    input.dispatchEvent(new Event('input'));
    tick(component.doneTypingInterval);

    expect(component.searchValue).toBe('bos');
    const requests = playerRequests();
    expect(requests.length).toBe(1);
    expect(requests[0].request.urlWithParams).toBe(playerSearchUrl + '?q=bos&limit=9&active=true');
    requests[0].flush([]);
    flushMicrotasks();
    expect(names()).toEqual(['Boston Bruins']);
    fixture.destroy();
  }));

  it('should not search for fewer than 2 characters, and clear the results', fakeAsync(() => {
    type('mac');
    playerRequests()[0].flush(mockPlayerSearchResults());
    flushMicrotasks();
    expect(component.filterResults.length).toBe(10);

    type('m');
    expect(playerRequests().length).toBe(0);
    expect(component.filterResults).toEqual([]);

    type('  ');
    expect(playerRequests().length).toBe(0);
  }));

  it('should show teams first, then players, 10 results in total', fakeAsync(() => {
    type('new');
    expect(names()).toEqual(['New Jersey Devils', 'New York Islanders', 'New York Rangers']);
    const requests = playerRequests();
    expect(requests[0].request.urlWithParams).toBe(playerSearchUrl + '?q=new&limit=7&active=true');

    requests[0].flush(mockPlayerSearchResults());
    flushMicrotasks();
    expect(component.filterResults.length).toBe(10);
    expect(component.filterResults.slice(0, 3).every(result => result.resultType === SearchResultTypeEnum.TEAM))
        .toBeTrue();
    expect(component.filterResults.slice(3).every(result => result.resultType === SearchResultTypeEnum.PLAYER))
        .toBeTrue();
    expect(names()[3]).toBe('Mackenzie Blackwood');
  }));

  it('should show a team match without players when nothing else matches', fakeAsync(() => {
    type('bos');
    playerRequests()[0].flush([]);
    flushMicrotasks();
    expect(names()).toEqual(['Boston Bruins']);
  }));

  it('should show no results for a query that matches nothing', fakeAsync(() => {
    type('zz');
    playerRequests()[0].flush([]);
    flushMicrotasks();
    expect(component.filterResults).toEqual([]);
  }));

  it('should ignore a late response of an older query', fakeAsync(() => {
    type('mac');
    const macRequest = playerRequests()[0];
    type('bos');
    const bosRequest = playerRequests()[0];

    bosRequest.flush([]);
    flushMicrotasks();
    macRequest.flush(mockPlayerSearchResults());
    flushMicrotasks();
    expect(names()).toEqual(['Boston Bruins']);
  }));

  it('should ignore a late response once the query got too short', fakeAsync(() => {
    type('mac');
    const macRequest = playerRequests()[0];
    type('m');
    macRequest.flush(mockPlayerSearchResults());
    flushMicrotasks();
    expect(component.filterResults).toEqual([]);
  }));

  it('should keep the team matches when the player search fails', fakeAsync(() => {
    type('bos');
    playerRequests()[0].flush('Bad Gateway', {status: 502, statusText: 'Bad Gateway'});
    flushMicrotasks();
    expect(names()).toEqual(['Boston Bruins']);
    expect(console.error).toHaveBeenCalledTimes(1);
  }));

  it('should clear the value and results, and close the results panel', fakeAsync(() => {
    type('mac');
    playerRequests()[0].flush(mockPlayerSearchResults());
    flushMicrotasks();
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.search-input');
    input.dispatchEvent(new Event('focusin'));
    fixture.detectChanges();
    expect(component.autocompleteTrigger.panelOpen).toBeTrue();

    component.clear();
    fixture.detectChanges();
    expect(component.searchValue).toBe('');
    expect(component.filterResults).toEqual([]);
    expect(component.autocompleteTrigger.panelOpen).toBeFalse();
    discardPeriodicTasks();
    fixture.destroy();
  }));

  it('should ignore a search still in flight when cleared', fakeAsync(() => {
    type('mac');
    const macRequest = playerRequests()[0];
    component.clear();
    macRequest.flush(mockPlayerSearchResults());
    flushMicrotasks();
    expect(component.filterResults).toEqual([]);
  }));

  it('should cancel a pending search when cleared', fakeAsync(() => {
    component.searchValue = 'mac';
    component.onInput();
    component.clear();
    tick(component.doneTypingInterval);
    expect(playerRequests().length).toBe(0);
  }));

  it('should focus the input', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.search-input');
    component.focus();
    expect(document.activeElement).toBe(input);
  });

  it('should emit resultSelected when a result is picked', () => {
    const emitted = jasmine.createSpy('resultSelected');
    component.resultSelected.subscribe(emitted);
    fixture.debugElement.query(element => element.name === 'mat-autocomplete')
        .triggerEventHandler('optionSelected', {});
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('should render a search result for each match', fakeAsync(() => {
    type('bos');
    playerRequests()[0].flush(mockPlayerSearchResults().slice(0, 2));
    flushMicrotasks();
    fixture.detectChanges();
    // The autocomplete panel only renders its options while open
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.search-input');
    input.dispatchEvent(new Event('focusin'));
    fixture.detectChanges();
    const results = Array.from(document.querySelectorAll('app-search-result')) as any[];
    expect(results.map(result => result.searchResult.displayValue))
        .toEqual(['Boston Bruins', 'Mackenzie Blackwood', 'Macklin Celebrini']);
    discardPeriodicTasks();
    fixture.destroy();
  }));
});

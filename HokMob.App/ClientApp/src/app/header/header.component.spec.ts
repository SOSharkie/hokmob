import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { LUCIDE_ICONS, registerLucideIcons } from '@shared/icons/lucide-icons';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';

import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let searchInput: jasmine.SpyObj<SearchInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ HeaderComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    spyOn(console, 'error');
    registerLucideIcons(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // The search input isn't declared, so stand in for it
    searchInput = jasmine.createSpyObj<SearchInputComponent>('SearchInputComponent', ['focus', 'clear']);
    component.searchInput = searchInput;
  });

  function header(): HTMLElement {
    return fixture.nativeElement.querySelector('.main-header');
  }

  it('should link the logo home and the menu to the about page', () => {
    expect(fixture.nativeElement.querySelector('.site-name').textContent.trim()).toBe('HOKMOB');
    expect(fixture.nativeElement.querySelector('.site-name').getAttribute('href')).toBe('/');
    const menuItems = Array.from(fixture.nativeElement.querySelectorAll('.header-menu .menu-item')) as HTMLElement[];
    expect(menuItems.map(item => item.textContent.trim())).toEqual(['About']);
    expect(menuItems[0].getAttribute('href')).toBe('/about');
  });

  it('should start with the phone search closed', () => {
    expect(component.isSearchOpen).toBeFalse();
    expect(header().classList).not.toContain('search-open');
  });

  it('should open the phone search from the search icon and focus the input', fakeAsync(() => {
    fixture.nativeElement.querySelector('.open-search-button').click();
    fixture.detectChanges();
    expect(header().classList).toContain('search-open');

    tick();
    expect(searchInput.focus).toHaveBeenCalledTimes(1);
  }));

  it('should close and clear the phone search on Cancel', () => {
    component.isSearchOpen = true;
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.cancel-search-button').click();
    fixture.detectChanges();
    expect(header().classList).not.toContain('search-open');
    expect(searchInput.clear).toHaveBeenCalledTimes(1);
  });

  it('should close the phone search when a result is picked', () => {
    component.isSearchOpen = true;
    fixture.detectChanges();

    fixture.nativeElement.querySelector('app-search-input').dispatchEvent(new CustomEvent('resultSelected'));
    fixture.detectChanges();
    expect(header().classList).not.toContain('search-open');
    expect(searchInput.clear).not.toHaveBeenCalled();
  });

  it('should use bundled Lucide icons', () => {
    const icons = Array.from(fixture.nativeElement.querySelectorAll('mat-icon')) as HTMLElement[];
    expect(icons.length).toBe(2);
    icons.forEach(icon => {
      const name = icon.getAttribute('svgIcon') ?? icon.getAttribute('ng-reflect-svg-icon');
      expect(LUCIDE_ICONS[name.replace('lucide:', '')]).withContext(name).toBeDefined();
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});

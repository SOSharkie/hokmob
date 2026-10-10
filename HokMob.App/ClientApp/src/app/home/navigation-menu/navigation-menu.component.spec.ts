import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LUCIDE_ICONS, registerLucideIcons } from '@shared/icons/lucide-icons';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

import { NavigationMenuComponent } from './navigation-menu.component';

describe('NavigationMenuComponent', () => {
  let component: NavigationMenuComponent;
  let fixture: ComponentFixture<NavigationMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ NavigationMenuComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    registerLucideIcons(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
    fixture = TestBed.createComponent(NavigationMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /** The menu's links, by their text. */
  function menuLinks(): Map<string, HTMLAnchorElement> {
    const links = Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('a.nav-menu-item'));
    return new Map(links.map(link => [link.querySelector('.nav-menu-text').textContent.trim(), link]));
  }

  it('should link the Draft menu item to the draft page', () => {
    expect(menuLinks().get('Draft').getAttribute('href')).toBe('/draft');
  });

  it('should show a History menu item under Stats that links to the history page', () => {
    const names = Array.from(menuLinks().keys());

    expect(names.indexOf('History')).toBe(names.indexOf('Stats') + 1);
    expect(menuLinks().get('History').getAttribute('href')).toBe('/history');
  });

  it('should render every menu item as a link with an href, so it can be reached from the keyboard', () => {
    const links = menuLinks();

    expect(links.size).toBe(component.navMenuItems.length);
    expect(links.get('Standings').getAttribute('href')).toBe('/standings');
    expect(links.get('Stats').getAttribute('href')).toBe('/stats');
    expect(links.get('Teams').getAttribute('href')).toBe('/standings');
  });

  it('should link News to the external page', () => {
    expect(menuLinks().get('News').getAttribute('href')).toBe('https://www.reddit.com/r/hockey/');
  });

  it('should use a bundled Lucide icon for every menu item', () => {
    for (const menuItem of component.navMenuItems) {
      expect(component.getSvgIcon(menuItem)).toBe(`lucide:${menuItem.iconName}`);
      expect(LUCIDE_ICONS[menuItem.iconName]).withContext(menuItem.iconName).toBeDefined();
    }
  });
});

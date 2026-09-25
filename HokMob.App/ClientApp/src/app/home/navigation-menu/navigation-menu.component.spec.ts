import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LUCIDE_ICONS } from '@shared/icons/lucide-icons';
import { AppTestingModule } from '@shared/testing/app-testing.module';

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

    fixture = TestBed.createComponent(NavigationMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show a Draft menu item that navigates to the draft page', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    const draftItem = component.navMenuItems.find(item => item.name === 'Draft');
    const menuTexts = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.nav-menu-text'))
      .map(el => el.textContent.trim());

    expect(menuTexts).toContain('Draft');
    component.onClickMenuItem(draftItem);
    expect(navigateSpy).toHaveBeenCalledWith(['draft']);
  });

  it('should show a History menu item under Stats that navigates to the history page', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    const menuTexts = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.nav-menu-text'))
      .map(el => el.textContent.trim());

    expect(menuTexts.indexOf('History')).toBe(menuTexts.indexOf('Stats') + 1);
    component.onClickMenuItem(component.navMenuItems.find(item => item.name === 'History'));
    expect(navigateSpy).toHaveBeenCalledWith(['history']);
  });

  it('should use a bundled Lucide icon for every menu item', () => {
    for (const menuItem of component.navMenuItems) {
      expect(component.getSvgIcon(menuItem)).toBe(`lucide:${menuItem.iconName}`);
      expect(LUCIDE_ICONS[menuItem.iconName]).withContext(menuItem.iconName).toBeDefined();
    }
  });
});

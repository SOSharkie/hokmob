import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';

import { AboutComponent } from './about.component';

describe('AboutComponent', () => {
  let component: AboutComponent;
  let fixture: ComponentFixture<AboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ AboutComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  it('should show the headline, story and a card per feature', () => {
    expect(text('.about-headline')).toBe('A cleaner way to follow the NHL.');
    expect(text('.about-story')).toContain('Sean Odnert');
    const cards = fixture.nativeElement.querySelectorAll('.feature-card');
    expect(cards.length).toBe(component.features.length);
    expect(text('.feature-card .feature-title')).toBe('Live scores');
  });

  it('should link the contact email', () => {
    const contact = fixture.nativeElement.querySelector('.contact-button');
    expect(contact.getAttribute('href')).toBe('mailto:SOSharkie@gmail.com');
    expect(contact.textContent.trim()).toBe('SOSharkie@gmail.com');
  });

  it('should show the non-commercial disclaimer as its own paragraph', () => {
    const disclaimer: HTMLElement = fixture.nativeElement.querySelector('p.about-disclaimer');
    expect(disclaimer.textContent).toContain('non-commercial fan project');
    expect(disclaimer.textContent).toContain('not affiliated with or endorsed by the NHL');
    expect(disclaimer.closest('section')).toBeNull();
  });
});

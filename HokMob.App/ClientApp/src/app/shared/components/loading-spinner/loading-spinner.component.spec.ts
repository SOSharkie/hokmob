import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';

import { LoadingSpinnerComponent } from './loading-spinner.component';

describe('LoadingSpinnerComponent', () => {
  let fixture: ComponentFixture<LoadingSpinnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ LoadingSpinnerComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoadingSpinnerComponent);
  });

  function host(): HTMLElement {
    return fixture.nativeElement;
  }

  it('should draw the track and the arc', () => {
    fixture.detectChanges();
    expect(host().querySelector('svg .track')).not.toBeNull();
    expect(host().querySelector('svg .arc')).not.toBeNull();
  });

  it('should be 56px square by default', () => {
    fixture.detectChanges();
    expect(host().style.width).toBe('56px');
    expect(host().style.height).toBe('56px');
  });

  it('should take the given size', () => {
    fixture.componentRef.setInput('size', 40);
    fixture.detectChanges();
    expect(host().style.width).toBe('40px');
    expect(host().style.height).toBe('40px');
  });

  it('should tell screen readers that something is loading', () => {
    fixture.detectChanges();
    expect(host().getAttribute('role')).toBe('progressbar');
    expect(host().getAttribute('aria-label')).toBe('Loading');
    expect(host().querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });
});

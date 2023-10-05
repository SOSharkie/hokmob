import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StandingsSummaryComponent } from './standings-summary.component';

describe('StandingsSummaryComponent', () => {
  let component: StandingsSummaryComponent;
  let fixture: ComponentFixture<StandingsSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StandingsSummaryComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StandingsSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

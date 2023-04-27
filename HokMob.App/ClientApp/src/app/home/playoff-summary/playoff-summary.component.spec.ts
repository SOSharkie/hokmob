import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayoffSummaryComponent } from './playoff-summary.component';

describe('PlayoffSummaryComponent', () => {
  let component: PlayoffSummaryComponent;
  let fixture: ComponentFixture<PlayoffSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlayoffSummaryComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayoffSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

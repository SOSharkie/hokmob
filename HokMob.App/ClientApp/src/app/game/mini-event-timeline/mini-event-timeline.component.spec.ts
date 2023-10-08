import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MiniEventTimelineComponent } from './mini-event-timeline.component';

describe('MiniEventTimelineComponent', () => {
  let component: MiniEventTimelineComponent;
  let fixture: ComponentFixture<MiniEventTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MiniEventTimelineComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MiniEventTimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalScorersComponent } from './goal-scorers.component';

describe('GoalScorersComponent', () => {
  let component: GoalScorersComponent;
  let fixture: ComponentFixture<GoalScorersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GoalScorersComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoalScorersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

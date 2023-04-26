import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatLeaderboardComponent } from './stat-leaderboard.component';

describe('StatLeaderboardComponent', () => {
  let component: StatLeaderboardComponent;
  let fixture: ComponentFixture<StatLeaderboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StatLeaderboardComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatLeaderboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

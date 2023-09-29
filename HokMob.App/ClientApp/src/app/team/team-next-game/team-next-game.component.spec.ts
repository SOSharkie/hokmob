import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamNextGameComponent } from './team-next-game.component';

describe('TeamNextGameComponent', () => {
  let component: TeamNextGameComponent;
  let fixture: ComponentFixture<TeamNextGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TeamNextGameComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamNextGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

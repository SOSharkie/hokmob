import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerCareerComponent } from './player-career.component';

describe('PlayerCareerComponent', () => {
  let component: PlayerCareerComponent;
  let fixture: ComponentFixture<PlayerCareerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlayerCareerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerCareerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

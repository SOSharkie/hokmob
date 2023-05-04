import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerGameDialogComponent } from './player-game-dialog.component';

describe('PlayerGameDialogComponent', () => {
  let component: PlayerGameDialogComponent;
  let fixture: ComponentFixture<PlayerGameDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlayerGameDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerGameDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

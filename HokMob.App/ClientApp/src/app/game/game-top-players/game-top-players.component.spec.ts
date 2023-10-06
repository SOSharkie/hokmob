import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameTopPlayersComponent } from './game-top-players.component';

describe('GameTopPlayersComponent', () => {
  let component: GameTopPlayersComponent;
  let fixture: ComponentFixture<GameTopPlayersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GameTopPlayersComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameTopPlayersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameHeaderComponent } from './game-header.component';

describe('DropdownHeaderComponent', () => {
  let component: GameHeaderComponent;
  let fixture: ComponentFixture<GameHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GameHeaderComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

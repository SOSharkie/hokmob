import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreviousGameComponent } from './previous-game.component';

describe('PreviousGameComponent', () => {
  let component: PreviousGameComponent;
  let fixture: ComponentFixture<PreviousGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PreviousGameComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreviousGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

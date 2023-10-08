import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MiniEventComponent } from './mini-event.component';

describe('MiniEventComponent', () => {
  let component: MiniEventComponent;
  let fixture: ComponentFixture<MiniEventComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MiniEventComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MiniEventComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

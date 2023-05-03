import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MomentumComponent } from './momentum.component';

describe('MomentumComponent', () => {
  let component: MomentumComponent;
  let fixture: ComponentFixture<MomentumComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MomentumComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MomentumComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

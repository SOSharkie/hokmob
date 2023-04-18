import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayoffSeriesComponent } from './playoff-series.component';

describe('PlayoffSeriesComponent', () => {
  let component: PlayoffSeriesComponent;
  let fixture: ComponentFixture<PlayoffSeriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlayoffSeriesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayoffSeriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

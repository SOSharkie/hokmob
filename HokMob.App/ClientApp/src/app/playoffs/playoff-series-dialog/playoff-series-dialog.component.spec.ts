import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayoffSeriesDialogComponent } from './playoff-series-dialog.component';

describe('PlayoffSeriesDialogComponent', () => {
  let component: PlayoffSeriesDialogComponent;
  let fixture: ComponentFixture<PlayoffSeriesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlayoffSeriesDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayoffSeriesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

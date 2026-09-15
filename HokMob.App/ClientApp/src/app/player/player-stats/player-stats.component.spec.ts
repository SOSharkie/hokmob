import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';

import { PlayerStatsComponent } from './player-stats.component';

describe('PlayerStatsComponent', () => {
  let component: PlayerStatsComponent;
  let fixture: ComponentFixture<PlayerStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayerStatsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerStatsComponent);
    component = fixture.componentInstance;
    // Not rendered: the template needs input data in the old NHL API models. Render it with test data once
    // this component is migrated (see docs/nhl-api-migration-plan.md).
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

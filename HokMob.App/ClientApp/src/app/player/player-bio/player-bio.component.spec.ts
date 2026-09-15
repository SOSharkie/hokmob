import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';

import { PlayerBioComponent } from './player-bio.component';

describe('PlayerBioComponent', () => {
  let component: PlayerBioComponent;
  let fixture: ComponentFixture<PlayerBioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayerBioComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerBioComponent);
    component = fixture.componentInstance;
    // Not rendered: the template needs input data in the old NHL API models. Render it with test data once
    // this component is migrated (see docs/nhl-api-migration-plan.md).
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

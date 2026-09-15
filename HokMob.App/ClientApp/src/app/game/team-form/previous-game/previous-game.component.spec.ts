import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';

import { PreviousGameComponent } from './previous-game.component';

describe('PreviousGameComponent', () => {
  let component: PreviousGameComponent;
  let fixture: ComponentFixture<PreviousGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PreviousGameComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreviousGameComponent);
    component = fixture.componentInstance;
    // Not rendered: the template needs input data in the old NHL API models. Render it with test data once
    // this component is migrated (see docs/nhl-api-migration-plan.md).
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

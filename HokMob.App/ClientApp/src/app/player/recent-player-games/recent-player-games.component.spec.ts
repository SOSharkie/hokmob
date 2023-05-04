import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecentPlayerGamesComponent } from './recent-player-games.component';

describe('RecentPlayerGamesComponent', () => {
  let component: RecentPlayerGamesComponent;
  let fixture: ComponentFixture<RecentPlayerGamesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RecentPlayerGamesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecentPlayerGamesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

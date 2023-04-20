import {Component, OnInit} from '@angular/core';
import {NhlPlayoffService} from "@shared/services/nhl-playoff.service";
import {NhlPlayoffModel} from "@shared/models/nhl-playoffs/nhl-playoff.model";

@Component({
  selector: 'app-playoffs',
  templateUrl: './playoffs.component.html',
  styleUrls: ['./playoffs.component.scss']
})
export class PlayoffsComponent implements OnInit {

  public playoffsData: NhlPlayoffModel;

  constructor(private nhlPlayoffService: NhlPlayoffService) {
  }

  public ngOnInit(): void {
    this.nhlPlayoffService.getNhlPlayoffs().then(result => {
      this.playoffsData = result;
    })
  }
}

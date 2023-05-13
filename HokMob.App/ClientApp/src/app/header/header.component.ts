import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { ThemeEnum } from '@shared/enums/theme.enum';
import { ThemeService } from '@shared/services/theme/theme.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements AfterViewInit {
  @ViewChild('lightModeSwitchInput') lightModeSwitchInput?: ElementRef;
  
  constructor(private themeService: ThemeService){

  }

  ngAfterViewInit() {
    this.initDarkModeSwitchInput();
  }

  lightModeSwitch(checked: boolean): void {
    this.themeService.setTheme(checked ? ThemeEnum.Light : ThemeEnum.Default);
  }

  private initDarkModeSwitchInput() {
    if (this.lightModeSwitchInput && this.themeService.getThemeFromStorage() == ThemeEnum.Light) {
      this.lightModeSwitchInput.nativeElement.setAttribute('checked', '');
    }
  }
}

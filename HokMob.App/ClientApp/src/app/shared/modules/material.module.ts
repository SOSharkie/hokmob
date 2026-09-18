import { NgModule } from '@angular/core';

import { MatNativeDateModule } from "@angular/material/core";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatMenuModule } from '@angular/material/menu';

const materialModule = [
  MatToolbarModule,
  MatInputModule,
  MatIconModule,
  MatNativeDateModule,
  MatDatepickerModule,
  MatMenuModule
]

@NgModule({
  imports: [ materialModule ],
  exports: [ materialModule ]
})
export class MaterialModule { }

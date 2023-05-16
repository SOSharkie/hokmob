import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'savePercentage'})
export class SavePercentagePipe implements PipeTransform {
  public transform(value: number): string {
    if (value === null || value === undefined) {
      return "N/A";
    } else if (value === 1) {
      return "1.000";
    }
    return value.toFixed(3).slice(1);
  }
}

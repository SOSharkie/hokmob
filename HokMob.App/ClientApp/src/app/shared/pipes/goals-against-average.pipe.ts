import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'goalsAgainstAverage',
    standalone: false
})
export class GoalsAgainstAveragePipe implements PipeTransform {
  public transform(value: number): string {
    if (value === null || value === undefined) {
      return "N/A";
    }
    return value.toFixed(2)
  }
}

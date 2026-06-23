import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss']
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: number | string = 0;
  @Input() icon: string = 'analytics';
  @Input() color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' = 'blue';
}

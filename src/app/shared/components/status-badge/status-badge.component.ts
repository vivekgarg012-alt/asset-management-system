import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.component.html',
  styleUrls: ['./status-badge.component.scss']
})
export class StatusBadgeComponent {
  @Input() status: string = '';
  @Input() showIcon: boolean = true;

  getBadgeClass(): string {
    const s = this.status.toLowerCase();
    if (s.includes('approve') || s.includes('active') || s.includes('complete') || s.includes('available')) return 'badge-approved';
    if (s.includes('pending') || s.includes('progress') || s.includes('draft') || s.includes('fair')) return 'badge-pending';
    if (s.includes('reject') || s.includes('cancel') || s.includes('poor') || s.includes('damage') || s.includes('retire')) return 'badge-rejected';
    if (s.includes('allocate') || s.includes('repair')) return 'badge-info';
    return 'badge-purple';
  }

  getIcon(): string {
    const s = this.status.toLowerCase();
    if (s.includes('approve') || s.includes('active') || s.includes('complete')) return 'check_circle';
    if (s.includes('pending') || s.includes('progress') || s.includes('draft')) return 'schedule';
    if (s.includes('reject') || s.includes('cancel')) return 'cancel';
    if (s.includes('available')) return 'event_available';
    if (s.includes('allocate')) return 'assignment_ind';
    if (s.includes('repair')) return 'build';
    return 'info';
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notifications: Notification[] = [
    { id: 'N001', title: 'Asset Request Submitted', message: 'Your request AR-2024-001 has been submitted successfully.', type: 'info', timestamp: '2024-12-01T10:00:00', read: false },
    { id: 'N002', title: 'Request Approved', message: 'Request AR-2024-002 has been approved by the Asset Manager.', type: 'success', timestamp: '2024-11-25T10:00:00', read: true },
    { id: 'N003', title: 'Warranty Expiring', message: 'Asset HW-LAP-001 warranty expires in 90 days.', type: 'warning', timestamp: '2024-12-10T08:00:00', read: false },
    { id: 'N004', title: 'New Allocation Ticket', message: 'You have a new asset allocation ticket assigned.', type: 'info', timestamp: '2024-12-05T14:00:00', read: false }
  ];

  private toastSubject = new BehaviorSubject<{ message: string; type: string } | null>(null);
  toast$ = this.toastSubject.asObservable();

  getNotifications(): Notification[] { return [...this.notifications]; }

  getUnreadCount(): number { return this.notifications.filter(n => !n.read).length; }

  markAsRead(id: string): void {
    const n = this.notifications.find(n => n.id === id);
    if (n) n.read = true;
  }

  markAllAsRead(): void { this.notifications.forEach(n => n.read = true); }

  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    this.toastSubject.next({ message, type });
    setTimeout(() => this.toastSubject.next(null), 4000);
  }

  addNotification(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.notifications.unshift({
      id: `N${Date.now()}`,
      title, message, type,
      timestamp: new Date().toISOString(),
      read: false
    });
  }
}

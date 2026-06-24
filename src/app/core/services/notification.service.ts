import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { AuthService } from './auth.service';

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
  private notifications: Notification[] = [];

  private notificationsSubject = new BehaviorSubject<Notification[]>(this.notifications);
  notifications$ = this.notificationsSubject.asObservable();

  private toastSubject = new BehaviorSubject<{ message: string; type: string } | null>(null);
  toast$ = this.toastSubject.asObservable();

  /** Emits whenever the user clicks/views a notification — subscribers can reload their data. */
  private notificationClickedSubject = new Subject<void>();
  notificationClicked$ = this.notificationClickedSubject.asObservable();

  /**
   * Set of "title|message" fingerprints the user has explicitly dismissed.
   * Persisted in localStorage per user so deletions survive re-login.
   */
  private dismissedKeys = new Set<string>();
  private currentUserId: string | null = null;

  constructor(private authService: AuthService) {
    this.authService.currentUser$.subscribe((user) => {
      // On logout, clear in-memory list (but keep localStorage intact)
      this.notifications = [];
      this.notificationsSubject.next([]);

      if (user) {
        // Load dismissed keys for this user from localStorage
        this.currentUserId = user.id;
        this.loadDismissedKeys(user.id);
      } else {
        this.currentUserId = null;
        this.dismissedKeys.clear();
      }
    });
  }

  // ─── localStorage helpers ────────────────────────────────────────────────────

  private storageKey(userId: string): string {
    return `ams_dismissed_notifs_${userId}`;
  }

  private loadDismissedKeys(userId: string): void {
    try {
      const raw = localStorage.getItem(this.storageKey(userId));
      this.dismissedKeys = raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch {
      this.dismissedKeys = new Set<string>();
    }
  }

  private saveDismissedKeys(): void {
    if (!this.currentUserId) return;
    try {
      localStorage.setItem(
        this.storageKey(this.currentUserId),
        JSON.stringify([...this.dismissedKeys])
      );
    } catch { /* storage quota — silently ignore */ }
  }

  private fingerprintOf(title: string, message: string): string {
    return `${title}|${message}`;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  clearNotifications(): void {
    this.notifications = [];
    this.notificationsSubject.next([]);
  }

  getNotifications(): Notification[] { return [...this.notifications]; }

  getUnreadCount(): number { return this.notifications.filter(n => !n.read).length; }

  markAsRead(id: string): void {
    const n = this.notifications.find(n => n.id === id);
    if (n) {
      n.read = true;
      this.notificationsSubject.next([...this.notifications]);
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.notificationsSubject.next([...this.notifications]);
  }

  /** Remove a single notification and remember it was dismissed. */
  deleteNotification(id: string): void {
    const target = this.notifications.find(n => n.id === id);
    if (target) {
      this.dismissedKeys.add(this.fingerprintOf(target.title, target.message));
      this.saveDismissedKeys();
    }
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notificationsSubject.next([...this.notifications]);
  }

  /** Remove all notifications and remember all of them as dismissed. */
  deleteAllNotifications(): void {
    this.notifications.forEach(n => {
      this.dismissedKeys.add(this.fingerprintOf(n.title, n.message));
    });
    this.saveDismissedKeys();
    this.notifications = [];
    this.notificationsSubject.next([]);
  }

  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    this.toastSubject.next({ message, type });
    setTimeout(() => this.toastSubject.next(null), 4000);
  }

  /** Call this when the user clicks a notification so subscribers can refresh their data. */
  emitNotificationClicked(): void {
    this.notificationClickedSubject.next();
  }

  addNotification(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    const key = this.fingerprintOf(title, message);

    // Skip if the user previously dismissed this exact notification
    if (this.dismissedKeys.has(key)) {
      console.log('[NotificationService] Skipping dismissed notification:', key);
      return;
    }

    // Prevent adding duplicate in-session notifications (same title and message)
    const isDuplicate = this.notifications.some(
      n => n.title === title && n.message === message
    );
    if (isDuplicate) {
      console.log('[NotificationService] Deduplicated notification:', title, message);
      return;
    }

    this.notifications.unshift({
      id: `N${Date.now()}`,
      title, message, type,
      timestamp: new Date().toISOString(),
      read: false
    });
    this.notificationsSubject.next([...this.notifications]);
  }
}

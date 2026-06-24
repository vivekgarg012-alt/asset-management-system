import { Component, OnInit, HostListener } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/user.model';
import { Router, NavigationEnd } from '@angular/router';
import { NotificationService, Notification } from '../../../core/services/notification.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  currentUser: User | null = null;
  isDashboard = true;
  showDropdown = false;
  notifications: Notification[] = [];
  unreadCount = 0;
  isApprover = false;
  activeNotification: Notification | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateVisibility(event.urlAfterRedirects);
      }
    });
  }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isApprover = user ? [
        UserRole.ASSET_MANAGER,
        UserRole.TEAM_LEAD,
        UserRole.ALLOCATION_TEAM
      ].includes(user.role) : false;
    });

    this.notificationService.notifications$.subscribe(list => {
      this.notifications = list;
      this.unreadCount = list.filter(n => !n.read).length;
    });

    this.updateVisibility(this.router.url);
  }

  toggleDropdown(event: Event): void {
    this.showDropdown = !this.showDropdown;
    event.stopPropagation();
  }

  markAllAsRead(event: Event): void {
    this.notificationService.markAllAsRead();
    event.stopPropagation();
  }

  deleteNotification(id: string, event: Event): void {
    this.notificationService.deleteNotification(id);
    event.stopPropagation();
  }

  deleteAllNotifications(event: Event): void {
    this.notificationService.deleteAllNotifications();
    event.stopPropagation();
  }

  viewDetails(notification: Notification, event: Event): void {
    this.notificationService.markAsRead(notification.id);
    this.notificationService.emitNotificationClicked();
    this.activeNotification = notification;
    this.showDropdown = false;
    event.stopPropagation();

    // Navigate to the requests page for this role if not already there
    const requestsRoute = this.getRequestsRouteForRole();
    if (requestsRoute && !this.router.url.includes(requestsRoute)) {
      this.router.navigate([requestsRoute]);
    }
  }

  /** Returns the asset-requests route path based on the logged-in user's role. */
  private getRequestsRouteForRole(): string | null {
    if (!this.currentUser) return null;
    switch (this.currentUser.role) {
      case UserRole.ASSET_MANAGER:
        return '/asset-manager/requests';
      case UserRole.TEAM_LEAD:
        return '/team-lead/pending-approval';
      case UserRole.ALLOCATION_TEAM:
        return '/allocation/tickets';
      default:
        return null;
    }
  }

  closeDetails(): void {
    this.activeNotification = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.showDropdown = false;
  }

  private updateVisibility(url: string): void {
    this.isDashboard = url.toLowerCase().includes('/dashboard');
  }
}

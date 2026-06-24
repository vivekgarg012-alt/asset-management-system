import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/user.model';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isCollapsed = false;
  currentRoute = '';
  navItems: NavItem[] = [];
  theme = 'light';
  private subscriptions: Subscription[] = [];

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.currentRoute = this.router.url;
    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        this.buildNavItems();
      }),
      this.authService.theme$.subscribe(t => this.theme = t),
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
        this.currentRoute = e.urlAfterRedirects || e.url;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  buildNavItems(): void {
    if (!this.currentUser) {
      this.navItems = [];
      return;
    }
    const role = this.currentUser.role;
    const base = this.authService.getRoleRoute(role);
    switch (role) {
      case UserRole.ADMINISTRATOR:
        this.navItems = [
          { label: 'Dashboard', icon: 'dashboard', route: `${base}/dashboard` },
          { label: 'User Management', icon: 'people', route: `${base}/users` },
          { label: 'Master Data', icon: 'settings', route: `${base}/master-data` },
          { label: 'Asset Transactions', icon: 'sync_alt', route: `${base}/transactions` },
          { label: 'Policy Details', icon: 'policy', route: `${base}/policy-details` },
          { label: 'Warranty Scheduler', icon: 'schedule', route: `${base}/warranty-scheduler` },
          { label: 'Reports', icon: 'assessment', route: `${base}/reports` }
        ];
        break;
      case UserRole.ASSET_MANAGER:
        this.navItems = [
          { label: 'Dashboard', icon: 'dashboard', route: `${base}/dashboard` },
          { label: 'Asset Inventory', icon: 'inventory', route: `${base}/inventory` },
          { label: 'Asset Requests', icon: 'assignment', route: `${base}/requests` },
          { label: 'Warranty Requests', icon: 'security', route: `${base}/warranty` },
          { label: 'Service & Maintenance', icon: 'build', route: `${base}/service` },
          { label: 'Reports', icon: 'assessment', route: `${base}/reports` }
        ];
        break;
      case UserRole.ALLOCATION_TEAM:
        this.navItems = [
          { label: 'Dashboard', icon: 'dashboard', route: `${base}/dashboard` },
          { label: 'Asset Inventory', icon: 'inventory', route: `${base}/inventory` },
          { label: 'Tickets', icon: 'confirmation_number', route: `${base}/tickets` },
          { label: 'Warranty Extensions', icon: 'security', route: `${base}/warranty` },
          { label: 'Service & Maintenance', icon: 'build', route: `${base}/service` },
          { label: 'Reports', icon: 'assessment', route: `${base}/reports` }
        ];
        break;
      case UserRole.TEAM_LEAD:
        this.navItems = [
          { label: 'Dashboard', icon: 'dashboard', route: `${base}/dashboard` },
          { label: 'Approval History', icon: 'fact_check', route: `${base}/pending-approval` },
          { label: 'My Asset', icon: 'devices', route: `${base}/my-asset` },
          { label: 'My Requests', icon: 'assignment', route: `${base}/my-requests` },
          { label: 'Return Asset', icon: 'assignment_return', route: `${base}/return-asset` },
          { label: 'Service Asset', icon: 'build', route: `${base}/service-asset` },
          { label: 'Extend Warranty', icon: 'security', route: `${base}/extend-warranty` }
        ];
        break;
      case UserRole.EMPLOYEE:
        this.navItems = [
          { label: 'My Assets', icon: 'devices', route: `${base}/my-assets` },
          { label: 'My Requests', icon: 'assignment', route: `${base}/my-requests` },
          { label: 'Return Asset', icon: 'assignment_return', route: `${base}/return-asset` },
          { label: 'Service Asset', icon: 'build', route: `${base}/service-asset` },
          { label: 'Extend Warranty', icon: 'security', route: `${base}/extend-warranty` }
        ];
        break;
    }
  }

  isActive(route: string): boolean {
    if (!this.currentRoute || !route) return false;

    // Normalize both routes to remove triple slashes and ensure leading slash
    const normalizedCurrent = ('/' + this.currentRoute).replace(/\/+/g, '/');
    const normalizedRoute = ('/' + route).replace(/\/+/g, '/');

    // For exact dashboard match or sub-routes
    return normalizedCurrent === normalizedRoute || normalizedCurrent.startsWith(normalizedRoute + '/');
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleTheme(): void {
    this.authService.toggleTheme();
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  logout(): void {
    this.authService.logout();
  }
}

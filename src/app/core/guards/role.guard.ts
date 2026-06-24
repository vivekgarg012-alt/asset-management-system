import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const expectedRole = route.data['role'];
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    if (currentUser.role === expectedRole) {
      return true;
    }

    // Redirect to their own dashboard if they try to access another role's area
    const ownDashboard = this.authService.getRoleRoute(currentUser.role);
    this.router.navigate([ownDashboard]);
    return false;
  }
}

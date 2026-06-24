import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RoleGuard } from './core/guards/role.guard';
import { AuthRedirectGuard } from './core/guards/auth-redirect.guard';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { UserRole } from './core/models/user.model';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: 'admin',
        loadChildren: () => import('./modules/administrator/administrator.module').then(m => m.AdministratorModule),
        canActivate: [RoleGuard],
        data: { role: UserRole.ADMINISTRATOR }
      },
      {
        path: 'asset-manager',
        loadChildren: () => import('./modules/asset-manager/asset-manager.module').then(m => m.AssetManagerModule),
        canActivate: [RoleGuard],
        data: { role: UserRole.ASSET_MANAGER }
      },
      {
        path: 'allocation',
        loadChildren: () => import('./modules/allocation-team/allocation-team.module').then(m => m.AllocationTeamModule),
        canActivate: [RoleGuard],
        data: { role: UserRole.ALLOCATION_TEAM }
      },
      {
        path: 'team-lead',
        loadChildren: () => import('./modules/team-lead/team-lead.module').then(m => m.TeamLeadModule),
        canActivate: [RoleGuard],
        data: { role: UserRole.TEAM_LEAD }
      },
      {
        path: 'employee',
        loadChildren: () => import('./modules/employee/employee.module').then(m => m.EmployeeModule),
        canActivate: [RoleGuard],
        data: { role: UserRole.EMPLOYEE }
      },
    ]
  },
  {
    path: 'home',
    loadChildren: () => import('./modules/home/home.module').then(m => m.HomeModule),
    canActivate: [AuthRedirectGuard]
  },
  {
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule),
    canActivate: [AuthRedirectGuard]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

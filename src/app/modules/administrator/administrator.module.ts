import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';
import { SharedModule } from '../../shared/shared.module';

import { AdminDashboardComponent } from './dashboard/dashboard.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { MasterDataComponent } from './master-data/master-data.component';
import { AssetTransactionComponent } from './asset-transaction/asset-transaction.component';
import { AdminReportsComponent } from './reports/reports.component';
import { WarrantySchedulerComponent } from './warranty-scheduler/warranty-scheduler.component';
import { PolicyDetailsComponent } from './policy-details/policy-details.component';

const routes: Routes = [
  { path: 'dashboard', component: AdminDashboardComponent },
  { path: 'users', component: UserManagementComponent },
  { path: 'master-data', component: MasterDataComponent },
  { path: 'transactions', component: AssetTransactionComponent },
  { path: 'reports', component: AdminReportsComponent },
  { path: 'warranty-scheduler', component: WarrantySchedulerComponent },
  { path: 'policy-details', component: PolicyDetailsComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    AdminDashboardComponent,
    UserManagementComponent,
    MasterDataComponent,
    AssetTransactionComponent,
    AdminReportsComponent,
    WarrantySchedulerComponent,
    PolicyDetailsComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    NgChartsModule,
    SharedModule
  ]
})
export class AdministratorModule { }

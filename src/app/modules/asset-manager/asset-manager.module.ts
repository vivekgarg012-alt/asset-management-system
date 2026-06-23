import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { ManagerDashboardComponent } from './dashboard/dashboard.component';
import { AssetInventoryComponent } from './asset-inventory/asset-inventory.component';
import { AssetRequestsComponent } from './asset-requests/asset-requests.component';
import { ReportsComponent } from './reports/reports.component';
import { WarrantyRequestsComponent } from './warranty-requests/warranty-requests.component';
import { ServiceRequestsComponent } from './service-requests/service-requests.component';

const routes: Routes = [
  { path: 'dashboard', component: ManagerDashboardComponent },
  { path: 'inventory', component: AssetInventoryComponent },
  { path: 'requests', component: AssetRequestsComponent },
  { path: 'warranty', component: WarrantyRequestsComponent },
  { path: 'service', component: ServiceRequestsComponent },
  { path: 'reports', component: ReportsComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    ManagerDashboardComponent,
    AssetInventoryComponent,
    AssetRequestsComponent,
    ReportsComponent,
    WarrantyRequestsComponent,
    ServiceRequestsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    SharedModule
  ]
})
export class AssetManagerModule { }

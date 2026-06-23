import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { NgChartsModule } from 'ng2-charts';

import { AllocationDashboardComponent } from './dashboard/dashboard.component';
import { AllocationInventoryComponent } from './inventory/inventory.component';
import { AllocationTicketsComponent } from './tickets/tickets.component';
import { AllocationReportsComponent } from './reports/reports.component';
import { WarrantyTicketsComponent } from './warranty-tickets/warranty-tickets.component';
import { ServiceCollectionComponent } from './service-collection/service-collection.component';

const routes: Routes = [
  { path: 'dashboard', component: AllocationDashboardComponent },
  { path: 'inventory', component: AllocationInventoryComponent },
  { path: 'tickets', component: AllocationTicketsComponent },
  { path: 'warranty', component: WarrantyTicketsComponent },
  { path: 'service', component: ServiceCollectionComponent },
  { path: 'reports', component: AllocationReportsComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    AllocationDashboardComponent,
    AllocationInventoryComponent,
    AllocationTicketsComponent,
    AllocationReportsComponent,
    WarrantyTicketsComponent,
    ServiceCollectionComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    NgChartsModule
  ]
})
export class AllocationTeamModule { }

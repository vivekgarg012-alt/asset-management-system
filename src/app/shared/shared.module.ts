import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { SidebarComponent } from './components/sidebar/sidebar.component';
import { HeaderComponent } from './components/header/header.component';
import { StatCardComponent } from './components/stat-card/stat-card.component';
import { StatusBadgeComponent } from './components/status-badge/status-badge.component';
import { ModalComponent } from './components/modal/modal.component';

@NgModule({
  declarations: [
    SidebarComponent,
    HeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    ModalComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
  ],
  exports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    SidebarComponent,
    HeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    ModalComponent
  ]
})
export class SharedModule { }
// Force re-compilation of SharedModule components


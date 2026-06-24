import { Component, HostListener, OnInit } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';
import { WarrantySchedulerService } from '../../../core/services/warranty-scheduler.service';
import { AssetService } from '../../../core/services/asset.service';
import { AuthService } from '../../../core/services/auth.service';

export interface WarrantyAllocatedRow {
  assetId: string;
  assetName: string;
  typeId: string;
  subCatId: string;
  userId: string;
  userName: string;
  userEmail: string;
  reminder1?: string;
  reminder2?: string;
  reminder3?: string;
  temp3?: string;
}

@Component({
  selector: 'app-warranty-scheduler',
  templateUrl: './warranty-scheduler.component.html',
  styleUrls: ['./warranty-scheduler.component.scss']
})
export class WarrantySchedulerComponent implements OnInit {
  // Existing scheduler config (kept for backwards compatibility)
  // Reminder configuration
  reminder1: number | null = 30;
  reminder2: number | null = 15;
  reminder3: number | null = 7;
  isSaving: boolean = false;

  dayOptions = [1, 3, 7, 15, 30, 45, 60];
  // UI state

  // New admin manual workflow state
  assetTypes: Array<{ id: string; name: string }> = [];
  subCategories: Array<{ id: string; name: string; typeId: string }> = [];
  filteredSubCategories: Array<{ id: string; name: string; typeId: string }> = [];

  selectedTypeId: string = '';
  selectedSubCatId: string = '';
  
  assetSearchTerm: string = '';
  selectedAssetId: string = '';
  filteredAssetList: any[] = [];

  manualDaysToExtend = 7;
  lastInstanceId: string = '';
  allocatedAssets: WarrantyAllocatedRow[] = [];
  isLoadingResults = false;

  constructor(
    private notificationService: NotificationService,
    private schedulerService: WarrantySchedulerService,
    private assetService: AssetService,
    private authService: AuthService
  ) {
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Keep for any future dropdowns
  }

  async ngOnInit(): Promise<void> {
    this.isSaving = true;
    try {
      const config = await this.schedulerService.getConfiguration();
      if (config) {
        this.reminder1 = config.reminder1 || 7;
        this.reminder2 = config.reminder2 || 15;
        this.reminder3 = config.reminder3 || 30;
        this.selectedAssetId = config.assetId || '';
      }
      await this.loadTypeAndSubCategoryOptions();
    } catch (error) {
      console.error('Failed to load scheduler configuration:', error);
      // Fallback to local storage if DB fails
      const r1 = localStorage.getItem('warranty_scheduler_reminder1');
      const r2 = localStorage.getItem('warranty_scheduler_reminder2');
      const r3 = localStorage.getItem('warranty_scheduler_reminder3');
      const assetId = localStorage.getItem('warranty_scheduler_asset_id');
      
      if (r1) this.reminder1 = parseInt(r1, 10);
      if (r2) this.reminder2 = parseInt(r2, 10);
      if (r3) this.reminder3 = parseInt(r3, 10);
      if (assetId) this.selectedAssetId = assetId;

      await this.loadTypeAndSubCategoryOptions();
    } finally {
      this.isSaving = false;
    }
  }

  private async loadTypeAndSubCategoryOptions(): Promise<void> {
    try {
      const dbTypes = await this.assetService.getAllAssetTypesCordys();
      const dbSubCats = await this.assetService.getAllSubcategoriesCordys();

      this.assetTypes = (dbTypes || [])
        .map((t: any) => ({
          id: String(t.type_id || t.Type_id || t.TYPE_ID || t.id || '').trim(),
          name: String(t.type_name || t.TYPE_NAME || t.name || '').trim()
        }))
        .filter(t => t.id && t.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      this.subCategories = (dbSubCats || [])
        .map((c: any) => ({
          id: String(c.sub_category_id || c.SUB_CATEGORY_ID || c.id || '').trim(),
          name: String(c.name || c.sub_category_name || c.SUB_CATEGORY_NAME || '').trim(),
          typeId: String(c.type_id || c.Type_id || c.TYPE_ID || '').trim()
        }))
        .filter(c => c.id && c.name && c.typeId)
        .sort((a, b) => a.name.localeCompare(b.name));

      this.filteredSubCategories = [];
    } catch (e) {
      console.warn('[WarrantyScheduler] Failed to load type/subcategory options:', e);
      this.assetTypes = [];
      this.subCategories = [];
      this.filteredSubCategories = [];
    }
  }

  typeDisplayName(typeId: string): string {
    return this.assetTypes.find(t => t.id === typeId)?.name || typeId || '—';
  }

  subCategoryDisplayName(subCatId: string): string {
    return this.subCategories.find(s => s.id === subCatId)?.name || subCatId || '—';
  }

  onTypeChange() {
    this.selectedSubCatId = '';
    this.selectedAssetId = '';
    this.filteredAssetList = [];
    this.filteredSubCategories = this.selectedTypeId
      ? this.subCategories.filter(sc => sc.typeId === this.selectedTypeId)
      : [];

    this.lastInstanceId = '';
    this.allocatedAssets = [];
  }

  async onSelectionChange() {
    this.selectedAssetId = '';
    this.lastInstanceId = '';
    await this.refreshAllocatedAssetsPreview();
  }

  onAssetSearch() {
    if (!this.assetSearchTerm) {
      this.filteredAssetList = [...this.allocatedAssets];
    } else {
      const term = this.assetSearchTerm.toLowerCase();
      this.filteredAssetList = this.allocatedAssets.filter(a => 
        a.assetName.toLowerCase().includes(term) || a.assetId.toLowerCase().includes(term)
      );
    }
    // If the selected asset is no longer in the list, we don't necessarily clear it, 
    // but the dropdown might not show it.
  }

  /** Loads allocated assets for the selected type + subcategory and resolves assignee (temp1 → user). */
  private async refreshAllocatedAssetsPreview(): Promise<void> {
    if (!this.selectedTypeId || !this.selectedSubCatId) {
      this.allocatedAssets = [];
      return;
    }

    this.isLoadingResults = true;
    this.allocatedAssets = [];
    try {
      const rows = await this.assetService.fetchAllRawAssets();
      const filtered = (rows || []).filter(
        (r: any) =>
          String(r.type_id || '').trim() === this.selectedTypeId &&
          String(r.sub_category_id || '').trim() === this.selectedSubCatId
      );

      const userIds = [
        ...new Set(
          filtered
            .map((r: any) => String(r.temp1 || '').trim())
            .filter(Boolean)
        )
      ];
      const userCache = new Map<string, { name: string; email: string }>();
      await Promise.all(
        userIds.map(async uid => {
          try {
            const u = await this.authService.getUserDetails(uid);
            userCache.set(uid, {
              name: u?.name || uid,
              email: u?.email || ''
            });
          } catch {
            userCache.set(uid, { name: uid, email: '' });
          }
        })
      );

      this.allocatedAssets = filtered.map((r: any) => {
        const uid = String(r.temp1 || '').trim();
        const u = uid ? userCache.get(uid) : undefined;
        return {
          assetId: String(r.asset_id || ''),
          assetName: String(r.asset_name || ''),
          typeId: String(r.type_id || ''),
          subCatId: String(r.sub_category_id || ''),
          userId: uid,
          userName: u?.name || (uid || '—'),
          userEmail: u?.email || '',
          reminder1: r.temp5 || 'Not Set',
          reminder2: r.temp6 || 'Not Set',
          reminder3: r.temp7 || 'Not Set',
          temp3: r.temp3 || '0'
        };
      });
      
      this.filteredAssetList = [...this.allocatedAssets];
      this.onAssetSearch();
    } catch (e) {
      console.warn('[WarrantyScheduler] Failed to load allocated assets preview:', e);
      this.allocatedAssets = [];
      this.filteredAssetList = [];
    } finally {
      this.isLoadingResults = false;
    }
  }

  get selectedAssetDetails() {
    if (!this.selectedAssetId) return null;
    return this.allocatedAssets.find(a => a.assetId === this.selectedAssetId);
  }

  get dayOptions1(): number[] {
    return this.dayOptions;
  }

  get dayOptions2(): number[] {
    if (!this.reminder1) return [];
    return this.dayOptions.filter(d => d < this.reminder1!);
  }

  get dayOptions3(): number[] {
    if (!this.reminder2) return [];
    return this.dayOptions.filter(d => d < this.reminder2!);
  }

  onReminderChange(level: number) {
    if (level === 1) {
      if (this.reminder2 && this.reminder1 && this.reminder2 >= this.reminder1) {
        const validOptions = this.dayOptions2;
        this.reminder2 = validOptions.length ? Math.max(...validOptions) : null;
      }
    }
    if (level <= 2) {
      if (this.reminder3 && this.reminder2 && this.reminder3 >= this.reminder2) {
        const validOptions = this.dayOptions3;
        this.reminder3 = validOptions.length ? Math.max(...validOptions) : null;
      }
    }
  }

  onAssetSelectionChange() {
    const details = this.selectedAssetDetails;
    if (details) {
      if (details.reminder1 !== 'Not Set') this.reminder1 = parseInt(details.reminder1 || '', 10) || 7;
      if (details.reminder2 !== 'Not Set') this.reminder2 = parseInt(details.reminder2 || '', 10) || 15;
      if (details.reminder3 !== 'Not Set') this.reminder3 = parseInt(details.reminder3 || '', 10) || 30;
    }
  }

  async saveSchedule() {
    this.isSaving = true;
    
    try {
      // 1. Persist to Database via Service
      await this.schedulerService.saveConfiguration(this.reminder1 || 7, this.reminder2 || 15, this.reminder3 || 30, this.selectedAssetId);
      
      // 2. Persist to local storage for quick access
      localStorage.setItem('warranty_scheduler_reminder1', (this.reminder1 || 7).toString());
      localStorage.setItem('warranty_scheduler_reminder2', (this.reminder2 || 15).toString());
      localStorage.setItem('warranty_scheduler_reminder3', (this.reminder3 || 30).toString());
      localStorage.setItem('warranty_scheduler_asset_id', this.selectedAssetId || '');

      this.notificationService.showToast('Warranty scheduler configuration saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save scheduler configuration:', error);
      this.notificationService.showToast('Failed to save configuration to database. Local settings updated.', 'warning');
    } finally {
      this.isSaving = false;
    }
  }

  async runNow() {
    // New behavior: manual extend warranty by 7 days using Type + Subcategory
    if (!this.selectedTypeId || !this.selectedSubCatId || !this.selectedAssetId) {
      this.notificationService.showToast('Please select Type, Subcategory and Asset first.', 'warning');
      return;
    }

    this.isSaving = true;
    try {
      const resp = await this.schedulerService.extendWarrantyFinalScheduler({
        days: this.manualDaysToExtend,
        typeId: this.selectedTypeId,
        subCatId: this.selectedSubCatId,
        assetId: this.selectedAssetId,
        reminder1: this.reminder1 || undefined,
        reminder2: this.reminder2 || undefined,
        reminder3: this.reminder3 || undefined
      });
      this.lastInstanceId = resp?.instanceId || '';
      this.notificationService.showToast(
        this.lastInstanceId
          ? `Warranty extend triggered. Instance: ${this.lastInstanceId}`
          : 'Warranty extend triggered successfully!',
        'success'
      );
    } catch (error) {
      this.notificationService.showToast('Failed to trigger warranty extend BPM. Please check console.', 'error');
      this.isSaving = false;
    }
  }

  async toggleAssetReminder() {
    if (!this.selectedAssetDetails) return;
    
    this.isSaving = true;
    try {
      const currentFlag = this.selectedAssetDetails.temp3 || '0';
      const newFlag = currentFlag === '1' ? '0' : '1';
      
      await this.assetService.updateAssetTemp3(this.selectedAssetId, newFlag);
      this.selectedAssetDetails.temp3 = newFlag;
      
      this.notificationService.showToast(`Warranty Expiry Reminder ${newFlag === '1' ? 'Activated' : 'Deactivated'} successfully.`, 'success');
    } catch (error) {
      console.error('Failed to toggle asset reminder flag:', error);
      this.notificationService.showToast('Failed to update Warranty Expiry Reminder flag.', 'error');
    } finally {
      this.isSaving = false;
    }
  }
}

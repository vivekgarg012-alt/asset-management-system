import { Component, OnInit } from '@angular/core';
import { Asset, AssetCondition } from '../../../core/models/asset.model';
import { HeroService } from 'src/app/core/services/hero.service';
import { NotificationService } from 'src/app/core/services/notification.service';

interface InventorySummaryRow {
  typeName: string;
  categoryName: string;
  total: number;
  available: number;
  moveToAllocation: number;
  assigned: number;
  other: number;
}

@Component({
  selector: 'app-allocation-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class AllocationInventoryComponent implements OnInit {
  allAssets: Asset[] = [];
  filteredAssets: Asset[] = [];
  loading = true;
  searchText = '';
  statusFilter = '';

  viewMode: 'summary' | 'details' = 'summary';
  summaryRows: InventorySummaryRow[] = [];
  inventoryTypeName = '';
  inventoryStats = { total: 0, available: 0, moveToAllocation: 0, assigned: 0, other: 0 };

  // Pagination
  currentPage = 1;
  pageSize = 10;
  paginatedAssets: Asset[] = [];
  totalPages = 1;

  constructor(
    private hs: HeroService,
    private notification: NotificationService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadInventory();
  }

  async loadInventory(): Promise<void> {
    this.loading = true;
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser?.id;

      if (!userId) {
        this.allAssets = [];
        this.summaryRows = [];
        this.inventoryStats = { total: 0, available: 0, moveToAllocation: 0, assigned: 0, other: 0 };
        this.notification.showToast('Current user is missing. Please log in again.', 'error');
        return;
      }

      this.allAssets = await this.fetchAllocationInventoryByUser(userId);
      this.calculateSummary();
      this.applyFilters();
    } catch (error) {
      console.error('Failed to load inventory', error);
      this.notification.showToast('Failed to load inventory data', 'error');
    } finally {
      this.loading = false;
    }
  }

  private async fetchAllocationInventoryByUser(userId: string): Promise<Asset[]> {
    const response = await this.hs.ajax(
      'GetAllocationInventoryByUserName',
      'http://schemas.cordys.com/AMS_Database_Metadata',
      { user_id: userId }
    );
    const tuples = this.hs.xmltojson(response, 'tuple');
    const tupleArray: any[] = tuples ? (Array.isArray(tuples) ? tuples : [tuples]) : [];

    return tupleArray.map((tuple: any) => this.mapAllocationInventoryTupleToAsset(tuple));
  }

  private mapAllocationInventoryTupleToAsset(tuple: any): Asset {
    const data = tuple?.old?.m_assets ?? tuple?.m_assets ?? tuple;
    const typeInfo = data?.m_asset_types ?? {};
    const subCategoryInfo = data?.m_asset_subcategories ?? {};
    const assignedUserInfo = data?.m_users ?? {};
    const assetId = this.getVal(data?.asset_id) ?? '';
    const serialNumber = this.getVal(data?.serial_number) ?? '';
    const typeName = this.getVal(typeInfo?.type_name) ?? this.getVal(data?.type_id) ?? 'Assigned Type';
    const categoryName = this.getVal(subCategoryInfo?.name) ?? this.getVal(data?.sub_category_id) ?? 'Uncategorized';
    const status = this.getVal(data?.status) ?? 'Unknown';
    const assignedUserId = this.getVal(data?.temp1) ?? '';
    const assignedUserName = this.getVal(assignedUserInfo?.assigned_user_name) ?? '';
    const shouldShowAssignedUser = this.isAllocatedStatus(status) && !!assignedUserId;

    return {
      id: assetId,
      assetId,
      assetTag: serialNumber || assetId,
      name: this.getVal(data?.asset_name) ?? 'Unknown Asset',
      type: typeName,
      category: categoryName,
      subCategory: categoryName,
      status,
      assignedTo: shouldShowAssignedUser ? assignedUserId : '',
      assignedToName: shouldShowAssignedUser ? this.formatAssignedUser(assignedUserName, assignedUserId) : '',
      location: '',
      purchaseDate: this.getVal(data?.purchase_date) ?? '',
      warrantyExpiry: this.getVal(data?.warranty_expiry) ?? '',
      vendor: '',
      serialNumber,
      cost: 0,
      condition: AssetCondition.GOOD,
      requestId: this.getVal(data?.temp2) ?? ''
    };
  }

  calculateSummary(): void {
    const summaryMap = new Map<string, InventorySummaryRow>();
    const stats = { total: 0, available: 0, moveToAllocation: 0, assigned: 0, other: 0 };

    this.allAssets.forEach(asset => {
      const typeName = asset.type as string || 'Assigned Type';
      const categoryName = asset.category || 'Uncategorized';
      const statusValue = (asset.status || '').toLowerCase().trim();

      const isAvailable = statusValue === 'available';
      const isMoveToAllocation = statusValue === 'movetoallocationteam';
      const isAssigned = statusValue === 'allocated' || statusValue === 'assigned';

      stats.total++;
      if (isAvailable) stats.available++;
      else if (isMoveToAllocation) stats.moveToAllocation++;
      else if (isAssigned) stats.assigned++;
      else stats.other++;

      if (!summaryMap.has(categoryName)) {
        summaryMap.set(categoryName, {
          typeName,
          categoryName,
          total: 0,
          available: 0,
          moveToAllocation: 0,
          assigned: 0,
          other: 0
        });
      }

      const row = summaryMap.get(categoryName)!;
      row.total++;
      if (isAvailable) row.available++;
      else if (isMoveToAllocation) row.moveToAllocation++;
      else if (isAssigned) row.assigned++;
      else row.other++;
    });

    this.inventoryStats = stats;
    this.inventoryTypeName = this.allAssets[0]?.type as string || '';
    this.summaryRows = Array.from(summaryMap.values())
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }

  selectSubCategory(subCat: string): void {
    this.searchText = subCat;
    this.statusFilter = '';
    this.viewMode = 'details';
    this.currentPage = 1; // Reset to page 1
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchText = '';
    this.statusFilter = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    let results = [...this.allAssets];

    if (this.statusFilter) {
      if (this.statusFilter === 'Available') {
        results = results.filter(a => a.status === 'Available');
      } else if (this.statusFilter === 'MoveToAllocationTeam') {
        results = results.filter(a => a.status === 'MoveToAllocationTeam');
      } else {
        results = results.filter(a => a.status === this.statusFilter);
      }
    }

    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase().trim();
      results = results.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.assetTag.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q) ||
        (a.requestId || '').toLowerCase().includes(q) ||
        (a.assignedToName || '').toLowerCase().includes(q)
      );
    }

    this.filteredAssets = results;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredAssets.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedAssets = this.filteredAssets.slice(startIndex, startIndex + this.pageSize);
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.currentPage = newPage;
      this.updatePagination();
    }
  }

  getPaginationRange(): string {
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.filteredAssets.length);
    return `${start} to ${end} of ${this.filteredAssets.length}`;
  }

  getPageArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  onFilterChange(): void {
    this.currentPage = 1; // Reset to first page on filter
    this.applyFilters();
  }

  getStatusClass(status: string): string {
    const s = status?.toLowerCase() || '';
    if (s.includes('movetoallocationteam')) return 'status-move-to-allocation';
    if (s.includes('available')) return 'status-available';
    if (s.includes('allocated') || s.includes('assigned')) return 'status-allocated';
    if (s.includes('repair')) return 'status-maintenance';
    return 'status-other';
  }

  getStatusLabel(status: string): string {
    return status === 'MoveToAllocationTeam' ? 'Ready for Allocation' : status;
  }

  getStatusTitle(status: string): string {
    return status === 'MoveToAllocationTeam' ? 'Move To Allocation Team: available and currently ready for allocation' : status;
  }

  private isAllocatedStatus(status: string): boolean {
    const value = (status || '').toLowerCase().trim();
    return value === 'allocated' || value === 'assigned';
  }

  private formatAssignedUser(name: string, id: string): string {
    return name ? `${name} (${id})` : id;
  }

  private getVal(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'object') {
      if (value['@nil'] === 'true' || value['@null'] === 'true' || value['@xsi:nil'] === 'true') return undefined;
      return undefined;
    }
    const str = String(value).trim();
    return str === '' ? undefined : str;
  }
}

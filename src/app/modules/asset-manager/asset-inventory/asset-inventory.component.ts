import { Component, OnInit } from '@angular/core';
import { AssetService } from '../../../core/services/asset.service';
import { Asset, AssetType, AssetStatus, AssetCondition } from '../../../core/models/asset.model';

@Component({
  selector: 'app-asset-inventory',
  templateUrl: './asset-inventory.component.html',
  styleUrls: ['./asset-inventory.component.scss']
})
export class AssetInventoryComponent implements OnInit {
  assets: Asset[] = [];
  filteredAssets: Asset[] = [];
  searchTerm = '';
  selectedType = '';
  selectedStatus = '';
  assetTypes: string[] = [];
  assetStatuses = ['Allocated', 'Available', 'Move to allocation team']
  selectedAsset: Asset | null = null;
  showDetailModal = false;

  // Loading & error state
  isLoading = true;
  loadError = '';
  
  // Expose Math for template
  protected readonly Math = Math;
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 5;

  constructor(private assetService: AssetService) {}

  ngOnInit(): void {
    this.loadAssets();
    this.loadAssetTypes();
  }

  async loadAssetTypes(): Promise<void> {
    try {
      const counts = await this.assetService.fetchAssetTypeWiseCount();
      this.assetTypes = counts.map(c => c.type_name);
    } catch (err) {
      console.error('Failed to load asset types:', err);
      // Fallback
      this.assetTypes = Object.values(AssetType) as string[];
    }
  }

  async loadAssets(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      this.assets = await this.assetService.fetchAssetsFromService();
      this.filteredAssets = [...this.assets];
    } catch (err: any) {
      console.error('Failed to load assets:', err);
      this.loadError = err?.message || err?.errorThrown || 'Failed to load asset data. Please try again.';
      this.assets = [];
      this.filteredAssets = [];
    } finally {
      this.isLoading = false;
    }
  }

  applyFilters(): void {
    this.filteredAssets = this.assets.filter(asset => {
      const matchesSearch = !this.searchTerm ||
        asset.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.assetTag.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.serialNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (asset.assignedToName && asset.assignedToName.toLowerCase().includes(this.searchTerm.toLowerCase()));
      const matchesType = !this.selectedType || asset.type === this.selectedType;
      const matchesStatus = !this.selectedStatus || asset.status === this.selectedStatus;
      return matchesSearch && matchesType && matchesStatus;
    }).sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    this.currentPage = 1; // Reset to first page on filter change
  }

  get paginationDisplayRange(): string {
    if (this.filteredAssets.length === 0) return '0 - 0 of 0';
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, this.filteredAssets.length);
    return `${start} - ${end} of ${this.filteredAssets.length}`;
  }

  get paginatedAssets(): Asset[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredAssets.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredAssets.length / this.itemsPerPage);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedType = '';
    this.selectedStatus = '';
    this.filteredAssets = [...this.assets];
  }

  viewAssetDetail(asset: Asset): void {
    this.selectedAsset = asset;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedAsset = null;
  }

  getConditionClass(condition: AssetCondition): string {
    switch (condition) {
      case AssetCondition.NEW: return 'condition-new';
      case AssetCondition.GOOD: return 'condition-good';
      case AssetCondition.FAIR: return 'condition-fair';
      case AssetCondition.POOR: return 'condition-poor';
      case AssetCondition.DAMAGED: return 'condition-damaged';
      default: return '';
    }
  }

  getTypeIcon(type: AssetType | string): string {
    switch (type) {
      case AssetType.HARDWARE: return 'computer';
      case AssetType.SOFTWARE: return 'code';
      case AssetType.NETWORK: return 'router';
      case AssetType.PERIPHERAL: return 'mouse';
      case AssetType.FURNITURE: return 'chair';
      default: return 'category';
    }
  }

  formatCurrency(value: number): string {
    return '₹' + value.toLocaleString('en-IN');
  }
}

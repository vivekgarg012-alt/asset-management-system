import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import * as XLSX from 'xlsx';
import { Asset, AssetCategory, AssetCondition, AssetStatus, AssetType } from '../../../core/models/asset.model';
import { AdminDataService, Project } from '../../../core/services/admin-data.service';
import { AssetService } from '../../../core/services/asset.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';


Chart.register(...registerables);

type MasterTab = 'types' | 'categories' | 'assets';
type AddAssetForm = {
  type: AssetType | string | '';
  category: string;
  name: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyExpiry: string;
  isExpiryMandatory: boolean;
};
type AssetCategoryGroup = {
  type: AssetType | string;
  icon: string;
  categories: AssetCategory[];
  assetCount: number;
};
export interface EnrichedSubcategory {
  id: string;
  name: string;
  type: AssetType | string;
  icon: string;
  totalCount: number;
  availableCount: number;
  assignedCount: number;
  utilizationRate: number;
  totalValue: number;
  warrantyHealth: number;
}

@Component({
  selector: 'app-master-data',
  templateUrl: './master-data.component.html',
  styleUrls: ['./master-data.component.scss']
})
export class MasterDataComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;
  activeTab: MasterTab = 'types';

  assetTypes: Array<{ type: AssetType | string; count: number; value: number; id?: string }> = [];
  assetCategories: AssetCategory[] = [];
  assetCategoryGroups: AssetCategoryGroup[] = [];
  assets: Asset[] = [];
  projects: Project[] = [];
  filteredAssets: Asset[] = [];

  assetTypeOptions: (AssetType | string)[] = [];
  assetStatusOptions: string[] = [];
  assetSearchTerm = '';
  selectedAssetType = '';
  selectedAssetSubCategory = '';
  selectedAssetStatus = '';
  assetSubCategoryOptions: string[] = [];
  currentPage = 1;
  pageSize = 5;
  showAddAssetModal = false;
  showAddTypeModal = false;
  showAddSubCategoryModal = false;
  newTypeName = '';
  newSubCategoryName = '';
  selectedTypeIdForSubCategory = '';
  isSaving = false;
  selectedCategory = '';
  selectedSubCategoryTypeFilter = '';
  submittedAssetForm = false;
  newAsset: AddAssetForm = this.createEmptyAsset();

  // Confirmation Modal State
  showConfirmModal = false;
  showConfirmAction = true;
  confirmTitle = '';
  confirmMessage = '';
  confirmBtnText = 'Delete';
  onConfirmCallback: (() => void) | null = null;

  summaryCards: Array<{ label: string; value: number | string; icon: string; color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' }> = [];

  // Enriched Subcategories for the new dashboard view
  enrichedSubcategories: EnrichedSubcategory[] = [];
  filteredEnrichedSubcategories: EnrichedSubcategory[] = [];
  selectedSubForDetail: EnrichedSubcategory | null = null;
  showSubDetailModal = false;
  selectedAssetForDetail: Asset | null = null;
  showAssetDetailModal = false;
  assetsInSelectedSub: Asset[] = [];
  subDetailsCurrentPage = 1;
  subDetailsPageSize = 5;
  subCatCurrentPage = 1;
  subCatPageSize = 5;
  assetTypeChartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: [{ data: [] }]
  };
  assetTypeChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          precision: 0
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.16)'
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const item = this.assetTypes[context.dataIndex];
            const valueLabel = new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0
            }).format(item?.value || 0);
            return ` ${context.raw} assets | ${valueLabel}`;
          }
        }
      }
    }
  };

  assetDoughnutChartData: ChartData<'doughnut', number[], string> = {
    labels: [],
    datasets: [{ data: [] }]
  };
  assetDoughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((Number(context.raw) / total) * 100);
            return `${context.label}: ${context.raw} (${percentage}%)`;
          }
        }
      }
    }
  };

  constructor(
    private assetService: AssetService,
    private adminDataService: AdminDataService,
    private notificationService: NotificationService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    await this.loadAssetsFromService();

    // Load users to map names properly
    let usersMap = new Map<string, string>();
    try {
      const allUsers = await this.adminDataService.GetAllUserRoleProjectDetails();
      allUsers.forEach(u => usersMap.set(u.id, u.name));
    } catch (e) {
      console.warn('Failed to load users for mapping', e);
    }

    // Map names to assets locally
    this.assets = this.assetService.getAssets().map(asset => {
      if (asset.assignedTo && !asset.assignedToName) {
        return { ...asset, assignedToName: usersMap.get(asset.assignedTo) || asset.assignedTo };
      }
      return asset;
    });
    const dbTypes = await this.assetService.getAllAssetTypesCordys();
    const dbSubCats = await this.assetService.getAllSubcategoriesCordys();

    const assetStats = this.assetService.getAssetStats();

    // Map stats by type name for quick lookup
    const statsMap = new Map(assetStats.byType.map(s => [s.type, s]));

    // Build the master list of asset types, filling in 0 count for new types
    this.assetTypes = dbTypes.map(t => {
      const name = t.type_name || t.name || t.TYPE_NAME || t.Type_name || '';
      const id = t.type_id || t.Type_id || t.TYPE_ID || t.id || '';
      if (statsMap.has(name)) {
        const stats = statsMap.get(name)!;
        return { ...stats, id };
      } else {
        return { type: name as any, count: 0, value: 0, id };
      }
    });

    // Ensure types that exist in stats but somehow not in DB are included
    assetStats.byType.forEach(s => {
      if (!this.assetTypes.find(t => t.type === s.type)) {
        this.assetTypes.push(s);
      }
    });

    const serviceCategories = this.assetService.getCategories();
    this.assetCategories = [...serviceCategories];

    // Augment assetCategories with IDs from DB
    dbSubCats.forEach(dbCat => {
      const catName = dbCat.name || dbCat.sub_category_name || dbCat.SUB_CATEGORY_NAME || '';
      const dbCatTypeId = dbCat.type_id || dbCat.Type_id || dbCat.TYPE_ID || '';
      const typeObj = dbTypes.find(t =>
        (t.type_id === dbCatTypeId) ||
        (t.Type_id === dbCatTypeId) ||
        (t.TYPE_ID === dbCatTypeId) ||
        (dbCatTypeId && (t.type_name || t.TYPE_NAME) && dbCatTypeId === 'typ_' + (t.type_name || t.TYPE_NAME).toLowerCase().slice(0, 3)) ||
        (dbCatTypeId && t.name && dbCatTypeId === 'typ_' + t.name.toLowerCase().slice(0, 3))
      );
      const typeName = typeObj ? (typeObj.type_name || typeObj.name || typeObj.TYPE_NAME) : dbCatTypeId;

      let existingCategory = this.assetCategories.find(c => c.type === typeName && (c.name === catName || c.subCategories.includes(catName)));
      if (existingCategory) {
        // Sync the actual DB ID to avoid collision during next generation
        existingCategory.id = dbCat.sub_category_id || existingCategory.id;
      } else {
        this.assetCategories.push({
          id: dbCat.sub_category_id || `cat_db_${Math.random()}`,
          name: catName,
          type: typeName as any,
          subCategories: [catName],
          icon: 'category'
        });
      }
    });

    // Deleted redundant this.assets = this.assetService.getAssets();
    this.assetCategoryGroups = this.buildAssetCategoryGroups();
    this.enrichedSubcategories = this.buildEnrichedSubcategories();
    this.filterSubcategories();
    this.assetTypeOptions = this.assetTypes.map(item => item.type);
    this.assetSubCategoryOptions = Array.from(new Set([
      ...this.assets.map(a => a.subCategory),
      ...dbSubCats.map(c => c.name)
    ])).filter(Boolean).sort();
    this.assetStatusOptions = Array.from(new Set(this.assets.map(a => a.status))).filter(Boolean).sort();
    this.projects = await this.getResolvedProjects();
    this.filterAssets();

    this.summaryCards = [
      { label: 'Asset Types', value: this.assetTypes.length, icon: 'category', color: 'blue' },
      { label: 'Asset Sub Categories', value: this.assetCategories.length, icon: 'dashboard', color: 'purple' },
      { label: 'Assets', value: this.assets.length, icon: 'inventory_2', color: 'green' }
    ];

    this.assetTypeChartData = {
      labels: this.assetTypes.map(item => item.type),
      datasets: [
        {
          data: this.assetTypes.map(item => item.count),
          backgroundColor: this.assetTypes.map(item => this.getAssetTypeColor(item.type)),
          borderRadius: 10,
          barThickness: 18,
          maxBarThickness: 18
        }
      ]
    };

    this.assetDoughnutChartData = {
      labels: this.assetTypes.map(item => item.type),
      datasets: [
        {
          data: this.assetTypes.map(item => item.count),
          backgroundColor: this.assetTypes.map(item => this.getAssetTypeColor(item.type)),
          borderWidth: 0,
          hoverOffset: 4
        }
      ]
    };
  }

  get totalAssetTypeValue(): number {
    return this.assetTypes.reduce((sum, item) => sum + item.value, 0);
  }

  get totalAssetTypeCount(): number {
    return this.assetTypes.reduce((sum, item) => sum + item.count, 0);
  }

  getAssetTypeShare(count: number): number {
    return this.totalAssetTypeCount ? Math.round((count / this.totalAssetTypeCount) * 100) : 0;
  }

  getCategoryAssetCount(category: AssetCategory): number {
    return this.assets.filter(asset => asset.type === category.type && asset.category === category.name).length;
  }

  setTab(tab: MasterTab): void {
    this.activeTab = tab;
  }

  openAddModal(): void {
    if (this.activeTab === 'types') {
      this.newTypeName = '';
      this.showAddTypeModal = true;
    } else if (this.activeTab === 'categories') {
      this.newSubCategoryName = '';
      this.selectedTypeIdForSubCategory = '';
      this.showAddSubCategoryModal = true;
    } else {
      this.showAddAssetModal = true;
      this.newAsset = this.createEmptyAsset();
      this.selectedCategory = '';
      this.submittedAssetForm = false;
    }
  }

  closeAddAssetModal(): void {
    this.showAddAssetModal = false;
    this.submittedAssetForm = false;
  }

  closeAddTypeModal(): void {
    this.showAddTypeModal = false;
  }

  closeAddSubCategoryModal(): void {
    this.showAddSubCategoryModal = false;
  }

  get addButtonText(): string {
    if (this.activeTab === 'types') return 'Add Asset Type';
    if (this.activeTab === 'categories') return 'Add Subcategory';
    return 'Add Asset';
  }

  onAssetTypeChange(type: AssetType | ''): void {
    this.newAsset.type = type;
    this.selectedCategory = '';
    this.newAsset.category = '';
  }

  getCategoriesForSelectedType(): AssetCategory[] {
    return this.newAsset.type
      ? this.assetCategories.filter(category => category.type === this.newAsset.type)
      : this.assetCategories;
  }

  get categoryDisabled(): boolean {
    return !this.newAsset.type;
  }

  get categoryHelperText(): string {
    if (!this.newAsset.type) {
      return 'Choose an asset type first to see matching categories.';
    }
    const categories = this.getCategoriesForSelectedType();
    return categories.length ? 'Select a category that belongs to the chosen type.' : 'No categories are mapped for the selected type.';
  }

  onAssetCategoryChange(categoryName: string): void {
    this.newAsset.category = categoryName;
    this.selectedCategory = categoryName;
  }

  onAssetNameChange(name: string): void {
    if (name) {
      const uniqueSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit unique number
      const sanitizedName = name.replace(/\s+/g, '').toUpperCase();
      this.newAsset.serialNumber = `${sanitizedName}-${uniqueSuffix}`;
    } else {
      this.newAsset.serialNumber = '';
    }
  }

  downloadTemplate(): void {
    const wsData = [
      ['Type', 'Category', 'Name', 'Purchase Date', 'Warranty Expiry', 'Warrenty Expiry Reminder'],
      ['Hardware', 'Laptops', 'Dell Latitude 7420', '15-01-2023', '15-01-2026', 'Active']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AssetTemplate');
    XLSX.writeFile(wb, 'Asset_Bulk_Upload_Template.xlsx');
  }

  triggerBulkUpload(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  async onFileChange(event: any): Promise<void> {
    const target: DataTransfer = <DataTransfer>(event.target);
    if (target.files.length !== 1) {
      this.notificationService.showToast('Please select a single file.', 'error');
      return;
    }

    this.isSaving = true;
    const reader: FileReader = new FileReader();

    reader.onload = async (e: any) => {
      try {
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];

        // Use raw: false to get formatted strings
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as string[][];

        if (!data || data.length < 2) {
          this.notificationService.showToast('The file is empty or missing data rows.', 'error');
          return;
        }

        // 1. Header Validation
        const expectedHeaders = ['Type', 'Category', 'Name', 'Purchase Date', 'Warranty Expiry', 'Warrenty Expiry Reminder'];
        const actualHeaders = data[0].map(h => String(h || '').trim());

        const headersMatch = expectedHeaders.length === actualHeaders.length &&
          expectedHeaders.every((val, index) => val.toLowerCase() === actualHeaders[index].toLowerCase());

        if (!headersMatch) {
          this.notificationService.showToast('Invalid template format. Column names must not be changed.', 'error');
          console.error('Expected:', expectedHeaders, 'Actual:', actualHeaders);
          return;
        }

        // 2. Fetch system data for validation
        const dbTypes = await this.assetService.getAllAssetTypesCordys();
        const dbSubCats = await this.assetService.getAllSubcategoriesCordys();

        // 3. Validation Pass (Pass 1)
        const errors: string[] = [];
        const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          // Skip truly empty rows
          if (!row || row.length === 0 || !row.some(cell => String(cell || '').trim() !== '')) continue;

          const rowNum = i + 1;
          const type = String(row[0] || '').trim();
          const category = String(row[1] || '').trim();
          const name = String(row[2] || '').trim();
          const purchaseDate = String(row[3] || '').trim();
          const warrantyExpiry = String(row[4] || '').trim();
          const reminderFlag = String(row[5] || '').trim();

          const isMandatory = type.toLowerCase() === 'hardware' || type.toLowerCase() === 'software';

          // Check for missing data
          if (!type) errors.push(`Row ${rowNum}: 'Type' is missing.`);
          if (!category) errors.push(`Row ${rowNum}: 'Category' is missing.`);
          if (!name) errors.push(`Row ${rowNum}: 'Name' is missing.`);
          if (!purchaseDate) errors.push(`Row ${rowNum}: 'Purchase Date' is missing.`);
          if (isMandatory && !warrantyExpiry) {
            errors.push(`Row ${rowNum}: 'Warranty Expiry' is missing (mandatory for '${type}').`);
          }

          // Skip further checks for this row if critical mandatory fields are missing
          if (!type || !category || !name || !purchaseDate || (isMandatory && !warrantyExpiry)) continue;

          // Validate existence of Type
          const matchedType = dbTypes.find(t =>
          (t.type_name?.toLowerCase() === type.toLowerCase() ||
            t.TYPE_NAME?.toLowerCase() === type.toLowerCase() ||
            t.name?.toLowerCase() === type.toLowerCase())
          );
          if (!matchedType) {
            errors.push(`Row ${rowNum}: Asset Type '${type}' does not exist in the system.`);
          }

          // Validate existence of Category
          const matchedSubCat = dbSubCats.find(c =>
          (c.name?.toLowerCase() === category.toLowerCase() ||
            c.sub_category_name?.toLowerCase() === category.toLowerCase() ||
            c.SUB_CATEGORY_NAME?.toLowerCase() === category.toLowerCase())
          );
          if (!matchedSubCat) {
            errors.push(`Row ${rowNum}: Category '${category}' does not exist in the system.`);
          }

          // Date format validation (DD-MM-YYYY)
          if (purchaseDate) {
            if (dateRegex.test(purchaseDate)) {
              const [d, m, y] = purchaseDate.split('-').map(Number);
              const pDate = new Date(y, m - 1, d);
              pDate.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (pDate > today) {
                errors.push(`Row ${rowNum}: Purchase Date cannot be in the future.`);
              }
            } else {
              errors.push(`Row ${rowNum}: Invalid Purchase Date format ('${purchaseDate}'). Use DD-MM-YYYY.`);
            }
          }

          if (warrantyExpiry) {
            if (dateRegex.test(warrantyExpiry)) {
              const [d, m, y] = warrantyExpiry.split('-').map(Number);
              const wDate = new Date(y, m - 1, d);
              wDate.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (wDate < today) {
                errors.push(`Row ${rowNum}: Warranty Expiry cannot be in the past.`);
              }
            } else {
              errors.push(`Row ${rowNum}: Invalid Warranty Expiry format ('${warrantyExpiry}'). Use DD-MM-YYYY.`);
            }
          }

          // Reminder flag validation
          if (reminderFlag) {
            const flagLower = reminderFlag.toLowerCase();
            if (flagLower !== 'active' && flagLower !== 'inactive') {
              errors.push(`Row ${rowNum}: 'Warrenty Expiry Reminder' must be either 'Active' or 'Inactive'.`);
            }
          }

          if (errors.length > 20) {
            errors.push('...and more errors found. Please check your file.');
            break;
          }
        }

        // 4. Error Reporting
        if (errors.length > 0) {
          // Log full error list for admin
          console.error('Bulk Upload Validation Errors:', errors);

          // Show the exact first error message in the toast
          this.notificationService.showToast(`Validation Failed: ${errors[0]}`, 'error');
          return;
        }

        // 5. Execution Pass (Pass 2) - Only if no errors
        let successCount = 0;

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0 || !row.some(cell => String(cell || '').trim() !== '')) continue;

          const type = String(row[0]).trim();
          const category = String(row[1]).trim();
          const name = String(row[2]).trim();
          const purchaseDateRaw = String(row[3]).trim();
          const warrantyExpiryRaw = String(row[4] || '').trim();
          const reminderFlagRaw = String(row[5] || '').trim().toLowerCase();

          // Convert DD-MM-YYYY to YYYY-MM-DD
          const convertDate = (d: string) => {
            if (!d) return '';
            const [day, month, year] = d.split('-');
            return `${year}-${month}-${day}`;
          };
          const purchaseDate = convertDate(purchaseDateRaw);
          const warrantyExpiry = convertDate(warrantyExpiryRaw);
          const temp3Val = reminderFlagRaw === 'active' ? '1' : '0';

          const matchedType = dbTypes.find(t =>
          (t.type_name?.toLowerCase() === type.toLowerCase() ||
            t.TYPE_NAME?.toLowerCase() === type.toLowerCase() ||
            t.name?.toLowerCase() === type.toLowerCase())
          );
          const realTypeId = matchedType.type_id || matchedType.Type_id || matchedType.id;

          const matchedSubCat = dbSubCats.find(c =>
          (c.name?.toLowerCase() === category.toLowerCase() ||
            c.sub_category_name?.toLowerCase() === category.toLowerCase() ||
            c.SUB_CATEGORY_NAME?.toLowerCase() === category.toLowerCase())
          );
          const realSubCatId = matchedSubCat.sub_category_id || matchedSubCat.SUB_CATEGORY_ID || matchedSubCat.id;

          // Unique Serial Number Generation
          const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
          const sanitizedName = name.replace(/\s+/g, '').toUpperCase();
          const serial = `${sanitizedName}-${uniqueSuffix}`;

          // ID and Tag generation
          const assetNumericIds = this.assets.map(a => {
            const match = (a.id || '').match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          });
          const maxAssetId = assetNumericIds.length > 0 ? Math.max(...assetNumericIds) : 0;
          const nextId = `asset_${String(maxAssetId + 1 + successCount).padStart(3, '0')}`;
          const nextTag = `${type.slice(0, 2).toUpperCase()}-${name.replace(/\s+/g, '-').slice(0, 8).toUpperCase()}-${String(maxAssetId + 1 + successCount).padStart(3, '0')}`;

          const asset: Asset = {
            id: nextId,
            assetTag: nextTag,
            name: name,
            type: type as any,
            category: category,
            subCategory: category,
            status: 'Available',
            location: 'To Be Assigned',
            purchaseDate: purchaseDate,
            warrantyExpiry: warrantyExpiry,
            vendor: 'Internal',
            serialNumber: serial,
            cost: 0,
            condition: AssetCondition.GOOD,
            temp3: temp3Val,
            temp5: warrantyExpiry ? '30' : 'Not Set',
            temp6: warrantyExpiry ? '15' : 'Not Set',
            temp7: warrantyExpiry ? '7' : 'Not Set'
          };

          await this.assetService.addAssetCordys(asset, realTypeId, realSubCatId);
          successCount++;
        }

        this.notificationService.showToast(`Successfully imported ${successCount} assets.`, 'success');
        await this.loadData();
        this.activeTab = 'assets';

      } catch (err) {
        console.error('File parsing/upload error', err);
        this.notificationService.showToast('Error processing file. Please ensure it is a valid Excel file.', 'error');
      } finally {
        this.isSaving = false;
        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }
      }
    };
    reader.readAsBinaryString(target.files[0]);
  }

  async saveAssetType(): Promise<void> {
    const trimmed = this.newTypeName.trim();
    if (!trimmed || this.isSaving) return;

    // Unique check
    const isDuplicate = this.assetTypes.some(t => t.type.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      this.notificationService.showToast(`Asset Type '${trimmed}' already exists.`, 'error');
      return;
    }

    this.isSaving = true;
    try {
      // Use timestamp-based unique ID to avoid any PK collision
      const nextId = `typ_${Date.now().toString().slice(-5)}`;

      await this.assetService.addAssetType(nextId, this.newTypeName.trim());
      this.notificationService.showToast(`Asset Type '${this.newTypeName}' created successfully!`, 'success');
      this.closeAddTypeModal();
      await this.loadData();

    } catch (e) {
      console.error(e);
    } finally {
      this.isSaving = false;
    }
  }

  async saveSubCategory(): Promise<void> {
    const trimmed = this.newSubCategoryName.trim();
    if (!trimmed || !this.selectedTypeIdForSubCategory || this.isSaving) return;

    // Unique check
    const isDuplicate = this.assetCategories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      this.notificationService.showToast(`Subcategory '${trimmed}' already exists.`, 'error');
      return;
    }

    this.isSaving = true;
    try {
      // Use timestamp-based unique ID to avoid any PK collision
      const nextId = `cat_${Date.now().toString().slice(-6)}`;
      await this.assetService.addAssetSubCategory(nextId, this.newSubCategoryName.trim(), this.selectedTypeIdForSubCategory);
      this.notificationService.showToast(`Subcategory '${this.newSubCategoryName}' added successfully!`, 'success');
      this.closeAddSubCategoryModal();
      await this.loadData();

    } catch (e) {
      console.error(e);
    } finally {
      this.isSaving = false;
    }
  }

  isWarrantyExpiryMandatory(): boolean {
    if (this.newAsset.isExpiryMandatory) return true;
    const type = (this.newAsset.type as string)?.toLowerCase() || '';
    return type === 'software' || type === 'hardware';
  }

  async saveAsset(): Promise<void> {
    this.submittedAssetForm = true;

    // Check for unique asset name
    const trimmedName = (this.newAsset.name || '').trim();
    const isDuplicate = this.assets.some(a => a.name.toLowerCase() === trimmedName.toLowerCase());

    if (isDuplicate) {
      this.notificationService.showToast(`An asset with the name '${trimmedName}' already exists. Asset names must be unique.`, 'error');
      return;
    }

    // Check for unique serial number
    const trimmedSerial = (this.newAsset.serialNumber || '').trim();
    if (trimmedSerial) {
      const isSerialDuplicate = this.assets.some(a => (a.serialNumber || '').toLowerCase() === trimmedSerial.toLowerCase());
      if (isSerialDuplicate) {
        this.notificationService.showToast(`An asset with serial number '${trimmedSerial}' already exists. Serial numbers must be unique.`, 'error');
        return;
      }
    }

    if (this.isPurchaseDateFuture()) {
      this.notificationService.showToast('Purchase Date cannot be in the future.', 'error');
      return;
    }

    if (this.isWarrantyExpiryPast()) {
      this.notificationService.showToast('Warranty Expiry Date cannot be in the past.', 'error');
      return;
    }

    const isExpiryFieldValid = this.isWarrantyExpiryMandatory() ? !!this.newAsset.warrantyExpiry : true;

    if (!this.newAsset.type || !this.newAsset.category || !trimmedName || !this.newAsset.serialNumber || !this.newAsset.purchaseDate || !isExpiryFieldValid || this.isSaving) {
      return;
    }

    this.isSaving = true;

    try {
      const selectedCategory = this.assetCategories.find(category => category.name === this.newAsset.category);
      // Robust Max ID increment
      const assetNumericIds = this.assets.map(a => {
        const match = (a.id || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
      const maxAssetId = assetNumericIds.length > 0 ? Math.max(...assetNumericIds) : 0;
      const nextId = `asset_${String(maxAssetId + 1).padStart(3, '0')}`;
      const nextTag = `${this.newAsset.type.slice(0, 2).toUpperCase()}-${this.newAsset.name.replace(/\s+/g, '-').slice(0, 8).toUpperCase()}-${String(maxAssetId + 1).padStart(3, '0')}`;

      const asset: Asset = {
        id: nextId,
        assetTag: nextTag,
        name: this.newAsset.name,
        type: this.newAsset.type,
        category: this.newAsset.category,
        subCategory: selectedCategory?.subCategories[0] || 'Standard',
        status: 'Available',
        location: 'To Be Assigned',
        purchaseDate: this.newAsset.purchaseDate,
        warrantyExpiry: this.newAsset.warrantyExpiry,
        vendor: 'Internal',
        serialNumber: this.newAsset.serialNumber,
        cost: 0,
        condition: AssetCondition.GOOD,
        temp3: this.newAsset.isExpiryMandatory ? '1' : '0',
        temp5: this.newAsset.warrantyExpiry ? '30' : 'Not Set',
        temp6: this.newAsset.warrantyExpiry ? '15' : 'Not Set',
        temp7: this.newAsset.warrantyExpiry ? '7' : 'Not Set'
      };

      // Securely fetch exact IDs from DB based on mapped name
      const dbTypes = await this.assetService.getAllAssetTypesCordys();
      const dbSubCats = await this.assetService.getAllSubcategoriesCordys();

      const matchedType = dbTypes.find(t => (t.type_name === this.newAsset.type || t.TYPE_NAME === this.newAsset.type || t.name === this.newAsset.type));
      const realTypeId = matchedType ? (matchedType.type_id || matchedType.Type_id || matchedType.TYPE_ID || matchedType.id) : `typ_${this.newAsset.type.toLowerCase().slice(0, 3)}`;

      const matchedSubCat = dbSubCats.find(c => (c.name === selectedCategory?.name || c.sub_category_name === selectedCategory?.name || c.SUB_CATEGORY_NAME === selectedCategory?.name));
      const realSubCatId = matchedSubCat ? (matchedSubCat.sub_category_id || matchedSubCat.SUB_CATEGORY_ID || matchedSubCat.id) : (selectedCategory?.id || `cat_999`);

      await this.assetService.addAssetCordys(asset, realTypeId, realSubCatId);

      this.notificationService.showToast(`Asset '${asset.name}' registered successfully!`, 'success');
      this.closeAddAssetModal();
      await this.loadData();
      this.activeTab = 'assets';

    } catch (e) {
      console.error(e);
    } finally {
      this.isSaving = false;
    }
  }

  async deleteAssetType(typeId: string | undefined): Promise<void> {
    if (!typeId) return;

    // Find the type object to get its name
    const typeObj = this.assetTypes.find(t => t.id === typeId);
    if (typeObj) {
      // Check if any subcategories belong to this type string
      const hasSubCategories = this.assetCategories.some(cat => cat.type === typeObj.type);
      if (hasSubCategories) {
        this.openConfirmModal(
          'Cannot Delete Type',
          `This Asset Type ('${typeObj.type}') has active Subcategories mapped to it. Please delete all related subcategories first.`,
          () => { },
          true // isWarning only
        );
        return;
      }
    }

    this.openConfirmModal(
      'Delete Asset Type',
      'Are you sure you want to delete this Asset Type? This action cannot be undone.',
      async () => {
        this.isSaving = true;
        try {
          await this.assetService.deleteAssetTypeCordys(typeId);
          this.notificationService.showToast('Asset Type deleted successfully.', 'success');
          await this.loadData();
        } catch (e: any) {
          if (e?.message?.includes('foreign key constraint') || e?.message?.includes('Constraint')) {
            alert('Integrity Error: Cannot delete Asset Type because there are dependent records in the database.');
          } else {
            alert('Failed to delete Asset Type.');
          }
          console.error(e);
        } finally {
          this.isSaving = false;
        }
      }
    );
  }

  async deleteSubCategory(subCatId: string): Promise<void> {
    const subCat = this.assetCategories.find(c => c.id === subCatId);
    if (subCat) {
      // Check if any assets belong to this subcategory (matches name and type)
      const hasAssets = this.assets.some(a =>
        (String(a.category || a.subCategory).toLowerCase() === subCat.name.toLowerCase()) &&
        a.type === subCat.type
      );

      if (hasAssets) {
        this.openConfirmModal(
          'Cannot Delete Subcategory',
          `The subcategory '${subCat.name}' contains active Assets. Please delete or re-assign all assets belonging to this category first.`,
          () => { },
          true // isWarning only
        );
        return;
      }
    }

    this.openConfirmModal(
      'Delete Subcategory',
      'Are you sure you want to delete this subcategory?',
      async () => {
        this.isSaving = true;
        try {
          await this.assetService.deleteAssetSubCategoryCordys(subCatId);
          this.notificationService.showToast('Subcategory deleted successfully.', 'success');
          await this.loadData();
        } catch (e: any) {
          if (e?.message?.includes('foreign key constraint') || e?.message?.includes('Constraint')) {
            alert('Integrity Error: Cannot delete Subcategory because there are assets attached to it in the system.');
          } else {
            alert('Failed to delete Subcategory.');
          }
          console.error(e);
        } finally {
          this.isSaving = false;
        }
      }
    );
  }

  async deleteAsset(assetId: string): Promise<void> {
    const asset = this.assets.find(a => a.id === assetId);

    // Allow deletion for 'Available' or blank statuses
    const status = (asset?.status || '').toLowerCase().trim();
    const canDelete = status === 'available' || status === '';

    if (!asset || !canDelete) {
      this.openConfirmModal(
        'Cannot Delete Asset',
        `This asset ('${asset?.name || 'Asset'}') is currently in '${asset?.status || 'Unknown'}' status. Only assets with 'Available' or blank status can be deleted.`,
        () => { },
        true // isWarning only (hides the Confirm button)
      );
      return;
    }

    this.openConfirmModal(
      'Delete Asset',
      'Are you sure you want to permanently delete this asset record?',
      async () => {
        this.isSaving = true;
        try {
          await this.assetService.deleteAssetCordys(assetId);
          this.notificationService.showToast('Asset record deleted successfully.', 'success');
          await this.loadData();
        } catch (e: any) {
          alert('Failed to delete Asset.');
          console.error(e);
        } finally {
          this.isSaving = false;
        }
      }
    );
  }

  async makeAssetAvailable(asset: Asset): Promise<void> {
    this.openConfirmModal(
      'Make Asset Available',
      `Are you sure you want to release '${asset.name}'? This will remove it from ${asset.assignedToName || 'the current user'}'s holding and make it Available for new allocations.`,
      async () => {
        this.isSaving = true;
        try {
          // Resolve raw IDs for the service call
          const dbTypes = await this.assetService.getAllAssetTypesCordys();
          const dbSubCats = await this.assetService.getAllSubcategoriesCordys();

          const matchedType = dbTypes.find(t => (t.type_name === asset.type || t.TYPE_NAME === asset.type || t.name === asset.type));
          const typeId = matchedType ? (matchedType.type_id || matchedType.Type_id || matchedType.id) : '';

          const matchedSubCat = dbSubCats.find(c => (c.name === asset.category || c.sub_category_name === asset.category));
          const subCatId = matchedSubCat ? (matchedSubCat.sub_category_id || matchedSubCat.SUB_CATEGORY_ID || matchedSubCat.id) : '';

          const rawAsset = {
            asset_id: asset.id,
            asset_name: asset.name,
            type_id: typeId,
            sub_category_id: subCatId,
            serial_number: asset.serialNumber,
            purchase_date: asset.purchaseDate,
            warranty_expiry: asset.warrantyExpiry,
            status: asset.status,
            temp1: asset.assignedTo,
            temp2: asset.requestId || '',
            temp3: asset.reminderDays || 30
          };

          await this.assetService.releaseAsset(rawAsset);
          this.notificationService.showToast('Asset released successfully and is now Available.', 'success');
          await this.loadData();
        } catch (e) {
          console.error('Error releasing asset:', e);
          this.notificationService.showToast('Failed to release asset. Please try again.', 'error');
        } finally {
          this.isSaving = false;
        }
      },
      false,
      'Confirm Release',
      'info'
    );
  }

  confirmIcon = 'warning';
  confirmIconClass = 'header-icon-danger';

  openConfirmModal(title: string, message: string, callback: () => void, isWarning: boolean = false, btnText: string = 'Delete', iconType: 'warning' | 'info' | 'danger' = 'warning') {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.onConfirmCallback = callback;
    this.showConfirmAction = !isWarning;
    this.confirmBtnText = btnText;
    this.confirmIcon = iconType === 'info' ? 'info' : 'warning';
    this.confirmIconClass = iconType === 'info' ? 'header-icon-info' : 'header-icon-danger';
    this.showConfirmModal = true;
  }

  closeConfirmModal() {
    this.showConfirmModal = false;
    this.onConfirmCallback = null;
  }

  handleConfirm() {
    if (this.onConfirmCallback) {
      this.onConfirmCallback();
    }
    this.closeConfirmModal();
  }

  canDeleteAsset(asset: Asset): boolean {
    const status = (asset?.status || '').toLowerCase().trim();
    return status === 'available' || status === '';
  }

  isFieldInvalid(field: keyof typeof this.newAsset): boolean {
    if (this.submittedAssetForm) {
      if (field === 'warrantyExpiry') {
        if (this.newAsset.isExpiryMandatory && !this.newAsset.warrantyExpiry) return true;
        return this.isWarrantyExpiryPast();
      }

      if (!this.newAsset[field]) return true;

      if (field === 'purchaseDate') return this.isPurchaseDateFuture();
    }
    return false;
  }

  isPurchaseDateFuture(): boolean {
    if (!this.newAsset.purchaseDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pDate = new Date(this.newAsset.purchaseDate);
    pDate.setHours(0, 0, 0, 0);
    return pDate > today;
  }

  isWarrantyExpiryPast(): boolean {
    if (!this.newAsset.warrantyExpiry) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const wDate = new Date(this.newAsset.warrantyExpiry);
    wDate.setHours(0, 0, 0, 0);
    return wDate < today;
  }

  filterAssets(): void {
    this.filteredAssets = this.assets.filter(asset => {
      const search = this.assetSearchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        asset.name.toLowerCase().includes(search) ||
        asset.assetTag.toLowerCase().includes(search) ||
        asset.category.toLowerCase().includes(search) ||
        asset.vendor.toLowerCase().includes(search);
      const matchesType = !this.selectedAssetType || asset.type === this.selectedAssetType;
      const matchesSubCategory = !this.selectedAssetSubCategory || asset.subCategory === this.selectedAssetSubCategory;
      const matchesStatus = !this.selectedAssetStatus || asset.status === this.selectedAssetStatus;
      return matchesSearch && matchesType && matchesSubCategory && matchesStatus;
    }).sort((a, b) => b.id.localeCompare(a.id));
    this.currentPage = 1;
  }

  get paginatedAssets() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredAssets.slice(startIndex, startIndex + this.pageSize);
  }

  get totalPages() {
    return Math.ceil(this.filteredAssets.length / this.pageSize);
  }

  get pageNumbers() {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  get paginatedSubAssets() {
    const startIndex = (this.subDetailsCurrentPage - 1) * this.subDetailsPageSize;
    return this.assetsInSelectedSub.slice(startIndex, startIndex + this.subDetailsPageSize);
  }

  get subDetailsTotalPages() {
    return Math.ceil(this.assetsInSelectedSub.length / this.subDetailsPageSize);
  }

  get subDetailsPageNumbers() {
    return Array.from({ length: this.subDetailsTotalPages }, (_, i) => i + 1);
  }

  setSubPage(page: number) {
    if (page >= 1 && page <= this.subDetailsTotalPages) {
      this.subDetailsCurrentPage = page;
    }
  }

  nextPage() {
    this.currentPage++;
  }

  prevPage() {
    this.currentPage--;
  }

  getAssetTypeIcon(type: AssetType | string): string {
    const icons: Record<string, string> = {
      [AssetType.HARDWARE]: 'laptop',
      [AssetType.SOFTWARE]: 'code',
      [AssetType.NETWORK]: 'router',
      [AssetType.PERIPHERAL]: 'mouse',
      [AssetType.FURNITURE]: 'chair'
    };
    return icons[type] || 'category';
  }

  getAssetTypeColor(type: AssetType | string): string {
    const colors: Record<string, string> = {
      [AssetType.HARDWARE]: '#3b82f6',
      [AssetType.SOFTWARE]: '#8b5cf6',
      [AssetType.NETWORK]: '#f59e0b',
      [AssetType.PERIPHERAL]: '#14b8a6',
      [AssetType.FURNITURE]: '#ec4899'
    };
    return colors[type] || '#94a3b8';
  }

  getTypeBadgeClass(type: AssetType | string): string {
    const map: Record<string, string> = {
      [AssetType.HARDWARE]: 'badge-blue',
      [AssetType.SOFTWARE]: 'badge-green',
      [AssetType.NETWORK]: 'badge-amber',
      [AssetType.PERIPHERAL]: 'badge-teal',
      [AssetType.FURNITURE]: 'badge-default'
    };
    return map[type] || 'badge-default';
  }

  getStatusBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('available')) return 'badge-green';
    if (s.includes('allocated')) return 'badge-blue';
    if (s.includes('repair') || s.includes('maintenance')) return 'badge-amber';
    if (s.includes('retired')) return 'badge-default';
    if (s.includes('reserved') || s.includes('team')) return 'badge-teal';
    return 'badge-default';
  }

  getConditionBadgeClass(condition: AssetCondition): string {
    const map: Record<string, string> = {
      [AssetCondition.NEW]: 'badge-blue',
      [AssetCondition.GOOD]: 'badge-green',
      [AssetCondition.FAIR]: 'badge-amber',
      [AssetCondition.POOR]: 'badge-default',
      [AssetCondition.DAMAGED]: 'badge-red'
    };
    return map[condition] || 'badge-default';
  }

  getProjectBadgeClass(status: Project['status']): string {
    const map: Record<string, string> = {
      Active: 'badge-green',
      Completed: 'badge-blue',
      'On Hold': 'badge-amber',
      Cancelled: 'badge-default'
    };
    return map[status] || 'badge-default';
  }

  formatAssetStatus(status: string): string {
    if (status === 'MoveToAllocationTeam') return 'Allocation Team';
    return status;
  }

  private async getResolvedProjects(): Promise<Project[]> {
    try {
      return await this.adminDataService.getProjectsFromDB();
    } catch (error) {
      console.error('Unable to load DB projects for master data.', error);
      return [];
    }
  }

  private async loadAssetsFromService(): Promise<void> {
    try {
      await this.assetService.fetchAssetsFromService();
    } catch (error) {
      console.error('Unable to load DB assets for master data.', error);
    }
  }

  private buildAssetCategoryGroups(): AssetCategoryGroup[] {
    const categoryMap = new Map<AssetType | string, AssetCategory[]>();

    this.assetCategories.forEach(category => {
      const categories = categoryMap.get(category.type) || [];
      categories.push(category);
      categoryMap.set(category.type, categories);
    });

    return this.assetTypes
      .map(item => ({
        type: item.type,
        icon: categoryMap.get(item.type)?.[0]?.icon || this.getAssetTypeIcon(item.type),
        categories: categoryMap.get(item.type) || [],
        assetCount: item.count
      }));
  }

  private buildEnrichedSubcategories(): EnrichedSubcategory[] {
    return this.assetCategories.map(cat => {
      const subAssets = this.assets.filter(a => {
        const assetCatName = String(a.category || a.subCategory || '').trim().toLowerCase();
        const catSearchName = String(cat.name || '').trim().toLowerCase();
        const assetTypeName = String(a.type || '').trim().toLowerCase();
        const catTypeName = String(cat.type || '').trim().toLowerCase();

        return assetCatName === catSearchName && assetTypeName === catTypeName;
      });

      const total = subAssets.length;
      const assigned = subAssets.filter(a => String(a.status).toLowerCase() === 'allocated').length;
      const available = total - assigned;
      const utilization = total > 0 ? Math.round((assigned / total) * 100) : 0;
      const value = subAssets.reduce((sum, a) => sum + (Number(a.cost) || 0), 0);

      // Calculate warranty health (active vs expired)
      const now = new Date();
      const healthy = subAssets.filter(a => {
        if (!a.warrantyExpiry) return false;
        return new Date(a.warrantyExpiry) > now;
      }).length;
      const warrantyHealth = total > 0 ? Math.round((healthy / total) * 100) : 100;

      return {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        icon: cat.icon || this.getAssetTypeIcon(cat.type),
        totalCount: total,
        availableCount: available,
        assignedCount: assigned,
        utilizationRate: utilization,
        totalValue: value,
        warrantyHealth: warrantyHealth
      };
    }).sort((a, b) => b.totalCount - a.totalCount);
  }

  filterSubcategories() {
    this.subCatCurrentPage = 1;
    if (!this.selectedSubCategoryTypeFilter) {
      this.filteredEnrichedSubcategories = [...this.enrichedSubcategories];
    } else {
      this.filteredEnrichedSubcategories = this.enrichedSubcategories.filter(sub =>
        String(sub.type).trim().toLowerCase() === String(this.selectedSubCategoryTypeFilter).trim().toLowerCase()
      );
    }
  }

  get paginatedSubcategories() {
    const startIndex = (this.subCatCurrentPage - 1) * this.subCatPageSize;
    return this.filteredEnrichedSubcategories.slice(startIndex, startIndex + this.subCatPageSize);
  }

  get totalSubCatPages() {
    return Math.ceil(this.filteredEnrichedSubcategories.length / this.subCatPageSize);
  }

  get subCatPageNumbers() {
    return Array.from({ length: this.totalSubCatPages }, (_, i) => i + 1);
  }

  setSubCatPage(page: number) {
    if (page >= 1 && page <= this.totalSubCatPages) {
      this.subCatCurrentPage = page;
    }
  }

  openSubDetails(sub: EnrichedSubcategory) {
    this.selectedSubForDetail = sub;
    this.subDetailsCurrentPage = 1;
    this.assetsInSelectedSub = this.assets.filter(a =>
      String(a.category || a.subCategory).toLowerCase() === String(sub.name).toLowerCase() &&
      a.type === sub.type
    ).sort((a, b) => b.id.localeCompare(a.id));
    this.showSubDetailModal = true;
  }

  closeSubDetails() {
    this.showSubDetailModal = false;
    this.selectedSubForDetail = null;
    this.assetsInSelectedSub = [];
  }

  openAssetDetails(asset: Asset) {
    this.selectedAssetForDetail = asset;
    this.showAssetDetailModal = true;
  }

  closeAssetDetails() {
    this.showAssetDetailModal = false;
    this.selectedAssetForDetail = null;
  }

  isWarrantyExpired(dateStr: string | undefined): boolean {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return expiry < now;
  }

  private createEmptyAsset(): AddAssetForm {
    return {
      type: '',
      category: '',
      name: '',
      serialNumber: '',
      purchaseDate: '',
      warrantyExpiry: '',
      isExpiryMandatory: false
    };
  }
}

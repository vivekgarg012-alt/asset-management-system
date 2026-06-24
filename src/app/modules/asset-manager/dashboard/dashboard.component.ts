import { Component, OnInit } from '@angular/core';
import { AssetService } from '../../../core/services/asset.service';
import { RequestService } from '../../../core/services/request.service';
import { AuthService } from '../../../core/services/auth.service';
import { AdminDataService } from '../../../core/services/admin-data.service';


@Component({
  selector: 'app-manager-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class ManagerDashboardComponent implements OnInit {
  // Top-level stats
  totalInventory = 0;
  allocatedAssets = 0;
  allocationTeamAssets = 0;
  availableAssets = 0;
  pendingRequestsCount = 0;

  // Categorized Pending Counts
  newRequestsPendingCount = 0;
  returnRequestsPendingCount = 0;
  extendRequestsPendingCount = 0;
  maintenanceRequestsPendingCount = 0;


  // Type breakdown (filtered to manager's type)
  typeBreakdown: TypeBreakdown[] = [];

  // Subcategory-level breakdown used by the donut chart
  chartBreakdown: TypeBreakdown[] = [];

  // The asset type name assigned to the logged-in asset manager
  managerAssetTypeName = '';

  // Total for percentage calculation
  grandTotal = 0;

  // Loading state
  isLoading = true;
  loadError = '';

  // Icon & color mapping for known types
  private typeStyleMap: Record<string, { icon: string; color: string; bgColor: string }> = {
    'hardware':   { icon: 'computer',   color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
    'software':   { icon: 'code',       color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.1)' },
    'network':    { icon: 'router',     color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
    'peripheral': { icon: 'mouse',      color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
    'furniture':  { icon: 'chair',      color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.1)' }
  };

  // Fallback colors for unknown types
  private fallbackColors = [
    { icon: 'category', color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.1)' },
    { icon: 'widgets',  color: '#14b8a6', bgColor: 'rgba(20, 184, 166, 0.1)' },
    { icon: 'inventory_2', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.1)' }
  ];

  // Known mapping of subcategory names → type key (lowercase)
  // Used to assign subcategory counts from GetDashboardData to their parent type
  private subCategoryTypeMapping: Record<string, string> = {
    'laptop': 'hardware', 'monitor': 'hardware', 'desktop': 'hardware',
    'server': 'hardware', 'workstation': 'hardware', 'tablet': 'hardware',
    'productivity suite': 'software', 'development tools': 'software',
    'design tools': 'software', 'software license': 'software',
    'ide license': 'software', 'license': 'software',
    'antivirus': 'software', 'ms office': 'software',
    'router': 'network', 'switch': 'network', 'access point': 'network',
    'firewall': 'network',
    'keyboard': 'peripheral', 'mouse': 'peripheral', 'headphones': 'peripheral',
    'webcam': 'peripheral', 'printer': 'peripheral',
    'desk': 'furniture', 'chair': 'furniture', 'cabinet': 'furniture'
  };

  constructor(
    private assetService: AssetService,
    private requestService: RequestService,
    private authService: AuthService,
    private adminDataService: AdminDataService
  ) {}


  ngOnInit(): void {
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      const currentUser = this.authService.getCurrentUser();
      const managerId = currentUser?.id || 'usr_004';

      // 1. Fetch all data in parallel
      const [
        typeCounts, 
        allAssets, 
        allocatedAssets, 
        allocationTeamAssets,
        pendingReqs,
        confirmReqs,
        returnReqs,
        warrantyReqs,
        maintenanceReqs,
        allAssignments
      ] = await Promise.all([
        this.assetService.fetchAssetTypeWiseCount(),
        this.assetService.fetchAssetsFromService(),
        this.assetService.fetchAllocatedAssetsFromService(),
        this.assetService.fetchAllocationTeamAssetsFromService(),
        this.requestService.fetchPendingRequestsFromService(managerId),
        this.requestService.fetchConfirmationRequestsFromService(managerId),
        this.requestService.fetchPendingReturnApprovalsFromService(managerId),
        this.requestService.fetchPendingWarrantyApprovalsFromService(managerId),
        this.requestService.fetchPendingServiceApprovals(managerId),
        this.adminDataService.getAssetTypeAssignmentDetails()
      ]);

      // 2. Resolve manager's assigned types
      const myAssignments = allAssignments.filter((a: any) =>
        a.assetManagerId && a.assetManagerId.toLowerCase().trim() === managerId.toLowerCase().trim()
      );
      const managerTypeNames = myAssignments.map((a: any) => a.name.toLowerCase().trim());
      console.log(`[Dashboard] Manager ${managerId} assigned to types:`, managerTypeNames);

      const isMyType = (item: any) => {
        if (managerTypeNames.length === 0) return true;
        const type = (item.type || item.assetType || '').toString().toLowerCase().trim();
        const typeId = (item.type_id || item.typeId || item.asset_type_id || '').toString().toLowerCase().trim();
        
        if (type && managerTypeNames.includes(type)) {
          return true;
        }
        if (typeId) {
          return myAssignments.some((a: any) => 
            a.id.toLowerCase().trim() === typeId || 
            a.name.toLowerCase().trim() === typeId
          );
        }
        return false;
      };

      // 3. Filter ALL data based on assignments
      const filteredAllAssets = allAssets.filter(isMyType);
      const filteredAllocated = allocatedAssets.filter(isMyType);
      const filteredATAssets = allocationTeamAssets.filter(isMyType);
      const filteredPending = pendingReqs.filter(isMyType);
      const filteredConfirm = confirmReqs.filter(isMyType);
      const filteredReturn = returnReqs.filter(isMyType);
      const filteredWarranty = warrantyReqs.filter(isMyType);
      const filteredMaintenance = maintenanceReqs.filter(isMyType);

      // 4. Calculate Top-Level Stat Cards (using filtered data)
      this.totalInventory = filteredAllAssets.length;
      this.allocatedAssets = filteredAllocated.length;
      this.allocationTeamAssets = filteredATAssets.length;
      this.availableAssets = filteredAllAssets.filter(a => a.status?.toLowerCase() === 'available').length;

      const allPending = [
        ...filteredPending.map(r => ({ ...r, displayType: 'New Asset' })),
        ...filteredConfirm.map(r => ({ ...r, displayType: 'Confirmation' })),
        ...filteredReturn.map(r => ({ ...r, displayType: 'Return' })),
        ...filteredWarranty.map(r => ({ ...r, displayType: 'Warranty' })),
        ...filteredMaintenance.map(r => ({ ...r, displayType: 'Maintenance' }))
      ];

      this.pendingRequestsCount = allPending.length;
      this.newRequestsPendingCount = filteredPending.length + filteredConfirm.length;
      this.returnRequestsPendingCount = filteredReturn.length;
      this.extendRequestsPendingCount = filteredWarranty.length;
      this.maintenanceRequestsPendingCount = filteredMaintenance.length;

      // 5. Build Breakdown Data
      const breakdownMap: Record<string, { count: number, subCats: Record<string, number> }> = {};
      filteredAllAssets.forEach(asset => {
        const type = (asset.type || 'Other').toString();
        const typeKey = type.toLowerCase().trim();
        const subCat = asset.subCategory || 'Uncategorized';

        if (!breakdownMap[typeKey]) {
          breakdownMap[typeKey] = { count: 0, subCats: {} };
        }
        breakdownMap[typeKey].count++;
        breakdownMap[typeKey].subCats[subCat] = (breakdownMap[typeKey].subCats[subCat] || 0) + 1;
      });

      let fallbackIndex = 0;
      this.typeBreakdown = typeCounts
        .filter(tc => managerTypeNames.length === 0 || managerTypeNames.includes(tc.type_name.toLowerCase().trim()))
        .map(tc => {
          const typeName = tc.type_name;
          const key = typeName.toLowerCase().trim();
          const style = this.typeStyleMap[key] || this.fallbackColors[fallbackIndex++ % this.fallbackColors.length];
          const calculatedData = breakdownMap[key];
          
          const subCategoriesArray = calculatedData 
            ? Object.keys(calculatedData.subCats).map(name => ({
                name: name,
                count: calculatedData.subCats[name]
              })).sort((a, b) => b.count - a.count)
            : [];

          return {
            type: typeName,
            icon: style.icon,
            color: style.color,
            bgColor: style.bgColor,
            count: tc.asset_count,
            subCategories: subCategoriesArray
          };
        });

      this.typeBreakdown.sort((a, b) => b.count - a.count);
      this.managerAssetTypeName = this.typeBreakdown.map(tb => tb.type).join(' & ');

      // 6. Build chartBreakdown (Donut chart)
      const subColors = [
        { icon: 'devices',      color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
        { icon: 'laptop',       color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.1)' },
        { icon: 'monitor',      color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
        { icon: 'memory',       color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
        { icon: 'tablet_mac',   color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.1)' },
        { icon: 'dns',          color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.1)' },
        { icon: 'category',     color: '#14b8a6', bgColor: 'rgba(20, 184, 166, 0.1)' },
        { icon: 'inventory_2',  color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.1)' }
      ];
      let subColorIdx = 0;

      const allSubCategorySlices: TypeBreakdown[] = [];
      this.typeBreakdown.forEach(parentType => {
        parentType.subCategories.forEach(sub => {
          const style = subColors[subColorIdx++ % subColors.length];
          allSubCategorySlices.push({
            type: sub.name,
            icon: style.icon,
            color: style.color,
            bgColor: style.bgColor,
            count: sub.count,
            subCategories: []
          });
        });
      });
      this.chartBreakdown = allSubCategorySlices.sort((a, b) => b.count - a.count).slice(0, 8);
      this.grandTotal = this.chartBreakdown.reduce((sum, item) => sum + item.count, 0);

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      this.loadError = 'Failed to load dashboard statistics.';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Attempts to guess the parent type from a subcategory name if not in the mapping.
   */
  private guessTypeFromName(name: string): string {
    // Default to 'hardware' if we can't determine the type
    return 'hardware';
  }

  getTypePercentage(count: number): number {
    if (this.grandTotal === 0) return 0;
    return Math.round((count / this.grandTotal) * 100);
  }

  // ===== Interactive Pie Chart Hover =====
  hoveredTypeIndex: number = -1;

  onTypeHover(index: number): void {
    this.hoveredTypeIndex = index;
  }

  onTypeLeave(): void {
    this.hoveredTypeIndex = -1;
  }

  /**
   * Generates an SVG arc path for a donut slice at the given index.
   * Center: (120,120), outer radius: 110, inner radius: 66
   */
  getSlicePath(index: number): string {
    if (this.grandTotal === 0) return '';

    const cx = 120, cy = 120;
    const outerR = 110, innerR = 66;

    // Calculate start angle (cumulative of all previous slices)
    let startAngleDeg = -90; // Start from 12 o'clock
    for (let i = 0; i < index; i++) {
      startAngleDeg += (this.chartBreakdown[i].count / this.grandTotal) * 360;
    }
    const sliceAngleDeg = (this.chartBreakdown[index].count / this.grandTotal) * 360;
    const endAngleDeg = startAngleDeg + sliceAngleDeg;

    const startRad = (startAngleDeg * Math.PI) / 180;
    const endRad = (endAngleDeg * Math.PI) / 180;

    const x1 = cx + outerR * Math.cos(startRad);
    const y1 = cy + outerR * Math.sin(startRad);
    const x2 = cx + outerR * Math.cos(endRad);
    const y2 = cy + outerR * Math.sin(endRad);
    const x3 = cx + innerR * Math.cos(endRad);
    const y3 = cy + innerR * Math.sin(endRad);
    const x4 = cx + innerR * Math.cos(startRad);
    const y4 = cy + innerR * Math.sin(startRad);

    const largeArc = sliceAngleDeg > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  }

  getSubCatPercentage(subCount: number, typeCount: number): number {
    if (typeCount === 0) return 0;
    return Math.round((subCount / typeCount) * 100);
  }
}

interface SubCategory {
  name: string;
  count: number;
}

interface TypeBreakdown {
  type: string;
  icon: string;
  color: string;
  bgColor: string;
  count: number;
  subCategories: SubCategory[];
}

import { Component, OnInit } from '@angular/core';
import { AssetService } from '../../../core/services/asset.service';
import { RequestService } from '../../../core/services/request.service';
import { HeroService } from '../../../core/services/hero.service';
import { NotificationService } from 'src/app/core/services/notification.service';

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {
  loading = false;
  selectedReport: string | null = null;
  reportData: any[] = [];
  filteredData: any[] = [];
  filters: { [key: string]: string } = {};
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  
  filterableHeaders = ['Name', 'Category', 'Type', 'Status', 'Asset Type', 'Asset Name'];

  reports: ReportConfig[] = [
    { id: 'inventory', title: 'Current Inventory Snap-Shot', description: 'Live status of all managed assets including availability.', icon: 'inventory_2' },
    { id: 'deployment', title: 'Asset Deployment Log', description: 'Historical history of asset allocations and assignments.', icon: 'history' },
    { id: 'warranty', title: 'Warranty & Retirement Forecast', description: 'Forecast of assets reaching end-of-service in coming months.', icon: 'event' }
  ];

  constructor(
    private assetService: AssetService,
    private requestService: RequestService,
    private hs: HeroService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {}

  async generateReport(type: string): Promise<void> {
    this.selectedReport = type;
    this.loading = true;
    this.reportData = [];
    this.filteredData = [];
    this.filters = {};
    this.currentPage = 1;

    try {
      if (type === 'inventory') {
        const [assets, users] = await Promise.all([
          this.assetService.fetchAssetsFromService(),
          this.hs.ajax('GetAllUserRoleProjectDetails', 'http://schemas.cordys.com/AMS_Database_Metadata', {})
        ]);

        // Build User Map
        const userTuples = this.hs.xmltojson(users, 'tuple');
        const userList = Array.isArray(userTuples) ? userTuples : (userTuples ? [userTuples] : []);
        const userMap = new Map<string, string>();
        userList.forEach((u: any) => {
          const ud = u?.old?.m_users || u?.m_users || {};
          if (ud.user_id) userMap.set(ud.user_id, ud.name || 'Unknown');
        });

        this.reportData = assets.map(a => {
          // Priority: 1. Service Map Name, 2. Global User Map, 3. Unassigned (for available)
          let assignedUser = 'Unassigned';
          if (a.status && a.status.toLowerCase() !== 'available') {
            assignedUser = a.assignedToName || userMap.get(a.assignedTo || '') || 'Unknown User';
          }

          return {
            'Asset Tag': a.assetTag,
            'Name': a.name,
            'Category': a.category,
            'Sub-Category': a.type,
            'Status': a.status,
            'Assigned User': assignedUser
          };
        });
      } 
      else if (type === 'deployment') {
        const res = await this.hs.ajax('Getallrequest', 'http://schemas.cordys.com/AMS_Database_Metadata', {});
        const tuples = this.hs.xmltojson(res, 't_asset_requests');
        const data = Array.isArray(tuples) ? tuples : (tuples ? [tuples] : []);
        
        const formatDate = (dateStr: string) => {
          if (!dateStr || dateStr === 'N/A') return 'N/A';
          try {
            const d = new Date(dateStr);
            return d.getFullYear() + '-' + 
                   String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(d.getDate()).padStart(2, '0');
          } catch { return dateStr; }
        };

        this.reportData = data
          .map((t: any) => {
            const r = t || {};
            const u = t?.m_users || {};
            // Attempt to get asset name from temp1 (sub-category name) or asset_type
            const assetName = r.temp1 && r.temp1 !== '-' ? r.temp1 : r.asset_type;
            
            return {
              'Request ID': r.request_id,
              'Assigned Date': formatDate(r.created_at),
              'Employee': u.name || 'N/A',
              'Asset': r.asset_type,
              'Asset Name': assetName
            };
          })
          .filter(r => r['Assigned Date'] !== 'N/A');
      }
      else if (type === 'warranty') {
        const assets = await this.assetService.fetchAssetsFromService();
        this.reportData = assets
          .filter(a => a.warrantyExpiry)
          .map(a => ({
            'Asset Tag': a.assetTag,
            'Name': a.name,
            'Category': a.category,
            'Purchase Date': a.purchaseDate || 'N/A',
            'Warranty Expiry': a.warrantyExpiry
          }))
          .sort((a,b) => new Date(a['Warranty Expiry']).getTime() - new Date(b['Warranty Expiry']).getTime());
      }

      this.applyFilters();
      this.notification.showToast(`${this.reports.find(r => r.id === type)?.title} Generated`, 'success');
    } catch (err) {
      console.error('Report Generation Error:', err);
      this.notification.showToast('Failed to generate report data', 'error');
    } finally {
      this.loading = false;
    }
  }

  // --- Filtering Logic ---
  onFilterChange(header: string, value: string): void {
    if (value) {
      this.filters[header] = value;
    } else {
      delete this.filters[header];
    }
    this.applyFilters();
  }

  isFilterable(header: string): boolean {
    return this.filterableHeaders.includes(header);
  }

  getFilterOptions(header: string): string[] {
    const options = new Set<string>();
    this.reportData.forEach(row => {
      if (row[header]) options.add(String(row[header]));
    });
    return Array.from(options).sort();
  }

  applyFilters(): void {
    this.filteredData = this.reportData.filter(row => {
      return Object.keys(this.filters).every(header => {
        const filterValue = this.filters[header];
        const cellValue = String(row[header] || '');
        return cellValue.toLowerCase().includes(filterValue.toLowerCase());
      });
    });
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.filters = {};
    this.applyFilters();
  }

  hasFilters(): boolean {
    return Object.keys(this.filters).length > 0;
  }

  // --- Pagination Methods ---
  get totalPages(): number {
    return Math.ceil(this.filteredData.length / this.pageSize) || 1;
  }

  get paginatedData(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredData.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getRangeStart(): number {
    return this.filteredData.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  getRangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredData.length);
  }

  downloadCSV(): void {
    if (this.filteredData.length === 0) return;
    const headers = Object.keys(this.filteredData[0]);
    
    const csvRows = [
      headers.join(','),
      ...this.filteredData.map(row => 
        headers.map(header => {
          let val = row[header];
          if (val === null || val === undefined) val = '';
          const stringVal = String(val).replace(/"/g, '""');
          return `"${stringVal}"`;
        }).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${this.selectedReport}_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getSelectedReportTitle(): string {
    return this.reports.find(r => r.id === this.selectedReport)?.title || 'Report';
  }

  getHeaders(): string[] {
    return this.reportData.length > 0 ? Object.keys(this.reportData[0]) : [];
  }
}

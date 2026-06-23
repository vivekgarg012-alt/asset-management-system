import { Component, OnInit } from '@angular/core';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { AdminDataService, AssetRequest } from 'src/app/core/services/admin-data.service';
import { RequestService } from 'src/app/core/services/request.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationService } from 'src/app/core/services/notification.service';


Chart.register(...registerables);

@Component({
  selector: 'app-asset-transaction',
  templateUrl: './asset-transaction.component.html',
  styleUrls: ['./asset-transaction.component.scss']
})
export class AssetTransactionComponent implements OnInit {

  allRequests: AssetRequest[] = [];
  filteredRequests: AssetRequest[] = [];
  pagedRequests: AssetRequest[] = [];
  userRolesMap = new Map<string, string>();

  selectedStatus = 'All';
  selectedRequestType = 'All';
  searchTerm = '';
  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = [10, 25, 50];

  isLoading = false;
  errorMessage = '';

  totalTransactions = 0;
  pendingCount = 0;
  approvedCount = 0;
  rejectedCount = 0;


  transactionStatusData: ChartData<'doughnut'> = {
    labels: ['Approved Requests', 'Pending', 'Rejected'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      hoverBackgroundColor: ['#059669', '#d97706', '#dc2626'],
      borderWidth: 0
    }]
  };

  transactionStatusOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' }
    },
    cutout: '70%'
  };

  transactionTrendData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      label: 'Requests',
      data: [],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };

  transactionTrendOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  statusOptions: string[] = ['All', 'Approved', 'Pending', 'Rejected'];
  requestTypeOptions: string[] = ['All', 'New Asset Requests', 'Extend Warranty Requests', 'Return Requests', 'Service Requests'];

  constructor(
    private adminDataService: AdminDataService,
    private requestService: RequestService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadRequests();
  }

  async loadRequests(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      // 1. Fetch all data sources + user master list in parallel
      const [newAssetRequests, warrantyRequests, returnRequests, serviceRequests, allUsers] = await Promise.all([
        this.adminDataService.getAllRequests(),
        this.requestService.fetchAllWarrantyRequests(),
        this.requestService.fetchAllReturnRequestsFromService(),
        this.requestService.getAllServiceRequests(),
        this.adminDataService.GetAllUserRoleProjectDetails()
      ]);

      // Create a lookup map for resolving missing user info
      const userMap = new Map<string, { name: string, email: string }>();
      this.userRolesMap.clear();
      allUsers.forEach(u => {
        if (u.id) {
          const key = u.id.toString().trim().toLowerCase();
          userMap.set(key, { name: u.name, email: u.email });
          this.userRolesMap.set(key, u.role || 'Employee');
        }
      });

      const resolveInfo = (id: any, name: string, email: string) => {
        const key = (id || '').toString().trim().toLowerCase();
        const info = userMap.get(key);
        return {
          name: (name && name !== 'System User') ? name : (info?.name || name || 'Unknown User'),
          email: email || (info?.email || '')
        };
      };

      // 2. Add type identifiers and normalize New Asset requests
      const normalizedNewAssets = newAssetRequests.map(r => ({
        ...r,
        requestType: 'New Asset Requests'
      }));

      // 3. Map Warranty Requests
      const mappedWarranty = warrantyRequests.map((r: any) => {
        const user = resolveInfo(r.requesterId, r.requesterName, r.requesterEmail);
        return {
          requestId: r.id || r.requestNumber,
          userId: r.requesterId,
          userName: user.name,
          userEmail: user.email,
          assetType: r.assetType || 'Hardware',
          reason: r.justification || '',
          urgency: r.urgency || 'Medium',
          status: r.status || 'Pending',
          emailApproval: r.hasEmailApproval || false,
          document: r.document || '',
          createdAt: r.requestDate || '',
          subCategory: 'Warranty Extension',
          requestType: 'Extend Warranty Requests'
        };
      });

      // 4. Map Return Requests
      const mappedReturns = returnRequests.map((r: any) => {
        const user = resolveInfo(r.requesterId, r.requesterName, r.requesterEmail);
        return {
          requestId: r.id || r.requestNumber,
          userId: r.requesterId,
          userName: user.name,
          userEmail: user.email,
          assetType: r.assetType || 'Hardware',
          reason: r.justification || '',
          urgency: r.urgency || 'Low',
          status: r.status || 'Pending',
          emailApproval: r.hasEmailApproval || false,
          document: r.document || '',
          createdAt: r.requestDate || '',
          subCategory: 'Asset Return',
          requestType: 'Return Requests'
        };
      });

      // 5. Map Service Requests
      const mappedService = serviceRequests.map((r: any) => {
        const user = resolveInfo(r.user_id, '', '');
        return {
          requestId: r.service_request_id,
          userId: r.user_id,
          userName: user.name,
          userEmail: user.email,
          assetType: r.asset_type_id || 'Hardware',
          reason: r.issue_description || '',
          urgency: r.urgency || 'Medium',
          status: r.status || r.current_status || 'Pending',
          rawStatus: r.status || r.current_status || 'Pending',
          emailApproval: false,
          document: r.document || '',
          createdAt: r.created_at || '',
          subCategory: 'Service / Maintenance',
          requestType: 'Service Requests'
        };
      });

      // 6. Normalize and Combine all requests
      this.allRequests = [
        ...normalizedNewAssets,
        ...mappedWarranty,
        ...mappedReturns,
        ...mappedService
      ].map(r => ({
        ...r,
        status: this.normalizeStatus(r.status)
      }));

      this.allRequests.sort((a, b) => {
        const timeA = this.toMillis(a.createdAt);
        const timeB = this.toMillis(b.createdAt);
        if (timeB !== timeA) return timeB - timeA;
        
        // Secondary sort by ID descending (numeric awareness for ex_100 vs ex_99)
        const idA = a.requestId || '';
        const idB = b.requestId || '';
        return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
      });
      this.updateDashboardCards();
      this.updateCharts();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading asset requests:', error);
      this.errorMessage = 'Unable to load asset requests. Please try again.';
      this.allRequests = [];
      this.filteredRequests = [];
      this.pagedRequests = [];
    } finally {
      this.isLoading = false;
    }
  }

  onRequestTypeChange(value: string): void {
    this.selectedRequestType = value;
    this.setPage(1);
    this.applyFilters();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.setPage(1);
    this.applyFilters();
  }

  onStatusChange(value: string): void {
    this.selectedStatus = value;
    this.setPage(1);
    this.applyFilters();
  }

  onPageSizeChange(value: string | number): void {
    this.pageSize = Number(value);
    this.setPage(1);
    this.updatePagedData();
  }

  setPage(page: number): void {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
    this.updatePagedData();
  }

  nextPage(): void {
    this.setPage(this.currentPage + 1);
  }

  prevPage(): void {
    this.setPage(this.currentPage - 1);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRequests.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];

    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i);
      } else if (current >= total - 2) {
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        for (let i = current - 2; i <= current + 2; i++) pages.push(i);
      }
    }
    return pages;
  }

  get startRecord(): number {
    return this.filteredRequests.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get endRecord(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredRequests.length);
  }

  private normalizeStatus(status: any): string {
    if (!status) return 'Pending';
    const s = status.toString().trim().toLowerCase();
    
    // Approved statuses
    if (s === 'approved' || s === 'completed' || s === 'closed' || s === 'success' || s === 'resolved') return 'Approved';
    
    // Rejected statuses
    if (s === 'rejected' || s === 'failed' || s === 'declined' || s === 'cancelled') return 'Rejected';
    
    // Everything else is Pending
    return 'Pending';
  }

  getStatusClass(status: string): string {
    const s = (status || '').toString().trim().toLowerCase();
    if (s === 'approved') return 'status-completed';
    if (s === 'pending') return 'status-pending';
    if (s === 'rejected') return 'status-rejected';
    return '';
  }

  private applyFilters(): void {
    const statusFilter = this.selectedStatus.trim().toLowerCase();
    const typeFilter = this.selectedRequestType;
    const search = this.searchTerm.trim().toLowerCase();

    this.filteredRequests = this.allRequests.filter((request) => {
      // 1. Status Filter
      const matchesStatus = statusFilter === 'all' || 
                           (request.status && request.status.toString().trim().toLowerCase() === statusFilter);

      if (!matchesStatus) {
        return false;
      }

      // 2. Request Type Filter
      const matchesType = typeFilter === 'All' || request.requestType === typeFilter;
      if (!matchesType) {
        return false;
      }

      // 3. Search Filter
      if (!search) {
        return true;
      }

      return (
        request.requestId.toLowerCase().includes(search) ||
        request.userName.toLowerCase().includes(search) ||
        request.userEmail.toLowerCase().includes(search) ||
        request.subCategory.toLowerCase().includes(search) ||
        request.reason.toLowerCase().includes(search) ||
        request.urgency.toLowerCase().includes(search) ||
        (request.requestType && request.requestType.toLowerCase().includes(search))
      );
    });

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    this.updatePagedData();
  }

  private updatePagedData(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.pagedRequests = this.filteredRequests.slice(startIndex, startIndex + this.pageSize);
  }

  private updateDashboardCards(): void {
    this.totalTransactions = this.allRequests.length;
    this.pendingCount = this.allRequests.filter(r => this.isStatus(r.status, 'Pending')).length;
    this.approvedCount = this.allRequests.filter(r => this.isStatus(r.status, 'Approved')).length;
    this.rejectedCount = this.allRequests.filter(r => this.isStatus(r.status, 'Rejected')).length;
  }

  private isStatus(status: any, target: string): boolean {
    if (!status) return target === 'pending';
    return status.toString().trim().toLowerCase() === target.toLowerCase();
  }

  private updateCharts(): void {
    this.transactionStatusData = {
      ...this.transactionStatusData,
      datasets: [{
        ...this.transactionStatusData.datasets[0],
        data: [
          this.allRequests.filter(r => this.isStatus(r.status, 'approved')).length,
          this.allRequests.filter(r => this.isStatus(r.status, 'pending')).length,
          this.allRequests.filter(r => this.isStatus(r.status, 'rejected')).length
        ]
      }]
    };

    const trend = this.getLastSixMonthsTrend();
    this.transactionTrendData = {
      labels: trend.labels,
      datasets: [{
        ...this.transactionTrendData.datasets[0],
        data: trend.counts
      }]
    };
  }

  private getLastSixMonthsTrend(): { labels: string[], counts: number[] } {
    const validDates = this.allRequests
      .map(request => new Date(request.createdAt))
      .filter(date => !Number.isNaN(date.getTime()));
    const anchorDate = validDates.length
      ? new Date(Math.max(...validDates.map(date => date.getTime())))
      : new Date();

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels: string[] = [];
    const monthKeys: string[] = [];
    const countsByMonth = new Map<string, number>();

    for (let index = 5; index >= 0; index -= 1) {
      const monthDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - index, 1);
      const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
      monthKeys.push(monthKey);
      labels.push(`${months[monthDate.getMonth()]} ${String(monthDate.getFullYear()).slice(2)}`);
      countsByMonth.set(monthKey, 0);
    }

    this.allRequests.forEach((request) => {
      const date = new Date(request.createdAt);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (countsByMonth.has(monthKey)) {
        countsByMonth.set(monthKey, (countsByMonth.get(monthKey) || 0) + 1);
      }
    });

    return {
      labels,
      counts: monthKeys.map((key) => countsByMonth.get(key) || 0)
    };
  }

  private toMillis(dateValue: string): number {
    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  getStatusLabel(status: string): string {
    const s = (status || '').toString().trim().toLowerCase();
    if (s === 'approved') return 'APPROVED';
    if (s === 'rejected') return 'REJECTED';
    if (s === 'pending') return 'PENDING';
    return s.toUpperCase() || 'PENDING';
  }

  async downloadDocument(doc: string, requestId?: string): Promise<void> {
    console.log('[AssetTransaction] downloadDocument called. doc:', doc, '| requestId:', requestId);

    // Use doc (the document field from the request) as the server path
    let serverPath = doc;

    // If doc is empty/null, try fetching from DB by requestId
    if ((!serverPath || serverPath === 'null') && requestId) {
      try {
        const docInfo = await this.requestService.getRequestDocumentInfo(requestId);
        serverPath = docInfo?.filePath || '';
      } catch (e) {
        console.error('[AssetTransaction] Failed to fetch doc info:', e);
      }
    }

    if (!serverPath || serverPath === 'null') {
      this.notificationService.showToast('No attachment found for this request.', 'error');
      return;
    }

    // Use the SOAP DownloadFile_AMS service to fetch the file
    await this.fetchAndOpenFile(serverPath, 'view');
  }

  private async fetchAndOpenFile(serverPath: string, action: 'view' | 'download'): Promise<void> {
    const displayName = this.extractFileName(serverPath);
    this.notificationService.showToast(`Fetching: ${displayName}...`, 'info');

    try {
      const parts = serverPath.split(/[\\\/]/);
      const fileName = parts.pop() || '';
      const dirPath = parts.join('\\');

      if (!fileName || !dirPath) {
        this.notificationService.showToast('Invalid file path.', 'error');
        return;
      }

      const base64Content = await this.requestService.downloadFileFromServer(fileName, dirPath);

      if (!base64Content || base64Content.length < 10) {
        this.notificationService.showToast('File content is empty or could not be retrieved.', 'error');
        return;
      }

      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const mimeMap: { [key: string]: string } = {
        'pdf': 'application/pdf', 'png': 'image/png',
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';

      const byteChars = atob(base64Content);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      if (action === 'view') {
        window.open(blobUrl, '_blank');
        this.notificationService.showToast(`Opened: ${displayName}`, 'success');
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = displayName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.notificationService.showToast(`Downloaded: ${displayName}`, 'success');
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err: any) {
      console.error('[AssetTransaction] File fetch failed:', err);
      this.notificationService.showToast(`Failed to fetch file: ${err?.message || 'Unknown error'}`, 'error');
    }
  }

  extractFileName(path: string): string {
    if (!path) return 'attachment';
    const parts = path.split(/[\\\/]/);
    return parts[parts.length - 1] || 'attachment';
  }

  formatSubcategory(subCatId: string): string {
    if (!subCatId || subCatId === '-') return '-';

    const subCatMap: { [key: string]: string } = {
      'cat_001': 'Laptop',
      'cat_002': 'Software License',
      'cat_003': 'Monitor',
      'cat_004': 'Peripheral'
    };

    // Return mapped name if exists, otherwise return the id itself (in case it's already a name).
    return subCatMap[subCatId.toLowerCase()] || subCatId;
  }

  // Keeping this just in case other parts of the component still depend on it
  formatAssetType(type: string): string {
    if (!type) {
      return '-';
    }
    if (type.startsWith('typ_')) {
      return 'Hardware';
    }
    return type;
  }

  getRequesterInitials(name: string): string {
    const normalizedName = (name || '').trim();
    if (!normalizedName) {
      return '?';
    }

    const parts = normalizedName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }


  trackByRequestId(index: number, request: AssetRequest): string {
    return request.requestId || `${index}`;
  }

  // ===== Progress Tracking Modal =====
  showTrackingModal = false;
  selectedTrackRequest: AssetRequest | null = null;
  loadingProgress = false;
  trackingSteps: any[] = [];
  overallProgress = 0;

  async trackRequest(request: AssetRequest): Promise<void> {
    this.selectedTrackRequest = request;
    this.showTrackingModal = true;
    this.loadingProgress = true;
    this.trackingSteps = [];
    this.overallProgress = 0;

    try {
      const progressData = await this.getAdminProgressData(request);

      // Sort chronologically
      progressData.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const stages = this.getAdminStagesForRequest(request);

      let availableProgress = [...progressData];

      // Resolve actual approver names from the DB
      const resolvedNames = await this.resolveApproverNamesForAdmin(request);

      this.trackingSteps = stages.map((stage, index) => {
        const isDistributionStep = index === (stages.length - 1) && stage.name === 'Asset Manager' && stages.length > 2;

        let foundIndex = -1;
        for (let i = availableProgress.length - 1; i >= 0; i--) {
          const p = availableProgress[i];
          if (stage.roles.some((role: string) => p.stage?.toLowerCase().includes(role))) {
            foundIndex = i;
            break;
          }
        }

        let data = null;
        if (foundIndex !== -1) {
          data = availableProgress[foundIndex];
          availableProgress.splice(foundIndex, 1);
        }

        let isCompleted = false;
        let isCurrent = false;

        if (data) {
          isCompleted = data.status === 'Approved' || data.status === 'Completed';
          isCurrent = data.status === 'Pending';
        } else {
          if (request.requestType !== 'Return Requests' && request.requestType !== 'Service Requests') {
            isCompleted = request.status.toLowerCase() === 'completed' || request.status.toLowerCase() === 'approved';
          }
        }

        // Resolve names: prefer DB name > resolved lookup name > fallback
        const dbName = data?.approverName?.trim();
        const genericPlaceholders = ['assigned approver', 'pending', 'to be assigned', 'null', 'undefined', '', 'assignedapprover'];
        const isPlaceholder = (val: string | undefined) => !val || genericPlaceholders.includes(val.toLowerCase().trim());

        let resolvedName = !isPlaceholder(dbName) ? dbName : resolvedNames[stage.name];
        if (isPlaceholder(resolvedName)) {
          resolvedName = undefined;
        }

        return {
          name: resolvedName || (request.requestType === 'Service Requests' ? stage.name : (isCompleted ? 'System Approved' : 'To be Assigned')),
          roleName: stage.name + (isDistributionStep ? ' (Distribution)' : ''),
          status: data ? data.status : (isCompleted ? 'Approved' : 'Pending'),
          timestamp: data?.timestamp,
          isCompleted: isCompleted,
          isCurrent: isCurrent,
          comments: data?.comments
        };
      });

      // Fix pending states: only the first non-completed step is "current"
      let currentStepFound = false;
      for (let i = 0; i < this.trackingSteps.length; i++) {
        const step = this.trackingSteps[i];
        if (step.status === 'Pending') {
          step.isCurrent = false;
        }
        if (!currentStepFound && !step.isCompleted) {
          step.isCurrent = true;
          currentStepFound = true;
        }
      }

      // Remove steps that have no approver assigned (not part of the actual flow)
      if (request.requestType !== 'Service Requests') {
        this.trackingSteps = this.trackingSteps.filter(step =>
          step.name !== 'To be Assigned'
        );
      }

      const rejectedIndex = this.trackingSteps.findIndex(s => s.status?.toLowerCase() === 'rejected');
      if (rejectedIndex !== -1) {
        this.trackingSteps = this.trackingSteps.slice(0, rejectedIndex + 1);
      }

      this.overallProgress = this.calculateOverallProgress(request.status);
    } catch (error) {
      console.error('Error tracking request:', error);
    } finally {
      this.loadingProgress = false;
    }
  }

  private getAdminStagesForRequest(request: AssetRequest): Array<{ name: string, roles: string[] }> {
    if (request.requestType === 'Return Requests') {
      return [
        { name: 'Asset Manager', roles: ['asset manager', 'mgr'] },
        { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] },
        { name: 'Asset Manager', roles: ['asset manager', 'mgr'] }
      ];
    }

    if (request.requestType === 'Extend Warranty Requests') {
      return [
        { name: 'Asset Manager', roles: ['asset manager', 'mgr'] },
        { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] }
      ];
    }

    if (request.requestType === 'Service Requests') {
      return [
        { name: 'Asset Manager', roles: ['stage_1'] },
        { name: 'Allocation Team', roles: ['stage_2'] },
        { name: 'Asset Manager (Final)', roles: ['stage_3'] },
        { name: 'On Service', roles: ['on_service'] },
        { name: 'Serviced', roles: ['serviced'] },
        { name: 'Handover Complete', roles: ['closed'] }
      ];
    }

    // Default: New Asset Requests
    const requesterId = (request.userId || '').toString().trim().toLowerCase();
    const requesterRole = this.userRolesMap.get(requesterId) || 'Employee';
    const isTeamLead = requesterRole.toLowerCase().includes('lead') || requesterRole === 'rol_02';
    const hasDocument = request.emailApproval || (request.document && request.document !== 'null' && request.document !== '');

    if (isTeamLead) {
      // If request is raised by team lead then tracker shouldnot show the team lead in tracker, only show asset manager-> allocation team-> asset manager
      return [
        { name: 'Asset Manager', roles: ['asset manager', 'mgr'] },
        { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] },
        { name: 'Asset Manager', roles: ['asset manager', 'mgr'] }
      ];
    }

    if (hasDocument) {
      // If request is raised by employee and document is there, then tracker should show asset manager-> asset allocation-> asset manager
      return [
        { name: 'Asset Manager', roles: ['asset manager', 'mgr'] },
        { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] },
        { name: 'Asset Manager', roles: ['asset manager', 'mgr'] }
      ];
    }

    // If request is raised by employee (without document), then show team lead-> asset manager-> asset allocation-> asset manager
    return [
      { name: 'Team Lead', roles: ['team lead', 'approver'] },
      { name: 'Asset Manager', roles: ['asset manager', 'mgr'] },
      { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] },
      { name: 'Asset Manager', roles: ['asset manager', 'mgr'] }
    ];
  }

  private async getAdminProgressData(request: AssetRequest): Promise<any[]> {
    if (request.requestType === 'Service Requests') {
      const serviceApprovals = await this.requestService.getServiceRequestApprovalChain(request.requestId);
      const userMap = await this.getAdminUserNameMap();

      const progressData = serviceApprovals.map((a: any) => ({
        stage: a.stage || a.role || 'Unknown',
        status: a.status || 'Pending',
        approverId: a.approver_id,
        approverName: userMap.get(a.approver_id) || 'Assigned Approver',
        timestamp: a.action_date,
        comments: a.remarks
      }));

      const reqStatus = this.getRawRequestStatus(request).toLowerCase();
      const statusTimestamp = new Date().toISOString();

      if (['onservice', 'on_service', 'serviced', 'closed', 'completed'].some(s => reqStatus.includes(s))) {
        progressData.push({
          stage: 'on_service',
          status: 'Approved',
          approverId: '',
          approverName: 'System',
          timestamp: statusTimestamp,
          comments: 'Asset sent to service center'
        });
      }

      if (['serviced', 'closed', 'completed'].some(s => reqStatus.includes(s))) {
        progressData.push({
          stage: 'serviced',
          status: 'Approved',
          approverId: '',
          approverName: 'System',
          timestamp: statusTimestamp,
          comments: 'Service completed'
        });
      }

      if (['closed', 'completed'].some(s => reqStatus.includes(s))) {
        progressData.push({
          stage: 'closed',
          status: 'Approved',
          approverId: '',
          approverName: 'System',
          timestamp: statusTimestamp,
          comments: 'Original asset handed back to employee'
        });
      }

      return progressData;
    }

    if (request.requestType === 'Return Requests') {
      const returnApprovals = await this.requestService.getReturnRequestProgress(request.requestId);
      const userMap = await this.getAdminUserNameMap();

      return returnApprovals.map((a: any) => ({
        stage: a.role || 'Unknown',
        status: a.status || 'Pending',
        approverId: a.approver_id,
        approverName: userMap.get(a.approver_id) || 'Assigned Approver',
        timestamp: a.action_date,
        comments: a.remarks
      }));
    }

    return this.requestService.getRequestProgress(request.requestId);
  }

  private async getAdminUserNameMap(): Promise<Map<string, string>> {
    try {
      const allUsers = await this.adminDataService.GetAllUserRoleProjectDetails();
      return new Map(allUsers.map((u: any) => [u.id, u.name]));
    } catch (e) {
      console.warn('Failed to fetch users for admin tracking name resolution:', e);
      return new Map<string, string>();
    }
  }

  private getRawRequestStatus(request: AssetRequest): string {
    return ((request as any).rawStatus || request.status || '').toString();
  }

  /**
   * Resolves actual approver names by looking up the requester's project (for Team Lead)
   * and the asset type assignment (for Asset Manager & Allocation Team).
   */
  private async resolveApproverNamesForAdmin(request: AssetRequest): Promise<Record<string, string>> {
    const resolvedNames: Record<string, string> = {};

    try {
      // 1. Resolve Team Lead from the requester's project
      if (request.userId) {
        const userDetails = await this.authService.getUserDetails(request.userId);
        if (userDetails?.projectId && userDetails.projectId !== 'null') {
          const project = await this.adminDataService.getProjectById(userDetails.projectId);
          if (project?.teamLead) {
            resolvedNames['Team Lead'] = project.teamLead;
          }
        }
      }

      // 2. Resolve Asset Manager & Allocation Team from asset type
      if (request.assetType) {
        const assignment = await this.adminDataService.getAssignmentByAssetType(request.assetType);
        if (assignment) {
          if (assignment.assetManager) resolvedNames['Asset Manager'] = assignment.assetManager;
          if (assignment.teamMembers) resolvedNames['Asset Allocation Team'] = assignment.teamMembers;
        }
      }
    } catch (err) {
      console.error('Failed to resolve approver names for admin tracking:', err);
    }

    return resolvedNames;
  }

  calculateOverallProgress(requestStatus: string): number {
    const status = requestStatus.toLowerCase();
    if (status === 'completed') return 100;
    if (status === 'rejected') return 0;

    const totalSteps = this.trackingSteps.length;
    const completedCount = this.trackingSteps.filter(s => s.isCompleted).length;

    if (totalSteps > 0 && completedCount === totalSteps) {
      return 100;
    }

    if (completedCount === 0) return 10;
    
    if (totalSteps === 4) {
      if (completedCount === 1) return 33;
      if (completedCount === 2) return 66;
      if (completedCount === 3) return 90;
    } else if (totalSteps === 3) {
      if (completedCount === 1) return 33;
      if (completedCount === 2) return 66;
    } else if (totalSteps === 2) {
      if (completedCount === 1) return 50;
    }
    
    return Math.floor((completedCount / totalSteps) * 100) || 10;
  }

  closeTrackingModal(): void {
    this.showTrackingModal = false;
    this.selectedTrackRequest = null;
    this.trackingSteps = [];
    this.overallProgress = 0;
  }

  // ===== Details Modal =====
  showDetailsModal = false;
  selectedRequest: AssetRequest | null = null;

  openDetailsModal(request: AssetRequest): void {
    this.selectedRequest = request;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedRequest = null;
  }
}

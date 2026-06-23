import { Component, OnInit } from '@angular/core';
import { RequestService } from '../../../core/services/request.service';
import { AssetService } from '../../../core/services/asset.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AdminDataService } from '../../../core/services/admin-data.service';
import { HeroService } from '../../../core/services/hero.service';
import { MailService } from '../../../core/services/mail.service';

@Component({
  selector: 'app-service-requests',
  templateUrl: './service-requests.component.html',
  styleUrls: ['./service-requests.component.scss']
})
export class ServiceRequestsComponent implements OnInit {
  activeTab: 'pending' | 'approved' | 'onservice' | 'serviced' | 'closed' | 'history' = 'pending';
  isLoading = true;
  loadError = '';

  // Data
  pendingApprovals: any[] = [];
  allServiceRequests: any[] = [];
  allServiceApprovals: any[] = [];
  serviceHistoryRows: any[] = [];
  serviceHistoryLoading = false;
  serviceHistoryFilters = {
    employee_id: '',
    asset_id: '',
    status: '',
    service_request_id: '',
    from_date: '',
    to_date: ''
  };
  allocationTeamMemberList: any[] = [];
  selectedAllocationMemberId = '';
  availableAssets: any[] = [];
  filteredTempAssets: any[] = [];
  tempAssetFallbackMode = false;

  // Drawer
  drawerOpen = false;
  selectedItem: any = null;
  actionRemarks = '';
  approvalChain: any[] = [];
  loadingChain = false;
  allUsersMap: Map<string, string> = new Map();
  isSaving = false;

  // Temp asset assign modal
  showTempAssetModal = false;
  selectedTempAssetId = '';
  tempExpectedReturnDate = '';
  pendingFinalApprovalItem: any = null;

  // Mark serviced modal
  showServicedModal = false;
  servicedBy = '';
  serviceCost = '';
  servicedRemarks = '';

  // Serviced drawer (Return Temp + Handover)
  servicedDrawerOpen = false;
  servicedDrawerItem: any = null;
  tempAssetInfo: any = null;
  tempReturnDone = false;

  // Pagination
  currentPage = 1;
  pageSize = 5;

  get minReturnDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  constructor(
    private requestService: RequestService,
    private assetService: AssetService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private adminService: AdminDataService,
    private mailService: MailService,
    private hs: HeroService
  ) {}

  ngOnInit(): void {
    this.loadAllData();
    this.loadAllUsers();
  }

  async loadAllUsers(): Promise<void> {
    try {
      const users = await this.adminService.GetAllUserRoleProjectDetails();
      if (Array.isArray(users)) {
        users.forEach((u: any) => {
          if (u.id && u.name) this.allUsersMap.set(u.id, u.name);
        });
      }
    } catch (e) {
      console.warn('Could not load users for name resolution:', e);
    }
  }

  async loadAllData(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      const currentUser = this.authService.getCurrentUser();
      const approverId = currentUser?.id;
      if (!approverId) {
        this.loadError = 'Current user is missing. Please log in again.';
        return;
      }

      const [pending, allReqs, allApprovals] = await Promise.all([
        this.requestService.fetchPendingServiceApprovals(approverId).catch(e => { console.error('Pending service fetch failed:', e); return []; }),
        this.requestService.getAllServiceRequests().catch(e => { console.error('All service requests fetch failed:', e); return []; }),
        this.requestService.getAllServiceApprovals().catch(e => { console.error('All service approvals fetch failed:', e); return []; })
      ]);

      this.pendingApprovals = pending;
      this.allServiceRequests = allReqs;
      // Filter approvals done by this manager (approved or rejected, not pending)
      this.allServiceApprovals = allApprovals
        .filter((a: any) => a.approver_id === approverId && a.status !== 'Pending')
        .sort((a: any, b: any) => {
          const da = a.action_date ? new Date(a.action_date).getTime() : 0;
          const db = b.action_date ? new Date(b.action_date).getTime() : 0;
          return db - da; // newest first
        });

      // Load available assets for temp asset assignment
      const allAssets = await this.assetService.fetchAssetDetailsFromService().catch(() => []);
      this.availableAssets = allAssets.filter((a: any) => a.status === 'Available');

      console.log(`[ServiceRequests] Loaded: ${this.pendingApprovals.length} pending, ${this.allServiceRequests.length} total`);
    } catch (err: any) {
      console.error('Failed to load service data:', err);
      this.loadError = err?.message || 'Failed to load service request data.';
    } finally {
      this.isLoading = false;
    }
  }

  switchTab(tab: 'pending' | 'approved' | 'onservice' | 'serviced' | 'closed' | 'history'): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.closeDrawer();
    if (tab === 'history' && this.serviceHistoryRows.length === 0) {
      this.loadServiceHistory();
    }
  }

  // ─── Filtered Data ──────────────────────────────────────────────────────

  get filteredPending(): any[] {
    return this.pendingApprovals;
  }

  get onServiceRequests(): any[] {
    return this.allServiceRequests.filter(r => r.status === 'OnService');
  }

  get servicedRequests(): any[] {
    return this.allServiceRequests.filter(r => r.status === 'Serviced');
  }

  get closedRequests(): any[] {
    return this.allServiceRequests.filter(r => r.status === 'Closed' || r.status === 'Rejected');
  }

  get approvedHistory(): any[] {
    return this.allServiceApprovals;
  }

  get currentData(): any[] {
    switch (this.activeTab) {
      case 'pending': return this.filteredPending;
      case 'approved': return this.approvedHistory;
      case 'onservice': return this.onServiceRequests;
      case 'serviced': return this.servicedRequests;
      case 'closed': return this.closedRequests;
      case 'history': return this.serviceHistoryRows;
      default: return [];
    }
  }

  get paginatedData(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.currentData.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.currentData.length / this.pageSize);
  }

  get pageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    return pages;
  }

  setPage(page: number): void { if (page >= 1 && page <= this.totalPages) this.currentPage = page; }
  nextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }
  prevPage(): void { if (this.currentPage > 1) this.currentPage--; }

  async loadServiceHistory(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.notificationService.showToast('Current user is missing. Please log in again.', 'error');
      return;
    }

    this.serviceHistoryLoading = true;
    try {
      const rows = await this.requestService.getAssetManagerServiceHistory({
        asset_manager_id: currentUser.id,
        ...this.serviceHistoryFilters
      });
      this.serviceHistoryRows = rows.length > 0 ? rows : this.buildServiceHistoryFallback(currentUser.id);
      this.currentPage = 1;
    } catch (error) {
      console.error('Failed to load service history:', error);
      this.notificationService.showToast('Failed to load service history.', 'error');
      this.serviceHistoryRows = this.buildServiceHistoryFallback(currentUser.id);
    } finally {
      this.serviceHistoryLoading = false;
    }
  }

  private buildServiceHistoryFallback(managerId: string): any[] {
    const relatedRequestIds = new Set<string>();
    [...this.pendingApprovals, ...this.allServiceApprovals]
      .filter((approval: any) => approval.approver_id === managerId)
      .forEach((approval: any) => {
        if (approval.service_request_id) relatedRequestIds.add(approval.service_request_id);
      });

    const hasBackendScope = relatedRequestIds.size > 0;
    return this.allServiceRequests
      .filter((request: any) => !hasBackendScope || relatedRequestIds.has(request.service_request_id))
      .map((request: any) => this.mapRequestToHistoryFallback(request, managerId))
      .filter((row: any) => this.matchesServiceHistoryFilters(row))
      .sort((a: any, b: any) => {
        const da = new Date(a.changed_at || a.created_at || 0).getTime();
        const db = new Date(b.changed_at || b.created_at || 0).getTime();
        return db - da;
      });
  }

  private mapRequestToHistoryFallback(request: any, managerId: string): any {
    const status = request.status || 'Pending';
    return {
      service_request_id: request.service_request_id || '',
      asset_id: request.asset_id || '',
      asset_name: request.temp1 || request.asset_name || request.asset_id || '',
      serial_number: request.temp2 || request.serial_number || '',
      employee_id: request.user_id || '',
      employee_name: this.allUsersMap.get(request.user_id) || request.user_id || '',
      employee_email: '',
      issue_description: request.issue_description || '',
      current_status: status,
      previous_status: this.getPreviousServiceStatus(status),
      new_status: status,
      changed_by: managerId,
      changed_by_name: this.allUsersMap.get(managerId) || 'Asset Manager',
      changed_at: request.created_at || '',
      created_at: request.created_at || '',
      history_remarks: request.issue_description || '',
      action_stage: 'Service Status',
      temp_asset_id: request.temp3 || request.allocation_id || '',
      temp_asset_name: '',
      expected_return_date: ''
    };
  }

  private getPreviousServiceStatus(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'movetoallocationteam': return 'Pending';
      case 'collectedbyteam': return 'MoveToAllocationTeam';
      case 'onservice': return 'CollectedByTeam';
      case 'serviced': return 'OnService';
      case 'closed': return 'Serviced';
      case 'rejected': return 'Pending';
      default: return 'Created';
    }
  }

  private matchesServiceHistoryFilters(row: any): boolean {
    const includes = (value: any, filter: string) =>
      !filter || String(value || '').toLowerCase().includes(filter.trim().toLowerCase());
    const rowDate = row.changed_at || row.created_at || '';

    return includes(row.employee_id, this.serviceHistoryFilters.employee_id)
      && includes(row.asset_id, this.serviceHistoryFilters.asset_id)
      && includes(row.service_request_id, this.serviceHistoryFilters.service_request_id)
      && (!this.serviceHistoryFilters.status || row.current_status === this.serviceHistoryFilters.status || row.new_status === this.serviceHistoryFilters.status)
      && (!this.serviceHistoryFilters.from_date || !rowDate || rowDate >= this.serviceHistoryFilters.from_date)
      && (!this.serviceHistoryFilters.to_date || !rowDate || rowDate <= this.serviceHistoryFilters.to_date);
  }

  resetServiceHistoryFilters(): void {
    this.serviceHistoryFilters = {
      employee_id: '',
      asset_id: '',
      status: '',
      service_request_id: '',
      from_date: '',
      to_date: ''
    };
    this.loadServiceHistory();
  }

  getHistoryStatus(row: any): string {
    return row?.new_status || row?.current_status || 'No History';
  }

  // ─── Drawer ─────────────────────────────────────────────────────────────

  async openDrawer(item: any): Promise<void> {
    const detailItem = await this.buildServiceDetailItem(item);
    this.selectedItem = {
      ...detailItem,
      isHistoryDetail: item?.status !== 'Pending'
    };
    // History rows come from t_service_approvals only, so they must be enriched before the drawer can show details.
    // this.selectedItem = {
    //   ...item,
    //   isHistoryDetail: item?.status !== 'Pending'
    // };
    /*
    this.selectedItem = {
      ...item,
      isHistoryDetail: item?.status !== 'Pending'
    };
    */
    this.drawerOpen = true;
    this.actionRemarks = '';
    this.approvalChain = [];
    this.allocationTeamMemberList = [];
    this.selectedAllocationMemberId = '';
    this.loadingChain = true;
    try {
      const chain = await this.requestService.getServiceRequestApprovalChain(item.service_request_id);
      this.approvalChain = chain.map((a: any) => ({
        ...a,
        approver_name: this.allUsersMap.get(a.approver_id) || a.approver_id || 'Unknown'
      }));
    } catch (e) {
      console.warn('Failed to load approval chain:', e);
    } finally {
      this.loadingChain = false;
    }

    if (this.selectedItem.status === 'Pending') {
      await this.loadAllocationTeamMemberForItem(item);
    }
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.selectedItem = null;
    this.actionRemarks = '';
    this.approvalChain = [];
  }

  private async buildServiceDetailItem(item: any): Promise<any> {
    let detailItem = { ...item };
    const requestId = item?.service_request_id;

    const requestRow = this.allServiceRequests.find((request: any) => request.service_request_id === requestId);
    if (requestRow) {
      detailItem = {
        ...requestRow,
        ...detailItem,
        issue_description: detailItem.issue_description || requestRow.issue_description,
        asset_id: detailItem.asset_id || requestRow.asset_id,
        user_id: detailItem.user_id || requestRow.user_id,
        tl_id: detailItem.tl_id || requestRow.tl_id,
        urgency: detailItem.urgency || requestRow.urgency,
        needs_temp_asset: detailItem.needs_temp_asset ?? requestRow.needs_temp_asset,
        created_at: detailItem.created_at || requestRow.created_at,
        req_temp1: detailItem.req_temp1 || requestRow.temp1,
        req_temp2: detailItem.req_temp2 || requestRow.temp2,
        req_temp3: detailItem.req_temp3 || requestRow.temp3
      };
    }

    if (detailItem.user_id && (!detailItem.requester_name || !detailItem.requester_email)) {
      const employee = await this.getServiceUserContact(detailItem.user_id, detailItem.requester_name, detailItem.requester_email);
      detailItem.requester_name = detailItem.requester_name || employee.name;
      detailItem.requester_email = detailItem.requester_email || employee.email;
    }

    if (detailItem.asset_id && (!detailItem.asset_name || !detailItem.asset_serial)) {
      const asset = await this.assetService.getAssetDetails(detailItem.asset_id).catch(() => null);
      if (asset) {
        detailItem.asset_name = detailItem.asset_name || asset.name;
        detailItem.asset_serial = detailItem.asset_serial || asset.serialNumber || asset.assetTag;
      }
    }

    return detailItem;
  }

  /** Get accumulated remarks for the current stage: employee reason + all previous stage remarks */
  getAccumulatedRemarks(): { source: string; text: string; date?: string }[] {
    if (!this.selectedItem) return [];
    const remarks: { source: string; text: string; date?: string }[] = [];

    // Employee's original reason
    if (this.selectedItem.issue_description) {
      remarks.push({
        source: 'Employee',
        text: this.selectedItem.issue_description,
        date: this.selectedItem.created_at
      });
    }

    // Add remarks from all completed approval stages before the current one
    for (const a of this.approvalChain) {
      if (a.status !== 'Pending' && a.remarks && a.remarks !== 'Waiting for collection' && a.remarks !== 'Waiting for final approval' && a.remarks !== 'waiting for approval') {
        remarks.push({
          source: this.getStageLabel(a.stage) + ' (' + (this.allUsersMap.get(a.approver_id) || a.approver_id) + ')',
          text: a.remarks,
          date: a.action_date
        });
      }
    }

    return remarks;
  }

  getApprovalChainIcon(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'approved') return 'check_circle';
    if (s === 'rejected') return 'cancel';
    return 'radio_button_unchecked';
  }

  getApprovalChainClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'approved') return 'chain-approved';
    if (s === 'rejected') return 'chain-rejected';
    return 'chain-pending';
  }

  getRequesterName(): string {
    return this.selectedItem?.requester_name || this.allUsersMap.get(this.selectedItem?.user_id) || 'Unknown';
  }

  getRequesterEmail(): string {
    return this.selectedItem?.requester_email || '—';
  }

  private async getServiceUserContact(userId?: string, fallbackName?: string, fallbackEmail?: string): Promise<{ name: string; email: string }> {
    if (!userId) {
      return { name: fallbackName || 'User', email: fallbackEmail || '' };
    }

    const user = await this.authService.getUserDetails(userId).catch(() => null);
    return {
      name: user?.name || fallbackName || this.allUsersMap.get(userId) || 'User',
      email: user?.email || fallbackEmail || ''
    };
  }

  private async loadAllocationTeamMemberForItem(item: any): Promise<void> {
    if (item?.stage !== 'STAGE_1_MANAGER') return;

    try {
      const assetTypeId = item.asset_type_id || (item.asset_id ? await this.requestService.getTypeIdFromAssetId(item.asset_id) : '');
      if (!assetTypeId) {
        console.warn('Unable to resolve asset type for service request:', item?.service_request_id);
        return;
      }

      const userId = await this.requestService.getUserIdByTypeAndRole(assetTypeId, 'rol_05');
      const user = await this.authService.getUserDetails(userId).catch(() => null);

      this.selectedAllocationMemberId = userId;
      this.allocationTeamMemberList = [{
        user_id: userId,
        name: user?.name || this.allUsersMap.get(userId) || userId,
        email: user?.email || ''
      }];
    } catch (err) {
      console.error('Failed to resolve allocation team member for service request:', err);
      this.allocationTeamMemberList = [];
      this.selectedAllocationMemberId = '';
    }
  }

  getSelectedAllocationMemberName(): string {
    const member = this.allocationTeamMemberList.find(m => m.user_id === this.selectedAllocationMemberId);
    if (!member) return 'Not Assigned';

    return member.email ? `${member.name} - ${member.email}` : member.name;
  }

  private getServiceAssetLabel(item: any): string {
    return item?.asset_name || item?.req_temp1 || item?.asset_id || 'Service Asset';
  }

  /** Finds the approval chain entry for a specific stage key */
  getChainEntry(stageKey: string): any | null {
    return this.approvalChain.find(a => a.stage === stageKey) || null;
  }

  getStageLabel(stage: string): string {
    if (stage === 'STAGE_1_MANAGER') return 'Asset Manager (Stage 1)';
    if (stage === 'STAGE_2_ALLOCATION') return 'Allocation Team (Stage 2)';
    if (stage === 'STAGE_3_MANAGER_FINAL') return 'Asset Manager Final (Stage 3)';
    return stage || 'Unknown';
  }

  // ─── Stage 1: Asset Manager Initial Approval ───────────────────────────

  async approveStage1(item: any): Promise<void> {
    if (this.isSaving) return;
    if (!this.selectedAllocationMemberId) {
      this.notificationService.showToast('No allocation team member available.', 'error');
      return;
    }
    this.isSaving = true;
    try {
      // 1. Update current approval to Approved
      const updateApproval = {
        tuple: {
          old: { t_service_approvals: { approval_id: item.approval_id } },
          new: { t_service_approvals: { status: 'Approved', remarks: this.actionRemarks || 'Approved by Asset Manager' } }
        }
      };
      await this.requestService.createEntryForServiceApproval(updateApproval);

      // 2. Update service request status to MoveToAllocationTeam
      const updateRequest = {
        tuple: {
          old: { t_service_requests: { service_request_id: item.service_request_id } },
          new: { t_service_requests: { status: 'MoveToAllocationTeam' } }
        }
      };
      await this.requestService.createEntryForServiceRequest(updateRequest);

      // 3. Create Stage 2 approval row for Allocation Team Member
      const createStage2 = {
        tuple: {
          new: {
            t_service_approvals: {
              service_request_id: item.service_request_id,
              approver_id: this.selectedAllocationMemberId,
              role: 'Allocation Team Member',
              stage: 'STAGE_2_ALLOCATION',
              status: 'Pending',
              remarks: 'Waiting for collection',
              action_date: new Date().toISOString(),
              temp1: item.asset_id || ''
            }
          }
        }
      };
      await this.requestService.createEntryForServiceApproval(createStage2);

      // 4. Complete BPM task
      if (item.temp7) {
        await this.requestService.completeUserTask({ TaskId: item.temp7, Action: 'COMPLETE' } as any);
      }

      const currentUser = this.authService.getCurrentUser();
      const employee = await this.getServiceUserContact(item.user_id, item.requester_name, item.requester_email);
      const allocationMember = this.allocationTeamMemberList.find(member => member.user_id === this.selectedAllocationMemberId);
      await this.mailService.sendServiceRequestNotification({
        stage: 'stage1_approved',
        serviceRequestId: item.service_request_id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        allocationName: allocationMember?.name || 'Allocation Team',
        allocationEmail: allocationMember?.email,
        assetManagerName: currentUser?.name || 'Asset Manager',
        assetName: this.getServiceAssetLabel(item),
        assetTag: item.asset_serial || item.req_temp2,
        remarks: this.actionRemarks || 'Approved by Asset Manager',
        actionByName: currentUser?.name || 'Asset Manager'
      });

      this.notificationService.showToast(`Service request ${item.service_request_id} approved and forwarded to Allocation Team.`, 'success');
      this.closeDrawer();
      await this.loadAllData();
    } catch (err) {
      console.error('Stage 1 approval failed:', err);
      this.notificationService.showToast('Failed to approve service request.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  // ─── Stage 3: Asset Manager Final Approval ─────────────────────────────

  async approveStage3(item: any): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;
    try {
      const currentUser = this.authService.getCurrentUser();
      await this.requestService.finalServiceApprovalService({
        service_request_id: item.service_request_id,
        approval_id: item.approval_id,
        approver_id: currentUser?.id || '',
        remarks: this.actionRemarks || 'Final approval granted'
      });

      await this.completeWorkflowTaskForApproval(item);

      const employee = await this.getServiceUserContact(item.user_id, item.requester_name, item.requester_email);
      const teamLead = await this.getServiceUserContact(item.tl_id, 'Team Lead', '');
      await this.mailService.sendServiceRequestNotification({
        stage: 'stage3_approved',
        serviceRequestId: item.service_request_id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        teamLeadName: teamLead.name,
        teamLeadEmail: teamLead.email,
        assetManagerName: currentUser?.name || 'Asset Manager',
        assetName: this.getServiceAssetLabel(item),
        assetTag: item.asset_serial || item.req_temp2,
        remarks: this.actionRemarks || 'Final approval granted',
        actionByName: currentUser?.name || 'Asset Manager',
        tempAssetId: item.req_temp3 || item.temp3 || ''
      });

      this.notificationService.showToast(`Service request ${item.service_request_id} final approval granted. Asset is now On Service.`, 'success');
      this.closeDrawer();
      await this.loadAllData();
    } catch (err: any) {
      console.error('Stage 3 final approval failed:', err);
      this.isSaving = false;
      throw err; // re-throw so handleApprove can catch and show temp asset modal if needed
    } finally {
      this.isSaving = false;
    }
  }

  // ─── Reject (any stage) ────────────────────────────────────────────────

  async rejectApproval(item: any): Promise<void> {
    if (this.isSaving) return;
    if (!this.actionRemarks || this.actionRemarks.trim() === '') {
      this.notificationService.showToast('Remarks are required for rejection.', 'error');
      return;
    }
    this.isSaving = true;
    try {
      // Update approval to Rejected
      const updateApproval = {
        tuple: {
          old: { t_service_approvals: { approval_id: item.approval_id } },
          new: { t_service_approvals: { status: 'Rejected', remarks: this.actionRemarks } }
        }
      };
      await this.requestService.createEntryForServiceApproval(updateApproval);

      // Update service request to Rejected
      const updateRequest = {
        tuple: {
          old: { t_service_requests: { service_request_id: item.service_request_id } },
          new: { t_service_requests: { status: 'Rejected' } }
        }
      };
      await this.requestService.createEntryForServiceRequest(updateRequest);

      await this.completeWorkflowTaskForApproval(item);

      this.notificationService.showToast(`Service request ${item.service_request_id} rejected.`, 'success');
      this.closeDrawer();
      await this.loadAllData();
    } catch (err) {
      console.error('Rejection failed:', err);
      this.notificationService.showToast('Failed to reject service request.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  // ─── Temp Asset Assignment ─────────────────────────────────────────────

  private async completeWorkflowTaskForApproval(item: any): Promise<void> {
    const taskId = item?.temp7 || await this.requestService.getServiceApprovalTaskId(item?.approval_id);

    if (!taskId) {
      console.warn(`[ServiceRequests] No workflow task id found for approval ${item?.approval_id}. PerformTaskAction skipped.`);
      return;
    }

    await this.requestService.completeUserTask({ TaskId: taskId, Action: 'COMPLETE' } as any);
  }

  openTempAssetModal(item: any): void {
    this.selectedItem = item;
    this.showTempAssetModal = true;
    this.selectedTempAssetId = '';
    this.tempExpectedReturnDate = '';
    this.filterTempAssetsForItem(item);
  }

  /**
   * Filters available assets to match the original asset's type & category.
   * Priority 1: Same type_id + sub_category_id
   * Priority 2: Same type_id only
   * Fallback:   All available assets with a warning message
   */
  private filterTempAssetsForItem(item: any): void {
    const originalTypeId = item.asset_type_id || '';
    const originalSubCategory = item.asset_sub_category || '';
    const originalAssetId = item.asset_id || '';

    // Exclude the original asset itself from candidates
    const candidates = this.availableAssets.filter(a => a.asset_id !== originalAssetId);

    // Priority 1: Exact match — same type_id AND sub_category_id
    let filtered: any[] = [];
    if (originalTypeId && originalSubCategory) {
      filtered = candidates.filter(a =>
        a.type_id === originalTypeId && a.sub_category_id === originalSubCategory
      );
    }

    // Priority 2: Same type_id only (broader match within same type)
    if (filtered.length === 0 && originalTypeId) {
      filtered = candidates.filter(a => a.type_id === originalTypeId);
    }

    // Priority 3: Fallback — show all available with warning
    if (filtered.length === 0) {
      this.filteredTempAssets = candidates;
      this.tempAssetFallbackMode = true;
    } else {
      this.filteredTempAssets = filtered;
      this.tempAssetFallbackMode = false;
    }

    console.log(`[TempAssetFilter] Original: type=${originalTypeId}, category=${originalSubCategory}. Matched: ${this.filteredTempAssets.length} assets. Fallback: ${this.tempAssetFallbackMode}`);
  }

  closeTempAssetModal(): void {
    this.showTempAssetModal = false;
    this.selectedTempAssetId = '';
    this.tempExpectedReturnDate = '';
  }

  isTempAssetFormValid(): boolean {
    return !!this.selectedTempAssetId && !!this.tempExpectedReturnDate && this.tempExpectedReturnDate >= this.minReturnDate;
  }

  async assignTempAsset(): Promise<void> {
    if (!this.selectedTempAssetId || !this.selectedItem) {
      this.notificationService.showToast('Please select a temporary asset.', 'error');
      return;
    }
    if (!this.tempExpectedReturnDate) {
      this.notificationService.showToast('Expected return date is required.', 'error');
      return;
    }
    if (this.tempExpectedReturnDate < this.minReturnDate) {
      this.notificationService.showToast('Expected return date cannot be in the past.', 'error');
      return;
    }
    this.isSaving = true;
    try {
      const currentUser = this.authService.getCurrentUser();
      const assignedTo = this.selectedItem.user_id || this.selectedItem.requester_id || '';
      
      // 1. Call custom Java service to assign the asset
      await this.requestService.assignTempAssetService({
        service_request_id: this.selectedItem.service_request_id,
        temp_asset_id: this.selectedTempAssetId,
        assigned_to: assignedTo,
        assigned_by: currentUser?.id || '',
        expected_return_date: this.tempExpectedReturnDate || '',
        remarks: 'Temporary asset assigned during service'
      });

      // 2. Explicitly link the temp asset to the service request in the database
      // The FinalServiceApproval DB procedure checks this field to verify assignment
      const updateRequest = {
        tuple: {
          old: { t_service_requests: { service_request_id: this.selectedItem.service_request_id } },
          new: { t_service_requests: { temp3: this.selectedTempAssetId } }
        }
      };
      await this.requestService.createEntryForServiceRequest(updateRequest);

      // 2.1 Ensure the temp asset has allocated metadata in m_assets (temp4 = allocated date).
      // Some environments may not update temp4 inside the custom Java service, so we set it explicitly.
      const updateTempAsset = {
        tuple: {
          old: { m_assets: { asset_id: this.selectedTempAssetId } },
          new: {
            m_assets: {
              // Use dedicated status for temporary allocation during service
              status: 'TempAllocate',
              temp1: assignedTo,
              temp4: new Date().toISOString().split('T')[0]
            }
          }
        }
      };
      await this.requestService.updateAssetStatus(updateTempAsset as any);

      // 3. Update the item in local memory so the UI knows it's assigned
      this.selectedItem.req_temp3 = this.selectedTempAssetId;

      this.notificationService.showToast('Temporary asset assigned successfully.', 'success');

      // If this was triggered from Stage 3 final approval, proceed with final approval now
      if (this.pendingFinalApprovalItem) {
        const finalItem = this.pendingFinalApprovalItem;
        this.pendingFinalApprovalItem = null;
        this.closeTempAssetModal();
        await this.approveStage3(finalItem);
      } else {
        this.closeTempAssetModal();
        await this.loadAllData();
      }
    } catch (err: any) {
      console.error('Assign temp asset failed:', err);
      this.notificationService.showToast(err?.message || 'Failed to assign temporary asset.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  // ─── Mark as Serviced ──────────────────────────────────────────────────

  openServicedModal(item: any): void {
    this.selectedItem = item;
    this.showServicedModal = true;
    this.servicedBy = '';
    this.serviceCost = '';
    this.servicedRemarks = '';
  }

  closeServicedModal(): void {
    this.showServicedModal = false;
  }

  onServiceCostInput(value: string): void {
    const cleaned = String(value || '')
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');
    const [whole, decimal] = cleaned.split('.');
    this.serviceCost = decimal !== undefined ? `${whole}.${decimal.slice(0, 2)}` : whole;
  }

  isServicedFormValid(): boolean {
    return !!this.servicedBy.trim()
      && !!this.serviceCost.trim()
      && /^\d+(\.\d{1,2})?$/.test(this.serviceCost.trim())
      && !!this.servicedRemarks.trim();
  }

  async markServiced(): Promise<void> {
    if (!this.selectedItem) return;
    if (!this.servicedBy.trim()) {
      this.notificationService.showToast('Serviced By is required.', 'error');
      return;
    }
    if (!this.serviceCost.trim() || !/^\d+(\.\d{1,2})?$/.test(this.serviceCost.trim())) {
      this.notificationService.showToast('Service Cost must be numeric.', 'error');
      return;
    }
    if (!this.servicedRemarks.trim()) {
      this.notificationService.showToast('Service remarks are required.', 'error');
      return;
    }
    this.isSaving = true;
    try {
      await this.requestService.markServiceCompletedService({
        service_request_id: this.selectedItem.service_request_id,
        serviced_by: this.servicedBy.trim(),
        cost: this.serviceCost.trim(),
        remarks: this.servicedRemarks.trim()
      });

      const employee = await this.getServiceUserContact(this.selectedItem.user_id, this.selectedItem.requester_name, this.selectedItem.requester_email);
      await this.mailService.sendServiceRequestNotification({
        stage: 'serviced',
        serviceRequestId: this.selectedItem.service_request_id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        assetName: this.getServiceAssetLabel(this.selectedItem),
        assetTag: this.selectedItem.asset_serial || this.selectedItem.req_temp2,
        remarks: this.servicedRemarks.trim(),
        servicedBy: this.servicedBy.trim(),
        serviceCost: this.serviceCost.trim()
      });

      this.notificationService.showToast(`Service request ${this.selectedItem.service_request_id} marked as Serviced. Employee notified.`, 'success');
      this.closeServicedModal();
      await this.loadAllData();
    } catch (err: any) {
      console.error('Mark serviced failed:', err);
      this.notificationService.showToast(err?.message || 'Failed to mark as serviced.', 'error');
    } finally {
      this.isSaving = false;
    }
  }
  // ─── Serviced Drawer ─────────────────────────────────────────────────

  async openServicedDrawer(item: any): Promise<void> {
    this.servicedDrawerItem = item;
    this.servicedDrawerOpen = true;
    this.tempReturnDone = false;
    this.tempAssetInfo = null;

    // Try to load temp asset allocation info
    try {
      const allReqs = await this.requestService.getAllServiceRequests();
      const req = allReqs.find((r: any) => r.service_request_id === item.service_request_id);
      if (req) {
        this.tempAssetInfo = {
          temp_asset_id: req.temp3 || req.allocation_id || '',
          original_asset_id: req.asset_id || '',
          original_asset_name: req.temp1 || '',
          user_id: req.user_id || ''
        };
        // Assigned temp assets are no longer in the available list, so fall back to a direct asset lookup.
        const tempAsset = this.availableAssets.find((a: any) => a.asset_id === this.tempAssetInfo.temp_asset_id)
          || await this.assetService.getAssetDetails(this.tempAssetInfo.temp_asset_id).catch(() => null);
        if (tempAsset) {
          this.tempAssetInfo.temp_asset_name = tempAsset.asset_name || tempAsset.name || tempAsset.asset_id || tempAsset.id;
          this.tempAssetInfo.temp_asset_serial = tempAsset.serial_number || tempAsset.serialNumber || '';
        }
      }
    } catch (e) {
      console.warn('Could not load temp asset info:', e);
    }
  }

  closeServicedDrawer(): void {
    this.servicedDrawerOpen = false;
    this.servicedDrawerItem = null;
    this.tempAssetInfo = null;
    this.tempReturnDone = false;
  }

  hasActiveTempAsset(): boolean {
    const tempId = String(this.tempAssetInfo?.temp_asset_id || '').trim();
    return !!tempId && tempId !== 'N/A' && tempId !== '-' && tempId !== '—';
  }

  canCompleteHandover(): boolean {
    return !this.hasActiveTempAsset() || this.tempReturnDone;
  }

  // ─── Return Temp Asset ─────────────────────────────────────────────────

  async returnTempAsset(): Promise<void> {
    if (!this.servicedDrawerItem) return;
    this.isSaving = true;
    try {
      await this.requestService.returnTempAssetService({
        service_request_id: this.servicedDrawerItem.service_request_id,
        remarks: 'Temporary asset returned'
      });

      // Also clear allocated metadata on the temp asset (status/user/date).
      const tempAssetId = this.tempAssetInfo?.temp_asset_id || this.servicedDrawerItem.req_temp3 || '';
      if (tempAssetId) {
        const clearTempAsset = {
          tuple: {
            old: { m_assets: { asset_id: tempAssetId } },
            new: { m_assets: { status: 'Available', temp1: '', temp4: '' } }
          }
        };
        await this.requestService.updateAssetStatus(clearTempAsset as any);
      }

      const employee = await this.getServiceUserContact(this.servicedDrawerItem.user_id, this.servicedDrawerItem.requester_name, this.servicedDrawerItem.requester_email);
      const teamLead = await this.getServiceUserContact(this.servicedDrawerItem.tl_id, 'Team Lead', '');
      await this.mailService.sendServiceRequestNotification({
        stage: 'temp_returned',
        serviceRequestId: this.servicedDrawerItem.service_request_id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        teamLeadName: teamLead.name,
        teamLeadEmail: teamLead.email,
        assetName: this.getServiceAssetLabel(this.servicedDrawerItem),
        assetTag: this.servicedDrawerItem.asset_serial || this.servicedDrawerItem.req_temp2,
        remarks: 'Temporary asset returned',
        tempAssetId: this.tempAssetInfo?.temp_asset_id || this.servicedDrawerItem.req_temp3 || '',
        tempAssetName: this.tempAssetInfo?.temp_asset_name || ''
      });
      this.notificationService.showToast('Temporary asset returned successfully.', 'success');
      this.tempReturnDone = true;
    } catch (err: any) {
      console.error('Return temp asset failed:', err);
      this.notificationService.showToast(err?.message || 'Failed to return temporary asset.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  // ─── Complete Handover ─────────────────────────────────────────────────

  async completeHandover(): Promise<void> {
    if (!this.servicedDrawerItem) return;
    this.isSaving = true;
    try {
      await this.requestService.completeServiceHandoverService({
        service_request_id: this.servicedDrawerItem.service_request_id,
        remarks: 'Serviced asset handed over to employee'
      });
      const employee = await this.getServiceUserContact(this.servicedDrawerItem.user_id, this.servicedDrawerItem.requester_name, this.servicedDrawerItem.requester_email);
      const teamLead = await this.getServiceUserContact(this.servicedDrawerItem.tl_id, 'Team Lead', '');
      await this.mailService.sendServiceRequestNotification({
        stage: 'handover_completed',
        serviceRequestId: this.servicedDrawerItem.service_request_id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        teamLeadName: teamLead.name,
        teamLeadEmail: teamLead.email,
        assetName: this.getServiceAssetLabel(this.servicedDrawerItem),
        assetTag: this.servicedDrawerItem.asset_serial || this.servicedDrawerItem.req_temp2,
        remarks: 'Serviced asset handed over to employee'
      });
      this.notificationService.showToast(`Service request ${this.servicedDrawerItem.service_request_id} closed. Asset handed over.`, 'success');
      this.closeServicedDrawer();
      await this.loadAllData();
    } catch (err: any) {
      console.error('Complete handover failed:', err);
      this.notificationService.showToast(err?.message || 'Failed to complete handover. Make sure temp asset is returned first.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  // ─── Approve dispatcher ────────────────────────────────────────────────

  async handleApprove(item: any): Promise<void> {
    if (item.stage === 'STAGE_1_MANAGER') {
      await this.approveStage1(item);
    } else if (item.stage === 'STAGE_3_MANAGER_FINAL') {
      // Check if temp asset is requested but NOT yet assigned
      if (item.needs_temp_asset && !item.req_temp3) {
        this.pendingFinalApprovalItem = item;
        this.openTempAssetModal(item);
        this.notificationService.showToast('Please assign a temporary asset before final approval.', 'info');
      } else {
        // Try final approval directly. If DB still requires temp asset, catch it and show modal.
        try {
          await this.approveStage3(item);
        } catch (err: any) {
          const errMsg = (err?.message || err?.faultstring || err?.errorThrown || JSON.stringify(err) || '').toLowerCase();
          if (errMsg.includes('temporary asset') || errMsg.includes('temp asset') || errMsg.includes('assign temp')) {
            this.pendingFinalApprovalItem = item;
            this.openTempAssetModal(item);
            this.notificationService.showToast('Please assign a temporary asset first before final approval.', 'info');
          } else {
            this.notificationService.showToast(errMsg || 'Final approval failed.', 'error');
          }
        }
      }
    }
  }

  getStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('pending') || s === 'movetoallocationteam') return 'status-pending';
    if (s === 'onservice') return 'status-inprogress';
    if (s === 'serviced' || s === 'approved' || s === 'collected') return 'status-approved';
    if (s === 'closed' || s === 'completed') return 'status-completed';
    if (s.includes('rejected')) return 'status-rejected';
    return 'status-default';
  }
}

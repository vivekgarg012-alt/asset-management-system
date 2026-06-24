import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RequestService } from '../../../core/services/request.service';
import { AuthService } from '../../../core/services/auth.service';
import { AdminDataService } from '../../../core/services/admin-data.service';
import { AssetService } from '../../../core/services/asset.service';
import { MailService } from '../../../core/services/mail.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AssetRequest, RequestStatus, RequestType } from '../../../core/models/request.model';
import { HeroService } from 'src/app/core/services/hero.service';
@Component({
  selector: 'app-tl-my-requests',
  templateUrl: './my-requests.component.html',
  styleUrls: ['./my-requests.component.scss']
})
export class MyRequestsComponent implements OnInit {
  requests: AssetRequest[] = [];
  loading = true;
  Math = Math;

  // Pagination
  currentPage = 1;
  pageSize = 5;
  totalRequests = 0;

  // Tracking Modal
  showTrackingModal = false;
  selectedRequest: AssetRequest | null = null;
  loadingProgress = false;
  trackingSteps: any[] = [];
  activeTab: 'pending' | 'resolved' = 'pending';
  overallProgress = 0;
  rejectionInfo: { stage: string, reason: string, approver: string } | null = null;

  // File upload for resubmit
  selectedFileBase64: string | null = null;
  selectedFileName: string | null = null;

  // Filters
  searchTerm = '';
  selectedType = '';

  types = [
    { label: 'All Requests', value: '' },
    { label: 'New Asset Requests', value: RequestType.NEW_ASSET },
    { label: 'Warranty Requests', value: RequestType.EXTEND_WARRANTY },
    { label: 'Return Requests', value: RequestType.RETURN_ASSET },
    { label: 'Service Requests', value: RequestType.SERVICE_MAINTENANCE }
  ];

  // Filters
  // searchTerm = '';
  // selectedType = '';

  // types = [
  //   { label: 'All Requests', value: '' },
  //   { label: 'New Asset Requests', value: RequestType.NEW_ASSET },
  //   { label: 'Warranty Requests', value: RequestType.EXTEND_WARRANTY },
  //   { label: 'Return Requests', value: RequestType.RETURN_ASSET }
  // ];

  // Resubmit Modal Data
  resubmitForm!: FormGroup;
  masterAssetTypes: any[] = [];
  masterSubCategories: any[] = [];
  availableSubCategories: any[] = [];

  constructor(
    private requestService: RequestService,
    private authService: AuthService,
    private adminService: AdminDataService,
    private assetService: AssetService,
    private fb: FormBuilder,
    private mailService: MailService,
    private notificationService: NotificationService,
    public hs: HeroService
  ) { }

  async ngOnInit(): Promise<void> {
    this.initResubmitForm();
    await this.loadRequests();
    await this.loadMasterData();
  }

  initResubmitForm() {
    this.resubmitForm = this.fb.group({
      requestNumber: [{ value: '', disabled: true }],
      requesterName: [{ value: '', disabled: true }],
      assetType: ['', Validators.required],
      subCategory: ['', Validators.required],
      urgency: ['Medium', Validators.required],
      justification: ['', [Validators.required, Validators.minLength(5)]],
      hasEmailApproval: [false]
    });
  }

  async loadMasterData(): Promise<void> {
    try {
      const [types, subCats] = await Promise.all([
        this.assetService.getAllAssetTypesCordys(),
        this.assetService.getAllSubcategoriesCordys()
      ]);
      this.masterAssetTypes = types || [];
      this.masterSubCategories = subCats || [];
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  }

  async loadRequests(): Promise<void> {
    this.loading = true;
    const user = this.authService.getCurrentUser();
    if (user) {
      try {
        const [assetRequests, warrantyRequests, returnRequests, serviceRequests] = await Promise.all([
          this.requestService.getRequestsByUserIdFromCordys(user.id),
          this.requestService.fetchAllWarrantyRequestsForUser(user.id),
          this.requestService.fetchReturnRequestsByEmployee(user.id),
          this.requestService.fetchServiceRequestsByUser(user.id)
        ]);


        console.log(`[MyRequests] Loaded ${assetRequests.length} asset, ${warrantyRequests.length} warranty, ${serviceRequests.length} service requests`);

        // Merge all request types and sort by date descending
        this.requests = [...assetRequests, ...warrantyRequests, ...returnRequests, ...serviceRequests];
        this.requests.sort((a, b) => {
          const dateA = a.requestDate ? new Date(a.requestDate).getTime() : 0;
          const dateB = b.requestDate ? new Date(b.requestDate).getTime() : 0;
          return dateB - dateA;
        });

        console.log(`[MyRequests] Total requests after merge and sort: ${this.requests.length}`);
        console.log('[MyRequests] Request Types distribution:', this.requests.reduce((acc: any, r) => {
          acc[r.requestType] = (acc[r.requestType] || 0) + 1;
          return acc;
        }, {}));

        // Sort by date descending
        this.requests.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
        this.totalRequests = this.requests.length;
      } catch (error) {
        console.error('Error loading requests:', error);
      }
    }
    this.loading = false;
  }

  get filteredRequests(): AssetRequest[] {
    const filtered = this.requests.filter(req => {
      // 1. Tab filtering
      const statusText = String(req.status || '').toLowerCase();
      let isResolved = req.status === RequestStatus.COMPLETED ||
        req.status === RequestStatus.REJECTED ||
        req.status === RequestStatus.CANCELLED ||
        statusText === 'closed';

      // For non-warranty requests, 'Approved' can be considered resolved (terminal for employee)
      // but for warranty, it still needs Allocation Team confirmation.
      if (req.requestType !== RequestType.EXTEND_WARRANTY && req.status === RequestStatus.APPROVED) {
        isResolved = true;
      }

      const tabMatch = this.activeTab === 'resolved' ? isResolved : !isResolved;
      if (!tabMatch) return false;

      // 2. Search filtering
      const matchesSearch = !this.searchTerm ||
        req.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        req.requestNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (req.assetName || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        req.category.toLowerCase().includes(this.searchTerm.toLowerCase());

      // 3. Type filtering
      const matchesType = !this.selectedType || req.requestType === this.selectedType;

      return matchesSearch && matchesType;
    });
    // Sort by Date (Descending - Newest first)
    filtered.sort((a, b) => {
      try {
        const dateA = a.requestDate ? new Date(a.requestDate).getTime() : 0;
        const dateB = b.requestDate ? new Date(b.requestDate).getTime() : 0;

        // If dates are different, sort by date descending
        if (dateA !== dateB && !isNaN(dateA) && !isNaN(dateB)) {
          return dateB - dateA;
        }

        // Fallback to request number comparison (numeric descending)
        // This ensures ex_141 appears before ex_136
        return (b.requestNumber || '').localeCompare(a.requestNumber || '', undefined, { numeric: true, sensitivity: 'base' });
      } catch (e) {
        return 0;
      }
    });

    return filtered;
  }

  setTab(tab: 'pending' | 'resolved') {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  get paginatedRequests(): AssetRequest[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredRequests.slice(startIndex, startIndex + this.pageSize);
  }

  get totalPages(): number {
    const count = this.filteredRequests.length;
    return Math.max(1, Math.ceil(count / this.pageSize));
  }

  // Update this to use filtered count
  get totalFilteredCount(): number {
    return this.filteredRequests.length;
  }

  get pendingCount(): number {
    return this.requests.filter(req => {
      const statusText = String(req.status || '').toLowerCase();
      let isResolved = req.status === RequestStatus.COMPLETED ||
        req.status === RequestStatus.REJECTED ||
        req.status === RequestStatus.CANCELLED ||
        statusText === 'closed';
      if (req.requestType !== RequestType.EXTEND_WARRANTY && req.status === RequestStatus.APPROVED) {
        isResolved = true;
      }
      return !isResolved;
    }).length;
  }

  get resolvedCount(): number {
    return this.requests.filter(req => {
      const statusText = String(req.status || '').toLowerCase();
      let isResolved = req.status === RequestStatus.COMPLETED ||
        req.status === RequestStatus.REJECTED ||
        req.status === RequestStatus.CANCELLED ||
        statusText === 'closed';
      if (req.requestType !== RequestType.EXTEND_WARRANTY && req.status === RequestStatus.APPROVED) {
        isResolved = true;
      }
      return isResolved;
    }).length;
  }

  /**
   * Returns a windowed set of page numbers for professional pagination.
   * Shows at most 5 page buttons, with ellipsis ('...') for gaps and always
   * shows the first and last page.
   */
  get visiblePages(): (number | string)[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const maxVisible = 5;

    if (total <= maxVisible + 2) {
      // If total pages fit without needing ellipsis, show all
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];

    // Always include first page
    pages.push(1);

    // Calculate the window around current page
    let start = Math.max(2, current - 1);
    let end = Math.min(total - 1, current + 1);

    // Ensure we show at least 3 middle pages
    if (current <= 3) {
      start = 2;
      end = Math.min(total - 1, maxVisible - 1);
    } else if (current >= total - 2) {
      start = Math.max(2, total - maxVisible + 2);
      end = total - 1;
    }

    // Add ellipsis after first page if needed
    if (start > 2) {
      pages.push('...');
    }

    // Add middle pages
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (end < total - 1) {
      pages.push('...');
    }

    // Always include last page
    pages.push(total);

    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  private getStagesForRequest(request: AssetRequest): Array<{ name: string, roles: string[] }> {
    const type = request.requestType;
    const isSkippedTl = request.hasEmailApproval ||
      request.requesterRole?.toLowerCase().includes('lead') ||
      request.requesterRole?.toLowerCase().includes('manager') ||
      request.requesterRoleName?.toLowerCase().includes('lead') ||
      request.requesterRoleName?.toLowerCase().includes('manager') ||
      request.requesterRoleName?.toLowerCase().includes('admin') ||
      ['rol_01', 'rol_02', 'rol_04', 'rol_05'].includes(request.requesterRole || '');

    switch (type) {
      case RequestType.RETURN_ASSET:
        return [
          { name: 'Asset Manager', roles: ['asset manager', 'mgr'] },
          { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] },
          { name: 'Asset Manager', roles: ['asset manager', 'mgr'] }
        ];

      case RequestType.EXTEND_WARRANTY:
        return [
          { name: 'Asset Manager', roles: ['asset manager', 'mgr'] },
          { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] }
        ];

      case RequestType.SERVICE_MAINTENANCE:
        // Service flow: 3 approval stages + lifecycle milestones
        // Team Lead gets notification only — NO approval stage
        return [
          { name: 'Asset Manager', roles: ['stage_1'] },
          { name: 'Allocation Team', roles: ['stage_2'] },
          { name: 'Asset Manager (Final)', roles: ['stage_3'] },
          { name: 'On Service', roles: ['on_service'] },
          { name: 'Serviced', roles: ['serviced'] },
          { name: 'Handover Complete', roles: ['closed'] }
        ];

      default: // NEW_ASSET
        const newAssetStages = [
          { name: 'Team Lead', roles: ['team lead', 'approver'] },
          { name: 'Asset Manager', roles: ['asset manager', 'mgr'] },
          { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] },
          { name: 'Asset Manager', roles: ['asset manager', 'mgr'] }
        ];

        return isSkippedTl ? newAssetStages.slice(1) : newAssetStages;
    }
  }

  async trackRequest(request: AssetRequest): Promise<void> {
    this.selectedRequest = request;
    this.showTrackingModal = true;

    if (request.status === 'Rejected') {
      this.populateResubmitForm(request);
    }

    this.loadingProgress = true;
    this.trackingSteps = [];
    this.overallProgress = 0;

    try {
      let progressData: any[];

      if (request.requestType === RequestType.SERVICE_MAINTENANCE) {
        // Fetch approvals from t_service_approvals
        const serviceApprovals = await this.requestService.getServiceRequestApprovalChain(request.id);

        // Fetch all users to resolve approver_id → name
        let allUsers: any[] = [];
        try {
          allUsers = await this.adminService.GetAllUserRoleProjectDetails();
        } catch (e) {
          console.warn('Failed to fetch users for name resolution:', e);
        }
        const userMap = new Map(allUsers.map((u: any) => [u.id, u.name]));

        progressData = serviceApprovals.map((a: any) => ({
          stage: a.stage || a.role || 'Unknown',
          status: a.status || 'Pending',
          approverId: a.approver_id,
          approverName: userMap.get(a.approver_id) || 'Assigned Approver',
          timestamp: a.action_date,
          comments: a.remarks
        }));

        // Add lifecycle milestone entries based on the service request's current status
        const reqStatus = (request.status || '').toLowerCase();
        const statusTimestamp = new Date().toISOString();

        // On Service milestone
        if (['onservice', 'on_service', 'serviced', 'closed', 'completed'].some(s => reqStatus.includes(s))) {
          progressData.push({
            stage: 'on_service',
            status: 'Approved',
            approverName: 'System',
            timestamp: statusTimestamp,
            comments: 'Asset sent to service center'
          });
        }

        // Serviced milestone
        if (['serviced', 'closed', 'completed'].some(s => reqStatus.includes(s))) {
          progressData.push({
            stage: 'serviced',
            status: 'Approved',
            approverName: 'System',
            timestamp: statusTimestamp,
            comments: 'Service completed'
          });
        }

        // Handover / Closed milestone
        if (['closed', 'completed'].some(s => reqStatus.includes(s))) {
          progressData.push({
            stage: 'closed',
            status: 'Approved',
            approverName: 'System',
            timestamp: statusTimestamp,
            comments: 'Original asset handed back to employee'
          });
        }
      } else if (request.requestType === RequestType.RETURN_ASSET) {
        // Fetch ALL approvals from t_asset_return_approvals for return requests
        const returnApprovals = await this.requestService.getReturnRequestProgress(request.id);

        // Fetch all users to resolve approver_id → name
        let allUsers: any[] = [];
        try {
          allUsers = await this.adminService.GetAllUserRoleProjectDetails();
        } catch (e) {
          console.warn('Failed to fetch users for name resolution:', e);
        }
        const userMap = new Map(allUsers.map((u: any) => [u.id, u.name]));

        progressData = returnApprovals.map((a: any) => ({
          stage: a.role || 'Unknown',
          status: a.status || 'Pending',
          approverId: a.approver_id,
          approverName: userMap.get(a.approver_id) || 'Assigned Approver',
          timestamp: a.action_date,
          comments: a.remarks
        }));
      } else if (request.requestType === RequestType.EXTEND_WARRANTY) {
        progressData = await this.requestService.getWarrantyProgress(request.id);
      } else {
        progressData = await this.requestService.getRequestProgress(request.id);
      }

      // Sort to ensure chronological order for multi-stage roles like Asset Manager
      progressData.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Filter out stale records from previous approval cycles (resubmit condition)
      // If there are records after a 'Rejected' status, a resubmit happened.
      let lastRejectedIndex = -1;
      for (let i = 0; i < progressData.length; i++) {
        if (progressData[i].status?.toLowerCase() === 'rejected') {
          lastRejectedIndex = i;
        }
      }
      if (lastRejectedIndex !== -1 && lastRejectedIndex < progressData.length - 1) {
        progressData = progressData.slice(lastRejectedIndex + 1);
      }

      const stages = this.getStagesForRequest(request);

      let availableProgress = [...progressData];
      const approverDetails = await this.resolveApproverDetails(request);
      const resolvedNames: Record<string, string> = {};
      Object.keys(approverDetails).forEach(role => resolvedNames[role] = approverDetails[role].name);

      this.trackingSteps = stages.map((stage, index) => {
        const isDistributionStep = index === (stages.length - 1) && stage.name === 'Asset Manager' && stages.length > 2;

        let foundIndex = -1;
        while (true) {
          // Priority 1: Look for a completed record (Approved/Completed) for this stage
          foundIndex = availableProgress.findIndex(p =>
            stage.roles.some(role => p.stage?.toLowerCase().includes(role)) &&
            (p.status?.toLowerCase() === 'approved' || p.status?.toLowerCase() === 'completed')
          );

          // Priority 2: Fallback to any record (Pending/Rejected) for this stage
          if (foundIndex === -1) {
            foundIndex = availableProgress.findIndex(p =>
              stage.roles.some(role => p.stage?.toLowerCase().includes(role))
            );
          }
          break;
        }

        let data = null;
        if (foundIndex !== -1) {
          data = availableProgress[foundIndex];
          // Remove it so subsequent stages match the next DB entries
          availableProgress.splice(foundIndex, 1);
        }

        let isCompleted = false;
        let isCurrent = false;

        if (data) {
          isCompleted = data.status === 'Approved' || data.status === 'Completed';
          isCurrent = data.status === 'Pending';
        } else {
          // For return/service requests, only trust actual data - don't guess future steps
          if (request.requestType !== RequestType.RETURN_ASSET && request.requestType !== RequestType.SERVICE_MAINTENANCE) {
            isCompleted = request.status === 'Completed' || request.status === 'Approved';
          }
        }

        // Correctly handle 'Assigned Approver' or empty placeholders from the DB and lookups
        const dbName = data?.approverName?.trim();
        const genericPlaceholders = ['approver', 'assigned approver', 'pending', 'to be assigned', 'null', 'undefined', '', 'assignedapprover'];
        const isPlaceholder = (val: string | undefined) => !val || genericPlaceholders.includes(val.toLowerCase().trim());

        let resolvedName = !isPlaceholder(dbName) ? dbName : resolvedNames[stage.name];

        // Final sanity check on resolved name
        if (isPlaceholder(resolvedName)) {
          resolvedName = undefined;
        }

        const fallbackName = request.requestType === RequestType.SERVICE_MAINTENANCE
          ? stage.name
          : (isCompleted ? 'System Approved' : 'To be Assigned');

        return {
          name: resolvedName || fallbackName,
          roleName: stage.name + (isDistributionStep ? ' (Distribution)' : ''),
          status: data ? data.status : (isCompleted ? 'Approved' : 'Pending'),
          timestamp: data?.timestamp,
          isCompleted: isCompleted,
          isCurrent: isCurrent,
          comments: data?.comments
        };
      });

      // 4. Special pass to handle pending states based on the previous step
      let currentStepFound = false;
      for (let i = 0; i < this.trackingSteps.length; i++) {
        const step = this.trackingSteps[i];

        // Reset flags that might have been guessed in the map pass
        if (step.status === 'Pending') {
          step.isCurrent = false;
        }

        // Don't mark rejected steps as "current" — they are terminal
        if (!currentStepFound && !step.isCompleted && step.status?.toLowerCase() !== 'rejected') {
          step.isCurrent = true;
          currentStepFound = true;
        }
      }

      // 5. Remove steps that have no approver assigned (not part of the actual flow)
      // this.trackingSteps = this.trackingSteps.filter(step =>
      //   step.name !== 'To be Assigned'
      // );
      if (request.requestType !== RequestType.SERVICE_MAINTENANCE) {
        this.trackingSteps = this.trackingSteps.filter(step =>
          step.name !== 'To be Assigned'
        );
      }

      // 6. If any step was rejected, remove all subsequent steps (they were never reached)
      const rejectedIndex = this.trackingSteps.findIndex(s => s.status?.toLowerCase() === 'rejected');
      if (rejectedIndex !== -1) {
        this.trackingSteps = this.trackingSteps.slice(0, rejectedIndex + 1);
      }

      // Extract rejection info if the request is rejected
      if (request.status === 'Rejected') {
        const rejectedStep = this.trackingSteps.find(step => step.status === 'Rejected');
        if (rejectedStep) {
          this.rejectionInfo = {
            stage: rejectedStep.roleName,
            reason: rejectedStep.comments || 'No reason provided',
            approver: rejectedStep.name
          };
        }
      } else {
        this.rejectionInfo = null;
      }

      this.overallProgress = this.calculateOverallProgress(request);
    } catch (error) {
      console.error('Error tracking request:', error);
    } finally {
      this.loadingProgress = false;
    }
  }

  private async resolveApproverDetails(request: AssetRequest): Promise<Record<string, { name: string, id: string }>> {
    const details: Record<string, { name: string, id: string }> = {};
    let user = this.authService.getCurrentUser();

    try {
      // 1. Force refresh user details if projectId is missing to ensure fresh data
      if (user && !user.projectId) {
        const freshUser = await this.authService.getUserDetails(user.id);
        if (freshUser) {
          user = freshUser;
        }
      }

      // 2. Resolve Team Lead from current user's project
      if (user?.projectId && user.projectId !== 'null') {
        const project = await this.adminService.getProjectById(user.projectId);
        if (project?.teamLead) {
          details['Team Lead'] = {
            name: project.teamLead,
            id: project.teamLeadId || this.adminService.findUserIdByName(project.teamLead) || 'usr_003'
          };
        }
      }

      // 3. Resolve Asset Manager & Allocation Team for this Asset Type
      if (request.assetType) {
        const assignment = await this.adminService.getAssignmentByAssetType(request.assetType);
        if (assignment) {
          details['Asset Manager'] = {
            name: assignment.assetManager,
            id: assignment.assetManagerId || this.adminService.findUserIdByName(assignment.assetManager) || 'usr_004'
          };
          details['Asset Allocation Team'] = {
            name: assignment.teamMembers,
            id: '' // Typically resolved as a team, not a single user ID
          };
        }
      }
    } catch (err) {
      console.error('Failed to resolve approver details:', err);
    }

    return details;
  }

  calculateOverallProgress(request: AssetRequest): number {
    const status = (request.status || '').toLowerCase();

    // For Extend Warranty, 'Approved' means Manager approved, but still pending Allocation Team.
    // Only 'Completed' or 'Rejected' are terminal.
    if (request.requestType === RequestType.EXTEND_WARRANTY) {
      if (status === 'completed' || status === 'rejected') return 100;
      if (status === 'approved') return 95;
    } else {
      if (status === 'completed' || status === 'approved' || status === 'rejected') return 100;
    }

    const completedCount = this.trackingSteps.filter(s => s.isCompleted || s.status?.toLowerCase() === 'rejected').length;
    const totalSteps = this.trackingSteps.length;

    if (totalSteps === 0) return 10;

    if (completedCount === totalSteps && totalSteps > 0) return 100;

    if (completedCount === 0) return 10;

    // Dynamic progress calculation based on steps
    const progress = Math.round((completedCount / totalSteps) * 100);

    // Ensure we don't show 100% unless it's actually terminal
    return Math.min(progress, 95);
  }

  // Confirmation Modal Variables
  showConfirmModal = false;
  confirmationRemarks = '';

  openConfirmForm() {
    this.showConfirmModal = true;
  }

  closeConfirmForm() {
    this.showConfirmModal = false;
    this.confirmationRemarks = '';
  }
  responseData = '';
  approval_id = '';
  task_id = '';

  async Getassetidbyapprovalid(request_id: any) {

    try {
      const resp: any = await this.hs.ajax('Getassetidbyapprovalid', 'http://schemas.cordys.com/AMS_Database_Metadata',
        { Request_id: request_id }
      );
      if (resp && resp.tuple && resp.tuple.old && resp.tuple.old.t_request_approvals) {
        this.responseData = resp.tuple.old.t_request_approvals.temp1;
        this.approval_id = resp.tuple.old.t_request_approvals.approval_id;
        this.task_id = resp.tuple.old.t_request_approvals.temp2;
        console.log("approval id.......................", this.approval_id);
        console.log("task id fetched:", this.task_id);
      }
    } catch (error) {
      console.error("Error in Getassetidbyapprovalid:", error);
    }
  }

  async submitConfirmation() {
    if (!this.selectedRequest) return;
    console.log("select request", this.selectedRequest);
    try {
      this.loading = true;
      const requestId = this.selectedRequest.requestNumber;

      const updateReq = {
        tuple: {
          old: {
            t_asset_requests: {
              request_id: requestId
            }
          },
          new: {
            t_asset_requests: {
              status: 'Approved'
            }
          }
        }
      };
      await this.Getassetidbyapprovalid(requestId);
      await this.requestService.submitNewRequestForm(updateReq);

      // Update the master asset status to Allocated
      if (this.responseData) {
        const assetUpdateReq = {
          tuple: {
            old: {
              m_assets: {
                asset_id: this.responseData
              }
            },
            new: {
              m_assets: {
                status: 'Allocated',
                temp1: this.authService.getCurrentUser()?.id,
                // temp1: this.selectedRequest.requesterId,
                temp2: this.selectedRequest.id
              }
            }
          }
        };
        await this.requestService.updateAssetStatus(assetUpdateReq);
      }

      const updateReq2 = {
        tuple: {
          old: {
            t_request_approvals: {
              approval_id: this.approval_id
            }
          },
          new: {
            t_request_approvals: {
              status: 'Approved'
            }
          }
        }
      };
      var res3 = await this.requestService.createEntryForRequestor(updateReq2);
      console.log("response 3", res3);

      let res4 = this.Getassetidbyapprovalid(requestId);
      console.log("response 4", this.task_id);
      // Complete the BPM task
      if (this.task_id) {
        var req3 = {
          TaskId: `${this.task_id}`,
          Action: 'COMPLETE'
        };
        await this.requestService.completeUserTask(req3 as any);
      }

      console.log('Confirmation submitted for:', requestId);

      // Update UI
      this.selectedRequest.status = RequestStatus.APPROVED;
      this.closeConfirmForm();
      this.closeTrackingModal();

      // Reload to ensure data consistency
      await this.loadRequests();

      this.notificationService.showToast('Asset receipt confirmed successfully. The request is now marked as Approved.', 'success');
    } catch (error) {
      console.error('Error submitting confirmation:', error);
      this.notificationService.showToast('Failed to confirm asset receipt. Please try again.', 'error');
    } finally {
      this.loading = false;
    }
  }

  async withdrawRequest(request: AssetRequest) {
    if (!confirm('Are you sure you want to withdraw this request?')) return;

    try {
      this.loading = true;

      if (request.requestType === RequestType.RETURN_ASSET) {
        // Withdraw Return Request: update t_asset_returns status
        const updateReturnReq = {
          tuple: {
            old: { t_asset_returns: { return_id: request.requestNumber } },
            new: { t_asset_returns: { status: 'Cancelled', remarks: 'Withdrawn by employee' } }
          }
        };
        await this.requestService.createEntryForReturn(updateReturnReq);

        this.notificationService.showToast('Return request withdrawn successfully.', 'info');
      } else {
        // Withdraw Standard Request: update t_asset_requests status
        const updateReq = {
          tuple: {
            old: { t_asset_requests: { request_id: request.requestNumber } },
            new: { t_asset_requests: { status: 'Cancelled' } }
          }
        };
        await this.Getassetidbyapprovalid(request.requestNumber);
        await this.requestService.submitNewRequestForm(updateReq);

        console.log("approval id222222222222", this.approval_id);

        const updateReq2 = {
          tuple: {
            old: { t_request_approvals: { approval_id: this.approval_id } },
            new: { t_request_approvals: { status: 'Rejected' } }
          }
        };
        var res3 = await this.requestService.createEntryForRequestor(updateReq2);
        console.log("response 3", res3);

        await this.Getassetidbyapprovalid(request.requestNumber);
        console.log("response 4", this.task_id);

        // Complete the BPM task
        console.log('Taskid:', this.task_id);
        if (this.task_id) {
          const req3 = {
            TaskId: `${this.task_id}`,
            Action: 'COMPLETE'
          };
          await this.requestService.completeUserTask(req3 as any);
        }
        this.notificationService.showToast('Request withdrawn successfully.', 'info');
      }

      this.closeTrackingModal();
      await this.loadRequests();
    } catch (error) {
      console.error('Error withdrawing request:', error);
      this.notificationService.showToast('Failed to withdraw request.', 'error');
    } finally {
      this.loading = false;
    }
  }

  populateResubmitForm(request: AssetRequest) {
    this.selectedRequest = request;

    // 1. Find and set available sub-categories first
    const typeObj = this.masterAssetTypes.find(t =>
      (t.type_name || '').toLowerCase() === (request.assetType || '').toLowerCase()
    );
    const typeId = typeObj ? typeObj.type_id : '';

    if (typeId) {
      this.availableSubCategories = this.masterSubCategories.filter(sub =>
        String(sub.type_id) === String(typeId)
      );
    }

    // 2. Patch the form values
    const subCatValue = request.category || request.subCategory || '';

    this.resubmitForm.patchValue({
      requestNumber: request.requestNumber,
      requesterName: request.requesterName || '',
      assetType: typeId,
      subCategory: subCatValue,
      urgency: request.urgency || 'Medium',
      justification: request.justification || '',
      hasEmailApproval: request.hasEmailApproval || false
    });

    // Final check: if subCategory is set but not in available list, we should still show it
    if (subCatValue && !this.availableSubCategories.some(s => s.name === subCatValue)) {
      this.availableSubCategories.push({ name: subCatValue, type_id: typeId });
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type: only images and PDFs allowed
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      const allowedExtensions = ['.png', '.jpg', '.jpeg', '.pdf'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        this.notificationService.showToast(
          'Only image files (PNG, JPG) and PDF files are allowed.',
          'error'
        );
        this.selectedFileBase64 = null;
        this.selectedFileName = null;
        event.target.value = '';
        return;
      }

      const MAX_SIZE_BYTES = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE_BYTES) {
        this.notificationService.showToast(
          `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 5 MB.`,
          'error'
        );
        this.selectedFileBase64 = null;
        this.selectedFileName = null;
        event.target.value = '';
        return;
      }
      this.selectedFileName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        this.selectedFileBase64 = reader.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      this.selectedFileBase64 = null;
      this.selectedFileName = null;
    }
  }

  onResubmitTypeChange() {
    const selectedType = this.resubmitForm.get('assetType')?.value;
    this.availableSubCategories = this.masterSubCategories.filter(sub =>
      String(sub.type_id) === String(selectedType)
    );

    // If we have a subcategory name from the request, find its ID if possible, 
    // or just ensure it's in the list
    if (this.selectedRequest && this.availableSubCategories.length > 0) {
      const subCatName = this.selectedRequest.subCategory;
      const subCatObj = this.availableSubCategories.find(s => s.name === subCatName);
      if (subCatObj) {
        this.resubmitForm.patchValue({ subCategory: subCatObj.name });
      }
    }
  }



  async submitResubmit() {
    if (this.resubmitForm.invalid || !this.selectedRequest) return;

    try {
      this.loading = true;
      const formVal = this.resubmitForm.getRawValue(); // Use getRawValue to get disabled field values if needed
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const selectedTypeObj = this.masterAssetTypes.find(t => String(t.type_id) === String(formVal.assetType));
      const typeName = selectedTypeObj ? selectedTypeObj.type_name : 'Hardware';

      // Validate file upload if email approval is checked
      if (formVal.hasEmailApproval && !this.selectedFileBase64 && !this.selectedRequest.emailApprovalDoc) {
        this.notificationService.showToast('Please upload the email approval document.', 'error');
        this.loading = false;
        return;
      }

      let dbFileName = this.selectedFileName || this.selectedRequest.emailApprovalDoc || '';
      if (dbFileName.length > 50) {
        const extIdx = dbFileName.lastIndexOf('.');
        const ext = extIdx >= 0 ? dbFileName.substring(extIdx) : '';
        dbFileName = dbFileName.substring(0, 50 - ext.length) + ext;
      }

      // 1. API: UpdateT_asset_requests
      // This updates the existing record data for the same old request ID
      const updateReq = {
        tuple: {
          old: { t_asset_requests: { request_id: this.selectedRequest.requestNumber } },
          new: {
            t_asset_requests: {
              asset_type: typeName,
              reason: formVal.justification,
              urgency: formVal.urgency,
              email_approval: String(formVal.hasEmailApproval),
              status: 'Pending',
              temp1: formVal.subCategory,
              temp2: dbFileName,
              document: dbFileName
            }
          }
        }
      };
      await this.requestService.submitNewRequestForm(updateReq);

      // Handle File Upload if new file selected
      if (this.selectedFileBase64) {
        try {
          const serverPath = await this.requestService.uploadFileToServer(this.selectedFileName!, this.selectedFileBase64);
          if (serverPath) {
            await this.requestService.updateRequestDocumentPath(this.selectedRequest.requestNumber, serverPath);
          }
        } catch (uploadErr) {
          console.error('File upload failed during resubmit:', uploadErr);
        }
      }

      await this.Getassetidbyapprovalid(this.selectedRequest.requestNumber);

      // 2. API: UpdateT_request_approvals
      // This adds a new entry (column/row) for the same request ID to restart approval flow
      // Resolve dynamic approver IDs
      const approverDetails = await this.resolveApproverDetails(this.selectedRequest);
      const teamLeadId = approverDetails['Team Lead']?.id;
      const assetManagerId = approverDetails['Asset Manager']?.id;

      const approvalEntry = {
        tuple: {
          new: {
            t_request_approvals: {
              request_id: this.selectedRequest.requestNumber,
              approver_id: assetManagerId,
              role: 'Asset Manager',
              status: 'Pending'
            }
          }
        }
      }
      const res2 = await this.requestService.createEntryForTeamLead(approvalEntry as any);
      const newapprovalid = res2.new.t_request_approvals.approval_id;

      const updateReq1 = {
        tuple: {
          old: { t_request_approvals: { approval_id: this.approval_id } },
          new: {
            t_request_approvals: {
              status: 'Approved'
            }
          }
        }
      }
      await this.requestService.createEntryForTeamLead(updateReq1 as any);

      // 3. Complete the current BPM task (the one that notified about rejection)
      console.log('Taskid to complete:', this.task_id);
      if (this.task_id) {
        const reqTaskComplete = {
          TaskId: `${this.task_id}`,
          Action: 'COMPLETE'
        };
        await this.requestService.completeUserTask(reqTaskComplete as any);
      }

      this.notificationService.showToast('Request resubmitted successfully.', 'success');
      this.closeTrackingModal();
      await this.loadRequests();
    } catch (error) {
      console.error('Error resubmitting request:', error);
      this.notificationService.showToast('Failed to resubmit request.', 'error');
    } finally {
      this.loading = false;
    }
  }

  closeTrackingModal(): void {
    this.showTrackingModal = false;
    this.selectedRequest = null;
    this.rejectionInfo = null;
    this.selectedFileBase64 = null;
    this.selectedFileName = null;
  }

  isFullyApproved(): boolean {
    if (!this.selectedRequest || this.trackingSteps.length === 0) return false;
    // All approval stages must be completed before showing confirmation button
    return this.trackingSteps.every(s => s.isCompleted);
  }

  getStatusClass(status: RequestStatus | string): string {
    const s = (status || '').toString().toLowerCase();
    if (s.includes('pending') || s.includes('movetoallocation')) return 'status-pending';
    if (s.includes('approved')) return 'status-approved';
    if (s.includes('rejected')) return 'status-rejected';
    if (s.includes('completed') || s.includes('closed')) return 'status-completed';
    if (s.includes('progress') || s.includes('onservice') || s.includes('on_service')) return 'status-progress';
    if (s.includes('serviced') || s.includes('collected')) return 'status-approved';
    return '';
  }

  getAssetIcon(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('soft')) return 'terminal';
    if (t.includes('hard') || t.includes('comp') || t.includes('laptop')) return 'laptop';
    if (t.includes('net') || t.includes('wifi') || t.includes('router')) return 'router';
    if (t.includes('periph') || t.includes('mouse') || t.includes('key')) return 'keyboard';
    if (t.includes('service') || t.includes('maintenance')) return 'build';
    if (t.includes('return')) return 'assignment_return';
    return 'inventory_2';
  }
}

import { Component, OnInit } from '@angular/core';
import { RequestService } from '../../../core/services/request.service';
import { AssetRequest, ApprovalEntry, ApprovalStage, RequestStatus, RequestUrgency, RequestType } from '../../../core/models/request.model';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { AssetService } from '../../../core/services/asset.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MailService } from '../../../core/services/mail.service';
import { HeroService } from '../../../core/services/hero.service';
import { AdminDataService } from '../../../core/services/admin-data.service';



@Component({
  selector: 'app-asset-requests',
  templateUrl: './asset-requests.component.html',
  styleUrls: ['./asset-requests.component.scss']
})
export class AssetRequestsComponent implements OnInit {
  allRequests: AssetRequest[] = [];
  allAssetRequests: AssetRequest[] = [];
  filteredRequests: AssetRequest[] = [];
  pendingRequests: AssetRequest[] = [];
  // activeTab: 'pending' | 'all' | 'return' = 'pending';
  confirmationRequests: AssetRequest[] = [];
  filteredConfirmationRequests: AssetRequest[] = [];
  confirmationSearchTerm = '';
  activeTab: 'pending' | 'all' | 'allAssetRequests' | 'confirmation' | 'return' = 'pending';
  searchTerm = '';
  selectedStatus: RequestStatus | '' = RequestStatus.PENDING;
  selectedUrgency = '';
  statuses = Object.values(RequestStatus);
  statusFilterOptions = [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED];
  urgencies = Object.values(RequestUrgency);
  RequestStatus = RequestStatus; // Add this to use in template
  RequestType = RequestType;
  availableAssets: any[] = [];
  private assetSubCategoryMap = new Map<string, { name: string, typeId: string }>();
  selectedAssetId = '';
  allocationTeamMemberList: any[] = [];
  selectedAllocationMemberId = '';
  assignedAllocationMemberName = '';
  showActionModal = false;
  selectedRequest: AssetRequest | null = null;
  actionType: string | null = null;
  actionComments = '';

  showDetailModal = false;
  detailRequest: AssetRequest | null = null;

  returnRequests: AssetRequest[] = [];
  returnConfirmationRequests: AssetRequest[] = [];
  requestStats = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0, inProgress: 0 };
  private returnApproverNameCache = new Map<string, string>();

  trackingSteps: any[] = [];
  overallProgress = 0;
  loadingProgress = false;

  // Loading & error state
  isLoading = true;
  loadError = '';

  // Pagination
  currentPage = 1;
  pageSize = 5;
  protected readonly Math = Math;
  task_id_latest = '';

  constructor(
    private requestService: RequestService,
    private authService: AuthService,
    private userService: UserService,
    private assetService: AssetService,
    private notificationService: NotificationService,
    private mailService: MailService,
    private hs: HeroService,
    private adminService: AdminDataService
  ) { }

  ngOnInit(): void {
    this.loadAllData();
  }

  async loadAllData(): Promise<void> {

    this.isLoading = true;
    this.loadError = '';

    try {
      const currentUser = this.authService.getCurrentUser();
      const approverId = currentUser?.id;
      if (!approverId) {
        this.allRequests = [];
        this.allAssetRequests = [];
        this.pendingRequests = [];
        this.confirmationRequests = [];
        this.returnConfirmationRequests = [];
        this.returnRequests = [];
        this.filteredRequests = [];
        this.requestStats = this.getEmptyRequestStats();
        this.loadError = 'Current user is missing. Please log in again.';
        return;
      }

      // Fetch all data including assignments in parallel
      const [allReqs, pendingReqs, confirmReqs, returnReqs, allReturnReqs, allAssignments] = await Promise.all([
        this.fetchApprovedAssetRequestsByAssetManager(approverId).catch(err => { console.error('Approved Asset Req fetch failed:', err); return []; }),
        this.requestService.fetchPendingRequestsFromService(approverId).catch(err => { console.error('Pending Req fetch failed:', err); return []; }),
        this.requestService.fetchConfirmationRequestsFromService(approverId).catch(err => { console.error('Confirm Req fetch failed:', err); return []; }),
        this.requestService.fetchPendingReturnApprovalsFromService(approverId).catch(err => { console.error('Return Req fetch failed:', err); return []; }),
        this.requestService.fetchAllReturnRequestsFromService().catch(err => { console.error('All Return Req fetch failed:', err); return []; }),
        this.adminService.getAssetTypeAssignmentDetails().catch(err => { console.error('Assignment fetch failed:', err); return []; }),
        this.loadAvailableAssets().catch(err => { console.error('Assets load failed:', err); return []; })
      ] as any[]);

      // Resolve manager's assigned types for strict filtering
      const myAssignments = (allAssignments || []).filter((a: any) =>
        a.assetManagerId && a.assetManagerId.toLowerCase().trim() === approverId.toLowerCase().trim()
      );
      const managerTypeNames = myAssignments.map((a: any) => a.name.toLowerCase().trim());
      console.log(`[AssetRequests] Manager ${approverId} assigned to types:`, managerTypeNames);

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

      // Deduplicate requests by ID to handle API returning multiple entries
      const deduplicate = (reqs: any[]) => {
        const map = new Map();
        (reqs || []).forEach(req => {
          const key = req.id || req.requestNumber;
          if (key && !map.has(key)) {
            map.set(key, req);
          }
        });
        return Array.from(map.values());
      };

      // Filter ALL data arrays based on these assignments
      this.allRequests = deduplicate(allReqs);
      this.allAssetRequests = [...this.allRequests];
      const filteredPending = deduplicate(pendingReqs).filter(isMyType);
      const filteredReturn = deduplicate(returnReqs).filter(isMyType);

      // Build the confirmationIds set AFTER confirmationRequests is finalized (done later below)
      // For now build a preliminary set from confirmReqs for filtering pending
      const rawConfirmIds = new Set(deduplicate(confirmReqs).map((r: AssetRequest) => String(r.id).toLowerCase().trim()));
      this.pendingRequests = filteredPending.filter((r: AssetRequest) => !rawConfirmIds.has(String(r.id).toLowerCase().trim()));

      // Reconcile allRequests statuses against the approvals table
      const pendingIds = new Set(this.pendingRequests.map((r: AssetRequest) => String(r.id).toLowerCase().trim()));
      this.allRequests = this.allRequests.map((req: AssetRequest) => {
        if (
          req.status === RequestStatus.PENDING &&
          req.currentStage !== ApprovalStage.TEAM_LEAD &&
          !pendingIds.has(String(req.id).toLowerCase().trim()) &&
          !rawConfirmIds.has(String(req.id).toLowerCase().trim())
        ) {
          return { ...req, status: RequestStatus.APPROVED };
        }
        return req;
      });

      // Filter out requests that are still pending at the Team Lead stage from the Asset Manager's view
      this.allRequests = this.allRequests.filter((req: AssetRequest) => {
        return !(req.currentStage === ApprovalStage.TEAM_LEAD && req.status === RequestStatus.PENDING);
      });

      // Allocation Team Member Dropdown removed per user request. We resolve in openDetailModal instead.
      this.returnRequests = await this.buildManagerReturnRequests(allReturnReqs, filteredReturn, approverId);
      this.confirmationRequests = [...deduplicate(confirmReqs), ...this.returnConfirmationRequests];
      console.log(`Confirmation Requests loaded: ${this.confirmationRequests.length}`);
      this.requestStats = this.requestService.getAllRequestStats(this.getDashboardStatsRequests());

      this.applyFilters();
    } catch (err: any) {
      console.error('Failed to load requests:', err);
      this.loadError = err?.message || err?.errorThrown || 'Failed to load request data. Please try again.';
      this.allRequests = [];
      this.allAssetRequests = [];
      this.pendingRequests = [];
      this.confirmationRequests = [];
      this.filteredConfirmationRequests = [];
      this.returnConfirmationRequests = [];
      this.returnRequests = [];
    } finally {
      this.isLoading = false;
    }
  }

  async Getassetidbyapprovalid(request_id: any) {
    try {
      const resp: any = await this.hs.ajax('Getassetidbyapprovalid', 'http://schemas.cordys.com/AMS_Database_Metadata',
        { Request_id: request_id }
      );
      const data = this.hs.xmltojson(resp, 'tuple');
      if (data) {
        const parent = data.old || data;
        const approval = parent.t_request_approvals || {};
        this.task_id_latest = approval.temp2 || '';
        console.log("[AssetManager] Latest Task ID fetched:", this.task_id_latest);
      }
    } catch (err) {
      console.error("[AssetManager] Error fetching latest task ID:", err);
    }
  }

  private async fetchApprovedAssetRequestsByAssetManager(approverId: string): Promise<AssetRequest[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetApprovedAssetRequestsByAssetManager xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="">
      <approver_id>${approverId}</approver_id>
    </GetApprovedAssetRequestsByAssetManager>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    const response = await this.hs.ajax(null, null, {}, soapRequest);
    const tuples = this.hs.xmltojson(response, 'tuple');
    if (!tuples) {
      return [];
    }

    const tupleArray = Array.isArray(tuples) ? tuples : [tuples];
    return tupleArray.map((tuple: any) => this.requestService.mapTupleToRequest(tuple));
  }


  async loadAvailableAssets(): Promise<void> {
    try {
      const [allAssets, subCategories] = await Promise.all([
        this.assetService.fetchAssetDetailsFromService(),
        this.assetService.getAllSubcategoriesCordys().catch(err => {
          console.warn('Failed to load asset subcategories for dropdown matching:', err);
          return [];
        })
      ]);
      this.availableAssets = allAssets.filter(a => a.status === 'Available');
      this.assetSubCategoryMap = new Map(
        (subCategories || [])
          .map((sub: any) => {
            const id = this.normalizeAssetMatchKey(sub?.sub_category_id || sub?.SUB_CATEGORY_ID || sub?.id);
            const name = this.normalizeAssetMatchKey(sub?.name || sub?.sub_category_name || sub?.SUB_CATEGORY_NAME);
            const typeId = this.normalizeAssetMatchKey(sub?.type_id || sub?.TYPE_ID);
            return id ? [id, { name, typeId }] as [string, { name: string, typeId: string }] : null;
          })
          .filter((entry): entry is [string, { name: string, typeId: string }] => !!entry)
      );
      console.log(`Loaded ${this.availableAssets.length} available assets for dropdown`);
    } catch (err) {
      console.error('Failed to load available assets:', err);
      this.availableAssets = [];
      this.assetSubCategoryMap.clear();
    }
  }

  get filteredAvailableAssets(): any[] {
    return this.getAvailableAssetDropdownResult().assets;
  }

  get showAvailableAssetFallbackWarning(): boolean {
    return this.getAvailableAssetDropdownResult().isFallback;
  }

  private getAvailableAssetDropdownResult(): { assets: any[], isFallback: boolean } {
    if (!this.detailRequest) return { assets: [], isFallback: false };

    const requestedTypes = this.getRequestedAssetTypeKeys(this.detailRequest);
    const requestedCategories = this.getRequestedAssetCategoryKeys(this.detailRequest);

    const exactMatches = this.availableAssets.filter(asset => {
      const typeMatches = requestedTypes.length === 0 || this.getAssetTypeKeys(asset).some(key => requestedTypes.includes(key));
      const categoryMatches = requestedCategories.length === 0 || this.matchesRequestedAssetCategory(asset, requestedCategories);
      return typeMatches && categoryMatches;
    });

    if (exactMatches.length > 0) {
      return { assets: exactMatches, isFallback: false };
    }

    return { assets: this.availableAssets, isFallback: this.availableAssets.length > 0 };
  }

  private getRequestedAssetTypeKeys(request: AssetRequest): string[] {
    return this.uniqueKeys([
      request.assetType,
      request.assignedTypeId,
      this.getSubCategoryInfo(request.category)?.typeId,
      this.getSubCategoryInfo(request.subCategory)?.typeId,
      this.requestService.normalizeAssetType(request.assetType)
    ]);
  }

  private getRequestedAssetCategoryKeys(request: AssetRequest): string[] {
    const genericValues = new Set(['hardware', 'software', 'network', 'peripheral', 'asset detail', 'n/a']);
    return this.uniqueKeys([
      request.category,
      request.subCategory,
      request.assetName,
      request.assignedSubCategoryId,
      this.getSubCategoryInfo(request.category)?.name,
      this.getSubCategoryInfo(request.subCategory)?.name,
      this.getSubCategoryInfo(request.assignedSubCategoryId)?.name,
      this.requestService.normalizeCategory(request.category),
      this.requestService.normalizeCategory(request.subCategory)
    ]).filter(key => !genericValues.has(key));
  }

  private getAssetTypeKeys(asset: any): string[] {
    return this.uniqueKeys([
      asset?.type_id,
      asset?.type_name,
      asset?.asset_type,
      this.getSubCategoryInfo(asset?.sub_category_id)?.typeId,
      this.requestService.normalizeAssetType(asset?.type_id || asset?.type_name || asset?.asset_type)
    ]);
  }

  private getAssetCategoryKeys(asset: any): string[] {
    return this.uniqueKeys([
      asset?.sub_category_id,
      asset?.sub_category_name,
      asset?.category,
      asset?.asset_name,
      this.getSubCategoryInfo(asset?.sub_category_id)?.name,
      this.requestService.normalizeCategory(asset?.sub_category_id || asset?.sub_category_name || asset?.category)
    ]);
  }

  private getSubCategoryInfo(value: string | undefined): { name: string, typeId: string } | undefined {
    const key = this.normalizeAssetMatchKey(value);
    return key ? this.assetSubCategoryMap.get(key) : undefined;
  }

  private matchesRequestedAssetCategory(asset: any, requestedCategories: string[]): boolean {
    const assetCategories = this.getAssetCategoryKeys(asset);
    return assetCategories.some(assetCategory =>
      requestedCategories.some(requestedCategory =>
        assetCategory === requestedCategory ||
        assetCategory.includes(requestedCategory) ||
        requestedCategory.includes(assetCategory)
      )
    );
  }

  private uniqueKeys(values: Array<string | undefined>): string[] {
    return Array.from(new Set(
      values
        .map(value => this.normalizeAssetMatchKey(value))
        .filter((value): value is string => !!value)
    ));
  }

  private normalizeAssetMatchKey(value: string | undefined): string {
    if (!value) return '';
    const normalized = String(value).trim().toLowerCase();
    if (!normalized || normalized === 'null' || normalized === 'undefined' || normalized === '—' || normalized === '-') {
      return '';
    }
    return normalized;
  }

  switchTab(tab: 'pending' | 'all' | 'allAssetRequests' | 'confirmation' | 'return'): void {
    this.activeTab = tab;
    this.searchTerm = '';
    this.selectedStatus = (tab === 'pending' || tab === 'return') ? RequestStatus.PENDING : '';
    this.selectedUrgency = '';
    this.confirmationSearchTerm = '';
    this.currentPage = 1; // Reset page on tab switch
    this.applyFilters();
  }

  applyFilters(): void {
    let source: AssetRequest[] = [];
    if (this.activeTab === 'pending') {
      // Use ONLY pendingRequests (from SOAP approval service) — not merged with allRequests.
      // allRequests comes from the main DB table whose status may lag behind the approval table,
      // causing already-approved requests to still appear as Pending here.
      source = [...this.pendingRequests];
    } else if (this.activeTab === 'return') {
      source = this.returnRequests;
    } else if (this.activeTab === 'allAssetRequests') {
      source = [...this.allAssetRequests];
    } else if (this.activeTab === 'confirmation') {
      source = this.confirmationRequests;
    } else {
      source = [...this.allAssetRequests, ...this.returnRequests];
    }

    const currentSearch = this.activeTab === 'confirmation' ? this.confirmationSearchTerm : this.searchTerm;

    this.filteredRequests = source.filter(req => {
      const matchesSearch = !currentSearch ||
        req.requestNumber.toLowerCase().includes(currentSearch.toLowerCase()) ||
        req.requesterName.toLowerCase().includes(currentSearch.toLowerCase()) ||
        req.category.toLowerCase().includes(currentSearch.toLowerCase());
      const matchesStatus = this.matchesSelectedStatus(req.status);
      const matchesUrgency = !this.selectedUrgency || req.urgency === this.selectedUrgency;
      return matchesSearch && matchesStatus && matchesUrgency;
    }).sort((a, b) => {
      const idA = (a.id || a.requestNumber || '').toLowerCase();
      const idB = (b.id || b.requestNumber || '').toLowerCase();
      return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
    });

    console.log(`[AssetRequests] applyFilters: tab=${this.activeTab}, sourceCount=${source.length}, filteredCount=${this.filteredRequests.length}`);
    if (this.selectedStatus) {
      console.log(`[AssetRequests] Status Filter: ${this.selectedStatus}. Source statuses:`, source.map(r => r.status).slice(0, 10));
    }

    this.filteredConfirmationRequests = this.confirmationRequests.filter(req => {
      return !this.confirmationSearchTerm ||
        req.id.toLowerCase().includes(this.confirmationSearchTerm.toLowerCase()) ||
        req.requesterName.toLowerCase().includes(this.confirmationSearchTerm.toLowerCase()) ||
        req.category.toLowerCase().includes(this.confirmationSearchTerm.toLowerCase());
    }).sort((a, b) => {
      const idA = (a.id || a.requestNumber || '').toLowerCase();
      const idB = (b.id || b.requestNumber || '').toLowerCase();
      return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
    });

    this.currentPage = 1; // Reset page on filter change
  }

  private getRequestSortTime(request: AssetRequest): number {
    const dateValue = request.lastUpdated || request.requestDate;
    const timestamp = dateValue ? new Date(dateValue).getTime() : NaN;
    if (!Number.isNaN(timestamp)) return timestamp;

    const numericId = String(request.id || request.requestNumber || '').match(/\d+/g)?.join('');
    return numericId ? Number(numericId) : 0;
  }

  private matchesSelectedStatus(status: RequestStatus): boolean {
    if (!this.selectedStatus) return true;
    if (this.selectedStatus === RequestStatus.APPROVED) {
      return status === RequestStatus.APPROVED || status === RequestStatus.COMPLETED;
    }
    return status === this.selectedStatus;
  }

  private async buildManagerReturnRequests(
    allReturnReqs: AssetRequest[],
    managerPendingReqs: AssetRequest[],
    approverId: string
  ): Promise<AssetRequest[]> {
    this.returnConfirmationRequests = [];
    const pendingById = new Map<string, AssetRequest>();
    managerPendingReqs.forEach(req => pendingById.set(req.id || req.requestNumber, req));

    const allById = new Map<string, AssetRequest>();
    allReturnReqs.forEach(req => allById.set(req.id || req.requestNumber, req));

    const ids = new Set<string>([...allById.keys(), ...pendingById.keys()]);
    const requests: AssetRequest[] = [];
    const confirmationRequests: AssetRequest[] = [];

    for (const id of ids) {
      const pendingSource = pendingById.get(id);
      const source = pendingSource || allById.get(id);
      if (!source) continue;

      const base = { ...source } as AssetRequest;
      const progress = await this.requestService.getReturnRequestProgress(id);
      const orderedProgress = this.getOrderedReturnProgress(progress);
      const chain = await this.buildReturnApprovalChain(progress);
      const managerApprovals = orderedProgress.filter((approval: any) =>
        approval.approver_id === approverId &&
        this.isAssetManagerReturnRole(approval.role)
      );

      // All return requests are fetched for history, so ignore requests that never involved this manager.
      if (!pendingSource && managerApprovals.length === 0) {
        continue;
      }

      const hasManagerPendingAction = managerApprovals.some((approval: any) =>
        approval.approver_id === approverId &&
        this.normalizeStatusText(approval.status) === RequestStatus.PENDING &&
        this.isAssetManagerReturnRole(approval.role)
      );

      base.approvalChain = chain.length ? chain : base.approvalChain;

      if (managerApprovals.length > 0) {
        const hasPendingManagerApproval = managerApprovals.some((approval: any) =>
          this.normalizeStatusText(approval.status) === RequestStatus.PENDING
        );

        managerApprovals.forEach((approval: any) => {
          const row = { ...base } as AssetRequest;
          row.status = this.normalizeStatusText(approval.status);
          row.currentStage = ApprovalStage.ASSET_MANAGER;
          row.returnapprovalId = approval.return_approval_id || row.returnapprovalId;
          row.taskid = approval.temp2 || row.taskid;
          row.lastUpdated = approval.action_date || row.lastUpdated;
          row.approvalChain = chain.length ? chain : row.approvalChain;
          // requests.push(row);
          const isPendingFinalConfirmation =
            this.isFinalManagerReturnApproval(orderedProgress, approval) &&
            this.normalizeStatusText(approval.status) === RequestStatus.PENDING;

          if (isPendingFinalConfirmation) {
            confirmationRequests.push(row);
          } else {
            requests.push(row);
          }
        });

        if (pendingSource && !hasPendingManagerApproval && pendingSource.status === RequestStatus.PENDING) {
          const pendingRow = { ...base } as AssetRequest;
          pendingRow.status = RequestStatus.PENDING;
          pendingRow.currentStage = ApprovalStage.ASSET_MANAGER;
          pendingRow.returnapprovalId = pendingRow.returnapprovalId || pendingSource.returnapprovalId;
          pendingRow.taskid = pendingRow.taskid || pendingSource.taskid;
          pendingRow.approvalChain = chain.length ? chain : pendingRow.approvalChain;
          requests.push(pendingRow);
        }

        continue;
      }

      if (pendingSource && pendingSource.status === RequestStatus.PENDING) {
        base.status = RequestStatus.PENDING;
        base.currentStage = ApprovalStage.ASSET_MANAGER;
        base.returnapprovalId = base.returnapprovalId || pendingSource.returnapprovalId;
        base.taskid = base.taskid || pendingSource.taskid;
      } else if (hasManagerPendingAction) {
        base.status = RequestStatus.PENDING;
        base.currentStage = ApprovalStage.ASSET_MANAGER;
      } else if (base.status === RequestStatus.PENDING) {
        base.status = this.getReturnDisplayStatus(progress, base.status);
        base.currentStage = ApprovalStage.ALLOCATION;
        base.returnapprovalId = '';
      }

      requests.push(base);
    }

    this.returnConfirmationRequests = this.mergeRequests(confirmationRequests);
    return this.mergeRequests(requests);
  }

  private async buildReturnApprovalChain(progress: any[]): Promise<ApprovalEntry[]> {
    const ordered = this.getOrderedReturnProgress(progress);
    const stages = [
      { stage: ApprovalStage.ASSET_MANAGER, matcher: (approval: any) => this.isAssetManagerReturnRole(approval.role) },
      { stage: ApprovalStage.ALLOCATION, matcher: (approval: any) => this.isAllocationReturnRole(approval.role) },
      { stage: 'Asset Manager Final Approval' as ApprovalStage, matcher: (approval: any) => this.isAssetManagerReturnRole(approval.role) }
    ];
    const usedIndexes = new Set<number>();

    return Promise.all(stages.map(async (template): Promise<ApprovalEntry> => {
      const matchIndex = ordered.findIndex((approval: any, index: number) =>
        !usedIndexes.has(index) && template.matcher(approval)
      );
      const approval = matchIndex >= 0 ? ordered[matchIndex] : null;
      if (matchIndex >= 0) usedIndexes.add(matchIndex);

      return {
        stage: template.stage,
        action: approval ? this.toApprovalAction(approval.status) : 'Pending',
        approverId: approval?.approver_id,
        approverName: approval ? await this.getReturnApproverName(approval.approver_id) : undefined,
        timestamp: approval?.action_date,
        comments: approval?.remarks
      };
    }));

    // Old behavior mapped only approval rows that already existed in DB, so future return stages were hidden.
    // if (!progress?.length) return [];
    // const ordered = [...progress].sort((a: any, b: any) => {
    //   const dateA = a.action_date ? new Date(a.action_date).getTime() : NaN;
    //   const dateB = b.action_date ? new Date(b.action_date).getTime() : NaN;
    //   if (!Number.isNaN(dateA) && !Number.isNaN(dateB) && dateA !== dateB) return dateA - dateB;
    //   return this.getNumericApprovalId(a.return_approval_id) - this.getNumericApprovalId(b.return_approval_id);
    // });
    // return Promise.all(ordered.map(async (approval: any): Promise<ApprovalEntry> => ({
    //   stage: this.isAllocationReturnRole(approval.role) ? ApprovalStage.ALLOCATION : ApprovalStage.ASSET_MANAGER,
    //   action: this.toApprovalAction(approval.status),
    //   approverId: approval.approver_id,
    //   approverName: await this.getReturnApproverName(approval.approver_id),
    //   timestamp: approval.action_date,
    //   comments: approval.remarks
    // })));
  }

  private getReturnDisplayStatus(progress: any[], fallback: RequestStatus): RequestStatus {
    if (!progress?.length) return fallback;
    if (progress.some((approval: any) => this.normalizeStatusText(approval.status) === RequestStatus.REJECTED)) {
      return RequestStatus.REJECTED;
    }
    if (progress.some((approval: any) => this.normalizeStatusText(approval.status) === RequestStatus.PENDING)) {
      return RequestStatus.IN_PROGRESS;
    }
    if (progress.some((approval: any) => this.normalizeStatusText(approval.status) === RequestStatus.APPROVED)) {
      return RequestStatus.APPROVED;
    }
    return fallback;
  }

  private normalizeStatusText(status: string): RequestStatus {
    const value = (status || '').toLowerCase();
    if (value.includes('approved')) return RequestStatus.APPROVED;
    if (value.includes('rejected')) return RequestStatus.REJECTED;
    if (value.includes('completed')) return RequestStatus.COMPLETED;
    if (value.includes('cancelled')) return RequestStatus.CANCELLED;
    if (value.includes('progress')) return RequestStatus.IN_PROGRESS;
    return RequestStatus.PENDING;
  }

  private toApprovalAction(status: string): ApprovalEntry['action'] {
    const normalized = this.normalizeStatusText(status);
    if (normalized === RequestStatus.APPROVED || normalized === RequestStatus.COMPLETED) return 'Approved';
    if (normalized === RequestStatus.REJECTED || normalized === RequestStatus.CANCELLED) return 'Rejected';
    return 'Pending';
  }

  private isAssetManagerReturnRole(role: string): boolean {
    return (role || '').toLowerCase().includes('asset manager');
  }

  private isAllocationReturnRole(role: string): boolean {
    const value = (role || '').toLowerCase();
    return value.includes('allocation');
  }

  private getOrderedReturnProgress(progress: any[] = []): any[] {
    return [...(progress || [])].sort((a: any, b: any) => {
      const dateA = a.action_date ? new Date(a.action_date).getTime() : NaN;
      const dateB = b.action_date ? new Date(b.action_date).getTime() : NaN;
      if (!Number.isNaN(dateA) && !Number.isNaN(dateB) && dateA !== dateB) return dateA - dateB;
      return this.getNumericApprovalId(a.return_approval_id) - this.getNumericApprovalId(b.return_approval_id);
    });
  }

  private isFinalManagerReturnApproval(orderedProgress: any[], approval: any): boolean {
    const currentIndex = orderedProgress.findIndex((item: any) =>
      item.return_approval_id === approval.return_approval_id
    );
    if (currentIndex < 0) return false;

    return orderedProgress.slice(0, currentIndex).some((item: any) =>
      this.isAllocationReturnRole(item.role) &&
      this.normalizeStatusText(item.status) === RequestStatus.APPROVED
    );
  }

  private getNumericApprovalId(id: string): number {
    const numericId = String(id || '').match(/\d+/g)?.join('');
    return numericId ? Number(numericId) : 0;
  }

  private async getReturnApproverName(approverId?: string): Promise<string | undefined> {
    if (!approverId) return undefined;
    if (this.returnApproverNameCache.has(approverId)) return this.returnApproverNameCache.get(approverId);

    const user = await this.authService.getUserDetails(approverId).catch(() => null);
    const name = user?.name || approverId;
    this.returnApproverNameCache.set(approverId, name);
    return name;
  }

  private async isFinalReturnConfirmation(request: AssetRequest): Promise<boolean> {
    const progress = await this.requestService.getReturnRequestProgress(request.id);
    const currentApproval = progress.find((approval: any) =>
      approval.return_approval_id === request.returnapprovalId &&
      this.isAssetManagerReturnRole(approval.role)
    );

    if (!currentApproval) return false;

    const currentOrder = this.getNumericApprovalId(currentApproval.return_approval_id);
    return progress.some((approval: any) =>
      this.isAllocationReturnRole(approval.role) &&
      this.normalizeStatusText(approval.status) === RequestStatus.APPROVED &&
      this.getNumericApprovalId(approval.return_approval_id) < currentOrder
    );
  }

  getApprovalStageLabel(stage: ApprovalStage | string): string {
    if (stage === 'Asset Manager Final Approval') return 'Asset Manager Final';
    if (stage === ApprovalStage.ASSET_MANAGER) return 'Asset Manager';
    if (stage === ApprovalStage.ALLOCATION) return 'Asset Allocation Team';
    if (stage === ApprovalStage.TEAM_LEAD) return 'Team Lead';
    return String(stage || '');
  }

  private mergeRequests(...groups: AssetRequest[][]): AssetRequest[] {
    const byId = new Map<string, AssetRequest>();
    groups.flat().forEach(request => {
      const key = request.id || request.requestNumber;
      if (key) byId.set(key, request);
    });
    return Array.from(byId.values());
  }

  private getDashboardStatsRequests(): AssetRequest[] {
    return this.mergeRequests(
      this.allRequests,
      this.pendingRequests,
      this.confirmationRequests,
      this.returnRequests
    );
  }

  private getEmptyRequestStats() {
    return { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0, inProgress: 0 };
  }


  get paginatedRequests(): AssetRequest[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRequests.slice(start, start + this.pageSize);
  }

  get paginatedConfirmationRequests(): AssetRequest[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredConfirmationRequests.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    const source = this.activeTab === 'confirmation' ? this.filteredConfirmationRequests : this.filteredRequests;
    return Math.ceil(source.length / this.pageSize);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  get paginationDisplayRange(): string {
    const source = this.activeTab === 'confirmation' ? this.filteredConfirmationRequests : this.filteredRequests;
    if (source.length === 0) return '0 - 0 of 0';
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, source.length);
    return `${start} - ${end} of ${source.length}`;
  }

  onConfirmationSearchChange(): void {
    this.filteredConfirmationRequests = this.confirmationRequests.filter(req => {
      return !this.confirmationSearchTerm ||
        req.requestNumber.toLowerCase().includes(this.confirmationSearchTerm.toLowerCase()) ||
        req.requesterName.toLowerCase().includes(this.confirmationSearchTerm.toLowerCase()) ||
        req.category.toLowerCase().includes(this.confirmationSearchTerm.toLowerCase());
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  getUrgencyClass(urgency: RequestUrgency): string {
    switch (urgency) {
      case RequestUrgency.HIGH: return 'urgency-high';
      case RequestUrgency.MEDIUM: return 'urgency-medium';
      case RequestUrgency.LOW: return 'urgency-low';
      default: return '';
    }
  }

  openActionModal(request: AssetRequest, action: 'approve' | 'reject'): void {
    console.log("Request is ", request);
    this.selectedRequest = request;
    this.actionType = action;
    this.actionComments = '';
    this.showActionModal = true;
  }

  closeActionModal(): void {
    this.showActionModal = false;
    this.selectedRequest = null;
    this.actionType = null;
    this.actionComments = '';
  }

  async directConfirmAction(request: AssetRequest, action: 'approve' | 'reject'): Promise<void> {
    if (action === 'reject' && (!this.actionComments || this.actionComments.trim() === '')) {
      alert('Approver remarks are required for rejection.');
      return;
    }

    this.notificationService.showToast(`Processing ${action === 'approve' ? 'approval' : 'rejection'} for request ${request.id}...`, 'info');

    if (action === 'approve') {
      if (request.requestType !== RequestType.RETURN_ASSET) {
        if (!this.selectedAssetId) {
          alert('Please select an asset to allocate before approving.');
          return;
        }
        if (!this.selectedAllocationMemberId) {
          alert('Please assign an Allocation Team Member before approving.');
          return;
        }
      }
    }

    this.selectedRequest = request;
    this.actionType = action;
    // this.actionComments = ''; // DO NOT RESET HERE, we need the value from UI
    console.log('Selected Allocation Member ID:', this.selectedAllocationMemberId);
    await this.confirmAction();
    this.closeDetailModal();
  }

  // async confirmAction(): Promise<void> {
  //   debugger;
  //On approval
  //update the request approvals table with Asset Manager status on approved
  //update the asset table for that particular asset id with status  "Move To Allocation Team"
  //create new entry in  request approvals table with asset id in it 

  //On reject
  ////update the request approvals table with Asset Manager status on rejected
  // //update the asset_request table with status rejected 
  // console.log("Selected request is ", this.selectedRequest);
  async confirmAction(): Promise<void> {

    console.log("Confirming action for request:", this.selectedRequest);
    if (!this.selectedRequest || !this.actionType) return;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.warn("No current user found during confirmAction");
      return;
    }

    if (this.actionType === 'approve') {
      if (this.selectedRequest.requestType === RequestType.RETURN_ASSET) {
        console.log("Executing Return Approval Flow...");

        if (!this.selectedRequest.returnapprovalId) {
          this.notificationService.showToast('Approval ID is missing for this return request. Please refresh and try again.', 'error');
          console.error('[ReturnApproval] Missing returnapprovalId for request:', this.selectedRequest);
          return;
        }

        // Request 1: Update current manager approval to 'Approved'
        const req6 = {
          tuple: {
            old: { t_asset_return_approvals: { return_approval_id: this.selectedRequest.returnapprovalId } },
            new: { t_asset_return_approvals: { status: "Approved", remarks: this.actionComments } }
          }
        };

        try {
          const isFinalConfirmation = await this.isFinalReturnConfirmation(this.selectedRequest);
          await this.requestService.updateReturnAssetStatus(req6 as any);

          console.log(`[ReturnApproval] isFinalConfirmation=${isFinalConfirmation}`);

          if (isFinalConfirmation) {
            // This is the final stage. Complete the request.
            console.log("Executing Final Return Confirmation...");

            // Update t_asset_returns main table status to 'Completed'
            const updateReturnReq = {
              tuple: {
                old: { t_asset_returns: { return_id: this.selectedRequest.id } },
                new: { t_asset_returns: { status: 'Completed' } }
              }
            };
            try {
              await this.requestService.createEntryForReturn(updateReturnReq as any);
            } catch (e) {
              console.error("Failed to update t_asset_returns status to Completed:", e);
            }

            // Update asset status to 'Available' and clear assignment
            if (this.selectedRequest.assignedAssetId) {
              try {
                const updateAssetReq = {
                  tuple: {
                    old: { m_assets: { asset_id: this.selectedRequest.assignedAssetId } },
                    // Clear assignment + allocated date (temp4) on successful return completion
                    new: { m_assets: { status: 'Available', temp1: '', temp4: '' } }
                  }
                };
                await this.requestService.updateAssetStatus(updateAssetReq as any);
                console.log(`[ReturnApproval] Asset ${this.selectedRequest.assignedAssetId} set to Available`);
              } catch (e) {
                console.error("Failed to update asset status to Available:", e);
              }
            }

            const taskid = this.selectedRequest?.taskid;
            if (taskid) {
              await this.requestService.completeUserTask({ TaskId: `${taskid}`, Action: 'COMPLETE' } as any);
            }
            this.notificationService.showToast(`Return request ${this.selectedRequest.id} completed.`, 'success');

            // Send 'completed' email to Employee
            this.mailService.sendReturnRequestNotification({
              stage: 'completed',
              returnId: this.selectedRequest.id,
              employeeName: this.selectedRequest.requesterName,
              assetName: this.selectedRequest.assetType,
              remarks: this.actionComments || 'Return successfully completed.',
              actionByName: currentUser.name
            });

          } else {
            // This is the initial approval stage. Forward to Allocation Team.
            const allocationApproverId = await this.requestService.resolveReturnApproverId(
              this.selectedRequest.assignedAssetId || '',
              'rol_05'
            );

            const req7 = {
              tuple: {
                new: {
                  t_asset_return_approvals: {
                    approver_id: allocationApproverId,
                    request_id: this.selectedRequest.id,
                    role: "Allocation Team Member",
                    status: "Pending",
                    remarks: '',
                  }
                }
              }
            };
            await this.requestService.completeTask(req7 as any);

            const taskid = this.selectedRequest?.taskid;
            if (taskid) {
              await this.requestService.completeUserTask({ TaskId: `${taskid}`, Action: 'COMPLETE' } as any);
            }
            this.notificationService.showToast(`Return request ${this.selectedRequest.id} approved.`, 'success');

            // Send email to Allocation Team
            this.mailService.sendReturnRequestNotification({
              stage: 'am_approved',
              returnId: this.selectedRequest.id,
              employeeName: this.selectedRequest.requesterName,
              assetName: this.selectedRequest.assetType,
              remarks: this.actionComments,
              actionByName: currentUser.name,
              nextApproverName: 'Allocation Team'
            });
          }
        } catch (error) {
          console.error("Return Approval SOAP call failed:", error);
        }
      } else {
        // Approval logic for Standard Requests (New Asset / Warranty)
        var req1 = {
          tuple: {
            old: { t_request_approvals: { approval_id: this.selectedRequest.approvalId } },
            new: { t_request_approvals: { status: "Approved", remarks: this.actionComments } }
          }
        };
        await this.requestService.updateEntryForAssetManager(req1 as any);

        var req2 = {
          tuple: {
            old: { m_assets: { asset_id: this.selectedRequest.assignedAssetId } },
            new: {
              m_assets: {
                status: "MoveToAllocationTeam",
                temp1: this.selectedRequest.requesterId,
                temp2: this.selectedRequest.id
              }
            }
          }
        };
        await this.requestService.updateAssetStatus(req2 as any);

        var req3 = {
          tuple: {
            new: {
              t_request_approvals: {
                approver_id: this.selectedAllocationMemberId,
                request_id: this.selectedRequest.id,
                role: "Asset Allocation Team",
                status: "Pending",
                remarks: this.actionComments,
                temp1: this.selectedRequest.assignedAssetId,
              }
            }
          }
        };
        await this.requestService.createEntryForTeamAllocationMember(req3 as any);

        const taskid = this.selectedRequest?.taskid;
        if (taskid) {
          await this.requestService.completeUserTask({ TaskId: `${taskid}`, Action: 'COMPLETE' } as any);
        }

        // Send Mail
        await this.mailService.sendAssetManagerStatusUpdate({
          requestId: this.selectedRequest.id,
          employeeName: this.selectedRequest.requesterName,
          status: 'Approved',
          managerName: currentUser.name,
          remarks: this.actionComments,
          allocationMemberName: this.assignedAllocationMemberName || 'Allocation Team',
          assetName: this.selectedRequest.assetType
        });

        this.notificationService.showToast(`Request ${this.selectedRequest.id} approved and routed for allocation.`, 'success');
      }
    } else {
      // Rejection logic for ALL request types
      if (this.selectedRequest.requestType === RequestType.RETURN_ASSET) {
        console.log("Executing Return Rejection Flow...");

        // Step 1: Update current return approval record to 'Rejected'
        const req9 = {
          tuple: {
            old: { t_asset_return_approvals: { return_approval_id: this.selectedRequest.returnapprovalId } },
            new: { t_asset_return_approvals: { status: "Rejected", remarks: this.actionComments } }
          }
        };
        await this.requestService.updateReturnAssetStatus(req9 as any);
        console.log("Step 1: Return approval record updated to Rejected");

        // Step 2: Update t_asset_returns main table status to 'Rejected'
        const updateReturnReq = {
          tuple: {
            old: {
              t_asset_returns: {
                return_id: this.selectedRequest.id
              }
            },
            new: {
              t_asset_returns: {
                status: 'Rejected'
              }
            }
          }
        };
        try {
          await this.requestService.createEntryForReturn(updateReturnReq as any);
          console.log("Step 2: t_asset_returns updated to Rejected");
        } catch (e) {
          console.error("Failed to update t_asset_returns status:", e);
        }

        // Step 3: Complete BPM task
        const taskid = this.selectedRequest?.taskid;
        if (taskid) {
          await this.requestService.completeUserTask({ TaskId: `${taskid}`, Action: 'COMPLETE' } as any);
          console.log("Step 3: BPM task completed");
        }
        this.notificationService.showToast(`Return request ${this.selectedRequest.id} rejected.`, 'info');

        // Send email to Employee about rejection
        this.mailService.sendReturnRequestNotification({
          stage: 'am_rejected',
          returnId: this.selectedRequest.id,
          employeeName: this.selectedRequest.requesterName,
          assetName: this.selectedRequest.assetType,
          remarks: this.actionComments,
          actionByName: currentUser.name
        });
      } else {
        // Standard Request Rejection (New Asset / Warranty)
        const reqReject = {
          tuple: {
            old: { t_request_approvals: { approval_id: this.selectedRequest.approvalId } },
            new: { t_request_approvals: { status: "Rejected", remarks: this.actionComments } }
          }
        };
        await this.requestService.updateEntryForAssetManager(reqReject as any);

        const nextRole = (this.selectedRequest.requesterRole?.toLowerCase().includes('lead') || this.selectedRequest.requesterRoleName?.toLowerCase().includes('lead')) ? 'Team Lead' : 'Employee';

        const employeeApprovalPayload = {
          tuple: {
            new: {
              t_request_approvals: {
                request_id: this.selectedRequest.id,
                approver_id: this.selectedRequest.requesterId,
                role: nextRole,
                status: "Pending"
              }
            }
          }
        };
        await this.requestService.updateEntryForAssetManager(employeeApprovalPayload as any);

        const rejectRequestPayload = {
          tuple: {
            old: { t_asset_requests: { request_id: this.selectedRequest.id } },
            new: { t_asset_requests: { status: 'Rejected' } }
          }
        };
        await this.requestService.submitNewRequestForm(rejectRequestPayload as any);

        await this.Getassetidbyapprovalid(this.selectedRequest.id);
        const taskid = this.task_id_latest || this.selectedRequest?.taskid;
        if (taskid) {
          await this.requestService.completeUserTask({ TaskId: `${taskid}`, Action: 'COMPLETE' } as any);
        }

        this.notificationService.showToast(`Request ${this.selectedRequest.id} rejected.`, 'info');

        this.mailService.sendAssetManagerStatusUpdate({
          requestId: this.selectedRequest.id,
          employeeName: this.selectedRequest.requesterName,
          status: 'Rejected',
          managerName: currentUser.name,
          remarks: this.actionComments || 'Rejected by Asset Manager'
        });
      }
    }

    this.closeActionModal();
    this.loadAllData();
  }

  // ─── Confirmation Requests Tab — dedicated approve / reject flow ──────────

  /**
   * Entry point called by the Approve / Reject buttons inside the
   * Confirmation Requests detail modal.  Keeps the confirmation flow
   * completely separate from the pending-tab flow.
   */
  async directConfirmActionForConfirmation(
    request: AssetRequest,
    action: 'approve' | 'reject'
  ): Promise<void> {
    if (action === 'reject' && (!this.actionComments || this.actionComments.trim() === '')) {
      alert('Approver remarks are required for rejection.');
      return;
    }

    this.notificationService.showToast(`Processing confirmation ${action === 'approve' ? 'approval' : 'rejection'} for request ${request.id}...`, 'info');

    this.selectedRequest = request;
    this.actionType = action;
    // this.actionComments = ''; // Keep the value given by the user in the UI
    console.log('[Confirmation] Action triggered:', action, ' | Request:', request);
    await this.confirmActionForConfirmation();
    this.closeDetailModal();
  }

  /**
   * Executes the backend calls for the Confirmation Requests approve / reject flow.
   *
   * On APPROVE:
   *   1. Update the t_request_approvals record → status = 'Approved'
   *   2. Complete the BPM user task (taskid stored in approval.temp2)
   *
   * On REJECT:
   *   1. Update the t_request_approvals record → status = 'Rejected'
   *   2. Update the asset request record → status = 'Rejected'
   */
  async confirmActionForConfirmation(): Promise<void> {

    console.log('[Confirmation] confirmActionForConfirmation called. Request:', this.selectedRequest);

    if (!this.selectedRequest || !this.actionType) return;
    console.log(this.selectedRequest);
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    if (this.actionType === 'approve') {
      console.log(this.selectedRequest.approvalId);
      // Step 1 — mark the approval record as Approved
      const approvePayload = {
        tuple: {
          old: {
            t_request_approvals: {
              approval_id: this.selectedRequest.approvalId
            }
          },
          new: {
            t_request_approvals: {
              status: 'Approved',
              remarks: this.actionComments || ''
            }
          }
        }
      };
      console.log('[Confirmation] Approve payload (step 1):', approvePayload);
      await this.requestService.updateEntryForAssetManager(approvePayload as any);

      const newRequestForUser = {
        tuple: {
          new: {
            t_request_approvals: {
              approver_id: this.selectedRequest.requesterId,
              request_id: this.selectedRequest.id,
              temp1: this.selectedRequest.allocatedAssetId,
              status: 'Pending',
              role: 'Employee'
            }
          }
        }
      };
      console.log('[Confirmation] Approve payload (step 1):', newRequestForUser);
      await this.requestService.createEntryForRequestor(newRequestForUser as any);

      // Step 2 — complete the BPM task so the workflow advances
      const taskId = this.selectedRequest.taskid;
      console.log('[Confirmation] Completing task:', taskId);
      if (taskId) {
        const taskPayload = {
          TaskId: `${taskId}`,
          Action: 'COMPLETE'
        };
        await this.requestService.completeUserTask(taskPayload as any);
      }

      this.mailService.sendFinalManagerConfirmationNotification({
        requestId: this.selectedRequest.id,
        employeeName: this.selectedRequest.requesterName,
        managerName: currentUser.name,
        assetName: this.selectedRequest.assetType
      });

      this.notificationService.showToast(`Request ${this.selectedRequest.id} confirmed successfully.`, 'success');



    } else {
      // Step 1 — mark the approval record as Rejected
      const rejectApprovalPayload = {
        tuple: {
          old: {
            t_request_approvals: {
              approval_id: this.selectedRequest.approvalId
            }
          },
          new: {
            t_request_approvals: {
              status: 'Rejected',
              remarks: this.actionComments || ''
            }
          }
        }
      };
      console.log('[Confirmation] Reject payload (step 1):', rejectApprovalPayload);
      await this.requestService.updateEntryForAssetManager(rejectApprovalPayload as any);

      const nextRole = (this.selectedRequest.requesterRole?.toLowerCase().includes('lead') || this.selectedRequest.requesterRoleName?.toLowerCase().includes('lead')) ? 'Team Lead' : 'Employee';

      // Step 1.5 — Create new entry for Employee (same as Team Lead logic)
      const employeeApprovalPayload = {
        tuple: {
          new: {
            t_request_approvals: {
              request_id: this.selectedRequest.id,
              approver_id: this.selectedRequest.requesterId,
              role: nextRole,
              status: "Pending"
            }
          }
        }
      };
      console.log('[Confirmation] Employee entry payload:', employeeApprovalPayload);
      await this.requestService.updateEntryForAssetManager(employeeApprovalPayload as any);

      // Step 2 — update the asset_request row status to Rejected
      const rejectRequestPayload = {
        tuple: {
          old: { t_asset_requests: { request_id: this.selectedRequest.id } },
          new: { t_asset_requests: { status: 'Rejected' } }
        }
      };
      console.log('[Confirmation] Reject payload (step 2):', rejectRequestPayload);
      await this.requestService.submitNewRequestForm(rejectRequestPayload as any);

      // Step 3 — Complete BPM Task
      await this.Getassetidbyapprovalid(this.selectedRequest.id);
      const taskid = this.task_id_latest || this.selectedRequest?.taskid;
      if (taskid) {
        const reqTaskComplete = {
          TaskId: `${taskid}`,
          Action: 'COMPLETE'
        };
        console.log('[Confirmation] Completing BPM Task:', taskid);
        await this.requestService.completeUserTask(reqTaskComplete as any);
      }

      this.notificationService.showToast(`Request ${this.selectedRequest.id} rejected.`, 'info');

      this.mailService.sendAssetManagerStatusUpdate({
        requestId: this.selectedRequest.id,
        employeeName: this.selectedRequest.requesterName,
        status: 'Rejected',
        managerName: currentUser.name,
        remarks: this.actionComments || 'Rejected by Asset Manager'
      });

    }


    this.loadAllData();
  }

  getTimeSince(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
    return `${Math.floor(diff / 30)} months ago`;
  }

  getRequesterEmail(req: AssetRequest): string {
    if (req.requesterEmail) return req.requesterEmail;
    const user = this.userService.getUserById(req.requesterId);
    return user ? user.email : '—';
  }

  async openDetailModal(request: AssetRequest): Promise<void> {
    this.detailRequest = { ...request };
    this.actionComments = ''; // Reset remarks for this specific request
    this.selectedAssetId = '';
    this.showDetailModal = true;
    this.loadingProgress = true;
    this.trackingSteps = [];
    this.overallProgress = 0;

    // Fetch real-time progress to get actual names and statuses for the tracker
    try {
      let progress: any[] = [];
      if (request.requestType === RequestType.RETURN_ASSET) {
        progress = await this.requestService.getReturnRequestProgress(request.id);
        const chain = await this.buildReturnApprovalChain(progress);
        if (chain.length > 0) {
          this.detailRequest.approvalChain = chain;

          const approverDetails = await this.resolveApproverDetails(request);
          const resolvedNames: Record<string, string> = {};
          resolvedNames[ApprovalStage.ASSET_MANAGER] = approverDetails['Asset Manager']?.name;
          resolvedNames[ApprovalStage.ALLOCATION] = approverDetails['Asset Allocation Team']?.name;
          resolvedNames['Asset Manager Final Approval'] = approverDetails['Asset Manager']?.name;

          // Populate trackingSteps for the UI tracker
          this.trackingSteps = chain.map(step => {
            const genericPlaceholders = ['approver', 'assigned approver', 'pending', 'to be assigned', 'null', 'undefined', '', 'assignedapprover'];
            const isPlaceholder = (val: string | undefined) => !val || genericPlaceholders.includes(val.toLowerCase().trim());

            let resolvedName = !isPlaceholder(step.approverName) ? step.approverName : resolvedNames[step.stage];

            return {
              name: resolvedName || (step.action === 'Approved' ? 'System Approved' : 'To be Assigned'),
              roleName: step.stage,
              status: step.action,
              timestamp: step.timestamp,
              isCompleted: step.action === 'Approved',
              isCurrent: false,
              comments: step.comments
            };
          });

          // Determine current step
          let currentStepFound = false;
          for (const step of this.trackingSteps) {
            if (!currentStepFound && !step.isCompleted && step.status !== 'Rejected') {
              step.isCurrent = true;
              currentStepFound = true;
            }
          }

          this.overallProgress = this.calculateOverallProgress(request);
        }
        await this.enrichReturnDetailWithAssetData(progress);
        await this.enrichReturnDetailWithRequesterData();
        this.loadingProgress = false;
        return;
      } else {
        progress = await this.requestService.getRequestProgress(request.id);
      }

      let stages = this.getStagesForRequest(request);
      const isSkippedTl = request.hasEmailApproval ||
        request.requesterRole?.toLowerCase().includes('lead') ||
        request.requesterRole?.toLowerCase().includes('manager') ||
        request.requesterRoleName?.toLowerCase().includes('lead') ||
        request.requesterRoleName?.toLowerCase().includes('manager') ||
        request.requesterRoleName?.toLowerCase().includes('admin') ||
        ['rol_01', 'rol_02', 'rol_04', 'rol_05'].includes(request.requesterRole || '');
      const hasTeamLeadProgress = progress.some(p =>
        ['team lead', 'approver'].some(role => (p.stage || p.role || '').toLowerCase().includes(role))
      );
      if (isSkippedTl || !hasTeamLeadProgress) {
        stages = stages.filter(s => s.name !== 'Team Lead Approval');
      }

      let availableProgress = [...progress].sort((a: any, b: any) =>
        new Date(a.timestamp || a.action_date).getTime() - new Date(b.timestamp || b.action_date).getTime()
      );

      // Filter out stale records from previous approval cycles (resubmit condition)
      // If there are any records after the last 'Rejected' status, a resubmit happened.
      let lastRejectedIndex = -1;
      for (let i = 0; i < availableProgress.length; i++) {
        const s = (availableProgress[i].status || availableProgress[i].action || '').toLowerCase();
        if (s === 'rejected') {
          lastRejectedIndex = i;
        }
      }
      if (lastRejectedIndex !== -1 && lastRejectedIndex < availableProgress.length - 1) {
        availableProgress = availableProgress.slice(lastRejectedIndex + 1);
      }

      const approverDetails = await this.resolveApproverDetails(request);
      const resolvedNames: Record<string, string> = {};
      Object.keys(approverDetails).forEach(role => resolvedNames[role] = approverDetails[role].name);

      this.trackingSteps = await Promise.all(stages.map(async (stage, index) => {
        let foundIndex = -1;
        for (let i = 0; i < availableProgress.length; i++) {
          const p = availableProgress[i];
          if (stage.roles.some(role => (p.stage || p.role)?.toLowerCase().includes(role))) {
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
          const status = this.normalizeStatusText(data.status);
          isCompleted = status === RequestStatus.APPROVED || status === RequestStatus.COMPLETED;
          isCurrent = status === RequestStatus.PENDING;
        }

        const dbName = (data?.approverName || data?.approver_id || '').trim();
        const genericPlaceholders = ['approver', 'assigned approver', 'pending', 'to be assigned', '', 'assignedapprover', 'null'];
        const isPlaceholder = (val: string | undefined) => !val || genericPlaceholders.includes(val.toLowerCase().trim());

        const roleKey = stage.name === 'Team Lead Approval' ? 'Team Lead' :
          (stage.name === 'Asset Manager Approval' || stage.name === 'Asset Manager Confirmation') ? 'Asset Manager' :
            'Asset Allocation Team';

        let resolvedName = !isPlaceholder(dbName) ? dbName : resolvedNames[roleKey];

        // If resolvedName is an ID (e.g., usr_002), fetch the real name
        if (resolvedName && resolvedName.toLowerCase().startsWith('usr_')) {
          const user = await this.authService.getUserDetails(resolvedName).catch(() => null);
          if (user && user.name) {
            resolvedName = user.name;
          }
        }

        return {
          name: resolvedName || (isCompleted ? 'System Approved' : 'To be Assigned'),
          roleName: stage.name,
          status: data ? this.toApprovalAction(data.status) : (isCompleted ? 'Approved' : 'Pending'),
          timestamp: data?.timestamp || data?.action_date,
          isCompleted: isCompleted,
          isCurrent: isCurrent,
          comments: data?.comments || data?.remarks
        };
      }));

      // Special pass to handle "current" state based on the previous step
      let currentStepFound = false;
      for (let i = 0; i < this.trackingSteps.length; i++) {
        const step = this.trackingSteps[i];
        if (step.status === 'Pending') step.isCurrent = false;

        if (!currentStepFound && !step.isCompleted && step.status?.toLowerCase() !== 'rejected') {
          step.isCurrent = true;
          currentStepFound = true;
        }
      }

      // If rejected, remove subsequent steps
      const rejectedIndex = this.trackingSteps.findIndex(s => s.status?.toLowerCase() === 'rejected');
      if (rejectedIndex !== -1) {
        this.trackingSteps = this.trackingSteps.slice(0, rejectedIndex + 1);
      }

      this.overallProgress = this.calculateOverallProgress(request);

      // Initialize selectedAllocationMemberId and assignedAllocationMemberName automatically
      this.selectedAllocationMemberId = request.assignedAllocationTeamId || '';
      this.assignedAllocationMemberName = (request as any).assignedAllocationTeamName || '';

      if (!this.assignedAllocationMemberName) {
        let allUsers: any[] = [];
        try {
          allUsers = await this.adminService.GetAllUserRoleProjectDetails();
          const assetType = request.assetType || request.category || 'Hardware';
          const assignment = await this.adminService.getAssignmentByAssetType(assetType);

          if (assignment) {
            if (assignment.teamMembers) {
              const memberTokens = assignment.teamMembers.split(/[,;|]/).map((t: string) => t.trim().toLowerCase());
              const matched = allUsers.find(u => {
                const uId = (u.id || '').toLowerCase();
                const uName = (u.name || u.user_name || '').toLowerCase();
                const uEmail = (u.email || '').toLowerCase();
                return memberTokens.some(token =>
                  token === uId ||
                  token === uName ||
                  token === uEmail ||
                  (uName && (token.includes(uName) || uName.includes(token)))
                );
              });
              if (matched) {
                this.assignedAllocationMemberName = matched.name;
                this.selectedAllocationMemberId = matched.id;
              }
            }

            if (!this.assignedAllocationMemberName && assignment.id) {
              const matchedByTypeId = allUsers.find(u =>
                u.assetTypeId === assignment.id &&
                (u.role === 'Asset Allocation Team' || (u.role_id || '').toLowerCase() === 'rol_05')
              );
              if (matchedByTypeId) {
                this.assignedAllocationMemberName = matchedByTypeId.name;
                this.selectedAllocationMemberId = matchedByTypeId.id;
              }
            }
          }
        } catch (e) { /* ignore */ }
      }

      if (!this.assignedAllocationMemberName) {
        try {
          if (progress) {
            const atEntry = progress.find((p: any) => (p.stage || '').toLowerCase().includes('allocation'));
            if (atEntry?.approverId) {
              this.assignedAllocationMemberName = atEntry.approverName || 'Assigned Member';
              this.selectedAllocationMemberId = atEntry.approverId;
            }
          }
        } catch (e) { /* ignore */ }
      }

      if (!this.assignedAllocationMemberName) {
        try {
          const currentUser = this.authService.getCurrentUser();
          const managerId = currentUser?.id || 'usr_004';
          const members = await this.requestService.getTeamAllocationMemberByAssetManager(managerId);

          if (members && members.length > 0) {
            let bestMember = members[0];
            if (request.assetType) {
              const allUsers = await this.adminService.GetAllUserRoleProjectDetails();
              const assignment = await this.adminService.getAssignmentByAssetType(request.assetType || request.category);
              for (const m of members) {
                const uId = m.user_id || m.id;
                const fullUser = allUsers.find(u => u.id === uId);
                if (fullUser) {
                  if (assignment && fullUser.assetTypeId === assignment.id) {
                    bestMember = m; break;
                  }
                  if (fullUser.assetTypeName && fullUser.assetTypeName.toLowerCase().includes((request.assetType || request.category).toLowerCase())) {
                    bestMember = m; break;
                  }
                }
              }
            }
            this.assignedAllocationMemberName = bestMember.name || '';
            this.selectedAllocationMemberId = bestMember.user_id || bestMember.id || '';
          }
        } catch (e) { /* ignore */ }
      }

      // Trigger initial update for the tracker if a member is already selected
      if (this.selectedAllocationMemberId) {
        this.onAllocationMemberChange(this.selectedAllocationMemberId);
      }

      // Legacy update for approvalChain if needed by other logic
      if (progress && progress.length > 0) {
        this.detailRequest.approvalChain = this.detailRequest.approvalChain.map(entry => {
          const stageProgress = progress.find(p => {
            const pStage = (p.stage || '').toLowerCase();
            const eStage = (entry.stage || '').toLowerCase();
            return pStage === eStage ||
              (entry.stage === ApprovalStage.TEAM_LEAD && (pStage.includes('team lead') || pStage.includes('manager') || pStage.includes('lead'))) ||
              (entry.stage === ApprovalStage.ASSET_MANAGER && (pStage.includes('asset manager') || pStage.includes('manager'))) ||
              (entry.stage === ApprovalStage.ALLOCATION && (pStage.includes('allocation') || pStage.includes('inventory')));
          });

          if (stageProgress) {
            if (entry.stage === ApprovalStage.TEAM_LEAD && stageProgress.comments && this.detailRequest) {
              this.detailRequest.teamLeadJustification = stageProgress.comments;
            }
            return {
              ...entry,
              action: (stageProgress.status === 'Approved' || stageProgress.status === 'Rejected' || stageProgress.status === 'Completed') ? 'Approved' : entry.action,
              approverName: stageProgress.approverName || entry.approverName,
              timestamp: stageProgress.timestamp || entry.timestamp,
              comments: stageProgress.comments || entry.comments
            };
          }
          return entry;
        });
      }
    } catch (err) {
      console.warn('Failed to load dynamic progress for tracker:', err);
    } finally {
      this.loadingProgress = false;
    }
  }

  private async enrichReturnDetailWithAssetData(progress: any[]): Promise<void> {
    if (!this.detailRequest || this.detailRequest.requestType !== RequestType.RETURN_ASSET) return;

    const progressAssetId = this.getOrderedReturnProgress(progress)
      .map((approval: any) => approval?.temp1)
      .find((assetId: string) => !!assetId && assetId !== 'â€”' && assetId !== '-' && assetId !== 'N/A');
    const assetId = this.detailRequest.assignedAssetId || this.detailRequest.allocatedAssetId || progressAssetId;
    if (!assetId) return;

    const asset = await this.requestService.getAssetDetailsById(assetId);
    if (!asset) {
      this.detailRequest.assignedAssetId = assetId;
      return;
    }

    this.detailRequest.assignedAssetId = asset.asset_id || assetId;
    this.detailRequest.allocatedAssetId = asset.asset_id || assetId;
    this.detailRequest.assetName = asset.asset_name || this.detailRequest.assetName;
    this.detailRequest.assetType = this.requestService.normalizeAssetType(asset.type_id || this.detailRequest.assetType);
    this.detailRequest.assignedTypeId = asset.type_id || this.detailRequest.assignedTypeId;
    this.detailRequest.assignedSubCategoryId = asset.sub_category_id || this.detailRequest.assignedSubCategoryId;
    this.detailRequest.subCategory = this.getSubCategoryInfo(asset.sub_category_id)?.name || asset.sub_category_id || this.detailRequest.subCategory;
    this.detailRequest.category = asset.asset_name || this.detailRequest.category;
    this.detailRequest.assignedSerial = asset.serial_number || this.detailRequest.assignedSerial;
    this.detailRequest.assignedPurchaseDate = asset.purchase_date || this.detailRequest.assignedPurchaseDate;
    this.detailRequest.assignedWarrantyExpiry = asset.warranty_expiry || this.detailRequest.assignedWarrantyExpiry;
  }

  private async enrichReturnDetailWithRequesterData(): Promise<void> {
    if (!this.detailRequest || this.detailRequest.requestType !== RequestType.RETURN_ASSET) return;

    const requesterId = this.detailRequest.requesterId;
    if (!requesterId) return;

    const requester = await this.authService.getUserDetails(requesterId).catch(() => null);
    if (!requester) return;

    // Return requests from GetT_asset_returnsObjects may not include joined m_users data.
    // Keep existing mapped values when present, and fill the missing requester details from Cordys.
    // this.detailRequest.requesterName = this.detailRequest.requesterName;
    this.detailRequest.requesterName = this.detailRequest.requesterName || requester.name || requesterId;
    this.detailRequest.requesterEmail = this.detailRequest.requesterEmail || requester.email || '';
    this.detailRequest.requesterRoleName = this.detailRequest.requesterRoleName || requester.role || '';
    this.detailRequest.requesterRole = this.detailRequest.requesterRole || requester.role || '';
    this.detailRequest.requesterDepartment = this.detailRequest.requesterDepartment || requester.department || '';
    this.detailRequest.requesterTeam = this.detailRequest.requesterTeam || requester.team || requester.projectName || '';
    this.detailRequest.requesterProject = this.detailRequest.requesterProject || requester.projectId || '';
    this.detailRequest.requesterProjectName = this.detailRequest.requesterProjectName || requester.projectName || '';
  }

  onAllocationMemberChange(memberId: string): void {
    if (!memberId || !this.trackingSteps || this.trackingSteps.length === 0) return;

    // We no longer rely on allocationTeamMemberList, we use the resolved assignedAllocationMemberName
    const memberName = this.assignedAllocationMemberName;
    if (!memberName) return;

    // Find the allocation team step in the tracker
    const allocationStep = this.trackingSteps.find(step => step.roleName === 'Asset Allocation Team');
    if (allocationStep && (allocationStep.status === 'Pending' || !allocationStep.isCompleted)) {
      allocationStep.name = memberName;
    }
  }

  private getStagesForRequest(request: AssetRequest): Array<{ name: string, roles: string[] }> {
    return [
      { name: 'Team Lead Approval', roles: ['team lead', 'approver'] },
      { name: 'Asset Manager Approval', roles: ['asset manager', 'mgr'] },
      { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] },
      { name: 'Asset Manager Confirmation', roles: ['asset manager'] }
    ];
  }

  calculateOverallProgress(request: AssetRequest): number {
    const status = (request.status || '').toLowerCase();
    if (status === 'completed' || status === 'rejected') return 100;

    const completedCount = this.trackingSteps.filter(s => s.isCompleted || s.status?.toLowerCase() === 'rejected').length;
    const totalSteps = this.trackingSteps.length;

    if (totalSteps === 0) return 10;
    if (completedCount === totalSteps && totalSteps > 0) return 100;
    const progress = Math.round((completedCount / totalSteps) * 100);
    return Math.min(Math.max(progress, 10), 95);
  }

  private async resolveApproverDetails(request: AssetRequest): Promise<Record<string, { name: string, id: string }>> {
    const details: Record<string, { name: string, id: string }> = {};
    try {
      // 1. Resolve Team Lead
      if (request.requesterId) {
        const user = await this.authService.getUserDetails(request.requesterId).catch(() => null);
        if (user) {
          if (user.teamLeadName) {
            details['Team Lead'] = {
              name: user.teamLeadName,
              id: user.teamLeadId || ''
            };
          } else if (user.teamLeadId) {
            const lead = await this.authService.getUserDetails(user.teamLeadId).catch(() => null);
            details['Team Lead'] = {
              name: lead?.name || 'Team Lead',
              id: user.teamLeadId
            };
          }
        }
      }

      // 2. Resolve Asset Manager & Allocation Team
      if (request.assetType) {
        const assignment = await this.adminService.getAssignmentByAssetType(request.assetType);
        if (assignment) {
          details['Asset Manager'] = {
            name: assignment.assetManager,
            id: assignment.assetManagerId || ''
          };

          details['Asset Allocation Team'] = {
            name: assignment.teamMembers,
            id: ''
          };
        }
      }
    } catch (err) {
      console.error('Failed to resolve approver details:', err);
    }
    return details;
  }

  getRejectionReason(req: AssetRequest): string {
    if (req.status !== RequestStatus.REJECTED) return '';

    // 1. Check if it's already in the request object
    if (req.reason) return req.reason;
    if (req.remarks) return req.remarks;

    // 2. Check the approval chain for a rejected stage
    const rejectedStage = req.approvalChain?.find(a => a.action === 'Rejected');
    if (rejectedStage && rejectedStage.comments) return rejectedStage.comments;

    return 'No rejection reason provided.';
  }

  getAssetManagerRemarks(req: AssetRequest): string {
    const amStage = req.approvalChain?.find(a =>
      a.stage === ApprovalStage.ASSET_MANAGER &&
      (a.action === 'Approved' || a.action === 'Rejected')
    );
    if (req.requestType === RequestType.RETURN_ASSET && amStage) {
      return amStage.comments || 'No remarks provided';
    }
    return amStage?.comments || req.remarks || '';
  }

  getAllocationRemarks(req: AssetRequest): string {
    const allocStage = req.approvalChain?.find(a =>
      a.stage === ApprovalStage.ALLOCATION &&
      (a.action === 'Approved' || a.action === 'Rejected')
    );
    if (req.requestType === RequestType.RETURN_ASSET && allocStage) {
      return allocStage.comments || 'No remarks provided';
    }
    return allocStage?.comments || '';
  }

  getTeamLeadRemarks(req: AssetRequest): string {
    if (req.teamLeadJustification) return req.teamLeadJustification;
    if (!req.approvalChain) return '';

    // 1. Look for explicit Team Lead stage in the chain
    const tlStage = req.approvalChain.find(a => {
      const stage = (a.stage || '').toLowerCase();
      return (stage.includes('team lead') || stage.includes('lead')) &&
        (a.action === 'Approved' || a.action === 'Rejected' || a.comments);
    });

    if (tlStage?.comments) return tlStage.comments;

    return '';
  }

  getReturnEmployeeReason(req: AssetRequest): string {
    return req.justification || req.reason || req.remarks || 'No reason provided';
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.detailRequest = null;
  }

  getApprovalStageClass(status: string): string {
    switch (status) {
      case 'Approved': case 'Completed': return 'completed';
      case 'Rejected': return 'rejected';
      case 'Pending': return 'current';
      default: return '';
    }
  }

  getApprovalIcon(status: string): string {
    switch (status) {
      case 'Approved': case 'Completed': return 'check_circle';
      case 'Rejected': return 'cancel';
      case 'Pending': return 'pending';
      default: return 'radio_button_unchecked';
    }
  }

  onAssetSelect(assetId: string): void {
    if (!this.detailRequest) return;

    if (!assetId) {
      this.detailRequest.assignedAssetId = '';
      this.detailRequest.assignedTypeId = '';
      this.detailRequest.assignedSubCategoryId = '';
      this.detailRequest.assignedSerial = '';
      this.detailRequest.assignedPurchaseDate = '';
      this.detailRequest.assignedWarrantyExpiry = '';
      return;
    }

    const asset = this.availableAssets.find(a => a.asset_id === assetId);
    if (asset) {
      this.detailRequest.assignedAssetId = asset.asset_id;
      this.detailRequest.assignedTypeId = asset.type_id;
      this.detailRequest.assignedSubCategoryId = asset.sub_category_id || '—';
      this.detailRequest.assignedSerial = asset.serial_number || '—';
      this.detailRequest.assignedPurchaseDate = asset.purchase_date || '—';
      this.detailRequest.assignedWarrantyExpiry = asset.warranty_expiry || '—';
    }
  }

  onMemberSelect(memberId: string): void {
    this.selectedAllocationMemberId = memberId;
    console.log('Allocation member selected:', this.selectedAllocationMemberId);
  }

  viewDocument(docName: string): void {
    if (!docName) return;

    // If it's a base64 data URL, open it directly
    if (docName.startsWith('data:')) {
      const newTab = window.open();
      if (newTab) {
        newTab.document.write(`<iframe src="${docName}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
      return;
    }

    // Handle server file paths — use SOAP DownloadFile_AMS to fetch content then display
    this.fetchAndOpenFile(docName, 'view');
  }


  downloadDocument(docName: string): void {
    if (!docName) return;

    if (docName.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = docName;
      link.download = 'attachment_' + new Date().getTime();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Handle server file paths — use SOAP DownloadFile_AMS to fetch content then download
    this.fetchAndOpenFile(docName, 'download');
  }

  /**
   * Fetches file content from the server via DownloadFile_AMS SOAP service,
   * then either opens it in a new tab (view) or triggers a browser download.
   */
  private async fetchAndOpenFile(serverPath: string, action: 'view' | 'download'): Promise<void> {
    const displayName = this.extractFileName(serverPath);
    this.notificationService.showToast(`Fetching: ${displayName}...`, 'info');

    try {
      // Split the full server path into directory + filename
      // e.g., "C:\OTAPPS\...\Intern_Uploads\file.pdf" → dir="C:\OTAPPS\...\Intern_Uploads", name="file.pdf"
      const parts = serverPath.split(/[\\\/]/);
      const fileName = parts.pop() || '';
      const dirPath = parts.join('\\');

      console.log('[AssetRequests] Calling DownloadFile_AMS - dir:', dirPath, '| file:', fileName);

      if (!fileName || !dirPath) {
        this.notificationService.showToast('Invalid file path.', 'error');
        return;
      }

      // Call the SOAP service to get base64-encoded file content
      const base64Content = await this.requestService.downloadFileFromServer(fileName, dirPath);

      console.log('[AssetRequests] Download response length:', base64Content?.length);

      if (!base64Content || base64Content.length < 10) {
        this.notificationService.showToast('File content is empty or could not be retrieved.', 'error');
        return;
      }

      // Determine MIME type from file extension
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const mimeMap: { [key: string]: string } = {
        'pdf': 'application/pdf', 'png': 'image/png',
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain', 'csv': 'text/csv',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';

      // Convert base64 to Blob
      const byteChars = atob(base64Content);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNums)], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      if (action === 'view') {
        // Open in new tab for viewing
        window.open(blobUrl, '_blank');
        this.notificationService.showToast(`Opened: ${displayName}`, 'success');
      } else {
        // Trigger download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = displayName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.notificationService.showToast(`Downloaded: ${displayName}`, 'success');
      }

      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    } catch (err: any) {
      console.error('[AssetRequests] File fetch failed:', err);
      const errDetail = err?.responseText || err?.errorThrown || err?.message || 'Unknown error';
      this.notificationService.showToast(`Failed to fetch file: ${errDetail}`, 'error');
    }
  }

  /** Extract just the filename from a full server path */
  extractFileName(path: string): string {
    if (!path) return 'attachment';
    const parts = path.split(/[\\\/]/);
    return parts[parts.length - 1] || 'attachment';
  }

  getSelectedAllocationMemberName(): string {
    return this.assignedAllocationMemberName || 'Not Assigned';
  }

  getTlRemarks(req: AssetRequest): string {
    if (req.teamLeadJustification) return req.teamLeadJustification;
    if (req.approvalChain) {
      const tlEntry = req.approvalChain.find(entry => entry.stage === ApprovalStage.TEAM_LEAD);
      if (tlEntry && tlEntry.comments && tlEntry.comments !== 'null') return tlEntry.comments;
    }
    return '';
  }

}

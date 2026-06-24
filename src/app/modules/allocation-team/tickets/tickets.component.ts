import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RequestService } from '../../../core/services/request.service';
import { AssetService } from '../../../core/services/asset.service';
import { AssetRequest, ApprovalEntry, RequestStatus, ApprovalStage, RequestType } from '../../../core/models/request.model';
import { HeroService } from 'src/app/core/services/hero.service';
import { MailService } from 'src/app/core/services/mail.service';
import { NotificationService } from 'src/app/core/services/notification.service';


export interface EnrichedTicket {
  taskid: string;
  approvalid: string;
  ticketId: string;
  requestorName: string;
  assetType: string;
  subCategory: string;
  assetName: string;
  assetId: string;
  warrantyExpiry: string;
  availabilityStatus: string;
  assignedDate: string;
  assetManagerName: string;
  teamLeadName: string;
  urgency: string;
  reason: string;
  status: RequestStatus;
  teamLeadRemarks?: string;
  assetManagerRemarks?: string;
  rawRequest: AssetRequest;
}

@Component({
  selector: 'app-allocation-tickets',
  templateUrl: './tickets.component.html',
  styleUrls: ['./tickets.component.scss']
})
export class AllocationTicketsComponent implements OnInit {
  RequestType = RequestType;
  activeTab: 'unresolved' | 'resolved' | 'return' | 'resolvedReturn' = 'unresolved';
  loading = true;
  allTickets: EnrichedTicket[] = [];
  resolvedTickets: EnrichedTicket[] = [];
  resolvedReturnTickets: EnrichedTicket[] = [];
  currentUser: any;
  returnTickets: EnrichedTicket[] = [];
  pendingWarrantyTickets: EnrichedTicket[] = [];
  selectedTicket: EnrichedTicket | null = null;
  drawerOpen = false;

  // Reject modal state
  showRejectModal = false;
  rejectRemarks = '';
  ticketToReject: EnrichedTicket | null = null;
  assetManagerNameForThisUser: string = "";
  assetManagerIDForThisUser: string = "";

  // Search and Filter
  searchTerm: string = '';
  selectedAssetType: string = '';
  selectedRequestType: string = ''; // New filter
  selectedResolvedStatus = '';
  selectedReturnStatus = '';
  isSaving = false;
  decisionRemarks = '';
  // New filter for Resolved tab
  assetTypeOptions: string[] = ['Hardware', 'Software', 'Furniture', 'Network'];
  subCategoryMap: Map<string, string> = new Map();
  typeToManagerMap: Map<string, string> = new Map();
  myAssetTypes: string[] = [];
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;

  constructor(
    private requestService: RequestService,
    private assetService: AssetService,
    private hs: HeroService,
    private mailService: MailService,
    private notificationService: NotificationService,
    private route: ActivatedRoute
  ) { }


  async ngOnInit(): Promise<void> {      // ✅ made async
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });
    this.currentUser = JSON.parse(localStorage.getItem("currentUser") || '{}');
    const userId = this.currentUser?.id ?? null;
    const request = { Approver_id: userId };

    try {
      // 1. Fetch ALL Asset Type Assignments to resolve managers and my assigned types
      const assignmentsSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAssetNAssetManagerDetails xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

      const resp = await this.hs.ajax(null, null, {}, assignmentsSoap);
      let typesData = this.hs.xmltojson(resp, 'm_asset_types');
      if (typesData) {
        const typeArray = Array.isArray(typesData) ? typesData : [typesData];

        typeArray.forEach((t: any) => {
          const typeName = (t.type_name || t.name || '').toLowerCase().trim();
          const managerName = t.asset_manager || '—';
          console.log("managerName", managerName)
          const teamMembers = (t.team_members || t.at_members || '').toString();

          if (typeName) {
            this.typeToManagerMap.set(typeName, managerName);
            if (teamMembers.includes(userId)) {
              this.myAssetTypes.push(typeName);
            }
          }
        });

        console.log('[AllocationTickets] My Assigned Types:', this.myAssetTypes);
        console.log('[AllocationTickets] Type to Manager Map:', Array.from(this.typeToManagerMap.entries()));
      }
    } catch (err) {
      console.error('[AllocationTickets] Failed to resolve assignments:', err);
    }

    try {
      const res = await this.hs.ajax(
        'GetAssetManagerByTeamAllocationMember',
        'http://schemas.cordys.com/AMS_Database_Metadata',
        request
      );


      const tuples = this.hs.xmltojson(res, 'tuple');
      console.log('Raw tuples:', tuples);
      const tupleArray: any[] = tuples ? (Array.isArray(tuples) ? tuples : [tuples]) : [];
      const firstTuple = tupleArray[0];
      const mUsers = firstTuple?.old?.m_roles?.m_users ?? firstTuple?.m_roles?.m_users ?? {};

      this.assetManagerNameForThisUser = this.getVal(mUsers?.name) ?? '';  // ✅ assigned
      this.assetManagerIDForThisUser = this.getVal(mUsers?.user_id) ?? '';  // ✅ assigned
      console.log("Asset Manager Name For This User", this.assetManagerNameForThisUser);
      console.log("Asset Manager ID For This User", this.assetManagerIDForThisUser);
    } catch (err) {
      console.error('Failed to fetch asset manager info:', err);
    }

    // 2. Load subcategories for mapping
    try {
      const subCats = await this.assetService.getAllSubcategoriesCordys();
      subCats.forEach(sc => {
        const id = sc.sub_category_id || sc.SUB_CATEGORY_ID || sc.id;
        const name = sc.sub_category_name || sc.SUB_CATEGORY_NAME || sc.name;
        if (id && name) this.subCategoryMap.set(id, name);
      });
    } catch (err) { console.warn('Subcategory load failed:', err); }

    // 3. Load dynamic asset types for filters
    try {
      const typeCounts = await this.assetService.fetchAssetTypeWiseCount();
      this.assetTypeOptions = typeCounts
        .map(t => t.type_name)
        .filter(name => name && name.toLowerCase() !== 'infrastructure');
    } catch (err) { console.warn('Asset types load failed:', err); }

    this.loadTickets();
  }

  async loadTickets(): Promise<void> {

    this.loading = true;
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || '{}');
      const userId = currentUser?.id;
      if (!userId) return;

      // 1. Fetch using specialized service
      const resRequests = await this.hs.ajax(
        'GetallpendingrequestsForAllocationTeamMemberwithTeamLead',
        'http://schemas.cordys.com/AMS_Database_Metadata',
        { Approver_id: userId }
      );

      const tuples = this.hs.xmltojson(resRequests, 'tuple');
      const tupleArray: any[] = tuples ? (Array.isArray(tuples) ? tuples : [tuples]) : [];
      this.allTickets = tupleArray.map((t: any) => this.mapTupleToEnrichedTicket(t));

      // 2. FALLBACK: If specialized service missed some tickets (common with multi-type users)
      // Discover tasks from the BPM engine directly
      try {
        const activeTasks = await this.requestService.fetchActiveTasks();
        const myTasks = activeTasks.filter(t => t.assigneeId === userId);

        // Find tickets that are in myTasks but NOT in allTickets
        for (const task of myTasks) {
          const existing = this.allTickets.find(ticket => ticket.taskid === task.taskId || ticket.ticketId === (task.data?.requestId || task.data?.Request_id));
          if (!existing) {
            console.log('[AllocationTickets] Discovered missing task:', task.taskId);
            // Try to fetch full details for this request
            const reqId = task.data?.requestId || task.data?.Request_id;
            if (reqId) {
              const allReqs = await this.requestService.fetchAllRequestsFromService(userId);
              const fullReq = allReqs.find(r => r.id === reqId);
              if (fullReq) {
                const ticket = this.mapWarrantyToEnrichedTicket(fullReq); // Close enough for enrichment
                ticket.taskid = task.taskId;
                this.allTickets.push(ticket);
              }
            }
          }
        }
      } catch (discoveryErr) { console.warn('Task discovery failed:', discoveryErr); }

      await this.loadReturnTickets();
      // await this.loadPendingWarrantyTickets();

      this.allTickets = [...this.allTickets, ...this.returnTickets, ...this.pendingWarrantyTickets];

      // Post-load filtering: Ensure everything matches my assigned types
      if (this.myAssetTypes.length > 0) {
        this.allTickets = this.allTickets.filter(t =>
          this.myAssetTypes.includes(t.assetType.toLowerCase().trim())
        );
      }

      await this.loadResolvedTickets();
      await this.loadResolvedReturnTickets();
    } catch (err) {
      console.error('Failed to load allocation tickets:', err);
      this.allTickets = [];
    } finally {
      this.loading = false;
    }
  }
  async loadReturnTickets(): Promise<void> {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || '{}');
    const approverId = currentUser?.id;
    if (!approverId) {
      this.returnTickets = [];
      console.warn('[AllocationTickets] Current user is missing. Cannot load return tickets.');
      return;
    }
    const request = { Approver_id: approverId };

    try {
      const res = await this.hs.ajax(
        'GetPendingReturnApprovalsForManager',
        'http://schemas.cordys.com/AMS_Database_Metadata',
        request
      );

      const tuples = this.hs.xmltojson(res, 'tuple');
      if (!tuples) {
        this.returnTickets = [];
      } else {
        const tupleArray: any[] = Array.isArray(tuples) ? tuples : [tuples];
        console.log('Processed Return Tuples:', tupleArray);
        this.returnTickets = tupleArray.map((t: any) => this.mapReturnTupleToEnrichedTicket(t));

        // Enrich each return ticket with full asset details from m_assets
        for (const ticket of this.returnTickets) {
          if (ticket.assetId && ticket.assetId !== '—') {
            const asset = await this.requestService.getAssetDetailsById(ticket.assetId);
            if (asset) {
              ticket.assetName = asset.asset_name || ticket.assetName;
              ticket.assetType = asset.type_id || ticket.assetType;
              ticket.subCategory = this.subCategoryMap.get(asset.sub_category_id) || asset.sub_category_id || ticket.subCategory;
              ticket.warrantyExpiry = asset.warranty_expiry || ticket.warrantyExpiry;
            }
          }
          await this.enrichReturnTicketWithApprovalHistory(ticket);
        }

        console.log('Return Tickets Statuses:', this.returnTickets.map(t => `${t.ticketId}: ${t.status}`));
      }
    } catch (err) {
      console.error('Failed to load return tickets:', err);
      this.returnTickets = [];
    }
  }

  async loadPendingWarrantyTickets(): Promise<void> {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || '{}');
    const userId = currentUser?.id;
    if (!userId) {
      this.pendingWarrantyTickets = [];
      return;
    }

    try {
      // 1. Try the direct service first
      let warrantyRequests = await this.requestService.fetchPendingWarrantyApprovalsFromService(userId);

      // 2. If direct service returns nothing (likely due to role restrictions on the backend), 
      // use a more robust discovery approach
      if (!warrantyRequests || warrantyRequests.length === 0) {
        console.log('[AllocationTickets] Direct pending service returned 0. Trying robust discovery...');
        const allWarrantyReqs = await this.requestService.fetchAllWarrantyRequests();
        const allAssets = await this.assetService.fetchAssetsFromService();

        // Find assets that are in "MoveToAllocationTeam" status
        const allocationAssetIds = new Set(
          allAssets
            .filter(a => a.status === 'MoveToAllocationTeam')
            .map(a => a.assetId || a.id)
        );

        // Find warranty requests linked to these assets
        const candidateReqs = allWarrantyReqs.filter(req => allocationAssetIds.has(req.assignedAssetId || ''));
        console.log(`[AllocationTickets] Found ${candidateReqs.length} candidate warranty requests based on asset status`);

        const discoveredReqs: AssetRequest[] = [];
        for (const req of candidateReqs) {
          try {
            const progress = await this.requestService.getWarrantyProgress(req.id);
            // Check if the latest approval is Pending and assigned to the current user
            if (progress && progress.length > 0) {
              const latest = [...progress].sort((a, b) => {
                const idA = parseInt(a.approvalId?.replace(/\D/g, '') || '0');
                const idB = parseInt(b.approvalId?.replace(/\D/g, '') || '0');
                return idB - idA;
              })[0];

              if (latest && latest.status === 'Pending' && latest.approverId === userId) {
                req.approvalId = latest.approvalId;
                req.taskid = latest.temp1;
                req.status = RequestStatus.PENDING;
                discoveredReqs.push(req);
              }
            }
          } catch (pErr) {
            console.warn(`Failed to check progress for candidate req ${req.id}:`, pErr);
          }
        }
        warrantyRequests = discoveredReqs;
      }

      this.pendingWarrantyTickets = (warrantyRequests || [])
        .filter(req => req.status === RequestStatus.PENDING || req.status === RequestStatus.IN_PROGRESS)
        .map(req => this.mapWarrantyToEnrichedTicket(req));

      console.log(`[AllocationTickets] Loaded ${this.pendingWarrantyTickets.length} pending warranty tickets`);
    } catch (err) {
      console.error('Failed to load pending warranty tickets:', err);
      this.pendingWarrantyTickets = [];
    }
  }

  async loadResolvedTickets(): Promise<void> {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || '{}');
    const userId = currentUser?.id;
    if (!userId) {
      this.resolvedTickets = [];
      return;
    }

    try {
      const res = await this.hs.ajax(
        'Getallrequestsbyapproverandrequestid',
        'http://schemas.cordys.com/AMS_Database_Metadata',
        { approver_id: userId }
      );
      const tuples = this.hs.xmltojson(res, 'tuple');
      if (tuples) {
        const tupleArray: any[] = Array.isArray(tuples) ? tuples : [tuples];
        console.log('[AllocationTickets] loadResolvedTickets - Raw tuples count:', tupleArray.length);

        const mappedResolved: EnrichedTicket[] = [];

        for (const tuple of tupleArray) {
          const parent = tuple?.old ?? tuple;
          const approval = parent?.t_request_approvals ?? parent;
          if (!approval) continue;

          const role = this.getVal(approval.role) || '';
          const approvalStatusStr = this.getVal(approval.status) || '';

          // Filter for allocation role and resolved approvals
          const isAllocationRole = role.toLowerCase().includes('allocation');
          const isApprovalResolved = ['approved', 'rejected', 'completed'].includes(approvalStatusStr.toLowerCase());

          if (isAllocationRole && isApprovalResolved) {
            const ticket = this.mapTupleToEnrichedTicket(tuple);
            // Override ticket status with the specific action taken by this Allocation Team member
            ticket.status = this.mapToStatus(approvalStatusStr);
            mappedResolved.push(ticket);
          }
        }

        // Apply filtering
        this.resolvedTickets = mappedResolved.filter(t => {
          // Filter by asset type assignment (handles multiple categories joined by & or ,)
          if (currentUser?.assetTypeName) {
            const assignedTypes = currentUser.assetTypeName
              .split(/[&,]/)
              .map((s: string) => s.trim().toLowerCase());

            if (assignedTypes.length > 0) {
              return assignedTypes.includes(t.assetType.toLowerCase());
            }
          }
          return true;
        });

        // Enrich with asset details in parallel
        await Promise.all(this.resolvedTickets.map(ticket => this.enrichTicketWithAssetDetails(ticket)));
      } else {
        this.resolvedTickets = [];
      }
    } catch (err) {
      console.error('Failed to load resolved tickets:', err);
      this.resolvedTickets = [];
    }
  }

  async loadResolvedReturnTickets(): Promise<void> {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || '{}');
    const approverId = currentUser?.id ?? currentUser?.user_id ?? currentUser?.userId;
    if (!approverId) {
      this.resolvedReturnTickets = [];
      return;
    }

    try {
      const res = await this.hs.ajax(
        'Getallreturnrequests',
        'http://schemas.cordys.com/AMS_Database_Metadata',
        {}
      );
      const tuples = this.hs.xmltojson(res, 'tuple');
      const tupleArray: any[] = tuples ? (Array.isArray(tuples) ? tuples : [tuples]) : [];
      const returnTupleById = new Map<string, any>();
      const approvalsById = new Map<string, any>();

      tupleArray.forEach((tuple: any) => {
        const data = tuple?.old?.t_asset_returns ?? tuple?.t_asset_returns ?? tuple;
        const returnId = this.getVal(data?.return_id);
        if (returnId) returnTupleById.set(returnId, tuple);

        const approvals = this.extractReturnApprovalsFromReturnTuple(tuple);
        approvals.forEach((approval: any) => {
          if (approval.return_approval_id) approvalsById.set(approval.return_approval_id, approval);
        });
      });

      const approvalsRes = await this.hs.ajax(
        'GetT_asset_return_approvalsObjects',
        'http://schemas.cordys.com/AMS_Database_Metadata',
        { fromReturn_approval_id: '0', toReturn_approval_id: 'zzzzzzzzzz' }
      );
      const approvalTuples = this.hs.xmltojson(approvalsRes, 'tuple');
      const approvalArray: any[] = approvalTuples ? (Array.isArray(approvalTuples) ? approvalTuples : [approvalTuples]) : [];
      approvalArray
        .map((tuple: any) => this.mapReturnApprovalTuple(tuple))
        .forEach((approval: any) => {
          if (approval.return_approval_id) approvalsById.set(approval.return_approval_id, approval);
        });

      let resolvedApprovals = Array.from(approvalsById.values())
        .filter((approval: any) =>
          approval.approver_id === approverId &&
          this.isAllocationReturnRole(approval.role) &&
          (
            approval.status === RequestStatus.APPROVED ||
            approval.status === RequestStatus.REJECTED ||
            approval.status === RequestStatus.COMPLETED ||
            approval.status === RequestStatus.CANCELLED
          )
        );

      if (!resolvedApprovals.length) {
        const progressApprovals: any[] = [];
        for (const returnId of returnTupleById.keys()) {
          const progress = await this.requestService.getReturnRequestProgress(returnId);
          progressApprovals.push(...progress);
        }
        resolvedApprovals = progressApprovals.filter((approval: any) => {
          const status = this.mapToStatus(approval.status || '');
          return approval.approver_id === approverId &&
            this.isAllocationReturnRole(approval.role) &&
            (
              status === RequestStatus.APPROVED ||
              status === RequestStatus.REJECTED ||
              status === RequestStatus.COMPLETED ||
              status === RequestStatus.CANCELLED
            );
        });
      }

      if (!resolvedApprovals.length) {
        this.resolvedReturnTickets = [];
        return;
      }

      this.resolvedReturnTickets = [];
      for (const approval of resolvedApprovals) {
        const baseTuple = returnTupleById.get(approval.request_id) ?? {
          old: {
            t_asset_returns: {
              return_id: approval.request_id,
              status: approval.status,
              remarks: approval.remarks,
              return_date: approval.action_date,
              temp1: approval.temp1,
              t_asset_return_approvals: approval
            }
          }
        };

        const ticket = this.mapReturnTupleToEnrichedTicket(baseTuple);
        ticket.approvalid = approval.return_approval_id || ticket.approvalid;
        ticket.status = approval.status;
        ticket.reason = ticket.reason || approval.remarks || '—';
        ticket.assignedDate = approval.action_date || ticket.assignedDate;
        ticket.taskid = approval.temp2 || ticket.taskid;
        if ((!ticket.assetId || ticket.assetId === '—' || ticket.assetId === 'â€”') && approval.temp1) {
          ticket.assetId = approval.temp1;
          ticket.rawRequest.assignedAssetId = approval.temp1;
        }
        await this.enrichReturnTicketWithAssetDetails(ticket);
        await this.enrichReturnTicketWithApprovalHistory(ticket);
        this.resolvedReturnTickets.push(ticket);
      }

      console.log(`Loaded ${this.resolvedReturnTickets.length} resolved return tickets for ${approverId}`);
    } catch (err) {
      console.error('Failed to load resolved return tickets:', err);
      this.resolvedReturnTickets = [];
    }
  }

  setTab(tab: 'unresolved' | 'resolved' | 'return' | 'resolvedReturn'): void {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  private findTaskIdRecursively(obj: any): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const targets = ['temp2', 'temp1', 'temp3', 'task_id', 'taskId', 'WORKITEM_ID'];
    for (const key of targets) {
      const val = this.getVal(obj[key]);
      if (val && val !== '—' && val !== '–' && val !== '-' && val !== 'null' && val !== 'NaN') return val;
    }
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const result = this.findTaskIdRecursively(obj[key]);
        if (result) return result;
      }
    }
    return null;
  }

  private mapReturnTupleToEnrichedTicket(tuple: any): EnrichedTicket {
    const returnData = tuple?.old?.t_asset_returns ?? tuple?.t_asset_returns ?? tuple;
    let approvalObj = returnData?.t_asset_return_approvals ?? tuple?.old?.t_asset_return_approvals ?? tuple?.t_asset_return_approvals ?? {};

    if (Array.isArray(approvalObj)) {
      approvalObj = approvalObj.find((a: any) => this.mapToStatus(this.getSafeVal(a.status) || '') === RequestStatus.PENDING) ?? approvalObj[0] ?? {};
    }

    const userData = returnData?.m_users ?? {};
    const assetData = returnData?.m_assets ?? tuple?.old?.m_assets ?? tuple?.m_assets ?? {};
    const assetId = this.getVal(returnData?.temp1) ?? this.getVal(assetData?.asset_id) ?? this.getVal(approvalObj?.temp1) ?? 'â€”';
    const statusStr = this.getSafeVal(returnData?.status) ?? this.getSafeVal(approvalObj?.status) ?? 'Pending';
    const status = this.mapToStatus(statusStr);
    const safeAssetId = this.getSafeVal(assetId) || '';
    const returnId = this.getSafeVal(returnData?.return_id) ?? this.getSafeVal(approvalObj?.request_id) ?? '';
    const requestorName = this.getSafeVal(userData?.name) ?? 'Unknown';
    const assetType = this.getSafeVal(assetData?.type_id) ?? this.getSafeVal(assetData?.asset_type) ?? 'Hardware';
    const assetName = this.getSafeVal(assetData?.asset_name) ?? 'Asset Return';
    const reason = this.getSafeVal(returnData?.remarks) ?? '';

    return {
      taskid: this.getSafeVal(approvalObj?.temp2) ?? '',
      approvalid: this.getSafeVal(approvalObj?.return_approval_id) ?? '',
      ticketId: returnId,
      requestorName,
      assetType,
      subCategory: this.getVal(assetData?.sub_category_id) ?? 'N/A',
      assetName,
      assetId: safeAssetId,
      warrantyExpiry: this.getVal(assetData?.warranty_expiry) ?? '-',
      availabilityStatus: 'N/A',
      assignedDate: this.getSafeVal(approvalObj?.action_date) ?? this.getSafeVal(returnData?.return_date) ?? '',
      assetManagerName: '—',
      teamLeadName: '—',
      urgency: 'Medium',
      reason,
      status,
      rawRequest: {
        id: returnId,
        requestNumber: returnId,
        requesterId: this.getSafeVal(returnData?.requested_by) ?? '',
        requesterName: requestorName,
        requestType: RequestType.RETURN_ASSET,
        status,
        currentStage: ApprovalStage.ALLOCATION,
        justification: reason,
        requestDate: this.getSafeVal(returnData?.return_date) ?? '',
        lastUpdated: this.getSafeVal(approvalObj?.action_date) ?? this.getSafeVal(returnData?.return_date) ?? '',
        assignedAssetId: safeAssetId,
        assetType,
        assetName,
        approvalChain: [{ stage: ApprovalStage.ALLOCATION, action: 'Pending' }],
        comments: []
      } as any
    };
  }

  /**
   * Maps a single Cordys XML→JSON tuple into an EnrichedTicket.
   *
   * Response shape:
   *   tuple.old.t_request_approvals
   *     ├── t_asset_requests  (request_id, user_id, asset_type, reason, urgency, status, created_at)
   *     ├── m_assets          (asset_id, asset_name, sub_category_id, warranty_expiry, status)
   *     └── m_users           (name, team_lead, project_id, user_id)
   */
  private mapTupleToEnrichedTicket(tuple: any): EnrichedTicket {
    const parent = tuple?.old ?? tuple;
    const approval = parent?.t_request_approvals ?? parent;
    const reqData = approval?.t_asset_requests ?? parent?.t_asset_requests ?? (parent.request_id ? parent : {});
    const assetData = approval?.m_assets ?? parent?.m_assets ?? reqData?.m_assets ?? {};
    const userData = approval?.m_users ?? parent?.m_users ?? reqData?.m_users ?? {};

    const statusStr = this.getVal(reqData?.status) ?? this.getVal(approval?.status) ?? 'Pending';
    const status = this.mapToStatus(statusStr);
    const assetType = this.getVal(reqData?.asset_type) ?? '—';
    const managerName = this.typeToManagerMap.get(assetType.toLowerCase().trim()) || '—';

    return {
      taskid: this.getVal(approval?.temp2) ?? '—',
      approvalid: this.getVal(approval?.approval_id) ?? '—',
      ticketId: this.getVal(reqData?.request_id) ?? this.getVal(approval?.request_id) ?? '—',
      requestorName: this.getVal(approval?.m_users?.name[0]) ?? '—',
      assetType,
      subCategory: this.subCategoryMap.get(this.getVal(assetData?.sub_category_id) || '') ?? this.getVal(assetData?.sub_category_id) ?? this.getVal(reqData?.temp1) ?? '—',
      assetName: this.getVal(assetData?.asset_name) ?? '—',
      assetId: this.getVal(assetData?.asset_id) ?? this.getVal(reqData?.asset_id) ?? this.getVal(reqData?.temp1) ?? this.getVal(parent?.asset_id) ?? '—',
      warrantyExpiry: this.getVal(assetData?.warranty_expiry) ?? '—',
      availabilityStatus: this.getVal(assetData?.status) ?? '—',
      assignedDate: this.getVal(reqData?.created_at) ?? '',
      assetManagerName: managerName,
      teamLeadName: this.getVal(userData?.team_lead) ?? '—',
      urgency: this.getVal(reqData?.urgency) ?? '—',
      reason: this.getVal(reqData?.reason) ?? '—',
      status,
      assetManagerRemarks: this.getVal(approval?.remarks) ?? this.getVal(approval?.temp3) ?? undefined,
      rawRequest: {
        id: this.getVal(reqData?.request_id) ?? '',
        requestNumber: this.getVal(reqData?.request_id) ?? '',
        requesterId: this.getVal(reqData?.user_id) ?? '',
        requesterName: this.getVal(userData?.name) ?? '',
        requesterDepartment: '',
        requesterTeam: '',
        assetType,
        category: this.getVal(assetData?.asset_name) ?? '',
        justification: this.getVal(reqData?.reason) ?? '',
        urgency: this.mapToUrgency(this.getVal(reqData?.urgency) ?? '') as any,
        status,
        currentStage: ApprovalStage.ALLOCATION,
        hasEmailApproval: reqData?.email_approval === 'true',
        requestDate: this.getVal(reqData?.created_at) ?? '',
        lastUpdated: this.getVal(reqData?.created_at) ?? '',
        requestType: 'NEW_ASSET' as any,
        approvalChain: [{ stage: ApprovalStage.ALLOCATION, action: 'Pending' }],
        comments: []
      } as AssetRequest
    };
  }

  private mapWarrantyToEnrichedTicket(req: AssetRequest): EnrichedTicket {
    return {
      taskid: req.taskid || '—',
      approvalid: req.approvalId || '—',
      ticketId: req.id || '—',
      requestorName: req.requesterName || '—',
      assetType: req.assetType || '—',
      subCategory: req.subCategory || '—',
      assetName: req.assetName || '—',
      assetId: req.assignedAssetId || '—',
      warrantyExpiry: req.assignedWarrantyExpiry || '—',
      availabilityStatus: 'N/A',
      assignedDate: req.requestDate || '',
      assetManagerName: '—',
      teamLeadName: '—',
      urgency: req.urgency || '—',
      reason: req.justification || '—',
      status: req.status,
      rawRequest: req
    };
  }

  private async enrichTicketWithAssetDetails(ticket: EnrichedTicket): Promise<void> {
    if (ticket.assetId && ticket.assetId !== '—') {
      // If basic details are missing, fetch them
      if (ticket.assetName === '—' || ticket.subCategory === '—' || ticket.subCategory === 'N/A') {
        try {
          const asset = await this.requestService.getAssetDetailsById(ticket.assetId);
          if (asset) {
            ticket.assetName = asset.asset_name || ticket.assetName;
            ticket.assetType = asset.type_id || ticket.assetType;
            ticket.subCategory = this.subCategoryMap.get(asset.sub_category_id) || asset.sub_category_id || ticket.subCategory;
            ticket.warrantyExpiry = asset.warranty_expiry || ticket.warrantyExpiry;
            if (ticket.availabilityStatus === '—' || ticket.availabilityStatus === 'N/A') {
              ticket.availabilityStatus = asset.status || ticket.availabilityStatus;
            }
          }
        } catch (err) {
          console.warn(`Failed to enrich ticket ${ticket.ticketId}:`, err);
        }
      }
    }
  }

  /** Safely extracts a string value; returns undefined for xsi:nil / null objects or blanks. */
  private getVal(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'object') {
      if (value['@nil'] === 'true' || value['@null'] === 'true') return undefined;
      return undefined;
    }
    const str = String(value).trim();
    return str === '' ? undefined : str;
  }

  private getSafeVal(value: any): string | undefined {
    const text = this.getVal(value)?.trim();
    if (!text) return undefined;

    const normalized = text.toLowerCase();
    if (['-', 'n/a', 'na', 'null', 'undefined', 'nan'].includes(normalized)) return undefined;
    if (text === '\u2014' || text === '\u2013') return undefined;
    if (normalized.includes('\u00e2') || normalized.includes('\ufffd')) return undefined;

    return text;
  }

  private mapToStatus(status: string): RequestStatus {
    const n = status.toLowerCase();
    if (n.includes('pending')) return RequestStatus.PENDING;
    if (n.includes('approved')) return RequestStatus.APPROVED;
    if (n.includes('rejected')) return RequestStatus.REJECTED;
    if (n.includes('progress')) return RequestStatus.IN_PROGRESS;
    if (n.includes('completed')) return RequestStatus.COMPLETED;
    if (n.includes('cancelled')) return RequestStatus.CANCELLED;
    return RequestStatus.PENDING;
  }

  private mapToUrgency(urgency: string): string {
    const n = urgency.toLowerCase();
    if (n.includes('critical')) return 'Critical';
    if (n.includes('high')) return 'High';
    if (n.includes('medium')) return 'Medium';
    if (n.includes('low')) return 'Low';
    return 'Medium';
  }



  async viewDetails(ticket: EnrichedTicket): Promise<void> {
    this.selectedTicket = ticket;
    this.drawerOpen = true;
    this.decisionRemarks = '';

    try {
      if (ticket.rawRequest.requestType === RequestType.RETURN_ASSET) {
        await this.enrichReturnTicketWithApprovalHistory(ticket);
      } else {
        // Fetch real-time progress for New Asset or Warranty requests
        const progress = await this.requestService.getRequestProgress(ticket.ticketId);
        if (progress && progress.length > 0) {
          // 1. Collect ALL unique, human-entered comments from the history
          const commentEntries = progress
            .filter(p => p.comments && p.comments.trim().length > 0)
            .filter(p => {
              const c = p.comments.toLowerCase().trim();
              // Only filter out very generic single-word status updates that aren't real remarks
              return c !== 'approved' && c !== 'rejected' && c !== 'completed' && c !== 'pending' && c !== '—' && c !== '-' && c !== 'ok';
            });

          console.log(`[AllocationTickets] Found ${commentEntries.length} meaningful comment entries for ${ticket.ticketId}`);

          // 2. Check if Team Lead is actually present in the approval flow
          const isTeamLeadInFlow = progress.some(p => {
            const stageLower = (p.stage || '').toLowerCase();
            return stageLower.includes('team lead') || stageLower.includes('lead');
          });

          // 3. Identify Team Lead Remarks — only if TL is in the flow
          if (isTeamLeadInFlow) {
            const tlEntry = commentEntries.find(p => {
              const combined = (p.stage + ' ' + (p.role || '')).toLowerCase();
              return combined.includes('team lead') || combined.includes('lead');
            });
            if (tlEntry) {
              ticket.teamLeadRemarks = tlEntry.comments;
            }
          } else {
            // TL is not in flow — clear any previously set teamLeadRemarks
            ticket.teamLeadRemarks = undefined;
          }

          // 4. Identify Asset Manager Remarks
          const amEntry = commentEntries.find(p => {
            const combined = (p.stage + ' ' + (p.role || '')).toLowerCase();
            return (combined.includes('asset manager') || combined.includes('manager')) &&
              !combined.includes('team lead') && !combined.includes('lead');
          });

          if (amEntry) {
            ticket.assetManagerRemarks = amEntry.comments;
          } else if (!isTeamLeadInFlow && commentEntries.length >= 1 && !ticket.assetManagerRemarks) {
            // TL not in flow: first comment belongs to AM
            ticket.assetManagerRemarks = commentEntries[0].comments;
          } else if (isTeamLeadInFlow && commentEntries.length >= 2 && !ticket.assetManagerRemarks) {
            // TL is in flow: take the entry that isn't the TL entry
            const otherEntry = commentEntries.find(p => p.comments !== ticket.teamLeadRemarks);
            if (otherEntry) ticket.assetManagerRemarks = otherEntry.comments;
          }

          console.log(`[AllocationTickets] Final extracted remarks for ${ticket.ticketId}:`, {
            isTeamLeadInFlow,
            TL: ticket.teamLeadRemarks,
            AM: ticket.assetManagerRemarks
          });
        }
      }
    } catch (err) {
      console.warn('[AllocationTickets] Failed to fetch approval history:', err);
    }
  }

  closeDetails(): void {
    this.drawerOpen = false;
    this.selectedTicket = null;
    this.decisionRemarks = '';
  }

  get unresolvedTickets(): EnrichedTicket[] {
    return this.allTickets.filter(t =>
      t.rawRequest.requestType !== RequestType.RETURN_ASSET &&
      (t.status === 'Pending' || t.status === 'In Progress')
    );
  }

  get allReturnTickets(): EnrichedTicket[] {
    const byId = new Map<string, EnrichedTicket>();
    [...this.returnTickets, ...this.resolvedReturnTickets].forEach(ticket => {
      if (ticket.ticketId) byId.set(ticket.ticketId, ticket);
    });
    return Array.from(byId.values());
  }

  get filteredTickets(): EnrichedTicket[] {
    let source: EnrichedTicket[] = [];
    if (this.activeTab === 'unresolved') {
      source = this.unresolvedTickets;
    } else if (this.activeTab === 'resolved') {
      source = this.resolvedTickets;
    } else if (this.activeTab === 'return') {
      source = this.allReturnTickets;
    } else if (this.activeTab === 'resolvedReturn') {
      source = this.resolvedReturnTickets;
    }

    // Apply Search
    let filtered = source.filter(t => {
      const matchesSearch = !this.searchTerm ||
        t.ticketId.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        t.requestorName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        t.subCategory.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesType = !this.selectedAssetType || t.assetType === this.selectedAssetType;

      const matchesRequestType = !this.selectedRequestType ||
        (this.selectedRequestType === 'new' && t.rawRequest.requestType === RequestType.NEW_ASSET) ||
        (this.selectedRequestType === 'warranty' && t.rawRequest.requestType === RequestType.EXTEND_WARRANTY) ||
        (this.selectedRequestType === 'return' && t.rawRequest.requestType === RequestType.RETURN_ASSET);

      const matchesResolvedStatus = (this.activeTab !== 'resolved' && this.activeTab !== 'resolvedReturn') || !this.selectedResolvedStatus ||
        (this.selectedResolvedStatus === 'Approved' && (t.status === RequestStatus.COMPLETED || t.status === RequestStatus.APPROVED)) ||
        (this.selectedResolvedStatus === 'Rejected' && t.status === RequestStatus.REJECTED);

      const matchesReturnStatus = this.activeTab !== 'return' || !this.selectedReturnStatus ||
        (this.selectedReturnStatus === 'Pending' && (t.status === RequestStatus.PENDING || t.status === RequestStatus.IN_PROGRESS)) ||
        (this.selectedReturnStatus === 'Approved' && (t.status === RequestStatus.APPROVED || t.status === RequestStatus.COMPLETED)) ||
        (this.selectedReturnStatus === 'Rejected' && t.status === RequestStatus.REJECTED);

      return matchesSearch && matchesType && matchesRequestType && matchesResolvedStatus && matchesReturnStatus;
    });

    // Sort by Date (Descending - Newest first)
    filtered.sort((a, b) => {
      const dateA = a.assignedDate ? new Date(a.assignedDate).getTime() : 0;
      const dateB = b.assignedDate ? new Date(b.assignedDate).getTime() : 0;
      return dateB - dateA;
    });

    return filtered;
  }


  get paginatedTickets(): EnrichedTicket[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTickets.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredTickets.length / this.pageSize);
  }

  get pageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    return pages;
  }

  setPage(page: number): void {
    this.currentPage = page;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }


  getStatusClass(status: RequestStatus): string {
    switch (status) {
      case RequestStatus.PENDING: return 'status-pending';
      case RequestStatus.APPROVED: return 'status-approved';
      case RequestStatus.IN_PROGRESS: return 'status-inprogress';
      case RequestStatus.COMPLETED: return 'status-completed';
      case RequestStatus.REJECTED: return 'status-rejected';
      case RequestStatus.CANCELLED: return 'status-cancelled';
      default: return 'status-default';
    }
  }

  async allocate(ticket: EnrichedTicket): Promise<void> {


    var req1 = {
      tuple: {
        old: {
          t_request_approvals: {
            approval_id: ticket.approvalid,

          }
        }
        ,
        new: {
          t_request_approvals: {
            status: "Approved",
            remarks: this.decisionRemarks
          }
        }

      }
    }
    console.log("First request is", req1)
    await this.requestService.updateEntryForAllocationTeamMember(req1 as any)

    // Handle Warranty Extension specific final approval
    if (ticket.rawRequest.requestType === RequestType.EXTEND_WARRANTY) {
      await this.requestService.updateExtendAssetRequest(ticket.rawRequest.id, 'Approved');

      // For warranty, we just complete the BPM task and notify
      if (ticket.taskid && ticket.taskid !== '—') {
        await this.requestService.completeUserTask({
          TaskId: ticket.taskid,
          Action: 'COMPLETE'
        } as any);
      }

      this.notificationService.showToast('Warranty extension confirmed successfully.', 'success');
      this.loadTickets();
      return;
    }

    var req2 = {
      tuple: {
        old: {
          m_assets: {
            asset_id: ticket.assetId,
          }
        },
        new: {
          m_assets: {
            status: "Allocated",
            temp1: ticket.rawRequest.requesterId,
            // Store allocated date in m_assets.temp4 (YYYY-MM-DD)
            temp4: new Date().toISOString().split('T')[0]
          }
        }
      }
    }
    console.log("Request2 is ", req2);
    await this.requestService.updateAssetStatus(req2 as any)
    var req3 = {
      tuple: {
        new: {
          t_request_approvals: {
            approver_id: this.assetManagerIDForThisUser,
            request_id: ticket.rawRequest.id,
            role: "Asset Manager",
            status: "Pending",

            temp1: ticket.assetId,

          }
        }
      }
    }
    console.log("Third request is ", req3);
    await this.requestService.createNewEntryForAssetManagerConfirmation(req3 as any);
    var taskid = ticket.taskid;
    console.log("Taskid is  ", taskid);
    var req4 = {
      TaskId: `${taskid}`,
      Action: 'COMPLETE'
    }
    await this.requestService.completeUserTask(req4 as any)

    // Notify Asset Manager for Final Confirmation
    this.mailService.sendAllocationCompletionNotification({
      requestId: ticket.ticketId,
      assetName: ticket.assetName || ticket.assetType,
      allocationName: 'Allocation Team Member',
      managerName: this.assetManagerNameForThisUser || 'Asset Manager'
    });

    this.loadTickets();
  }

  async reject(ticket: EnrichedTicket, remarksInput?: string): Promise<void> {
    const remarks = remarksInput || this.decisionRemarks || 'Rejected by Allocation Team';

    try {
      // Step 1: Update approval record to Rejected
      const reqReject = {
        tuple: {
          old: {
            t_request_approvals: {
              approval_id: ticket.approvalid,
            }
          },
          new: {
            t_request_approvals: {
              status: "Rejected",
              remarks: remarks
            }
          }
        }
      };
      console.log("Rejecting standard request:", reqReject);
      await this.requestService.updateEntryForAllocationTeamMember(reqReject as any);

      // Step 2: Update asset request status to Rejected
      const rejectRequestPayload = {
        tuple: {
          old: { t_asset_requests: { request_id: ticket.rawRequest.id } },
          new: { t_asset_requests: { status: 'Rejected' } }
        }
      };
      await this.requestService.submitNewRequestForm(rejectRequestPayload as any);

      // Step 3: Complete BPM task
      const taskid = ticket.taskid;
      if (taskid && taskid !== '—' && taskid !== '–' && taskid !== '-') {
        await this.requestService.completeUserTask({ TaskId: `${taskid}`, Action: 'COMPLETE' } as any);
      }

      this.notificationService.showToast(`Request ${ticket.ticketId} rejected.`, 'info');
    } catch (error) {
      console.error("Standard request rejection failed:", error);
      this.notificationService.showToast(`Failed to reject request ${ticket.ticketId}.`, 'error');
    }

    this.loadTickets();
    if (!this.decisionRemarks.trim()) {
      alert('Remarks are mandatory for rejection.');
      return;
    }

    try {
      await this.requestService.rejectRequest(
        ticket.rawRequest.id,
        this.currentUser.id,
        this.currentUser.name,
        this.decisionRemarks,
        ApprovalStage.ALLOCATION,
        ticket.approvalid
      );
      this.notificationService.showToast('Request rejected successfully', 'success');
      this.closeDetails();
      await this.loadTickets();
    } catch (error) {
      console.error('Rejection failed:', error);
      this.notificationService.showToast('Failed to reject request', 'error');
    }
  }
  async allocateAssetReturn(ticket: EnrichedTicket): Promise<void> {

    console.log("Starting allocateAssetReturn for:", ticket.ticketId);

    if (!ticket.ticketId || ticket.ticketId === '—' || !ticket.approvalid || ticket.approvalid === '—') {
      console.error("Cannot proceed: Missing Ticket ID or Approval ID", ticket);
      this.notificationService.showToast('Approval details are missing for this return ticket. Please refresh and try again.', 'error');
      return;
    }

    try {
      const assetLookupId = this.getReturnAssetLookupId(ticket);
      const approverId = await this.requestService.resolveReturnApproverId(assetLookupId, 'rol_04');

      // 1. Update current approval status
      var req11 = {
        tuple: {
          old: {
            t_asset_return_approvals: {
              return_approval_id: ticket.approvalid,
            }
          },
          new: {
            t_asset_return_approvals: {
              status: "Approved",
              remarks: this.decisionRemarks || ''
            }
          }
        }
      };

      console.log("Step 1: Updating current approval status...", req11);
      const res1 = await this.requestService.updateEntryForAllocationTeamMemberAssetReturn(req11 as any);
      console.log("Step 1 Complete. Response Tuple:", JSON.stringify(res1));

      // Capture TaskID from Step 1 response if current one is missing
      let currentTaskId = ticket.taskid;
      if (!currentTaskId || currentTaskId === '—' || currentTaskId === '-' || currentTaskId === '–') {
        // Try looking in new tag of response
        const newRecord = res1?.new?.t_asset_return_approvals || res1?.t_asset_return_approvals || res1;
        const respTaskId = this.getVal(newRecord?.temp2) || this.getVal(newRecord?.temp1) || this.findTaskIdRecursively(res1);
        if (respTaskId) {
          console.log("Captured TaskID from Step 1 response:", respTaskId);
          currentTaskId = respTaskId;
        }
      }

      // 2. Create next approval entry for Asset Manager
      var req12 = {
        tuple: {
          new: {
            t_asset_return_approvals: {
              approver_id: approverId,
              request_id: ticket.ticketId,
              role: "Asset Manager",
              status: "Pending",
              remarks: '',
              temp1: assetLookupId
            }
          }
        }
      };

      console.log(`Step 2: Creating entry for Asset Manager (${approverId})...`, req12);
      const res2 = await this.requestService.createNewEntryForAssetManagerConfirmationAssetReturn(req12 as any);
      console.log("Step 2 Complete. Response:", res2);

      // 3. Complete BPM Task if available
      console.log("Final Task ID for completion:", currentTaskId);

      console.log("SOAP Create (REQ7):", req11);
      //  await this.requestService.completeTask(req12 as any);
      // var req4 = {
      //   TaskId: `${taskid}`,
      //   Action: 'COMPLETE'
      // }
      // await this.requestService.completeUserTask(req4 as any)
      // console.log("Step 2 (Forwarding) Success");
      // Check for truthiness and skip placeholders (Em Dash, En Dash, Hyphen)
      if (currentTaskId && currentTaskId !== '—' && currentTaskId !== '–' && currentTaskId !== '-') {
        var req4 = {
          TaskId: `${currentTaskId}`,
          Action: 'COMPLETE'
        };
        console.log("Step 3: Completing BPM task...", req4);
        const res3 = await this.requestService.completeUserTask(req4 as any);
        console.log("Step 3 Complete. Response:", res3);
      } else {
        console.warn("Skipping Step 3: No valid TaskID found in initial data or Step 1 response.");
      }

      // Send email to Asset Manager for final confirmation
      this.mailService.sendReturnRequestNotification({
        stage: 'alloc_approved',
        returnId: ticket.ticketId,
        employeeName: ticket.requestorName,
        assetName: ticket.assetName,
        remarks: this.decisionRemarks || '',
        actionByName: 'Allocation Team Member',
        nextApproverName: 'Asset Manager'
      });

      console.log("All steps finished for return ticket:", ticket.ticketId);
      this.notificationService.showToast(`Return request ${ticket.ticketId} sent to Asset Manager for final confirmation.`, 'success');
      this.closeDetails();
      await this.loadTickets();

    } catch (error) {
      console.error("Critical error in allocateAssetReturn workflow:", error);
      this.notificationService.showToast(`Failed to confirm return request ${ticket.ticketId}.`, 'error');
    }
  }

  private mapReturnApprovalTuple(tuple: any): any {
    const data = tuple?.old?.t_asset_return_approvals ?? tuple?.t_asset_return_approvals ?? tuple;
    return {
      return_approval_id: this.getVal(data?.return_approval_id) ?? '',
      request_id: this.getVal(data?.request_id) ?? '',
      approver_id: this.getVal(data?.approver_id) ?? '',
      role: this.getVal(data?.role) ?? '',
      status: this.mapToStatus(this.getVal(data?.status) ?? ''),
      remarks: this.getVal(data?.remarks) ?? '',
      action_date: this.getVal(data?.action_date) ?? this.getVal(data?.created_at) ?? '',
      temp1: this.getVal(data?.temp1) ?? '',
      temp2: this.getVal(data?.temp2) ?? ''
    };
  }

  private extractReturnApprovalsFromReturnTuple(tuple: any): any[] {
    const returnData = tuple?.old?.t_asset_returns ?? tuple?.t_asset_returns ?? tuple;
    const returnId = this.getVal(returnData?.return_id) ?? '';
    const approvalObj = returnData?.t_asset_return_approvals ?? tuple?.old?.t_asset_return_approvals ?? tuple?.t_asset_return_approvals;
    const approvalArray = approvalObj ? (Array.isArray(approvalObj) ? approvalObj : [approvalObj]) : [];

    return approvalArray.map((approval: any) => ({
      ...this.mapReturnApprovalTuple(approval),
      request_id: this.getVal(approval?.request_id) ?? returnId
    }));
  }

  private async enrichReturnTicketWithAssetDetails(ticket: EnrichedTicket): Promise<void> {
    if (!ticket.assetId || ticket.assetId === 'â€”') return;

    const asset = await this.requestService.getAssetDetailsById(ticket.assetId);
    if (!asset) return;

    ticket.assetName = asset.asset_name || ticket.assetName;
    ticket.assetType = asset.type_id || ticket.assetType;
    ticket.subCategory = asset.sub_category_id || ticket.subCategory;
    ticket.warrantyExpiry = asset.warranty_expiry || ticket.warrantyExpiry;
  }

  private async enrichReturnTicketWithApprovalHistory(ticket: EnrichedTicket): Promise<void> {
    if (!ticket.ticketId || ticket.ticketId === 'â€”') return;
    const progress = await this.requestService.getReturnRequestProgress(ticket.ticketId);
    ticket.rawRequest.approvalChain = this.buildReturnApprovalChain(progress);
  }

  private buildReturnApprovalChain(progress: any[]): ApprovalEntry[] {
    if (!progress?.length) return [];
    return [...progress]
      .sort((a: any, b: any) => this.getNumericApprovalId(a.return_approval_id) - this.getNumericApprovalId(b.return_approval_id))
      .map((approval: any) => ({
        stage: this.isAllocationReturnRole(approval.role) ? ApprovalStage.ALLOCATION : ApprovalStage.ASSET_MANAGER,
        action: this.toApprovalAction(approval.status),
        approverId: this.getVal(approval.approver_id) ?? '',
        timestamp: this.getVal(approval.action_date) ?? '',
        comments: this.getVal(approval.remarks) ?? ''
      }));
  }

  getReturnAssetManagerRemarks(ticket: EnrichedTicket): string {
    const stage = ticket.rawRequest.approvalChain?.find(entry =>
      entry.stage === ApprovalStage.ASSET_MANAGER &&
      (entry.action === 'Approved' || entry.action === 'Rejected')
    );
    return stage ? (stage.comments || 'No remarks provided') : '';
  }

  getReturnAllocationTeamRemarks(ticket: EnrichedTicket): string {
    const stage = ticket.rawRequest.approvalChain?.find(entry =>
      entry.stage === ApprovalStage.ALLOCATION &&
      (entry.action === 'Approved' || entry.action === 'Rejected')
    );
    return stage ? (stage.comments || 'No remarks provided') : '';
  }

  getReturnEmployeeReason(ticket: EnrichedTicket): string {
    return ticket.rawRequest.justification || ticket.reason || 'No reason provided';
  }

  private toApprovalAction(status: string): ApprovalEntry['action'] {
    const normalized = this.mapToStatus(status || '');
    if (normalized === RequestStatus.APPROVED || normalized === RequestStatus.COMPLETED) return 'Approved';
    if (normalized === RequestStatus.REJECTED || normalized === RequestStatus.CANCELLED) return 'Rejected';
    return 'Pending';
  }

  private isAllocationReturnRole(role: string): boolean {
    return (role || '').toLowerCase().includes('allocation');
  }

  private getNumericApprovalId(id: string): number {
    const numericId = String(id || '').match(/\d+/g)?.join('');
    return numericId ? Number(numericId) : 0;
  }

  async rejectAssetReturn(ticket: EnrichedTicket, remarksInput?: string): Promise<void> {
    const remarks = remarksInput || this.rejectRemarks || 'Rejected by Allocation Team';

    try {
      // Step 1: Update current return approval status to "Rejected"
      const reqReject = {
        tuple: {
          old: {
            t_asset_return_approvals: {
              return_approval_id: ticket.approvalid,
            }
          },
          new: {
            t_asset_return_approvals: {
              status: "Rejected",
              remarks: remarks
            }
          }
        }
      };
      console.log("Step 1: Rejecting return request:", reqReject);
      await this.requestService.updateEntryForAllocationTeamMemberAssetReturn(reqReject as any);

      // Step 2: Update t_asset_returns main table status to 'Rejected'
      const updateReturnReq = {
        tuple: {
          old: {
            t_asset_returns: {
              return_id: ticket.ticketId
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
      const taskid = ticket.taskid;
      if (taskid && taskid !== '—' && taskid !== '–' && taskid !== '-') {
        const req4 = {
          TaskId: `${taskid}`,
          Action: 'COMPLETE'
        };
        await this.requestService.completeUserTask(req4 as any);
        console.log("Step 3: BPM task completed");
      }

      // Send email to Employee about rejection
      this.mailService.sendReturnRequestNotification({
        stage: 'alloc_rejected',
        returnId: ticket.ticketId,
        employeeName: ticket.requestorName,
        assetName: ticket.assetName,
        remarks: remarks,
        actionByName: 'Allocation Team Member'
      });

      this.notificationService.showToast(`Return request ${ticket.ticketId} rejected.`, 'info');
    } catch (error) {
      console.error("Return request rejection failed:", error);
      this.notificationService.showToast(`Failed to reject return request ${ticket.ticketId}.`, 'error');
    }

    this.loadTickets();
  }

  // ─── Reject Methods ───────────────────────────────────────────────────

  private getReturnAssetLookupId(ticket: EnrichedTicket): string {
    return this.getSafeVal(ticket.assetId) ||
      this.getSafeVal(ticket.rawRequest?.assignedAssetId) ||
      (ticket.assetType?.startsWith('typ_') ? ticket.assetType : '') ||
      '';
  }

  async handleRejectClick(ticket: EnrichedTicket): Promise<void> {
    if (!this.decisionRemarks || this.decisionRemarks.trim() === '') {
      this.notificationService.showToast('Rejection remarks are required in the Decision Remarks field.', 'warning');
      return;
    }

    const remarks = this.decisionRemarks;


    if (ticket.rawRequest.requestType === RequestType.RETURN_ASSET) {
      await this.rejectAssetReturn(ticket, remarks);
    } else {
      await this.reject(ticket, remarks);
    }
    this.closeDetails();
  }

  handleTableRejectClick(ticket: EnrichedTicket): void {
    this.viewDetails(ticket);
    this.notificationService.showToast('Please enter rejection remarks in the Decision Remarks field before rejecting.', 'info');
  }


  isExpiringSoon(dateStr: string): boolean {
    if (!dateStr || dateStr === '—') return false;
    const expiry = new Date(dateStr);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays < 90;
  }

  getAvailClass(status: string): string {
    switch (status) {
      case 'Available': return 'avail-available';
      case 'Allocated': return 'avail-allocated';
      case 'MoveToAllocationTeam': return 'avail-allocated';
      case 'In Repair': return 'avail-inrepair';
      case 'Retired': return 'avail-retired';
      case 'Reserved': return 'avail-reserved';
      default: return 'avail-default';
    }
  }
}

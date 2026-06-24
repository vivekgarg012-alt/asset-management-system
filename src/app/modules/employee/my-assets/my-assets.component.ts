import { Component, OnInit } from '@angular/core';
import { AssetService } from '../../../core/services/asset.service';
import { AuthService } from '../../../core/services/auth.service';
import { RequestService } from '../../../core/services/request.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Asset } from '../../../core/models/asset.model';
import { RequestType, RequestUrgency, RequestStatus, ApprovalStage } from '../../../core/models/request.model';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HeroService } from '../../../core/services/hero.service';
import { Router } from '@angular/router';
import { AdminDataService } from '../../../core/services/admin-data.service';
import { MailService } from '../../../core/services/mail.service';

interface AssetTypeOption {
  type_id: string;
  type_name: string;
}

@Component({
  selector: 'app-my-assets',
  templateUrl: './my-assets.component.html',
  styleUrls: ['./my-assets.component.scss']
})
export class MyAssetsComponent implements OnInit {
  myAssets: Asset[] = [];
  filteredAssets: Asset[] = [];
  RequestType = RequestType;

  // Filter & search
  searchText = '';
  selectedTypeFilter = '';
  assetTypes: AssetTypeOption[] = [];
  typeMap: Record<string, string> = {}; // type_id → type_name

  // Pagination
  currentPage = 1;
  pageSize = 5;
  Math = Math;

  // Modal states
  isReturnModalOpen = false;
  isWarrantyModalOpen = false;
  selectedAsset: Asset | null = null;
  actionForm!: FormGroup;

  constructor(
    private authService: AuthService,
    private assetService: AssetService,
    private requestService: RequestService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private hs: HeroService,
    private router: Router,
    private adminService: AdminDataService,
    private mailService: MailService
  ) { }

  async ngOnInit(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      // Fetch asset types first to build the lookup map
      const types = await this.assetService.getAllAssetTypesCordys();
      this.assetTypes = types
        .map((t: any) => ({
          type_id: t.type_id || '',
          type_name: t.type_name || t.name || t.type_id || ''
        }))
        .filter(t => t.type_name && t.type_name.toLowerCase() !== 'infrastructure');
      this.assetTypes.forEach(t => this.typeMap[t.type_id] = t.type_name);

      try {
        const resp = await this.hs.ajax('GetAssetsByUser', 'http://schemas.cordys.com/AMS_Database_Metadata', { userId: user.id || '' });
        const result = this.hs.xmltojson(resp, 'm_assets');
        const rawData = result ? (Array.isArray(result) ? result : [result]) : [];

        const assetsFromGetAssetsByUser: Asset[] = rawData.map((item: any) => ({
          id: item.asset_id || item.id || '',
          assetTag: item.serial_number || item.asset_tag || item.asset_id || '',
          name: item.asset_name || item.name || '',
          type: item.type_id || item.type || item.asset_type || '',
          category: item.m_asset_subcategories?.name || item.m_asset_subcategories?.Name || item.category || '',
          subCategory: item.m_asset_subcategories?.name || item.m_asset_subcategories?.Name || item.category || '',
          condition: item.condition || 'Good',
          status: item.status || 'Allocated',
          warrantyExpiry: item.warranty_expiry || item.warrantyExpiry || '',
          assignedTo: item.user_id || user.id || '',
          purchaseDate: item.purchase_date || item.purchaseDate || '',
          allocatedDate: item.temp4 || ''
        } as any));

        this.myAssets = assetsFromGetAssetsByUser;
      } catch (err) {
        console.error('Failed to fetch assets via GetAssetsByUser:', err);
        // Fallback
        this.myAssets = await this.assetService.getAssetsByUserIdFromCordys(user.id);
      }
      // Fetch allocated assets and requests in parallel for joining
      // const [assets, requests] = await Promise.all([
      //   this.assetService.getAllocatedAssetsByUserId(user.id),
      //   this.requestService.getRequestsByUserIdFromCordys(user.id)
      // ]);

      // this.myAssets = assets;

      // Fetch allocated assets and requests in parallel for joining
      const [assets, requests, allServiceReqs] = await Promise.all([
        this.assetService.getAllocatedAssetsByUserId(user.id),
        this.requestService.getRequestsByUserIdFromCordys(user.id),
        this.requestService.getAllServiceRequests().catch(() => [])
      ]);

      let loadedAssets = [...assets];

      // Append temporarily allocated assets from service requests
      const tempReqs = allServiceReqs.filter((r: any) =>
        r.user_id === user.id &&
        r.temp3 &&
        (r.status === 'OnService' || r.status === 'Serviced')
      );

      for (const sReq of tempReqs) {
        try {
          const tAssetId = sReq.temp3;
          if (!loadedAssets.some(a => a.id === tAssetId || a.assetId === tAssetId)) {
            const tAsset = await this.assetService.getAssetDetails(tAssetId);
            if (tAsset) {
              loadedAssets.push({
                ...tAsset,
                assignedTo: user.id,
                status: 'TempAllocated',
                requestId: sReq.service_request_id,
                name: `${tAsset.name} (Temp)`
              });
            }
          }
        } catch (e) {
          console.warn('Could not load temp asset details', e);
        }
      }

      // Preserve allocatedDate from GetAssetsByUser (m_assets.temp4) if the allocation service
      // doesn't return temp4 (common depending on join service implementation).
      const byId = new Map<string, Asset>(this.myAssets.map(a => [a.id, a]));
      this.myAssets = loadedAssets.map(a => ({
        ...a,
        allocatedDate: (a as any).allocatedDate || byId.get(a.id)?.allocatedDate || ''
      }));

      // Fallback to mock data if no real data is found (for consistency with dashboard)
      if (this.myAssets.length === 0) {
        this.myAssets = this.assetService.getAssetsByUser(user.id);
      }

      // Resolve type IDs to human-readable names and join with requests for IDs
      this.myAssets = this.myAssets.map(asset => {
        // Try to find a matching request if requestId is missing from the asset record itself
        if (!asset.requestId || asset.requestId === 'N/A' || asset.requestId === '') {
          const aId = (asset.id || '').toLowerCase().trim();
          const aTag = (asset.assetTag || '').toLowerCase().trim();
          const aSerial = (asset.serialNumber || '').toLowerCase().trim();

          const matchingRequest = requests.find(r => {
            const rAllocId = (r.allocatedAssetId || '').toLowerCase().trim();
            const rAssignedId = ((r as any).assignedAssetId || '').toLowerCase().trim();

            const raw = (r as any).rawRequest || {};
            const rTemp1 = (raw.temp1 || '').toLowerCase().trim();
            const rTemp2 = (raw.temp2 || '').toLowerCase().trim();

            return (rAllocId && (rAllocId === aId || rAllocId === aTag || rAllocId === aSerial)) ||
              (rAssignedId && (rAssignedId === aId || rAssignedId === aTag || rAssignedId === aSerial)) ||
              (rTemp1 && (rTemp1 === aId || rTemp1 === aTag || rTemp1 === aSerial)) ||
              (rTemp2 && (rTemp2 === aId || rTemp2 === aTag || rTemp2 === aSerial));
          });

          if (matchingRequest) {
            asset.requestId = matchingRequest.id || matchingRequest.requestNumber;
          }
        }

        return {
          ...asset,
          type: this.resolveTypeName(asset.type as string)
        };
      });

      this.applyFilters();
    } catch (error) {
      console.error('Failed to fetch assets from Cordys in My Assets page', error);
      this.myAssets = this.assetService.getAssetsByUser(user.id);
      this.applyFilters();
    }
  }

  /**
   * Resolves a type_id like "typ_01" to the human-readable name like "Hardware".
   * Falls back to the original value if not found in the map.
   */
  resolveTypeName(typeValue: string): string {
    if (!typeValue) return 'N/A';
    // If the typeMap has this key, it's a type_id → return the name
    if (this.typeMap[typeValue]) return this.typeMap[typeValue];
    // Otherwise it's already a type name (from mock data etc.)
    return typeValue;
  }

  applyFilters(): void {
    let result = [...this.myAssets];

    // Filter by type name
    if (this.selectedTypeFilter) {
      result = result.filter(a => a.type === this.selectedTypeFilter);
    }

    // Filter by search text (searches across name, type, and asset tag)
    if (this.searchText && this.searchText.trim()) {
      const query = this.searchText.trim().toLowerCase();
      result = result.filter(a =>
        (a.name || '').toLowerCase().includes(query) ||
        (a.type as string || '').toLowerCase().includes(query) ||
        (a.assetTag || '').toLowerCase().includes(query)
      );
    }

    this.filteredAssets = result;
    this.currentPage = 1; // Reset to first page on filter change
  }

  get paginatedAssets(): Asset[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredAssets.slice(startIndex, startIndex + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredAssets.length / this.pageSize));
  }

  get totalFilteredCount(): number {
    return this.filteredAssets.length;
  }

  get visiblePages(): (number | string)[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const maxVisible = 5;

    if (total <= maxVisible + 2) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    let start = Math.max(2, current - 1);
    let end = Math.min(total - 1, current + 1);

    if (current <= 3) {
      start = 2;
      end = Math.min(total - 1, maxVisible - 1);
    } else if (current >= total - 2) {
      start = Math.max(2, total - maxVisible + 2);
      end = total - 1;
    }

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push('...');
    pages.push(total);

    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onTypeFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedTypeFilter = '';
    this.applyFilters();
  }

  /** Returns unique type names present in the user's assets for the filter dropdown */
  get uniqueAssetTypes(): string[] {
    const types = new Set(this.myAssets.map(a => a.type as string).filter(Boolean));
    return Array.from(types).sort();
  }

  isExpiringSoon(dateStr: string): boolean {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
  }

  openReturnModal(asset: Asset): void {
    this.selectedAsset = asset;
    this.actionForm = this.fb.group({
      justification: ['', [Validators.required, Validators.minLength(5)]]
    });
    this.isReturnModalOpen = true;
  }

  openWarrantyModal(asset: Asset): void {
    this.selectedAsset = asset;
    this.actionForm = this.fb.group({
      justification: ['', [Validators.required, Validators.minLength(5)]]
    });
    this.isWarrantyModalOpen = true;
  }

  closeModals(): void {
    this.isReturnModalOpen = false;
    this.isWarrantyModalOpen = false;
    this.selectedAsset = null;
  }

  async submitRequest(type: RequestType): Promise<void> {
    if (this.actionForm.invalid || !this.selectedAsset) {
      this.actionForm.markAllAsTouched();
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) return;
    const formVal = this.actionForm.value;

    if (type === RequestType.RETURN_ASSET) {
      try {
        const hasActiveReturn = await this.requestService.hasActiveReturnRequestForAsset(this.selectedAsset?.id || '', user.id);
        if (hasActiveReturn) {
          this.notificationService.showToast('A return request is already active for this asset.', 'warning');
          return;
        }

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}-${mm}-${dd}`;

        var request3 = {
          tuple: {
            new: {
              t_asset_returns: {
                requested_by: `${user.id}`,
                return_date: formattedDate,
                status: 'Pending',
                remarks: formVal.justification,
                temp1: this.selectedAsset?.id || ''
              }
            }
          }
        };

        var res3: any = await this.requestService.createEntryForReturn(request3 as any);

        const tReturns = res3?.old?.t_asset_returns || res3?.new?.t_asset_returns || res3?.t_asset_returns || {};
        const return_id = tReturns.return_id || tReturns.id || 'SYS_UNKNOWN';
        const assetManagerId = await this.requestService.resolveReturnApproverId(this.selectedAsset?.id || '', 'rol_04');

        var request4 = {
          tuple: {
            new: {
              t_asset_return_approvals: {
                request_id: `${return_id}`,
                approver_id: assetManagerId,
                role: `Asset Manager`,
                status: `Pending`,
                remarks: 'waiting for approval'
              }
            }
          }
        };

        var res4: any = await this.requestService.createEntryForAssetApprovals(request4 as any);

        const tApprovals = res4?.old?.t_asset_return_approvals || res4?.new?.t_asset_return_approvals || res4?.t_asset_return_approvals || {};
        const return_approval_id = tApprovals.return_approval_id || tApprovals.id || 'SYS_UNKNOWN_APP';

        let request5 = {
          user_id: user.id,
          return_approval_id: `${return_approval_id}`,
          returnid: `${return_id}`
        };
        await this.requestService.callBPMForReturn(request5 as any);

        const newReq = this.buildMockPayload(user, type, formVal.justification);
        this.requestService.addRequest(newReq as any);

        this.notificationService.showToast('Return request submitted successfully!', 'success');
        this.closeModals();

      } catch (err) {
        console.error(err);
        this.notificationService.showToast('Failed to submit return request', 'error');
      }
    } else if (type === RequestType.EXTEND_WARRANTY) {
      // Resolve the manager dynamically based on asset type
      this.adminService.getAssignmentByAssetType(this.selectedAsset.type)
        .then((assignment) => {
          const resolvedManagerId = assignment?.assetManagerId;
          
          if (!resolvedManagerId) {
            throw new Error(`No manager assigned for asset type: ${this.selectedAsset?.type}`);
          }

          const soapData = {
            tuple: {
              new: {
                t_extend_asset_requests: {
                  user_id: user.id,
                  asset_type: this.selectedAsset?.id || '', // Asset ID stored in asset_type column
                  reason: formVal.justification,
                  urgency: 'Medium',
                  email_approval: 'false',
                  status: "Pending",
                  created_at: new Date().toISOString()
                }
              }
            }
          };

          return this.hs.ajax('UpdateT_extend_asset_requests', 'http://schemas.cordys.com/AMS_Database_Metadata', soapData)
            .then((resp: any) => {
              const requestId =
                resp?.tuple?.new?.t_extend_asset_requests?.request_id ||
                resp?.tuple?.old?.t_extend_asset_requests?.request_id ||
                resp?.request_id;

              if (!requestId) {
                throw new Error('Request saved but approval record could not be created.');
              }

              const approvalData = {
                tuple: {
                  new: {
                    t_extend_request_approvals: {
                      request_id: requestId,
                      approver_id: resolvedManagerId,
                      role: 'Asset Manager',
                      status: 'Pending',
                      remarks: formVal.justification,
                      action_date: new Date().toISOString()
                    }
                  }
                }
              };

              return this.hs.ajax('UpdateT_extend_request_approvals', 'http://schemas.cordys.com/AMS_Database_Metadata', approvalData);
            });
        })
        .then((approvalResp: any) => {
          if (!approvalResp) return;
          const newapprovalid =
            approvalResp?.tuple?.new?.t_extend_request_approvals?.approval_id ||
            approvalResp?.tuple?.old?.t_extend_request_approvals?.approval_id ||
            approvalResp?.approval_id || '';
          const newrequestid =
            approvalResp?.tuple?.new?.t_extend_request_approvals?.request_id ||
            approvalResp?.tuple?.old?.t_extend_request_approvals?.request_id || '';

          const request3 = {
            InputDoc: "false",
            Inputusrid: user.id,
            Inputrequestapprovalid: `${newapprovalid}`,
            Inputrequestid: `${newrequestid}`
          };
          this.requestService.callBPMForwarrantyexpiry(request3 as any);

          // Notify Employee and Manager
          this.mailService.sendWarrantyRequestSubmissionNotification({
            employeeName: user.name,
            assetName: this.selectedAsset?.name || 'Asset',
            requestId: newrequestid,
            justification: formVal.justification
          });

          const newReq = this.buildMockPayload(user, type, formVal.justification);
          this.requestService.addRequest(newReq as any);

          this.notificationService.showToast('Warranty extension request submitted successfully!', 'success');
          this.closeModals();
        })
        .catch((err: any) => {
          console.error(err);
          this.notificationService.showToast('Failed to submit warranty request. Please try again.', 'error');
          this.closeModals();
        });
    }
  }

  private buildMockPayload(user: any, type: RequestType, justification: string) {
    if (!this.selectedAsset) return {};
    return {
      id: `REQ${Date.now()}`,
      requestNumber: this.requestService.generateRequestNumber(type),
      requesterId: user.id,
      requesterName: user.name,
      requesterDepartment: user.department,
      requesterTeam: user.team,
      assetType: this.selectedAsset.type,
      category: this.selectedAsset.category,
      subCategory: this.selectedAsset.subCategory,
      justification: justification,
      urgency: type === RequestType.RETURN_ASSET ? RequestUrgency.LOW : RequestUrgency.MEDIUM,
      status: RequestStatus.PENDING,
      currentStage: ApprovalStage.TEAM_LEAD,
      hasEmailApproval: false,
      requestDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      requestType: type,
      allocatedAssetId: this.selectedAsset.id,
      approvalChain: [
        { stage: ApprovalStage.TEAM_LEAD, action: 'Pending' as any },
        { stage: ApprovalStage.ASSET_MANAGER, action: 'Pending' as any },
        { stage: ApprovalStage.ALLOCATION, action: 'Pending' as any }
      ],
      comments: [{
        id: `C${Date.now()}`,
        userId: user.id,
        userName: user.name,
        comment: `${type === RequestType.RETURN_ASSET ? 'Returning' : 'Extending warranty for'} asset: ${this.selectedAsset.assetTag} - ${this.selectedAsset.name}`,
        timestamp: new Date().toISOString()
      }]
    };
  }
}

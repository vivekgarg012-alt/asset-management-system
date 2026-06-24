import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AssetService } from '../../../core/services/asset.service';
import { RequestService } from '../../../core/services/request.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Asset } from '../../../core/models/asset.model';
import { RequestType, RequestUrgency, RequestStatus, ApprovalStage } from '../../../core/models/request.model';
import { HeroService } from '../../../core/services/hero.service';
import { AdminDataService } from '../../../core/services/admin-data.service';
import { MailService } from '../../../core/services/mail.service';


@Component({
  selector: 'app-tl-extend-warranty',
  templateUrl: './extend-warranty.component.html',
  styleUrls: ['./extend-warranty.component.scss']
})
export class ExtendWarrantyComponent implements OnInit {
  warrantyForm!: FormGroup;
  eligibleAssets: Asset[] = [];
  selectedAsset: Asset | undefined;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private assetService: AssetService,
    private requestService: RequestService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    private hs: HeroService,
    private adminService: AdminDataService,
    private mailService: MailService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    
    this.getAssetsByUser(user.id);
    
    this.warrantyForm = this.fb.group({
      assetId: ['', Validators.required],
      justification: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  onAssetSelect(): void {
    const id = this.warrantyForm.get('assetId')?.value;
    this.selectedAsset = this.eligibleAssets.find(a => a.id === id);
  }

  async onSubmit(): Promise<void> {
    if (this.warrantyForm.invalid || !this.selectedAsset) return;

    const user = this.authService.getCurrentUser();
    if (!user) return;
    const formVal = this.warrantyForm.value;

    this.isLoading = true;

    try {
      // 1. Resolve manager dynamically based on asset type
      const normalizedType = this.requestService.normalizeAssetType(this.selectedAsset.type, this.selectedAsset.name);
      const assignment = await this.adminService.getAssignmentByAssetType(normalizedType);
      const resolvedManagerId = assignment?.assetManagerId;

      if (!resolvedManagerId) {
        this.notificationService.showToast('No manager assigned for this asset type. Please contact administrator.', 'error');
        this.isLoading = false;
        return;
      }

      // 2. Submit request to Cordys
      const soapData = {
        tuple: {
          new: {
            t_extend_asset_requests: {
              user_id: user.id,
              asset_type: formVal.assetId,
              reason: formVal.justification,
              urgency: 'Medium',
              email_approval: 'false',
              status: "Pending",
              created_at: new Date().toISOString(),
              temp1: this.selectedAsset?.name || '',
              temp2: this.selectedAsset?.serialNumber || '',
              temp3: this.selectedAsset?.warrantyExpiry || '',
              temp4: '',
              temp5: '',
              temp6: '',
              temp7: ''
            }
          }
        }
      };

      console.log('[TL ExtendWarranty] Submitting request to Cordys:', soapData);
      const resp: any = await this.hs.ajax('UpdateT_extend_asset_requests', 'http://schemas.cordys.com/AMS_Database_Metadata', soapData);

      const requestId =
        resp?.tuple?.new?.t_extend_asset_requests?.request_id ||
        resp?.tuple?.old?.t_extend_asset_requests?.request_id ||
        resp?.request_id;

      if (!requestId) {
        throw new Error('Request saved but approval record could not be created.');
      }

      // 3. Create approval record for Asset Manager
      const approvalData = {
        tuple: {
          new: {
            t_extend_request_approvals: {
              request_id: requestId,
              approver_id: `${resolvedManagerId}`,
              role: 'Asset Manager',
              status: 'Pending',
              remarks: formVal.justification,
              action_date: new Date().toISOString(),
              temp1: '',
              temp2: '',
              temp3: '',
              temp4: this.selectedAsset?.id || '',
              temp5: '',
              temp6: '',
              temp7: ''
            }
          }
        }
      };

      console.log('[TL ExtendWarranty] Creating manager approval entry:', approvalData);
      const approvalResp: any = await this.hs.ajax('UpdateT_extend_request_approvals', 'http://schemas.cordys.com/AMS_Database_Metadata', approvalData);

      const newapprovalid =
        approvalResp?.tuple?.new?.t_extend_request_approvals?.approval_id ||
        approvalResp?.tuple?.old?.t_extend_request_approvals?.approval_id ||
        approvalResp?.approval_id || '';

      const newrequestid =
        approvalResp?.tuple?.new?.t_extend_request_approvals?.request_id ||
        approvalResp?.tuple?.old?.t_extend_request_approvals?.request_id || '';

      // 4. Trigger BPM workflow
      const request3 = {
        InputDoc: "false",
        Inputusrid: user.id,
        Inputrequestapprovalid: `${newapprovalid}`,
        Inputrequestid: `${newrequestid || requestId}`
      };

      console.log('[TL ExtendWarranty] Triggering BPM with payload:', request3);
      await this.requestService.callBPMForwarrantyexpiry(request3 as any);

      // 5. Send Email Notifications
      this.mailService.sendWarrantyRequestSubmissionNotification({
        employeeName: user.name,
        assetName: this.selectedAsset?.name || 'Asset',
        requestId: newrequestid || requestId,
        justification: formVal.justification
      });

      // 6. Update local memory queue/mock list
      const newReq = {
        id: newrequestid || requestId,
        requestNumber: newrequestid || requestId,
        requesterId: user.id,
        requesterName: user.name,
        requesterDepartment: user.department,
        requesterTeam: user.team,
        assetType: this.requestService.normalizeAssetType(this.selectedAsset.type, this.selectedAsset.name),
        category: this.selectedAsset.category,
        subCategory: this.selectedAsset.subCategory,
        justification: formVal.justification,
        urgency: RequestUrgency.MEDIUM,
        status: RequestStatus.PENDING,
        currentStage: ApprovalStage.ASSET_MANAGER,
        hasEmailApproval: false,
        requestDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        requestType: RequestType.EXTEND_WARRANTY,
        allocatedAssetId: this.selectedAsset.id,
        approvalChain: [
          { stage: ApprovalStage.TEAM_LEAD, action: 'Approved' as any },
          { stage: ApprovalStage.ASSET_MANAGER, action: 'Pending' as any },
          { stage: ApprovalStage.ALLOCATION, action: 'Pending' as any }
        ],
        comments: [{
          id: `C${Date.now()}`,
          userId: user.id,
          userName: user.name,
          comment: `Requesting warranty extension for: ${this.selectedAsset.assetTag} - ${this.selectedAsset.name}`,
          timestamp: new Date().toISOString()
        }]
      };

      this.requestService.addRequest(newReq as any);
      this.notificationService.showToast('Warranty extension request submitted successfully!', 'success');
      this.isLoading = false;
      this.router.navigate(['/team-lead/my-requests']);

    } catch (err: any) {
      console.error('[TL ExtendWarranty] Error during submit:', err);
      this.notificationService.showToast('Failed to submit warranty request. Please try again.', 'error');
      this.isLoading = false;
    }
  }

  getAssetsByUser(userId?: string): void {
    this.isLoading = true;
    this.hs.ajax('GetAssetsByUser', 'http://schemas.cordys.com/AMS_Database_Metadata',
      { userId: userId || '' }
    ).then((resp: any) => {
      const result = this.hs.xmltojson(resp, 'm_assets');
      const rawData = result ? (Array.isArray(result) ? result : [result]) : [];

      const mappedAssets = rawData.map((item: any) => ({
        id: item.asset_id || item.id || '',
        assetTag: item.serial_number || item.asset_tag || item.asset_id || '',
        name: item.asset_name || item.name || '',
        category: item.m_asset_subcategories?.name || item.m_asset_subcategories?.Name || item.category || item.asset_type || '',
        subCategory: item.m_asset_subcategories?.name || item.m_asset_subcategories?.Name || '',
        condition: item.condition || 'Good',
        status: item.status || 'Allocated',
        warrantyExpiry: item.warranty_expiry || item.warrantyExpiry || '',
        assignedTo: item.user_id || userId || '',
        serialNumber: item.serial_number || item.asset_tag || '',
        type: item.type_id || item.asset_type || item.type || ''
      } as any));

      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      this.eligibleAssets = mappedAssets.filter((a: any) => {
        if (!a.warrantyExpiry) return false;
        const expiry = new Date(a.warrantyExpiry);
        return expiry < oneYearFromNow;
      });

      this.isLoading = false;
    }).catch((err: any) => {
      console.error('[ExtendWarranty] Error fetching assets:', err);
      const user = this.authService.getCurrentUser();
      if (user) {
        const allMyAssets = this.assetService.getAssetsByUser(user.id);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        this.eligibleAssets = allMyAssets.filter(a => {
          if (!a.warrantyExpiry) return false;
          const expiry = new Date(a.warrantyExpiry);
          return expiry < oneYearFromNow;
        });
      }
      this.isLoading = false;
    });
  }
}

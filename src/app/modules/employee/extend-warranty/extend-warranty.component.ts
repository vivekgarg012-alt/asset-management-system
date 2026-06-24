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

@Component({
  selector: 'app-extend-warranty',
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
    private adminService: AdminDataService
  ) { }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.getAssetsByUser(user.id);
    }

    this.warrantyForm = this.fb.group({
      assetId: ['', Validators.required],
      justification: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  onAssetSelect(): void {
    const id = this.warrantyForm.get('assetId')?.value;
    this.selectedAsset = this.eligibleAssets.find(a => a.id === id);
  }

  onSubmit(): void {
    if (this.warrantyForm.invalid || !this.selectedAsset) return;

    const user = this.authService.getCurrentUser();
    if (!user) return;
    const formVal = this.warrantyForm.value;

    const newReq = {
      id: `REQ${Date.now()}`,
      requestNumber: this.requestService.generateRequestNumber(RequestType.EXTEND_WARRANTY),
      requesterId: user.id,
      requesterName: user.name,
      requesterDepartment: user.department,
      requesterTeam: user.team,
      assetType: this.selectedAsset.type,
      category: this.selectedAsset.category,
      subCategory: this.selectedAsset.subCategory,
      justification: formVal.justification,
      urgency: RequestUrgency.MEDIUM,
      status: RequestStatus.PENDING,
      currentStage: ApprovalStage.TEAM_LEAD,
      hasEmailApproval: false,
      requestDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      requestType: RequestType.EXTEND_WARRANTY,
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
        comment: `Requesting warranty extension for: ${this.selectedAsset.assetTag} - ${this.selectedAsset.name}`,
        timestamp: new Date().toISOString()
      }]
    };
    this.submitextendwarranty()
    this.requestService.addRequest(newReq as any);
    this.notificationService.showToast('Warranty extension request submitted successfully!', 'success');
    this.router.navigate(['/employee/my-requests']);
  }

  getAssetsByUser(userId?: string): void {
    this.isLoading = true;
    const uid = userId || this.authService.getCurrentUser()?.id || 'usr_009';

    this.hs.ajax('GetAllocatedAssetsByUserId', 'http://schemas.cordys.com/AMS_Database_Metadata', { userId: uid })
      .then((resp: any) => {
        const result = this.hs.xmltojson(resp, 'm_assets');
        const rawData = result ? (Array.isArray(result) ? result : [result]) : [];

        this.eligibleAssets = rawData.map((item: any) => ({
          id: item.asset_id || item.id || '',
          assetTag: item.serial_number || item.asset_tag || item.asset_id || '',
          name: item.asset_name || item.name || '',
          type: item.type_id || item.asset_type || item.type || '',
          vendor: item.m_asset_vendors?.name || item.m_asset_vendors?.Name || '',
          category: item.m_asset_subcategories?.name || item.m_asset_subcategories?.Name || item.category || item.asset_type || '',
          subCategory: item.m_asset_subcategories?.name || item.m_asset_subcategories?.Name || '',
          condition: item.condition || 'Good',
          status: item.status || 'Allocated',
          warrantyExpiry: item.warranty_expiry || item.warrantyExpiry || '',
          assignedTo: item.user_id || uid || '',
          serialNumber: item.serial_number || item.asset_tag || ''
        } as any));

        this.isLoading = false;
      }).catch((err: any) => {
        console.error('[ExtendWarranty] Error fetching allocated assets:', err);
        this.isLoading = false;
      });
  }

  async submitextendwarranty() {
    debugger
    if (this.warrantyForm.invalid) {
      this.warrantyForm.markAllAsTouched();
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.notificationService.showToast('You must be logged in to submit a request.', 'error');
      return;
    }

    this.isLoading = true;
    const formVal = this.warrantyForm.value;
    console.log("formval", formVal);
    const assignment = await this.adminService.getAssignmentByAssetType(this.selectedAsset?.type || '');
    const rs = assignment?.assetManagerId;

    if (!rs) {
      this.notificationService.showToast('No manager assigned for this asset type. Please contact administrator.', 'error');
      this.isLoading = false;
      return;
    }
    // var assetresp: any = await this.requestService.getAssetManagerByAssetTypeId(assetReq)
    // console.log(assetresp);
    // console.log("assetresp", assetresp[0].old.m_users.user_id)
    // var rs = assetresp[0].old.m_users.user_id
    const soapData = {
      tuple: {
        new: {
          t_extend_asset_requests: {
            user_id: user.id,
            asset_type: formVal.assetId,
            //   asset_id: asset_024,
            reason: formVal.justification,
            urgency: 'Medium',
            email_approval: 'false',
            document: '',
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

    console.log('[RequestAsset] Submitting to Cordys:', soapData);

    this.hs.ajax('UpdateT_extend_asset_requests', 'http://schemas.cordys.com/AMS_Database_Metadata', soapData)
      .then((resp: any) => {
        console.log('[RequestAsset] Insert response:', resp);

        const requestId =
          resp?.tuple?.new?.t_extend_asset_requests?.request_id ||
          resp?.tuple?.old?.t_extend_asset_requests?.request_id ||
          resp?.request_id;

        if (!requestId) {
          console.error('[RequestAsset] request_id not found in response');
          this.notificationService.showToast('Request saved but approval record could not be created.', 'error');
          this.isLoading = false;
          return;
        }

        const approvalData = {
          tuple: {
            new: {
              t_extend_request_approvals: {
                request_id: requestId,
                approver_id: `${rs}`,
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

        console.log('[RequestAsset] Calling 2nd API:', approvalData);

        // 🚀 Second API call
        return this.hs.ajax(
          'UpdateT_extend_request_approvals',
          'http://schemas.cordys.com/AMS_Database_Metadata',
          approvalData
        );
      })
      .then((approvalResp: any) => {
        if (!approvalResp) return; // in case first failed

        console.log('[RequestAsset] Approval insert response:', approvalResp);

        // Extract approval_id from the response
        const newapprovalid =
          approvalResp?.tuple?.new?.t_extend_request_approvals?.approval_id ||
          approvalResp?.tuple?.old?.t_extend_request_approvals?.approval_id ||
          approvalResp?.approval_id || '';

        // Extract request_id (carried from first API response via closure)
        const newrequestid =
          approvalResp?.tuple?.new?.t_extend_request_approvals?.request_id ||
          approvalResp?.tuple?.old?.t_extend_request_approvals?.request_id || '';

        console.log('[RequestAsset] Extracted approval_id:', newapprovalid, 'request_id:', newrequestid);

        // Call BPM for warranty expiry
        const request3 = {
          // InputDoc: "false",
          user_id: user.id,
          approval_id: `${newapprovalid}`,
          request_id: `${newrequestid}`
        };
        this.requestService.callBPMForwarrantyexpiry(request3 as any);

        this.notificationService.showToast('Request submitted successfully!', 'success');
        this.isLoading = false;
        this.router.navigate(['/team-lead/my-asset']);
      })
      .catch((err: any) => {
        console.error('[RequestAsset] Error:', err);

        this.notificationService.showToast(
          'Request submitted but approval record may have failed.',
          'error'
        );

        this.isLoading = false;
        this.router.navigate(['/team-lead/my-asset']);
      });
  }
}


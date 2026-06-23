import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AssetService } from '../../../core/services/asset.service';
import { RequestService } from '../../../core/services/request.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MailService } from '../../../core/services/mail.service';
import { Asset } from '../../../core/models/asset.model';
import { RequestType, RequestUrgency, RequestStatus, ApprovalStage } from '../../../core/models/request.model';
import { AdminDataService } from '../../../core/services/admin-data.service';

@Component({
  selector: 'app-return-asset',
  templateUrl: './return-asset.component.html',
  styleUrls: ['./return-asset.component.scss']
})
export class ReturnAssetComponent implements OnInit {
  returnForm!: FormGroup;
  myAssets: Asset[] = [];
  selectedAsset: Asset | undefined;

  constructor(
    private fb: FormBuilder,
    private assetService: AssetService,
    private requestService: RequestService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private mailService: MailService,
    private adminService: AdminDataService,
    private router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    // Initialize form immediately to prevent NG01052 Error
    this.returnForm = this.fb.group({
      assetId: ['', Validators.required],
      justification: ['', [Validators.required, Validators.minLength(5)]]
    });

    const user = this.authService.getCurrentUser();
    if (user) {
      this.myAssets = await this.assetService.getAssetsByUserSOAP(user.id);
    }
  }

  onAssetSelect(): void {
    const id = this.returnForm.get('assetId')?.value;
    this.selectedAsset = this.myAssets.find(a => a.id === id);
  }

  async onSubmit(): Promise<void> {
    // debugger;
    console.log('onSubmit triggered. Form valid?', this.returnForm.valid, 'Selected Asset:', this.selectedAsset);
    if (this.returnForm.invalid || !this.selectedAsset) {
      console.warn('Form is invalid or no asset selected!');
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) return;
    const formVal = this.returnForm.value;

    try {
      console.log('Preparing SOAP request for User ID:', user.id);
      const hasActiveReturn = await this.requestService.hasActiveReturnRequestForAsset(this.selectedAsset.id, user.id);
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
              temp1: this.selectedAsset.id
            }
          }
        }
      };

      var res3: any = await this.requestService.createEntryForReturn(request3 as any);

      const tReturns = res3?.old?.t_asset_returns || res3?.new?.t_asset_returns || res3?.t_asset_returns || {};
      const return_id = tReturns.return_id || tReturns.id || 'SYS_UNKNOWN';
      const assetManagerId = await this.requestService.resolveReturnApproverId(this.selectedAsset.id, 'rol_04');

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
      console.log("approvalreturnid", return_approval_id);
      let request5 = {
        user_id: user.id,
        return_approval_id: `${return_approval_id}`,
        returnid: `${return_id}`
      };
      console.log("request5", request5);
      await this.requestService.callBPMForReturn(request5 as any);

      // Send email notification to Asset Manager
      this.mailService.sendReturnRequestNotification({
        stage: 'submitted',
        returnId: return_id,
        employeeName: user.name,
        assetName: this.selectedAsset.name || this.selectedAsset.assetTag,
        remarks: formVal.justification,
        nextApproverName: 'Asset Manager'
      });

      const newReq = {
        id: `REQ${Date.now()}`,
        requestNumber: this.requestService.generateRequestNumber(RequestType.RETURN_ASSET),
        requesterId: user.id,
        requesterName: user.name,
        requesterDepartment: user.department,
        requesterTeam: user.team,
        assetType: this.selectedAsset.type,
        category: this.selectedAsset.category,
        subCategory: this.selectedAsset.subCategory,
        justification: formVal.justification,
        urgency: RequestUrgency.LOW,
        status: RequestStatus.PENDING,
        currentStage: ApprovalStage.TEAM_LEAD,
        hasEmailApproval: false,
        requestDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        requestType: RequestType.RETURN_ASSET,
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
          comment: `Returning asset: ${this.selectedAsset.assetTag} - ${this.selectedAsset.name}`,
          timestamp: new Date().toISOString()
        }]
      };

      this.requestService.addRequest(newReq as any);
      this.notificationService.showToast('Return request submitted successfully!', 'success');
      this.router.navigate(['/employee/my-requests']);
    } catch (err) {
      console.error(err);
      this.notificationService.showToast('Failed to submit return request', 'error');
    }
  }
}

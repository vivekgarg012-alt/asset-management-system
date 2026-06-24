import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Asset } from '../../../core/models/asset.model';
import { AssetService } from '../../../core/services/asset.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RequestService } from '../../../core/services/request.service';
import { MailService } from '../../../core/services/mail.service';

@Component({
  selector: 'app-service-asset',
  templateUrl: './service-asset.component.html',
  styleUrls: ['./service-asset.component.scss']
})
export class ServiceAssetComponent implements OnInit {
  serviceForm!: FormGroup;
  myAssets: Asset[] = [];
  selectedAsset: Asset | undefined;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private assetService: AssetService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private requestService: RequestService,
    private mailService: MailService,
    private router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    this.serviceForm = this.fb.group({
      assetId: ['', Validators.required],
      issueDescription: ['', [Validators.required, Validators.minLength(5)]],
      urgency: ['Medium', Validators.required],
      needsTempAsset: [false]
    });

    const user = this.authService.getCurrentUser();
    if (user) {
      this.myAssets = await this.assetService.getAssetsByUserSOAP(user.id);
    }
  }

  onAssetSelect(): void {
    const id = this.serviceForm.get('assetId')?.value;
    this.selectedAsset = this.myAssets.find(asset => asset.id === id);
  }

  async onSubmit(): Promise<void> {
    if (this.serviceForm.invalid || !this.selectedAsset || this.isSubmitting) {
      this.serviceForm.markAllAsTouched();
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.notificationService.showToast('You must be logged in to submit a service request.', 'error');
      return;
    }

    this.isSubmitting = true;
    const formVal = this.serviceForm.value;

    try {
      const hasActiveService = await this.requestService.hasActiveServiceRequestForAsset(this.selectedAsset.id, user.id);
      if (hasActiveService) {
        this.notificationService.showToast('A service request is already active for this asset.', 'warning');
        return;
      }

      const assetManagerId = await this.requestService.resolveServiceAssetManagerId(this.selectedAsset.id);
      const freshUser = await this.authService.getUserDetails(user.id).catch(() => null);
      const teamLeadId = user.managerId || user.teamLeadId || freshUser?.managerId || freshUser?.teamLeadId || '';

      // Build fields map - only include FK fields when they have valid values.
      // Using raw SOAP XML prevents Cordys BusObject from auto-generating
      // empty tags for FK columns (allocation_id, tl_id) which would violate
      // FK constraints (empty string != NULL in Postgres).
      const fields: Record<string, string> = {
        asset_id: this.selectedAsset.id,
        user_id: user.id,
        issue_description: formVal.issueDescription,
        urgency: formVal.urgency,
        needs_temp_asset: formVal.needsTempAsset ? 'true' : 'false',
        status: 'Pending',
        created_at: new Date().toISOString(),
        temp1: this.selectedAsset.name || '',
        temp2: this.selectedAsset.assetTag || this.selectedAsset.id || ''
      };

      // Only add FK fields when they have actual valid values
      if (teamLeadId) {
        fields['tl_id'] = teamLeadId;
      }

      const requestResp: any = await this.requestService.createServiceRequestRaw(fields);
      const serviceRequestRow = requestResp?.old?.t_service_requests
        || requestResp?.new?.t_service_requests
        || requestResp?.t_service_requests
        || (Array.isArray(requestResp) ? (requestResp[0]?.old?.t_service_requests || requestResp[0]?.t_service_requests || {}) : {});
      const serviceRequestId = serviceRequestRow?.service_request_id;

      if (!serviceRequestId) {
        throw new Error('Service request was saved, but service_request_id was not returned.');
      }

      const approvalPayload = {
        tuple: {
          new: {
            t_service_approvals: {
              service_request_id: serviceRequestId,
              approver_id: assetManagerId,
              role: 'Asset Manager',
              stage: 'STAGE_1_MANAGER',
              status: 'Pending',
              remarks: 'waiting for approval',
              action_date: new Date().toISOString(),
              temp1: this.selectedAsset.id,
              temp2: '',
              temp3: '',
              temp4: '',
              temp5: '',
              temp6: '',
              temp7: ''
            }
          }
        }
      };

      const approvalResp: any = await this.requestService.createEntryForServiceApproval(approvalPayload);
      const approvalRow = approvalResp?.old?.t_service_approvals
        || approvalResp?.new?.t_service_approvals
        || approvalResp?.t_service_approvals
        || {};
      const approvalId = approvalRow.approval_id;

      if (!approvalId) {
        throw new Error('Service approval was saved, but approval_id was not returned.');
      }

      await this.requestService.callBPMForService({
        user_id: user.id,
        service_request_id: serviceRequestId,
        approval_id: approvalId
      });

      const [teamLead, assetManager] = await Promise.all([
        teamLeadId ? this.authService.getUserDetails(teamLeadId).catch(() => null) : Promise.resolve(null),
        assetManagerId ? this.authService.getUserDetails(assetManagerId).catch(() => null) : Promise.resolve(null)
      ]);

      await this.mailService.sendServiceRequestNotification({
        stage: 'submitted',
        serviceRequestId,
        employeeName: user.name,
        employeeEmail: user.email,
        teamLeadName: teamLead?.name || user.teamLeadName || freshUser?.teamLeadName || 'Team Lead',
        teamLeadEmail: teamLead?.email,
        assetManagerName: assetManager?.name || 'Asset Manager',
        assetManagerEmail: assetManager?.email,
        assetName: this.selectedAsset.name,
        assetTag: this.selectedAsset.assetTag,
        issueDescription: formVal.issueDescription,
        urgency: formVal.urgency
      });

      this.notificationService.showToast('Service request submitted successfully!', 'success');
      this.router.navigate(['/employee/my-requests']);
    } catch (err) {
      console.error('[ServiceAsset] Failed to submit service request:', err);
      this.notificationService.showToast('Failed to submit service request', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }
}

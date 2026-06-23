import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AssetService } from '../../../core/services/asset.service';
import { RequestService } from '../../../core/services/request.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MailService } from '../../../core/services/mail.service';
import { AssetType, AssetCategory } from '../../../core/models/asset.model';
import { AdminDataService } from '../../../core/services/admin-data.service';

import { RequestType, RequestUrgency, RequestStatus, ApprovalStage } from '../../../core/models/request.model';

@Component({
  selector: 'app-request-asset',
  templateUrl: './request-asset.component.html',
  styleUrls: ['./request-asset.component.scss']
})
export class RequestAssetComponent implements OnInit {
  requestForm!: FormGroup;
  isSubmitting = false;

  // Master data from Cordys
  masterAssetTypes: any[] = [];
  masterSubCategories: any[] = [];

  // Currently filtered lists for dropdowns
  availableTypes: any[] = [];
  availableSubCategories: any[] = [];
  
  // File upload state
  selectedFileBase64: string | null = null;
  selectedFileName: string | null = null;
  
  // urgencies removed

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
    this.requestForm = this.fb.group({
      assetType: ['', Validators.required],
      subCategory: ['', Validators.required],
      urgency: ['Medium', Validators.required],
      justification: ['', [Validators.required, Validators.minLength(5)]],
      hasEmailApproval: [false]
    });

    await this.loadMasterData();
  }

  async loadMasterData(): Promise<void> {
    try {
      console.log('[RequestAsset Debug] Starting master data load...');
      // 0. Populate User Cache for approver resolution
      await this.adminService.GetAllUserRoleProjectDetails();

      const [types, subCats] = await Promise.all([
        this.assetService.getAllAssetTypesCordys(),
        this.assetService.getAllSubcategoriesCordys()
      ]);

      this.masterAssetTypes = types || [];
      this.masterSubCategories = subCats || [];

      // FINAL FAIL-SAFE: If Cordys returns nothing, populate with basic defaults so the UX doesn't break
      if (this.masterAssetTypes.length === 0) {
        console.warn('[RequestAsset Debug] Cordys returned 0 types. Using hardcoded defaults.');
        this.masterAssetTypes = [
          { type_id: 'typ_01', type_name: 'Software' },
          { type_id: 'typ_02', type_name: 'Hardware' }
        ];
      }

      if (this.masterSubCategories.length === 0) {
        console.warn('[RequestAsset Debug] Cordys returned 0 sub-categories. Using hardcoded defaults.');
        this.masterSubCategories = [
          { sub_category_id: 'cat_001', name: 'Laptop', type_id: 'typ_02' },
          { sub_category_id: 'cat_002', name: 'Software License', type_id: 'typ_01' },
          { sub_category_id: 'cat_003', name: 'Monitor', type_id: 'typ_02' },
          { sub_category_id: 'cat_004', name: 'Hardware Accessory', type_id: 'typ_02' }
        ];
      }

      this.availableTypes = this.masterAssetTypes;
    } catch (error) {
      console.error('CRITICAL: Failed to load master data for request form:', error);
    }
  }

  onTypeChange(): void {
    const selectedType = this.requestForm.get('assetType')?.value;
    console.log('[RequestAsset Debug] Type changed to (Selected ID):', selectedType);

    // Reset following dropdowns
    this.requestForm.patchValue({ subCategory: '' });

    // Filter sub-categories DIRECTLY based on Asset Type
    this.availableSubCategories = this.masterSubCategories.filter(sub =>
      String(sub.type_id) === String(selectedType)
    );

    // Fallback: If no subcategories found for type, show all to avoid empty dropdown
    if (this.availableSubCategories.length === 0 && this.masterSubCategories.length > 0) {
      this.availableSubCategories = this.masterSubCategories;
    }

    console.log('[RequestAsset Debug] Filtered Sub-categories:', this.availableSubCategories);
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

      // Limit file size to 5 MB to avoid SOAP gateway payload limits
      const MAX_SIZE_BYTES = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE_BYTES) {
        this.notificationService.showToast(
          `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 5 MB.`,
          'error'
        );
        this.selectedFileBase64 = null;
        this.selectedFileName = null;
        // Reset the file input so the user can re-select
        event.target.value = '';
        return;
      }
      this.selectedFileName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        // Includes the data URI scheme e.g. "data:image/jpeg;base64,..."
        this.selectedFileBase64 = reader.result as string; 
      };
      reader.readAsDataURL(file);
    } else {
      this.selectedFileBase64 = null;
      this.selectedFileName = null;
    }
  }

  async onSubmit(): Promise<void> {
    console.log('[onSubmit] Called. Form valid:', this.requestForm.valid);
    console.log('[onSubmit] Form values:', this.requestForm.value);
    console.log('[onSubmit] Form errors:', {
      assetType: this.requestForm.get('assetType')?.errors,
      subCategory: this.requestForm.get('subCategory')?.errors,
      justification: this.requestForm.get('justification')?.errors,
    });
    if (this.requestForm.invalid) {
      console.warn('[onSubmit] Form is invalid — submission blocked.');
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.notificationService.showToast('You must be logged in to submit a request.', 'error');
      return;
    }

    const formVal = this.requestForm.value;
    
    // Validate file upload if email approval is checked
    if (formVal.hasEmailApproval && !this.selectedFileBase64) {
      this.notificationService.showToast('Please upload the email approval document.', 'error');
      return;
    }

    const isDeptHead = user.role === 'Team Lead';
    const selectedTypeObj = this.masterAssetTypes.find(t => String(t.type_id) === String(formVal.assetType));
    const typeName = selectedTypeObj ? selectedTypeObj.type_name : 'Hardware';

    const selectedSubCatObj = this.masterSubCategories.find(s => String(s.sub_category_id) === String(formVal.subCategory));
    const subCatName = selectedSubCatObj ? selectedSubCatObj.name : formVal.subCategory;

    let dbFileName = this.selectedFileName || '';
    if (dbFileName.length > 50) {
      const extIdx = dbFileName.lastIndexOf('.');
      const ext = extIdx >= 0 ? dbFileName.substring(extIdx) : '';
      dbFileName = dbFileName.substring(0, 50 - ext.length) + ext;
    }

    try {
      // 1. Submit Request
      const request1 = {
        tuple: {
          new: {
            t_asset_requests: {
              user_id: user.id,
              asset_type: typeName,
              reason: formVal.justification,
              urgency: formVal.urgency,
              email_approval: String(formVal.hasEmailApproval),
              status: 'Pending',
              temp1: subCatName,
              temp2: dbFileName,
              document: dbFileName
            }
          }
        }
      };

      console.log('[RequestAsset] REQ1:', request1);
      const res = await this.requestService.submitNewRequestForm(request1 as any);
      const newrequestid = res.new?.t_asset_requests?.request_id;
      if (!newrequestid) throw new Error('Failed to retrieve request ID');

      // 2. Handle File Upload
      if (this.selectedFileBase64) {
        try {
          const serverPath = await this.requestService.uploadFileToServer(this.selectedFileName!, this.selectedFileBase64);
          if (serverPath) {
            await this.requestService.updateRequestDocumentPath(newrequestid, serverPath);
          }
        } catch (uploadErr) {
          console.error('[RequestAsset] Upload failed:', uploadErr);
        }
      }

      // 3. Resolve Approvers & Create Approval Entry
      const approverDetails = await this.resolveApproverDetails(typeName);
      const teamLeadId = approverDetails['Team Lead']?.id || 'usr_001';
      const assetManagerId = approverDetails['Asset Manager']?.id || 'usr_001';

      const request2 = {
        tuple: {
          new: {
            t_request_approvals: {
              request_id: `${newrequestid}`,
              approver_id: formVal.hasEmailApproval ? assetManagerId : teamLeadId,
              role: formVal.hasEmailApproval ? 'Asset Manager' : 'Team Lead',
              status: 'Pending'
            }
          }
        }
      };

      const res2 = await this.requestService.createEntryForTeamLead(request2 as any);
      const newapprovalid = res2.new?.t_request_approvals?.approval_id;

      // 4. Trigger BPM Workflow
      const request3 = {
        InputDoc: formVal.hasEmailApproval.toString(),
        Inputusrid: user.id,
        Inputrequestapprovalid: `${newapprovalid}`,
        Inputrequestid: `${newrequestid}`
      };
      await this.requestService.callBPMForRequest(request3 as any);

      // 5. Finalize
      await this.mailService.sendAssetRequestConfirmation({
        employeeName: user.name,
        employeeEmail: user.email,
        assetType: typeName,
        category: subCatName,
        requestId: `${newrequestid}`,
        justification: formVal.justification,
        urgency: formVal.urgency,
        teamLeadName: user.teamLeadName
      });

      this.notificationService.showToast('Request Raised Successfully!', 'success');
      this.router.navigate(['/employee/my-requests']);
    } catch (error: any) {
      console.error('[RequestAsset] Submission failed:', error);
      this.notificationService.showToast('Failed to submit request.', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  private async resolveApproverDetails(assetType: string): Promise<Record<string, { name: string, id: string }>> {
    const details: Record<string, { name: string, id: string }> = {};
    let user = this.authService.getCurrentUser();

    try {
      if (user && !user.projectId) {
        const freshUser = await this.authService.getUserDetails(user.id);
        if (freshUser) user = freshUser;
      }

      // 1. Team Lead
      if (user?.projectId && user.projectId !== 'null') {
        const project = await this.adminService.getProjectById(user.projectId);
        if (project?.teamLead) {
          details['Team Lead'] = {
            name: project.teamLead,
            id: project.teamLeadId || this.adminService.findUserIdByName(project.teamLead) || 'usr_001'
          };
        }
      }

      // 2. Asset Manager
      if (assetType) {
        const assignment = await this.adminService.getAssignmentByAssetType(assetType);
        if (assignment) {
          details['Asset Manager'] = {
            name: assignment.assetManager,
            id: assignment.assetManagerId || this.adminService.findUserIdByName(assignment.assetManager) || 'usr_001'
          };
        }
      }
    } catch (err) {
      console.error('Failed to resolve approver details:', err);
    }
    return details;
  }
  
}

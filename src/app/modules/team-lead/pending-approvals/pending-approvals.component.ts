import { Component, OnInit } from '@angular/core';
import { AssetRequest, ApprovalStage } from '../../../core/models/request.model';
import { HeroService } from '../../../core/services/hero.service';
import { RequestService } from '../../../core/services/request.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MailService } from '../../../core/services/mail.service';
import { AdminDataService } from '../../../core/services/admin-data.service';


@Component({
  selector: 'app-pending-approvals',
  templateUrl: './pending-approvals.component.html',
  styleUrls: ['./pending-approvals.component.scss']
})
export class PendingApprovalsComponent implements OnInit {
  pendingRequests: AssetRequest[] = [];
  selectedRequest: AssetRequest | null = null;
  user: any;
  userDetails: any;
  isLoading = false;
  trackingSteps: any[] = [];
  overallProgress = 0;
  loadingProgress = false;

  // Pagination & Filtering
  currentPage = 1;
  pageSize = 5;
  searchTerm = '';
  tl_remarks = '';
  task_id_latest = '';

  constructor(
    private hs: HeroService,
    private requestService: RequestService,
    private notificationService: NotificationService,
    private mailService: MailService,
    private adminService: AdminDataService,
  ) { }


  ngOnInit(): void {
    this.getuser();
  }

  getuser() {
    this.isLoading = true;
    this.hs.ajax('GetUserDetails', 'http://schemas.cordys.com/UserManagement/1.0/User', {}
    ).then((resp: any) => {
      this.user = this.hs.xmltojson(resp, "User");
      this.getuserdetails();
    }).catch(err => {
      console.error("Error fetching user details in getuser:", err);
      this.isLoading = false;
    });
  }

  getuserdetails() {
    const targetUsername = this.user?.UserName || this.user?.username || '';

    this.hs.ajax('Getuserbyusername', 'http://schemas.cordys.com/AMS_Database_Metadata',
      { username: targetUsername }
    ).then((resp: any) => {
      this.userDetails = this.hs.xmltojson(resp, "m_users");
      this.getallrequests();
    }).catch(err => {
      console.error("Error fetching detailed user info in getuserdetails:", err);
      this.isLoading = false;
    });
  }

  getallrequests() {
    this.isLoading = true;
   
    this.hs.ajax('GetRequestsForTeamLead', 'http://schemas.cordys.com/AMS_Database_Metadata',
      {}
    ).then((resp: any) => {
      const result = this.hs.xmltojson(resp, "tuple") || this.hs.xmltojson(resp, "t_request_approvals");
      const rawData = result ? (Array.isArray(result) ? result : [result]) : [];

      const mappedRequests = rawData.map((item: any) => {
        const parent = item.old || item;
        const request = this.requestService.mapTupleToRequest(item);
        console.log("item", parent);

        const approvalItem = parent.t_request_approvals;
        const reqItem = approvalItem.t_asset_requests;

        return {
          ...request,
          id: reqItem.request_id || approvalItem.request_id || parent.request_id || request.id,
          requestNumber: reqItem.request_id || approvalItem.request_id || parent.request_id || request.requestNumber,
          requesterName: approvalItem.m_users?.name,
          assetType: reqItem.asset_type || request.assetType,
          category: reqItem.temp1 || request.category,
          urgency: reqItem.urgency || request.urgency,
          requestDate: reqItem.created_at || request.requestDate,
          justification: approvalItem.t_asset_requests.reason || '',
          reqStatus: reqItem.status || request.reqStatus,
          status: approvalItem.status || request.status,
          approverId: approvalItem.approver_id || '',
          role: approvalItem.role || ''
        };
      });

      // Sort mapped requests by newest date first
      const sortedByDate = mappedRequests.sort((a: any, b: any) => {
        const dateA = new Date(a.requestDate || 0).getTime();
        const dateB = new Date(b.requestDate || 0).getTime();
        return dateB - dateA;
      });

      const uniqueRequestsMap = new Map<string, any>();
      // Since sortedByDate is newest first, the first occurrence for each requestNumber is the latest version.
      sortedByDate.forEach(req => {
        const key = req.requestNumber || req.id;
        if (!uniqueRequestsMap.has(key)) {
          uniqueRequestsMap.set(key, req);
        }
      });

      // Populate pendingRequests after deduplication
      this.pendingRequests = Array.from(uniqueRequestsMap.values()).sort((a: any, b: any) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
      this.isLoading = false;


    }).catch(err => {
      console.error("Error fetching request history:", err);
      this.isLoading = false;
    });
  }

  // Helper method for cleanly mapping asset type
  private getAssetType(reqItem: any, assetTypeInfo: any): string {
    const type = assetTypeInfo.type_name || reqItem.asset_type || '';
    if (type.toLowerCase() === 'typ_01') return 'Software';
    if (type.toLowerCase() === 'typ_02') return 'Hardware';
    return type;
  }



  get filteredRequests(): AssetRequest[] {
    if (!this.searchTerm.trim()) return this.pendingRequests;
    const term = this.searchTerm.toLowerCase();
    return this.pendingRequests.filter(req =>
      req.requestNumber.toLowerCase().includes(term) ||
      req.requesterName.toLowerCase().includes(term) ||
      req.category.toLowerCase().includes(term) ||
      req.assetType.toLowerCase().includes(term) ||
      req.status.toLowerCase().includes(term)
    );
  }

  get paginatedRequests(): AssetRequest[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRequests.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredRequests.length / this.pageSize) || 1;
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.selectedRequest = null;
    }
  }

  selectRequest(req: AssetRequest): void {
    this.selectedRequest = req;
    this.tl_remarks = '';
    this.fetchApprovalProgress(req.id);
  }

  private getStagesForRequest(request: AssetRequest): Array<{ name: string, roles: string[] }> {
    const isSkippedTl = request.hasEmailApproval ||
      request.requesterId === this.userDetails?.user_id ||
      request.requesterRole?.toLowerCase().includes('lead') ||
      request.requesterRole?.toLowerCase().includes('manager') ||
      request.requesterRoleName?.toLowerCase().includes('lead') ||
      request.requesterRoleName?.toLowerCase().includes('manager') ||
      request.requesterRoleName?.toLowerCase().includes('admin') ||
      ['rol_01', 'rol_02', 'rol_04', 'rol_05'].includes(request.requesterRole || '');

    const stages = [
      { name: 'Team Lead Approval', roles: ['team lead', 'approver'] },
      { name: 'Asset Manager Approval', roles: ['asset manager', 'mgr'] },
      { name: 'Asset Allocation Team', roles: ['asset allocation', 'allocation', 'team'] }
    ];

    return isSkippedTl ? stages.slice(1) : stages;
  }

  async fetchApprovalProgress(requestId: string) {
    if (!this.selectedRequest) return;
    this.loadingProgress = true;
    this.trackingSteps = [];

    try {
      const progressData = await this.requestService.getRequestProgress(requestId);
      const stages = this.getStagesForRequest(this.selectedRequest);

      let availableProgress = [...progressData].sort((a: any, b: any) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const approverDetails = await this.resolveApproverDetails(this.selectedRequest);
      const resolvedNames: Record<string, string> = {};
      Object.keys(approverDetails).forEach(role => resolvedNames[role] = approverDetails[role].name);

      this.trackingSteps = stages.map((stage, index) => {
        let foundIndex = -1;
        for (let i = availableProgress.length - 1; i >= 0; i--) {
          const p = availableProgress[i];
          if (stage.roles.some(role => p.stage?.toLowerCase().includes(role))) {
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
          isCompleted = data.status === 'Approved' || data.status === 'Completed';
          isCurrent = data.status === 'Pending';
        }

        const dbName = data?.approverName?.trim();
        const genericPlaceholders = ['approver', 'assigned approver', 'pending', 'to be assigned', '', 'assignedapprover'];
        const isPlaceholder = (val: string | undefined) => !val || genericPlaceholders.includes(val.toLowerCase().trim());

        const roleKey = stage.name === 'Team Lead Approval' ? 'Team Lead' :
          stage.name === 'Asset Manager Approval' ? 'Asset Manager' :
            'Asset Allocation Team';

        let resolvedName = !isPlaceholder(dbName) ? dbName : resolvedNames[roleKey];

        return {
          name: resolvedName || (isCompleted ? 'System Approved' : 'To be Assigned'),
          roleName: stage.name,
          status: data ? data.status : (isCompleted ? 'Approved' : 'Pending'),
          timestamp: data?.timestamp,
          isCompleted: isCompleted,
          isCurrent: isCurrent,
          comments: data?.comments || data?.remarks
        };
      });

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

      this.overallProgress = this.calculateOverallProgress(this.selectedRequest);
    } catch (err) {
      console.error('[History] Failed to fetch progress:', err);
    } finally {
      this.loadingProgress = false;
    }
  }

  private async resolveApproverDetails(request: AssetRequest): Promise<Record<string, { name: string, id: string }>> {
    const details: Record<string, { name: string, id: string }> = {};
    try {
      details['Team Lead'] = {
        name: this.userDetails?.name || 'Team Lead',
        id: this.userDetails?.user_id || ''
      };

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

  calculateOverallProgress(request: AssetRequest): number {
    const status = (request.status || '').toLowerCase();
    if (status === 'completed' || status === 'approved' || status === 'rejected') return 100;

    const completedCount = this.trackingSteps.filter(s => s.isCompleted || s.status?.toLowerCase() === 'rejected').length;
    const totalSteps = this.trackingSteps.length;

    if (totalSteps === 0) return 10;
    const progress = Math.round((completedCount / totalSteps) * 100);
    return Math.min(Math.max(progress, 10), 95);
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

  cancelSelection(): void {
    this.selectedRequest = null;
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
        console.log("[PendingApprovals] Latest Task ID fetched:", this.task_id_latest);
      }
    } catch (err) {
      console.error("[PendingApprovals] Error fetching latest task ID:", err);
    }
  }
  assetmanagerid: any;
  markAsAccept(): void {
    if (this.selectedRequest) {

      this.handleApprove(this.selectedRequest.assetType);
    }
  }

  markAsReject(): void {
    if (this.selectedRequest) {
      this.handleReject();
    }
  }
  async handleApprove(assettype: any) {
    console.log(this.selectedRequest);
    if (!this.selectedRequest?.approvalId) {
      this.notificationService.showToast("No approval record found for this request", "error");
      return;
    }


    try {
      this.isLoading = true;
      var req1 = {
        tuple: {
          old: {
            "t_request_approvals": {
              approval_id: this.selectedRequest.approvalId
            }
          },
          new: {
            "t_request_approvals": {
              status: "Approved",
              remarks: this.tl_remarks || 'Approved by Team Lead'
            }
          }
        }
      };

      var res2 = await this.requestService.updateEntryForTeamLead(req1 as any);
      var newrequestid = this.selectedRequest.requestNumber;
      console.log("Taskid response is", res2);

      // Fetch latest task ID dynamically to ensure we have it for completion
      await this.Getassetidbyapprovalid(newrequestid);
      const taskid = this.task_id_latest || this.selectedRequest?.taskid;
      const assignment = await this.adminService.getAssignmentByAssetType(assettype);
      console.log("taskid to complete", taskid);

      if (assignment) {
        this.assetmanagerid = assignment.assetManagerId;
      }

      var request2 = {
        tuple: {
          new: {
            t_request_approvals: {
              request_id: `${newrequestid}`,
              approver_id: this.assetmanagerid,
              role: 'Asset Manager',
              status: 'Pending'
            }
          }
        }
      };

      var res3 = await this.requestService.updateEntryForTeamLead(request2 as any);
      console.log("res3", res3);

      var req3 = {
        TaskId: `${taskid}`,
        Action: 'COMPLETE'
      };

      await this.requestService.completeUserTask(req3 as any);

      // Trigger status update email
      this.mailService.sendAssetRequestStatusUpdate({
        requestId: this.selectedRequest.requestNumber,
        employeeName: this.selectedRequest.requesterName,
        employeeEmail: (this.selectedRequest as any).requesterEmail,
        status: 'Approved',
        teamLeadName: this.userDetails.name,
        remarks: this.tl_remarks || 'Approved by Team Lead',
        assetType: this.selectedRequest.assetType
      });

      this.notificationService.showToast(`Request ${this.selectedRequest.requestNumber} Approved successfully`, 'success');


      this.selectedRequest = null;
      this.tl_remarks = '';
      this.getallrequests();
    } catch (error) {
      console.error("Approval error:", error);
      this.notificationService.showToast("Failed to approve request. Please try again.", "error");
      this.isLoading = false;
    }

  }

  async handleReject() {
    if (!this.selectedRequest?.approvalId) {
      this.notificationService.showToast("No approval record found for this request", "error");
      return;
    }


    if (!this.tl_remarks || !this.tl_remarks.trim()) {
      this.notificationService.showToast("Please enter remarks before rejecting.", "warning");
      return;
    }


    try {
      this.isLoading = true;
      var req1 = {
        tuple: {
          old: {
            "t_request_approvals": {
              approval_id: this.selectedRequest.approvalId,
            }
          },
          new: {
            "t_request_approvals": {
              status: "Rejected",
              remarks: this.tl_remarks
            }
          }
        }
      };

      var req4 = {
        tuple: {
          new: {
            "t_request_approvals": {
              request_id: this.selectedRequest.requestNumber,
              approver_id: this.selectedRequest.requesterId,
              role: "Employee",
              status: "Pending"
            }
          }
        }
      };

      await this.requestService.updateEntryForTeamLead(req1 as any);
      await this.requestService.updateEntryForTeamLead(req4 as any);

      // Update the master asset request status to Rejected
      var req2 = {
        tuple: {
          old: {
            "t_asset_requests": {
              request_id: this.selectedRequest.requestNumber
            }
          },
          new: {
            "t_asset_requests": {
              status: "Rejected"
            }
          }
        }
      };
      await this.requestService.submitNewRequestForm(req2 as any);

      // Fetch latest task ID dynamically to ensure we have it for completion
      await this.Getassetidbyapprovalid(this.selectedRequest.requestNumber);
      const taskid = this.task_id_latest || this.selectedRequest?.taskid;
      console.log("taskid to complete", taskid);

      if (taskid) {
        var req3 = {
          TaskId: `${taskid}`,
          Action: 'COMPLETE'
        };
        await this.requestService.completeUserTask(req3 as any);
      }

      this.notificationService.showToast(`Request ${this.selectedRequest.requestNumber} Rejected successfully`, 'success');

      // Trigger status update email
      this.mailService.sendAssetRequestStatusUpdate({
        requestId: this.selectedRequest.requestNumber,
        employeeName: this.selectedRequest.requesterName,
        employeeEmail: (this.selectedRequest as any).requesterEmail,
        status: 'Rejected',
        teamLeadName: this.userDetails.name,
        remarks: this.tl_remarks,
        assetType: this.selectedRequest.assetType
      });


      this.selectedRequest = null;
      this.tl_remarks = '';
      this.getallrequests();
    } catch (error) {
      console.error("Rejection error:", error);
      this.notificationService.showToast("Failed to reject request. Please try again.", "error");
      this.isLoading = false;
    }

  }

  onSearch(event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.currentPage = 1;
  }

  viewDocument(docName: string): void {
    if (!docName) return;

    if (docName.startsWith('data:')) {
      const newTab = window.open();
      if (newTab) {
        newTab.document.write(`<iframe src="${docName}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
      return;
    }

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

    this.fetchAndOpenFile(docName, 'download');
  }

  private async fetchAndOpenFile(serverPath: string, action: 'view' | 'download'): Promise<void> {
    const displayName = this.extractFileName(serverPath);
    this.notificationService.showToast(`Fetching: ${displayName}...`, 'info');

    try {
      const parts = serverPath.split(/[\\\/]/);
      const fileName = parts.pop() || '';
      const dirPath = parts.join('\\');

      if (!fileName || !dirPath) {
        this.notificationService.showToast('Invalid file path.', 'error');
        return;
      }

      const base64Content = await this.requestService.downloadFileFromServer(fileName, dirPath);

      if (!base64Content || base64Content.length < 10) {
        this.notificationService.showToast('File content is empty or could not be retrieved.', 'error');
        return;
      }

      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const mimeMap: { [key: string]: string } = {
        'pdf': 'application/pdf', 'png': 'image/png',
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';

      const byteChars = atob(base64Content);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      if (action === 'view') {
        window.open(blobUrl, '_blank');
        this.notificationService.showToast(`Opened: ${displayName}`, 'success');
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = displayName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.notificationService.showToast(`Downloaded: ${displayName}`, 'success');
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err: any) {
      console.error('[PendingApprovals] File fetch failed:', err);
      this.notificationService.showToast(`Failed to fetch file: ${err?.message || 'Unknown error'}`, 'error');
    }
  }

  extractFileName(path: string): string {
    if (!path) return 'attachment';
    const parts = path.split(/[\\\/]/);
    return parts[parts.length - 1] || 'attachment';
  }

}

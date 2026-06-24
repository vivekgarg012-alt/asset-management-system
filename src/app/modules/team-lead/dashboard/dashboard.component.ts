import { Component, OnInit } from '@angular/core';
import { UserService } from '../../../core/services/user.service';
import { AssetService } from '../../../core/services/asset.service';
import { RequestService } from '../../../core/services/request.service';
import { AuthService } from '../../../core/services/auth.service';
import { AssetRequest, ApprovalStage } from '../../../core/models/request.model';
import { HeroService } from '../../../core/services/hero.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MailService } from '../../../core/services/mail.service';
import { AdminDataService } from '../../../core/services/admin-data.service';


@Component({
  selector: 'app-lead-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class LeadDashboardComponent implements OnInit {
  teamSize = 0;
  teamAssets = 0;
  pendingApprovalsCount = 0;
  teamRequests: AssetRequest[] = [];
  selectedRequest: AssetRequest | null = null;

  // Pagination & Filtering
  currentPage = 1;
  pageSize = 5;
  searchTerm = '';
  data: any = { table: [] };
  user: any;
  userDetails: any;
  isLoading = false;
  teamMembers: any[] = [];
  showTeamModal = false;
  trackingSteps: any[] = [];
  overallProgress = 0;
  loadingProgress = false;
  tl_remarks = '';
  task_id_latest = '';
  assetmanagerid: any;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private assetService: AssetService,
    private hs: HeroService,
    private requestService: RequestService,
    private notificationService: NotificationService,
    private mailService: MailService,
    private adminService: AdminDataService
  ) { }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const activeTeam = user.team || 'General';

    // Maintain existing logic for assets as requested (Assets are still local for now)
    this.teamAssets = this.assetService.getAssetsByTeam(activeTeam).length;

    this.getuser();
  }

  get filteredRequests(): AssetRequest[] {
    if (!this.searchTerm.trim()) return this.teamRequests;
    const term = this.searchTerm.toLowerCase();
    return this.teamRequests.filter(req =>
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

  getuser() {
    this.isLoading = true;
    this.hs.ajax('GetUserDetails', 'http://schemas.cordys.com/UserManagement/1.0/User', {}
    ).then((resp: any) => {
      this.user = this.hs.xmltojson(resp, "User");
      this.getuserdetails();
    }).catch(err => {
      console.error("Error fetching user details in getuser:", err);
    });
  }
  getuserdetails() {
    // Ensuring we have a valid username from the first API call
    const targetUsername = this.user?.UserName || this.user?.username || '';

    this.hs.ajax('Getuserbyusername', 'http://schemas.cordys.com/AMS_Database_Metadata',
      { username: targetUsername } // Capitalized 'Username' is the standard for Cordys DB operations
    ).then((resp: any) => {
      this.userDetails = this.hs.xmltojson(resp, "m_users");
      this.getusercount(); // Fetch live team size once project ID is known
      this.getpendingcount(); // Fetch accurate pending approvals count
      this.getallrequests();
    }).catch(err => {
      console.error("Error fetching detailed user info in getuserdetails:", err);
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.selectedRequest = null; // Clear selection on page change
    }
  }

  selectRequest(req: AssetRequest): void {
    this.selectedRequest = req;
    this.fetchApprovalProgress(req.id);
  }

  private getStagesForRequest(request: AssetRequest): Array<{ name: string, roles: string[] }> {
    const type = request.requestType;
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

      // Filter out stale records from previous approval cycles (resubmit condition)
      // If there are records after a 'Rejected' status, a resubmit happened.
      let lastRejectedIndex = -1;
      for (let i = 0; i < availableProgress.length; i++) {
        if (availableProgress[i].status?.toLowerCase() === 'rejected') {
          lastRejectedIndex = i;
        }
      }
      if (lastRejectedIndex !== -1 && lastRejectedIndex < availableProgress.length - 1) {
        availableProgress = availableProgress.slice(lastRejectedIndex + 1);
      }

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

        // Map internal stage name to human friendly role for resolution
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
      console.error('[Dashboard] Failed to fetch progress:', err);
    } finally {
      this.loadingProgress = false;
    }
  }

  private async resolveApproverDetails(request: AssetRequest): Promise<Record<string, { name: string, id: string }>> {
    const details: Record<string, { name: string, id: string }> = {};
    try {
      // 1. Resolve Team Lead (Me if not self-request)
      details['Team Lead'] = {
        name: this.userDetails?.name || 'Team Lead',
        id: this.userDetails?.user_id || ''
      };

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

      await this.requestService.updateEntryForTeamLead(req1 as any);
      var newrequestid = this.selectedRequest.requestNumber;

      await this.Getassetidbyapprovalid(newrequestid);
      const taskid = this.task_id_latest || this.selectedRequest?.taskid;
      const assignment = await this.adminService.getAssignmentByAssetType(assettype);

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

      await this.requestService.updateEntryForTeamLead(request2 as any);

      var req3 = {
        TaskId: `${taskid}`,
        Action: 'COMPLETE'
      };

      await this.requestService.completeUserTask(req3 as any);

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

      await this.Getassetidbyapprovalid(this.selectedRequest.requestNumber);
      const taskid = this.task_id_latest || this.selectedRequest?.taskid;

      if (taskid) {
        var req3 = {
          TaskId: `${taskid}`,
          Action: 'COMPLETE'
        };
        await this.requestService.completeUserTask(req3 as any);
      }

      this.notificationService.showToast(`Request ${this.selectedRequest.requestNumber} Rejected successfully`, 'success');

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
      }
    } catch (err) {
      console.error("Error fetching latest task ID:", err);
    }
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
    try {
      const parts = serverPath.split(/[\\\/]/);
      const fileName = parts.pop() || '';
      const dirPath = parts.join('\\');
      const base64Content = await this.requestService.downloadFileFromServer(fileName, dirPath);
      if (!base64Content || base64Content.length < 10) return;
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const mimeMap: { [key: string]: string } = {
        'pdf': 'application/pdf', 'png': 'image/png',
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      const byteChars = atob(base64Content);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      if (action === 'view') {
        window.open(blobUrl, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = displayName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      console.error('File fetch failed:', err);
    }
  }

  extractFileName(path: string): string {
    if (!path) return 'attachment';
    const parts = path.split(/[\\\/]/);
    return parts[parts.length - 1] || 'attachment';
  }

  onSearch(event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.currentPage = 1;
  }
  getallrequests() {
    this.isLoading = true;
    this.hs.ajax('GetallpendingrequestsForParticularTeamLead', 'http://schemas.cordys.com/AMS_Database_Metadata',
      { Approver_id: this.userDetails.user_id }
    ).then((resp: any) => {
      const result = this.hs.xmltojson(resp, "tuple") || this.hs.xmltojson(resp, "t_asset_requests");
      const rawData = result ? (Array.isArray(result) ? result : [result]) : [];

      this.teamRequests = rawData.map((tuple: any) => {
        const parent = tuple.old || tuple;
        const reqItem = parent.t_asset_requests || parent;
        const userInfo = parent.m_users || reqItem.m_users || {};
        const subCategory = parent.m_asset_subcategories || reqItem.m_asset_subcategories || {};
        const approvalInfo = parent.t_request_approvals || reqItem.t_request_approvals || {};
        const assetTypeInfo = parent.m_asset_types || reqItem.m_asset_types || {};

        return {
          approvalId: approvalInfo.approval_id || '',
          id: reqItem.request_id || '',
          requestNumber: reqItem.request_id || '',
          requesterId: reqItem.user_id || userInfo.user_id || '',
          requesterName: userInfo.name || '',
          requesterEmail: userInfo.email || '',
          requesterTeam: (userInfo.m_projects && userInfo.m_projects.project_name) ? userInfo.m_projects.project_name : (userInfo.team || ''),
          category: reqItem.temp1,
          assetType: this.getAssetType(reqItem, assetTypeInfo) || subCategory.name || reqItem.asset_type || '',
          description: reqItem.purpose || reqItem.reason || '',
          urgency: reqItem.urgency || '',
          status: approvalInfo.status || reqItem.status || 'Pending',
          reason: reqItem.reason || reqItem.purpose || '',
          justification: reqItem.reason || reqItem.purpose || '',
          remarks: approvalInfo.remarks || 'No remarks',
          requestDate: reqItem.created_at || reqItem.request_date || new Date().toISOString(),
          currentStage: ApprovalStage.TEAM_LEAD,
          taskid: approvalInfo.temp2 || '',
          document: reqItem.document || reqItem.temp2 || ''
        } as unknown as AssetRequest;
      }).sort((a: any, b: any) => (b.requestNumber || '').localeCompare(a.requestNumber || ''));

      console.log("Mapped pending requests for dashboard:", this.teamRequests);
      this.isLoading = false;
    }).catch(err => {
      console.error("Error fetching pending requests:", err);
      this.isLoading = false;
    });
  }

  private getAssetType(reqItem: any, assetTypeInfo: any): string {
    const type = assetTypeInfo.type_name || reqItem.asset_type || '';
    if (type.toLowerCase() === 'typ_01') return 'Software';
    if (type.toLowerCase() === 'typ_02') return 'Hardware';
    return type;
  }



  getusercount() {
    this.hs.ajax('GetAllUserRoleProjectDetails', 'http://schemas.cordys.com/AMS_Database_Metadata', {}
    ).then((resp: any) => {
      const result = this.hs.xmltojson(resp, "m_users");
      const allUsers = result ? (Array.isArray(result) ? result : [result]) : [];
      // Filter the users belonging to the team lead's project
      const users = allUsers.filter((u: any) => u.project_id === this.userDetails.project_id);

      this.teamSize = users.length;
      // Store full member details for the modal
      this.teamMembers = users.map((u: any) => ({
        name: u.name || 'N/A',
        user_id: u.user_id || u.email || 'N/A',
        email: u.email || 'N/A',
        status: u.status || 'Active',
        role_id: (u.m_roles && u.m_roles.role_name) ? u.m_roles.role_name : (u.role_id || ''),
        team_lead: (u.m_projects && u.m_projects.team_lead) ? u.m_projects.team_lead : (this.userDetails.team_lead || this.userDetails.name || 'N/A')
      }));
      console.log("Team Size and Details updated from API:", this.teamSize, this.teamMembers);
      this.getteamassetscount(); // Fetch team assets count now that we have the member IDs
    }).catch(err => {
      console.error("Error fetching user details in getusercount:", err);
    });
  }

  toggleTeamModal(): void {
    this.showTeamModal = !this.showTeamModal;
  }

  getpendingcount() {
    this.hs.ajax('GetallpendingrequestsForParticularTeamLead', 'http://schemas.cordys.com/AMS_Database_Metadata',
      { Approver_id: this.userDetails.user_id }
    ).then((resp: any) => {
      const result = this.hs.xmltojson(resp, "t_asset_requests");
      const rawData = result ? (Array.isArray(result) ? result : [result]) : [];
      this.pendingApprovalsCount = rawData.length;
      console.log("Pending Approvals count updated from API:", this.pendingApprovalsCount);
    }).catch(err => {
      console.error("Error fetching pending count in getpendingcount:", err);
    });
  }

  getteamassetscount() {
    // Fetch all allocated assets from Cordys
    this.hs.ajax('Getallocatedasset', 'http://schemas.cordys.com/AMS_Database_Metadata', {}
    ).then((resp: any) => {
      const result = this.hs.xmltojson(resp, "tuple");
      const rawAssets = result ? (Array.isArray(result) ? result : [result]) : [];

      // Get the list of user IDs in the team
      const teamUserIds = this.teamMembers.map(m => m.user_id);

      // Filter assets assigned to team members
      // temp1 is used as the user_id in the m_assets table in this project
      const teamAllocatedAssets = rawAssets.filter((tuple: any) => {
        const assetData = tuple.old?.m_assets || tuple.m_assets || tuple;
        const assignedUserId = assetData.temp1 || assetData.user_id || '';
        return teamUserIds.includes(assignedUserId);
      });

      this.teamAssets = teamAllocatedAssets.length;
      console.log("Team Assets count updated from API:", this.teamAssets);
    }).catch(err => {
      console.error("Error fetching team assets count:", err);
    });
  }

}



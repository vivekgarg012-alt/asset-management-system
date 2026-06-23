import { Component, OnInit } from '@angular/core';
import { RequestService } from '../../../core/services/request.service';
import { AssetRequest } from '../../../core/models/request.model';
import { HeroService } from 'src/app/core/services/hero.service';
import { MailService } from 'src/app/core/services/mail.service';
import { NotificationService } from 'src/app/core/services/notification.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { AssetService } from '../../../core/services/asset.service';
import { AdminDataService } from '../../../core/services/admin-data.service';

@Component({
  selector: 'app-warranty-tickets',
  templateUrl: './warranty-tickets.component.html',
  styleUrls: ['./warranty-tickets.component.scss']
})
export class WarrantyTicketsComponent implements OnInit {
  loading = true;
  warrantyTickets: AssetRequest[] = [];

  isWarrantyModalOpen = false;
  activeTab: 'pending' | 'resolved' = 'pending';
  allWarrantyRequests: AssetRequest[] = [];
  selectedWarrantyRequest: AssetRequest | null = null;
  newWarrantyDate: string = '';

  // Search and Filter
  searchTerm: string = '';
  selectedAssetType: string = '';
  assetTypeOptions: string[] = ['Hardware', 'Software', 'Furniture', 'Network'];

  // Pagination
  currentPage = 1;
  pageSize = 5;
  Math = Math;

  constructor(
    private requestService: RequestService,
    private assetService: AssetService,
    private hs: HeroService,
    private mailService: MailService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private adminService: AdminDataService
  ) { }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadWarrantyTickets(),
      this.loadAssetTypes()
    ]);
  }

  async loadAssetTypes(): Promise<void> {
    try {
      const typeCounts = await this.assetService.fetchAssetTypeWiseCount();
      this.assetTypeOptions = typeCounts
        .map(t => t.type_name)
        .filter(name => name && name.toLowerCase() !== 'infrastructure');
    } catch (err) {
      console.warn('Failed to load asset types:', err);
    }
  }

  get filteredWarrantyTickets(): AssetRequest[] {
    const source = this.activeTab === 'pending' ? this.warrantyTickets : this.resolvedWarrantyRequests;

    return source.filter(req => {
      const matchesSearch = !this.searchTerm ||
        (req.id?.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (req.requesterName?.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (req.assetName?.toLowerCase().includes(this.searchTerm.toLowerCase()));

      const matchesType = !this.selectedAssetType || req.assetType === this.selectedAssetType;

      return matchesSearch && matchesType;
    });
  }

  get totalFilteredCount(): number {
    return this.filteredWarrantyTickets.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalFilteredCount / this.pageSize);
  }

  get paginatedWarrantyTickets(): AssetRequest[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredWarrantyTickets.slice(start, start + this.pageSize);
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

    if (start > 2) {
      pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < total - 1) {
      pages.push('...');
    }

    pages.push(total);
    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  get pendingWarrantyCount(): number {
    return this.warrantyTickets.filter(req => req.status === 'Pending' || req.status === 'In Progress').length;
  }

  get resolvedWarrantyRequests(): AssetRequest[] {
    return this.allWarrantyRequests.filter(req => {
      if (req.status === 'Rejected') {
        // Only show rejected requests if they actually reached the allocation team
        // We check if an approval record with role 'Asset Allocation Team' exists
        // This is handled during enrichment in loadWarrantyTickets
        return (req as any).involvedAllocationTeam === true;
      }
      return req.status === 'Completed' || req.status === 'Approved' || req.status === 'Cancelled';
    }).sort((a, b) => {
      const idA = (a.id || '').toLowerCase();
      const idB = (b.id || '').toLowerCase();
      return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  setTab(tab: 'pending' | 'resolved'): void {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  async loadWarrantyTickets(): Promise<void> {
    this.loading = true;
    try {
      const currentUser = this.authService.getCurrentUser();
      const userId = currentUser?.id ?? 'usr_007';

      const [pendingRes, allRes] = await Promise.all([
        this.requestService.fetchPendingWarrantyApprovalsFromService(userId),
        this.requestService.fetchAllWarrantyRequests()
      ]);

      let pendingWarrantyTickets = (pendingRes || []).filter(req => req.status === 'Pending' || req.status === 'In Progress');

      // Robust discovery fallback
      if (pendingWarrantyTickets.length === 0) {
        console.log('[WarrantyTickets] Direct pending service returned 0. Trying robust discovery...');

        // Broaden candidate search: check ALL non-terminal requests for pending stages for this user
        const terminalStatuses = ['Completed', 'Rejected', 'Cancelled', 'Resolved'];
        const candidateReqs = (allRes || []).filter(req => !terminalStatuses.includes(req.status));
        const userIdLower = userId.toLowerCase();

        const discoveredReqs: AssetRequest[] = [];
        for (const req of candidateReqs) {
          try {
            const progress = await this.requestService.getWarrantyProgress(req.id);
            if (progress && progress.length > 0) {
              const latest = [...progress].sort((a, b) => {
                const idA = parseInt(a.approvalId?.replace(/\D/g, '') || '0');
                const idB = parseInt(b.approvalId?.replace(/\D/g, '') || '0');
                return idB - idA;
              })[0];

              if (latest && latest.status === 'Pending' && (latest.approverId || '').toLowerCase() === userIdLower) {
                req.approvalId = latest.approvalId;
                req.taskid = latest.temp1;
                req.status = 'Pending' as any;
                discoveredReqs.push(req);
              }
            }
          } catch (pErr) { console.warn('Progress check failed:', pErr); }
        }
        pendingWarrantyTickets = discoveredReqs;
      }

      this.warrantyTickets = pendingWarrantyTickets.sort((a, b) => {
        const idA = (a.id || '').toLowerCase();
        const idB = (b.id || '').toLowerCase();
        return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
      });

      // 🚀 BPM Discovery Fallback: If taskid is missing, find it in active tasks
      try {
        const activeTasks = await this.requestService.fetchActiveTasks();
        if (activeTasks && activeTasks.length > 0) {
          this.warrantyTickets.forEach(req => {
            if (!req.taskid) {
              const matchingTask = activeTasks.find(t => {
                const dataStr = JSON.stringify(t.data || {}).toLowerCase();
                const subjectStr = (t.subject || '').toLowerCase();
                const reqIdLower = (req.id || '').toLowerCase();
                return reqIdLower && (dataStr.includes(reqIdLower) || subjectStr.includes(reqIdLower));
              });
              if (matchingTask) {
                console.log(`[WarrantyTickets] Discovered missing taskId ${matchingTask.taskId} for request ${req.id}`);
                req.taskid = matchingTask.taskId;
              }
            }
          });
        }
      } catch (e) {
        console.warn('[WarrantyTickets] Task discovery failed:', e);
      }

      // Enrich all requests to see if Allocation Team was involved (for Resolved tab filtering)
      this.allWarrantyRequests = await Promise.all((allRes || []).map(async (req) => {
        try {
          const progress = await this.requestService.getWarrantyProgress(req.id);
          (req as any).involvedAllocationTeam = progress.some(p =>
            (p.stage || '').toLowerCase().includes('allocation') ||
            (p.stage || '').toLowerCase().includes('team')
          );
        } catch (e) {
          (req as any).involvedAllocationTeam = false;
        }
        return req;
      }));

      // Map employee names for both pending and resolved requests
      try {
        const allUsers = await this.adminService.GetAllUserRoleProjectDetails();
        if (allUsers && allUsers.length > 0) {
          const userMap = new Map(allUsers.map((u: any) => [u.id || u.user_id, u.name]));

          const mapNames = (reqs: AssetRequest[]) => reqs.forEach(req => {
            if (!req.requesterName || req.requesterName === 'Unknown') {
              req.requesterName = userMap.get(req.requesterId) || req.requesterName || 'Employee';
            }
          });

          mapNames(this.warrantyTickets);
          mapNames(this.allWarrantyRequests);
        }
      } catch (userErr) {
        console.warn('[WarrantyTickets] Failed to enrich requester names:', userErr);
      }

      console.log('Pending Warranty Tickets:', this.warrantyTickets.length);
      console.log('All Warranty Requests:', this.allWarrantyRequests.length);
    } catch (err) {
      console.error('Failed to load warranty tickets:', err);
      this.notificationService.showToast('Failed to load warranty requests', 'error');
    } finally {
      this.loading = false;
    }
  }

  loadingRemarks = false;
  async openWarrantyModal(request: AssetRequest): Promise<void> {
    this.selectedWarrantyRequest = request;
    this.newWarrantyDate = '';
    this.isWarrantyModalOpen = true;
    this.loadingRemarks = true;

    // Fetch progress to get Manager remarks
    try {
      console.log(`[WarrantyTickets] Fetching progress for request: ${request.id}`);
      const progress = await this.requestService.getWarrantyProgress(request.id);
      console.log(`[WarrantyTickets] Progress records found:`, progress.length);

      if (this.selectedWarrantyRequest) {
        this.selectedWarrantyRequest.approvalChain = progress.map(p => ({
          stage: p.stage as any,
          action: p.status as any,
          comments: p.comments,
          approverName: p.approverName,
          timestamp: p.timestamp
        }));
        console.log(`[WarrantyTickets] Updated approval chain. Manager remarks: "${this.managerRemarks}"`);

        // 🚀 On-demand BPM Task Discovery: Ensure we have the taskId before the user acts
        if (!this.selectedWarrantyRequest.taskid) {
          try {
            const activeTasks = await this.requestService.fetchActiveTasks();
            const reqIdLower = (this.selectedWarrantyRequest.id || '').toLowerCase();
            const matchingTask = activeTasks.find(t => {
              const dataStr = JSON.stringify(t.data || {}).toLowerCase();
              const subjectStr = (t.subject || '').toLowerCase();
              return reqIdLower && (dataStr.includes(reqIdLower) || subjectStr.includes(reqIdLower));
            });
            if (matchingTask) {
              console.log(`[WarrantyTickets] On-demand discovery found taskId ${matchingTask.taskId}`);
              this.selectedWarrantyRequest.taskid = matchingTask.taskId;
            }
          } catch (e) { console.warn('[WarrantyTickets] On-demand discovery failed:', e); }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch warranty progress:', err);
    } finally {
      this.loadingRemarks = false;
    }
  }

  get managerRemarks(): string {
    if (!this.selectedWarrantyRequest?.approvalChain) return '—';
    const chain = [...this.selectedWarrantyRequest.approvalChain].reverse();
    const allocationEntry = chain.find(a => (a.stage || '').toString().toLowerCase().includes('allocation') || (a.stage || '').toString().toLowerCase().includes('team'));
    if (allocationEntry?.comments && allocationEntry.comments !== '—' && allocationEntry.comments.trim().length > 0) return allocationEntry.comments;
    const managerEntry = chain.find(a => (a.stage || '').toString().toLowerCase().includes('manager') || (a.stage || '').toString().toLowerCase().includes('mgr'));
    return managerEntry?.comments || '—';
  }

  closeWarrantyModal(): void {
    this.isWarrantyModalOpen = false;
    this.selectedWarrantyRequest = null;
    this.newWarrantyDate = '';
  }

  async approveWarrantyExtension(): Promise<void> {
    const request = this.selectedWarrantyRequest;
    const newDate = this.newWarrantyDate;

    if (!request || !newDate) {
      this.notificationService.showToast('Please select a valid warranty date.', 'warning');
      return;
    }

    try {
      const requestId = request.id;
      const approvalId = request.approvalId;
      const assetId = request.assignedAssetId;

      if (!approvalId) {
        this.notificationService.showToast('Approval context missing. Cannot proceed.', 'error');
        return;
      }

      // 1. Update status in t_extend_request_approvals to 'Approved'
      await this.requestService.updateWarrantyRequestApproval(
        approvalId,
        'Approved',
        'Warranty extended by Allocation Team',
        assetId
      );

      // 2. Update master request status to 'Completed'
      await this.requestService.updateExtendAssetRequest(requestId, 'Completed');

      // 3. Update m_assets with the new warranty date
      if (assetId) {
        await this.requestService.updateAssetWarrantyDate(assetId, newDate);

        // 3.1 Reset asset status back to 'Allocated' so it appears in Employee list
        const resetStatusReq = {
          tuple: {
            old: { m_assets: { asset_id: assetId } },
            new: { m_assets: { status: 'Allocated' } }
          }
        };
        await this.requestService.updateAssetStatus(resetStatusReq as any);
      }

      // 4. Send email to employee
      await this.mailService.sendWarrantyExtensionConfirmation({
        employeeName: request.requesterName,
        assetName: request.assetName || 'Asset',
        newExpiryDate: newDate,
        requestId: requestId
      });

      // 5. Complete BPM task
      if (request.taskid) {
        console.log(`[AllocationTeam] Completing BPM Task ${request.taskid} for request ${requestId}`);
        await this.requestService.completeUserTask({
          TaskId: request.taskid,
          Action: 'COMPLETE'
        } as any);
      }

      this.notificationService.showToast('Warranty extension approved and updated successfully!', 'success');
      this.closeWarrantyModal();
      await this.loadWarrantyTickets(); // Refresh
    } catch (error) {
      console.error('Failed to approve warranty extension:', error);
      this.notificationService.showToast('Failed to complete approval. Please try again.', 'error');
    }
  }
}

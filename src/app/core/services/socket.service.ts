import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { User, UserRole } from '../models/user.model';
import { RequestService } from './request.service';
import { HeroService } from './hero.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);
  private readonly serverUrl = 'http://localhost:3000'; // Default notification server endpoint
  // private readonly serverUrl = 'http://43.242.214.41:3000'; //For Server notifictaion

  private emittedRequests = new Set<string>();

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private requestService: RequestService,
    private hs: HeroService
  ) {
    // Monitor authentication session changes
    this.authService.currentUser$.subscribe((user: User | null) => {
      if (user) {
        this.connect(user);
        this.loadPendingApprovalsFromDB(user);
      } else {
        this.disconnect();
      }
    });

    // Clean up any existing window event listener to prevent duplicate triggers during HMR/hot-reload
    if ((window as any).__newRequestSoapSuccessHandler) {
      window.removeEventListener('newRequestSoapSuccess', (window as any).__newRequestSoapSuccessHandler);
    }

    const soapSuccessHandler = (event: any) => {
      const { method, response, requestParams } = event.detail;
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return;

      let requestId = '';
      let requestType = '';
      let targetRole = '';
      let targetUserId = '';

      // Extractor helper: recursively search the JSON object for a specific key
      const findKey = (obj: any, targetKey: string): any => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj[targetKey] !== undefined) return obj[targetKey];
        for (const key of Object.keys(obj)) {
          const found = findKey(obj[key], targetKey);
          if (found) return found;
        }
        return null;
      };

      // Helper to extract text from a possible Cordys text element object
      const getExtractedText = (val: any): string => {
        if (val && typeof val === 'object' && val['#text']) {
          return String(val['#text']);
        }
        return String(val || '');
      };

      // Helper to search in response first, then requestParams
      const getValue = (key: string): string => {
        const valFromResp = findKey(response, key);
        if (valFromResp !== null && valFromResp !== undefined && String(valFromResp).trim() !== '') {
          return getExtractedText(valFromResp);
        }
        const valFromReq = findKey(requestParams, key);
        return getExtractedText(valFromReq);
      };

      // Match database update SOAP methods for approvals (containing status: 'Pending')
      if (method === 'UpdateT_request_approvals' || String(response).includes('UpdateT_request_approvals')) {
        const status = getValue('status');
        if (status.toLowerCase() !== 'pending') return;

        requestId = getValue('request_id');
        targetUserId = getValue('approver_id');
        targetRole = getValue('role');
        requestType = 'Asset Request';
      } else if (method === 'UpdateT_extend_request_approvals' || String(response).includes('UpdateT_extend_request_approvals')) {
        const status = getValue('status');
        if (status.toLowerCase() !== 'pending') return;

        requestId = getValue('request_id');
        targetUserId = getValue('approver_id');
        targetRole = getValue('role');
        requestType = 'Warranty Extension';
      } else if (method === 'UpdateT_asset_return_approvals' || String(response).includes('UpdateT_asset_return_approvals')) {
        const status = getValue('status');
        if (status.toLowerCase() !== 'pending') return;

        requestId = getValue('request_id');
        targetUserId = getValue('approver_id');
        targetRole = getValue('role');
        requestType = 'Asset Return';
      } else if (method === 'UpdateT_service_approvals' || String(response).includes('UpdateT_service_approvals')) {
        const status = getValue('status');
        if (status.toLowerCase() !== 'pending') return;

        requestId = getValue('service_request_id');
        targetUserId = getValue('approver_id');
        targetRole = getValue('role');
        requestType = 'Service Request';
      }

      // If we successfully resolved a request ID, emit the event to the server
      if (requestId && requestId.trim()) {
        const uniqueKey = `${requestType}_${requestId.trim()}_${targetRole}_${targetUserId}`;
        if (this.emittedRequests.has(uniqueKey)) {
          console.log('[SocketService] Request emission already handled recently (deduplicated):', uniqueKey);
          return;
        }
        this.emittedRequests.add(uniqueKey);
        setTimeout(() => this.emittedRequests.delete(uniqueKey), 5000);

        const employeeName = currentUser.name || currentUser.firstName || 'An Employee';
        this.emitNewRequest(requestId, requestType, employeeName, targetRole, targetUserId);
      }
    };

    (window as any).__newRequestSoapSuccessHandler = soapSuccessHandler;
    window.addEventListener('newRequestSoapSuccess', soapSuccessHandler);
  }

  /**
   * Establish connection to Socket.io and register user session.
   */
  connect(user: User): void {
    if (this.socket) {
      this.disconnect();
    }

    try {
      console.log('[SocketService] Connecting to Socket.io server at:', this.serverUrl);
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('[SocketService] Connected. Registering session for:', user.name);
        this.connected$.next(true);
        this.socket?.emit('register', {
          id: user.id,
          name: user.name,
          role: user.role
        });
      });

      this.socket.on('disconnect', () => {
        console.log('[SocketService] Disconnected from server.');
        this.connected$.next(false);
      });

      // Approvers should listen for real-time notifications raised by employees
      const isApprover = [
        UserRole.ADMINISTRATOR,
        UserRole.ASSET_MANAGER,
        UserRole.TEAM_LEAD,
        UserRole.ALLOCATION_TEAM
      ].includes(user.role);

      if (isApprover) {
        this.socket.on('incoming_request_notification', (data: any) => {
          console.log('[SocketService] Received incoming request notification:', data);

          const notificationTitle = `New ${data.requestType} Raised`;
          const notificationMsg = `${data.employeeName} has raised a new ${data.requestType} (ID: ${data.requestId}).`;

          // 1. Display Toast message banner
          this.notificationService.showToast(notificationMsg, 'info');

          // 2. Add notification to the active panel list
          this.notificationService.addNotification(notificationTitle, notificationMsg, 'info');
        });
      }

    } catch (err) {
      console.error('[SocketService] Connection establishment error:', err);
    }
  }

  /**
   * Emit new request raised details to the server.
   */
  emitNewRequest(requestId: string, requestType: string, employeeName: string, targetRole: string, targetUserId: string): void {
    if (this.socket && this.connected$.value) {
      console.log('[SocketService] Emitting new_request_raised:', { requestId, requestType, employeeName, targetRole, targetUserId });
      this.socket.emit('new_request_raised', {
        requestId,
        requestType,
        employeeName,
        targetRole,
        targetUserId
      });
    } else {
      console.warn('[SocketService] Socket client not connected, queueing bypassed.');
    }
  }

  /**
   * Disconnect manually from Socket.io server.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected$.next(false);
      console.log('[SocketService] Socket connection disconnected.');
    }
  }

  /**
   * Load pending approvals from the database and add them to the local notifications list.
   */
  private async loadPendingApprovalsFromDB(user: User): Promise<void> {
    console.log('[SocketService] Loading pending approvals from DB for:', user.name, '| Role:', user.role);

    // Extract assigned asset types for managers & allocation team to filter relevant notifications
    const assignedTypes = user.assetTypeName
      ? user.assetTypeName.split(/[&,]/).map((s: string) => s.trim().toLowerCase())
      : [];

    const isMatchCategory = (assetType: string): boolean => {
      if (!assetType) return false;
      if (assignedTypes.length === 0) return true; // If no categories assigned, don't restrict (fallback)
      return assignedTypes.includes(assetType.trim().toLowerCase());
    };

    try {
      if (user.role === UserRole.TEAM_LEAD) {
        // All notifications for Team Lead are delivered exclusively via real-time Socket.io
        // events (incoming_request_notification). No DB pre-loading is done here so that
        // cleared notifications never reappear on re-login.
        console.log('[SocketService] Team Lead: skipping DB pre-load. Notifications via socket only.');
      }

      else if (user.role === UserRole.ASSET_MANAGER) {
        // All notifications for Asset Manager are delivered exclusively via real-time Socket.io
        // events (incoming_request_notification). No DB pre-loading is done here so that
        // cleared notifications never reappear on re-login.
        console.log('[SocketService] Asset Manager: skipping DB pre-load. Notifications via socket only.');
      }

      else if (user.role === UserRole.ALLOCATION_TEAM) {
        // All notifications for Allocation Team are delivered exclusively via real-time Socket.io
        // events (incoming_request_notification). No DB pre-loading is done here so that
        // cleared notifications never reappear on re-login.
        console.log('[SocketService] Allocation Team: skipping DB pre-load. Notifications via socket only.');
      }
    } catch (e) {
      console.error('[SocketService] loadPendingApprovalsFromDB encountered an overall error:', e);
    }
  }
}

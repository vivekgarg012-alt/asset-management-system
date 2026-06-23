export interface AssetRequest {
  approvalId?: string; // ID for the specific approval record
  returnapprovalId?: string;
  id: string;
  requestNumber: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  requesterDepartment: string;
  requesterTeam: string;
  assetType: string;
  category: string;
  subCategory?: string;
  justification: string;
  urgency: RequestUrgency;
  status: RequestStatus;
  currentStage: ApprovalStage;
  hasEmailApproval: boolean;
  emailApprovalDoc?: string;
  requestDate: string;
  lastUpdated: string;
  document?: string;
  approvalChain: ApprovalEntry[];
  assignedAllocationTeamId?: string;
  allocatedAssetId?: string;
  comments: RequestComment[];
  requestType: RequestType;
  assignedAssetId?: string;
  assignedTypeId?: string;
  assignedSubCategoryId?: string;
  assignedSerial?: string;
  assignedPurchaseDate?: string;
  assignedWarrantyExpiry?: string;
  requesterStatus?: string;
  requesterProject?: string;
  requesterRole?: string;
  requesterProjectName?: string;
  requesterRoleName?: string;
  teamLeadJustification?: string;
  taskid?: string;
  assetName?: string;
  reason?: string;
  remarks?: string;
  reqStatus?: string;
}

export enum RequestType {
  NEW_ASSET = 'New Asset',
  RETURN_ASSET = 'Return Asset',
  EXTEND_WARRANTY = 'Extend Warranty',
  SERVICE_MAINTENANCE = 'Service / Maintenance'
}

export enum RequestUrgency {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export enum RequestStatus {
  DRAFT = 'Draft',
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export enum ApprovalStage {
  TEAM_LEAD = 'Team Lead Approval',
  ASSET_MANAGER = 'Asset Manager Approval',
  ALLOCATION = 'Asset Allocation',
  REJECTED = 'Rejected',
  COMPLETED = 'Completed'
}

export interface ApprovalEntry {
  stage: ApprovalStage;
  approverId?: string;
  approverName?: string;
  action: 'Approved' | 'Rejected' | 'Pending' | 'Skipped';
  comments?: string;
  timestamp?: string;
}

export interface RequestComment {
  id: string;
  userId: string;
  userName: string;
  comment: string;
  timestamp: string;
}

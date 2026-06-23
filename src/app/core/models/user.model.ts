export interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  team: string;
  designation: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  joinDate: string;
  managerId?: string;
  projectId?: string;
  projectName?: string;
  teamLeadName?: string;
  teamLeadId?: string;
  assetTypeId?: string;
  assetTypeName?: string;
}

export enum UserRole {
  ADMINISTRATOR = 'Administrator',
  ASSET_MANAGER = 'Asset Manager',
  ALLOCATION_TEAM = 'Asset Allocation Team',
  TEAM_LEAD = 'Team Lead',
  EMPLOYEE = 'Employee'
}

export interface Department {
  id: string;
  name: string;
  headId: string;
  teams: Team[];
}

export interface Team {
  id: string;
  name: string;
  departmentId: string;
  leadId: string;
  memberCount: number;
}

import { Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { HeroService } from './hero.service';

declare var $: any;

export interface Allocation {
  id: string;
  allocationId: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  assetType: string;
  userId: string;
  userName: string;
  department: string;
  team: string;
  allocatedBy: string;
  allocationDate: string;
  expectedReturnDate?: string;
  status: 'Active' | 'Returned' | 'Overdue';
  requestId?: string;
  notes?: string;
}

export interface AssetReturn {
  id: string;
  returnId: string;
  allocationId: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  returnedBy: string;
  returnedByName: string;
  department: string;
  receivedBy: string;
  receivedByName: string;
  returnDate: string;
  condition: 'Good' | 'Fair' | 'Damaged' | 'Poor';
  notes?: string;
  requestId?: string;
}

export interface MaintenanceLog {
  id: string;
  logId: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  assetType: string;
  maintenanceType: 'Repair' | 'Servicing' | 'Upgrade' | 'Inspection';
  description: string;
  vendor: string;
  cost: number;
  scheduledDate: string;
  completedDate?: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  performedBy?: string;
  notes?: string;
}

export interface Project {
  id: string;
  projectCode: string;
  name: string;
  description: string;
  department: string;
  teamLead: string;
  teamLeadId?: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Completed' | 'On Hold' | 'Cancelled';
  assetCount: number;
  memberCount: number;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  permissions: string[];
  userCount: number;
  isActive: boolean;
}

export interface AssetTypeAssignment {
  id: string;
  name: string;
  assetManager: string;
  assetManagerId?: string;
  teamMembers: string;
}

export interface AssignedAsset {
  userId: string;
  userName: string;
  email: string;
  roleName: string;
  assetId: string;
  assetName: string;
  assetType: string;
  subCategory: string;
}

export interface AssetRequest {
  requestId: string;
  userId: string;
  userName: string;
  userEmail: string;
  assetType: string;
  reason: string;
  urgency: string;
  status: string;
  emailApproval: boolean;
  document: string;
  subCategory: string;
  requestType?: string;
  createdAt: string;
}

export interface Policy {
  id: string;
  policyId: string;
  name: string;
  category: string;
  effectiveDate: string;
  expiryDate: string;
  status: string;
  description: string;
  toMailId?: string;
  fromMailId?: string;
}

interface UserMasterRecord {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  status: string;
  projectId: string;
  assetTypeId: string;
  createdAt: string;
  temp1: string;
  temp2: string;
  temp3: string;
  temp4: string;
  temp5: string;
  temp6: string;
  temp7: string;
}

@Injectable({ providedIn: 'root' })
export class AdminDataService {
  private userMasterCache = new Map<string, UserMasterRecord>();

  constructor(private heroService: HeroService) {}

  private allocations: Allocation[] = [
    { id: 'ALL001', allocationId: 'ALLOC-2024-001', assetId: 'AST001', assetTag: 'HW-LAP-001', assetName: 'Dell Latitude 5540', assetType: 'Hardware', userId: 'USR005', userName: 'Ananya Desai', department: 'Engineering', team: 'Frontend', allocatedBy: 'Priya Sharma', allocationDate: '2024-03-20', status: 'Active', requestId: 'REQ001' },
    { id: 'ALL002', allocationId: 'ALLOC-2024-002', assetId: 'AST002', assetTag: 'HW-LAP-002', assetName: 'MacBook Pro 14"', assetType: 'Hardware', userId: 'USR004', userName: 'Suresh Patel', department: 'Engineering', team: 'Frontend', allocatedBy: 'Priya Sharma', allocationDate: '2024-01-15', status: 'Active' },
    { id: 'ALL003', allocationId: 'ALLOC-2024-003', assetId: 'AST004', assetTag: 'SW-LIC-001', assetName: 'Microsoft 365 Business', assetType: 'Software', userId: 'USR005', userName: 'Ananya Desai', department: 'Engineering', team: 'Frontend', allocatedBy: 'Kavitha Iyer', allocationDate: '2024-01-01', status: 'Active' },
    { id: 'ALL004', allocationId: 'ALLOC-2024-004', assetId: 'AST006', assetTag: 'NW-RTR-001', assetName: 'Cisco Catalyst 9200', assetType: 'Network', userId: 'USR003', userName: 'Priya Sharma', department: 'IT', team: 'Asset Allocation', allocatedBy: 'Kavitha Iyer', allocationDate: '2023-11-05', status: 'Active' },
    { id: 'ALL005', allocationId: 'ALLOC-2024-005', assetId: 'AST009', assetTag: 'SW-LIC-002', assetName: 'JetBrains IntelliJ IDEA', assetType: 'Software', userId: 'USR004', userName: 'Suresh Patel', department: 'Engineering', team: 'Frontend', allocatedBy: 'Priya Sharma', allocationDate: '2024-04-05', expectedReturnDate: '2025-03-31', status: 'Active' },
    { id: 'ALL006', allocationId: 'ALLOC-2024-006', assetId: 'AST010', assetTag: 'HW-MON-002', assetName: 'LG 27UK850-W', assetType: 'Hardware', userId: 'USR005', userName: 'Ananya Desai', department: 'Engineering', team: 'Frontend', allocatedBy: 'Kavitha Iyer', allocationDate: '2024-05-12', status: 'Active' },
    { id: 'ALL007', allocationId: 'ALLOC-2023-001', assetId: 'AST013', assetTag: 'PR-MSE-001', assetName: 'Logitech MX Master 3S', assetType: 'Peripheral', userId: 'USR005', userName: 'Ananya Desai', department: 'Engineering', team: 'Frontend', allocatedBy: 'Priya Sharma', allocationDate: '2024-03-20', status: 'Active' },
    { id: 'ALL008', allocationId: 'ALLOC-2023-002', assetId: 'AST007', assetTag: 'HW-LAP-004', assetName: 'Lenovo ThinkPad X1 Carbon', assetType: 'Hardware', userId: 'USR006', userName: 'Vikram Singh', department: 'Engineering', team: 'Backend', allocatedBy: 'Priya Sharma', allocationDate: '2023-06-20', expectedReturnDate: '2024-06-20', status: 'Overdue' }
  ];

  private returns: AssetReturn[] = [
    { id: 'RET001', returnId: 'RET-2024-001', allocationId: 'ALLOC-2023-001', assetId: 'AST008', assetTag: 'PR-KBD-001', assetName: 'Logitech MX Keys', returnedBy: 'USR006', returnedByName: 'Vikram Singh', department: 'Engineering', receivedBy: 'USR003', receivedByName: 'Priya Sharma', returnDate: '2024-10-15', condition: 'Good', notes: 'Returned willingly, asset in excellent condition', requestId: 'REQ006' },
    { id: 'RET002', returnId: 'RET-2024-002', allocationId: 'ALLOC-2022-001', assetId: 'AST015', assetTag: 'HW-LAP-006', assetName: 'MacBook Air M2', returnedBy: 'USR007', returnedByName: 'Meera Nair', department: 'Design', receivedBy: 'USR009', receivedByName: 'Kavitha Iyer', returnDate: '2024-08-20', condition: 'Poor', notes: 'Asset degraded - scheduled for retirement' },
    { id: 'RET003', returnId: 'RET-2024-003', allocationId: 'ALLOC-2024-008', assetId: 'AST012', assetTag: 'FR-DSK-001', assetName: 'Standing Desk Motorized', returnedBy: 'USR010', returnedByName: 'Rahul Mehta', department: 'Engineering', receivedBy: 'USR003', receivedByName: 'Priya Sharma', returnDate: '2024-11-30', condition: 'Good', notes: 'Employee resigned, all assets returned' }
  ];

  private maintenanceLogs: MaintenanceLog[] = [
    { id: 'MNT001', logId: 'MNT-2024-001', assetId: 'AST007', assetTag: 'HW-LAP-004', assetName: 'Lenovo ThinkPad X1 Carbon', assetType: 'Hardware', maintenanceType: 'Repair', description: 'Screen replacement due to accidental damage - display unit cracked', vendor: 'Lenovo Service Center', cost: 18000, scheduledDate: '2024-11-01', completedDate: '2024-11-10', status: 'Completed', performedBy: 'Lenovo Technician', notes: 'Warranty partial coverage applied' },
    { id: 'MNT002', logId: 'MNT-2024-002', assetId: 'AST001', assetTag: 'HW-LAP-001', assetName: 'Dell Latitude 5540', assetType: 'Hardware', maintenanceType: 'Servicing', description: 'Annual preventive maintenance and cleaning', vendor: 'Dell Technologies', cost: 3500, scheduledDate: '2024-12-15', status: 'Scheduled', notes: 'Scheduled as per AMC' },
    { id: 'MNT003', logId: 'MNT-2024-003', assetId: 'AST006', assetTag: 'NW-RTR-001', assetName: 'Cisco Catalyst 9200', assetType: 'Network', maintenanceType: 'Upgrade', description: 'Firmware upgrade to latest version and config backup', vendor: 'Cisco Systems', cost: 8000, scheduledDate: '2024-10-20', completedDate: '2024-10-21', status: 'Completed', performedBy: 'Cisco Network Engineer' },
    { id: 'MNT004', logId: 'MNT-2024-004', assetId: 'AST002', assetTag: 'HW-LAP-002', assetName: 'MacBook Pro 14"', assetType: 'Hardware', maintenanceType: 'Inspection', description: 'Quarterly hardware health check and battery calibration', vendor: 'Apple Authorized Service', cost: 2000, scheduledDate: '2024-12-20', status: 'In Progress', performedBy: 'Apple Technician' },
    { id: 'MNT005', logId: 'MNT-2024-005', assetId: 'AST015', assetTag: 'HW-LAP-006', assetName: 'MacBook Air M2', assetType: 'Hardware', maintenanceType: 'Repair', description: 'Battery replacement - capacity degraded to 60%', vendor: 'Apple Authorized Service', cost: 12000, scheduledDate: '2024-07-10', completedDate: '2024-07-15', status: 'Completed', performedBy: 'Apple Technician', notes: 'Post repair decided to retire asset' }
  ];

  getAllocations(): Allocation[] { return [...this.allocations]; }
  getActiveAllocations(): Allocation[] { return this.allocations.filter(a => a.status === 'Active'); }
  getOverdueAllocations(): Allocation[] { return this.allocations.filter(a => a.status === 'Overdue'); }

  getReturns(): AssetReturn[] { return [...this.returns]; }

  getMaintenanceLogs(): MaintenanceLog[] { return [...this.maintenanceLogs]; }
  getMaintenanceByStatus(status: string): MaintenanceLog[] { return this.maintenanceLogs.filter(m => m.status === status); }

  async getProjectsFromDB(): Promise<Project[]> {
    const getAllProjectsSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllProjectsDetails xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    const response = await this.heroService.ajax(null, null, {}, getAllProjectsSoap);
    let projectsData = this.heroService.xmltojson(response, 'm_projects');

    if (!projectsData) {
      return [];
    }

    if (!Array.isArray(projectsData)) {
      projectsData = [projectsData];
    }

    return projectsData.map((projectData: any) => ({
      id: this.normalizeNullable(projectData.project_id || projectData.project_code, projectData.project_name),
      projectCode: this.normalizeNullable(projectData.project_id || projectData.project_code, '-'),
      name: this.normalizeNullable(projectData.project_name, 'Untitled Project'),
      description: '',
      department: '',
      teamLead: this.normalizeSoapNullable(projectData.team_lead || projectData.tl_id, ''),
      teamLeadId: this.normalizeSoapNullable(projectData.tl_id, ''),
      startDate: '',
      endDate: '',
      status: this.normalizeNullable(projectData.temp1, 'Active') as Project['status'],
      assetCount: 0,
      memberCount: this.normalizeNumber(projectData.members)
    })) as Project[];
  }

  async getProjectsByStatus(status: string): Promise<Project[]> {
    const projects = await this.getProjectsFromDB();
    return projects.filter(project => project.status === status);
  }

  async addProject(projectName: string): Promise<void> {
    const normalizedProjectName = this.normalizeNullable(projectName, '');

    if (!normalizedProjectName) {
      throw new Error('Project name is required.');
    }

    const addProjectSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_projects xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <new>
          <m_projects qAccess="0" qConstraint="0" qInit="0" qValues="">
            <project_name>${this.xmlEscape(normalizedProjectName)}</project_name>
          </m_projects>
        </new>
      </tuple>
    </UpdateM_projects>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    await this.heroService.ajax(null, null, {}, addProjectSoap);
  }

  async updateProjectStatus(projectId: string, status: string): Promise<void> {
    const updateProjectSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_projects xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_projects qAccess="0" qConstraint="0" qInit="0" qValues="">
            <project_id>${this.xmlEscape(projectId)}</project_id>
          </m_projects>
        </old>
        <new>
          <m_projects qAccess="0" qConstraint="0" qInit="0" qValues="">
            <temp1>${this.xmlEscape(status)}</temp1>
          </m_projects>
        </new>
      </tuple>
    </UpdateM_projects>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    await this.heroService.ajax(null, null, {}, updateProjectSoap);
  }

  async addUser(user: {
    userId: string;
    name: string;
    email: string;
    roleId: string;
    password?: string;
    projectId?: string;
    assetTypeId?: string;
  }): Promise<string> {
    const userId = this.normalizeNullable(user.userId, '');
    const name = this.normalizeNullable(user.name, '');
    const email = this.normalizeNullable(user.email, '');
    const roleId = this.normalizeNullable(user.roleId, '');
    const password = user.password || 'Qwerty@1234';
    const projectId = this.normalizeNullable(user.projectId, '');
    const assetTypeId = this.normalizeNullable(user.assetTypeId, '');

    if (!userId || !name || !email || !roleId) {
      throw new Error('User ID, name, email, and role are required.');
    }

    const cordysRole = this.mapRoleIdToCordysRole(roleId);
    const createUserSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <CreateUserInOrganization xmlns="http://schemas.cordys.com/UserManagement/1.0/Organization">
      <User>
        <UserName isAnonymous="">${this.xmlEscape(email)}</UserName>
        <Description>${this.xmlEscape(name)}</Description>
        <Credentials allowDuplicate="true">
          <UserIDPassword>
            <UserID>${this.xmlEscape(email)}</UserID>
            <Password>${this.xmlEscape(password)}</Password>
          </UserIDPassword>
        </Credentials>
        <Roles>
          <Role application="">${this.xmlEscape(cordysRole)}</Role>
        </Roles>
      </User>
    </CreateUserInOrganization>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      // Step 0: Ensure valid administrative context (Matching the working self-registration flow)
      console.log('[AdminDataService] Refreshing admin authentication context...');
      await new Promise<void>((resolve, reject) => {
        if (typeof $ !== 'undefined' && $.cordys?.authentication?.sso) {
          $.cordys.authentication.sso.authenticate('sourabhs', 'sourabhs')
            .done(() => resolve())
            .fail((err: any) => reject(err));
        } else {
          resolve(); // Fallback if Cordys SDK is missing
        }
      });

      console.log('[AdminDataService] Creating user in Cordys organization...');
      const resp = await this.heroService.ajax(null, null, {}, createUserSoap);
      
      // Check for SOAP Fault within a successful AJAX response (Cordys specific)
      const fault = this.heroService.xmltojson(resp, 'Fault');
      if (fault) {
        const fs = fault.faultstring || fault.Faultstring || JSON.stringify(fault);
        // Only proceed if it's explicitly a "user already exists" scenario
        if (fs.toLowerCase().includes('already exists') || fs.toLowerCase().includes('user exists')) {
          console.warn('[AdminDataService] User already exists in Cordys, proceeding to DB sync.');
        } else {
          throw new Error(`Cordys SOAP Fault: ${fs}`);
        }
      }
    } catch (e: any) {
      // If we threw the Error above, re-throw it to stop the flow
      if (e instanceof Error && e.message.includes('Cordys SOAP Fault')) throw e;

      console.error('[AdminDataService] Cordys User Creation Request Failed:', e);
      const errorText = e?.responseText || '';
      
      // Fuzzy check for existing user in error response
      const isAlreadyExists = errorText.toLowerCase().includes('already exists') || 
                              errorText.toLowerCase().includes('duplicate user');
      
      if (!isAlreadyExists) {
        let detail = e?.responseText || e?.errorThrown || '';
        if (typeof detail !== 'string') detail = JSON.stringify(e);
        throw new Error(`Cordys Platform Rejection: ${detail}`);
      }
      console.warn('[AdminDataService] User already exists (via error), proceeding to DB sync.');
    }

    // 2. Add User details to DB - Only reached if Cordys succeeded or user already existed
    const addUserSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_users xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <new>
          <m_users qAccess="0" qConstraint="0" qInit="0" qValues="">
            <user_id>${this.xmlEscape(userId)}</user_id>
            <name>${this.xmlEscape(name)}</name>
            <email>${this.xmlEscape(email)}</email>
            <role_id>${this.xmlEscape(roleId)}</role_id>
            <status>Active</status>
            <temp1>${this.xmlEscape(password)}</temp1>
            ${projectId ? `<project_id>${this.xmlEscape(projectId)}</project_id>` : ''}
            ${assetTypeId ? `<asset_type_id>${this.xmlEscape(assetTypeId)}</asset_type_id>` : ''}
            <created_at>${new Date().toISOString()}</created_at>
          </m_users>
        </new>
      </tuple>
    </UpdateM_users>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    await this.heroService.ajax(null, null, {}, addUserSoap);
    return userId;
  }

  async getAssetTypeAssignmentDetails(): Promise<AssetTypeAssignment[]> {
    const getAssetAssignmentsSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAssetNAssetManagerDetails xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    const response = await this.heroService.ajax(null, null, {}, getAssetAssignmentsSoap);
    let assetTypesData = this.heroService.xmltojson(response, 'm_asset_types');

    if (!assetTypesData) {
      return [];
    }

    if (!Array.isArray(assetTypesData)) {
      assetTypesData = [assetTypesData];
    }

    return assetTypesData.map((assetTypeData: any) => ({
      id: this.normalizeNullable(assetTypeData.type_id, assetTypeData.type_name),
      name: this.normalizeNullable(assetTypeData.type_name, 'Unnamed Asset Type'),
      assetManager: this.normalizeSoapNullable(assetTypeData.asset_manager, ''),
      assetManagerId: this.normalizeSoapNullable(assetTypeData.asset_manager_id || assetTypeData.am_id || assetTypeData.manager_id, ''),
      teamMembers: this.normalizeSoapNullable(assetTypeData.team_members, '')
    })) as AssetTypeAssignment[];
  }

  async getProjectById(projectId: string): Promise<Project | undefined> {
    const projects = await this.getProjectsFromDB();
    const pid = (projectId || '').toLowerCase().trim();
    return projects.find(p => 
      (p.id || '').toLowerCase().trim() === pid || 
      (p.projectCode || '').toLowerCase().trim() === pid
    );
  }

  async getAssignmentByAssetType(assetType: string): Promise<AssetTypeAssignment | undefined> {
    const assignments = await this.getAssetTypeAssignmentDetails();
    const normalizedType = (assetType || '').toLowerCase().trim();
    
    // 1. Try exact or ID match
    let found = assignments.find(a => 
      a.name.toLowerCase() === normalizedType || 
      a.id.toLowerCase() === normalizedType ||
      normalizedType.includes(a.name.toLowerCase()) ||
      a.name.toLowerCase().includes(normalizedType)
    );

    // 2. If no match, try keyword matching for Software/Hardware
    if (!found) {
       found = assignments.find(a => 
         (normalizedType.includes('soft') && a.name.toLowerCase().includes('soft')) ||
         (normalizedType.includes('hard') && a.name.toLowerCase().includes('hard'))
       );
    }

    return found;
  }

  async assignTeamLeadToProject(projectId: string, teamLeadUserId: string): Promise<void> {
    const normalizedProjectId = this.normalizeNullable(projectId, '');
    const normalizedTeamLeadUserId = this.normalizeNullable(teamLeadUserId, '');

    if (!normalizedProjectId) {
      throw new Error('Project ID is required.');
    }

    const teamLeadElement = normalizedTeamLeadUserId 
      ? `<tl_id>${this.xmlEscape(normalizedTeamLeadUserId)}</tl_id>`
      : `<tl_id xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />`;

    const assignLeadSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_projects xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_projects qConstraint="0">
            <project_id>${this.xmlEscape(normalizedProjectId)}</project_id>
          </m_projects>
        </old>
        <new>
          <m_projects qAccess="0" qConstraint="0" qInit="0" qValues="">
            ${teamLeadElement}
          </m_projects>
        </new>
      </tuple>
    </UpdateM_projects>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    await this.heroService.ajax(null, null, {}, assignLeadSoap);
  }

  async clearAssetManagerFromType(typeId: string): Promise<void> {
    const soap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_asset_types xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_asset_types qConstraint="0">
            <type_id>${this.xmlEscape(typeId)}</type_id>
          </m_asset_types>
        </old>
        <new>
          <m_asset_types qAccess="0" qConstraint="0" qInit="0" qValues="">
            <am_id xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />
            <asset_manager xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />
          </m_asset_types>
        </new>
      </tuple>
    </UpdateM_asset_types>
  </SOAP:Body>
</SOAP:Envelope>`.trim();
    await this.heroService.ajax(null, null, {}, soap);
  }

  async updateAssetTypeTeamMembers(typeId: string, teamMembers: string): Promise<void> {
    const soap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_asset_types xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_asset_types qConstraint="0">
            <type_id>${this.xmlEscape(typeId)}</type_id>
          </m_asset_types>
        </old>
        <new>
          <m_asset_types qAccess="0" qConstraint="0" qInit="0" qValues="">
            <team_members>${this.xmlEscape(teamMembers)}</team_members>
          </m_asset_types>
        </new>
      </tuple>
    </UpdateM_asset_types>
  </SOAP:Body>
</SOAP:Envelope>`.trim();
    await this.heroService.ajax(null, null, {}, soap);
  }

  async getRolesFromDB(): Promise<Role[]> {
    const getAllRolesSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllRoles xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    const response = await this.heroService.ajax(null, null, {}, getAllRolesSoap);
    let rolesData = this.heroService.xmltojson(response, 'm_roles');

    if (!rolesData) {
      return [];
    }

    if (!Array.isArray(rolesData)) {
      rolesData = [rolesData];
    }

    return rolesData.map((roleData: any) => {
      const roleName = this.normalizeNullable(roleData.role_name, roleData.role_id || 'Role');
      return {
        id: roleData.role_id || roleName,
        name: roleName,
        code: (roleData.role_id || '').toUpperCase(),
        description: '',
        permissions: [],
        userCount: this.normalizeNumber(roleData.employee_count),
        isActive: true
      };
    }) as Role[];
  }

  async GetAllUserRoleProjectDetails(): Promise<User[]> {
    const getAllUsersSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllUserRoleProjectDetails xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    const response = await this.heroService.ajax(null, null, {}, getAllUsersSoap);
    let usersData = this.heroService.xmltojson(response, 'm_users');

    if (!usersData) {
      return [];
    }

    if (!Array.isArray(usersData)) {
      usersData = [usersData];
    }

    this.userMasterCache.clear();

    return usersData.map((userData: any) => {
      const userId = userData.user_id || userData.email;
      const roleName = this.normalizeNullable(userData.m_roles?.role || userData.role || userData.role_id, 'Employee');
      const masterRecord: UserMasterRecord = {
        userId,
        name: this.normalizeNullable(userData.name, 'Unknown User'),
        email: this.normalizeNullable(userData.email, ''),
        roleId: this.normalizeNullable(userData.role_id, ''),
        roleName,
        status: this.normalizeNullable(userData.status, 'Active'),
        projectId: this.normalizeNullable(userData.project_id, 'null'),
        assetTypeId: this.normalizeNullable(userData.asset_type_id, 'null'),
        createdAt: this.normalizeNullable(userData.created_at, new Date().toISOString()),
        temp1: this.normalizeNullable(userData.temp1, 'null'),
        temp2: this.normalizeNullable(userData.temp2, 'null'),
        temp3: this.normalizeNullable(userData.temp3, 'null'),
        temp4: this.normalizeNullable(userData.temp4, 'null'),
        temp5: this.normalizeNullable(userData.temp5, 'null'),
        temp6: this.normalizeNullable(userData.temp6, 'null'),
        temp7: this.normalizeNullable(userData.temp7, 'null')
      };

      this.userMasterCache.set(userId, masterRecord);

      return {
        id: userId,
        name: masterRecord.name,
        email: masterRecord.email,
        role: masterRecord.roleName as User['role'],
        department: '',
        team: '',
        designation: '',
        isActive: masterRecord.status.toLowerCase() === 'active',
        joinDate: masterRecord.createdAt.split('T')[0],
        projectId: masterRecord.projectId !== 'null' ? masterRecord.projectId : undefined,
        projectName: this.normalizeSoapNullable(userData.m_projects?.project_name, '') || undefined,
        assetTypeId: masterRecord.assetTypeId !== 'null' ? masterRecord.assetTypeId : undefined,
        assetTypeName: this.normalizeSoapNullable(userData.m_asset_types?.asset_type_name || userData.m_asset_types?.name, '') || undefined
      };
    }) as User[];
  }

  async updateUserActiveStatus(userId: string, isActive: boolean): Promise<void> {
    const newStatus = isActive ? 'Active' : 'Inactive';

    const updateUserSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_users xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_users qConstraint="0">
            <user_id>${this.xmlEscape(userId)}</user_id>
          </m_users>
        </old>
        <new>
          <m_users qAccess="0" qConstraint="0" qInit="0" qValues="">
            <status>${this.xmlEscape(newStatus)}</status>
          </m_users>
        </new>
      </tuple>
    </UpdateM_users>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    await this.heroService.ajax(null, null, {}, updateUserSoap);
    const cachedRecord = this.userMasterCache.get(userId);
    if (cachedRecord) {
      this.userMasterCache.set(userId, { ...cachedRecord, status: newStatus });
    }
  }

  async updateUserDetails(userId: string, updates: {
    email?: string;
    roleId?: string;
    projectId?: string;
    assetTypeId?: string;
    status?: string;
  }): Promise<void> {
    const normalizedUserId = this.normalizeNullable(userId, '');
    if (!normalizedUserId) {
      throw new Error('User ID is required.');
    }

    // If role is changing, update in Cordys platform first
    if (updates.roleId) {
      const cached = this.userMasterCache.get(userId);
      const userEmail = updates.email || cached?.email || '';
      if (userEmail) {
        await this.updateUserRoleInCordys(userEmail, updates.roleId);
      } else {
        console.error('[AdminDataService] Cannot update Cordys role: User email not found in cache or updates for ID:', userId);
      }
    }

    // Build only the fields that are provided
    let updateFields = '';
    if (updates.email) {
      updateFields += `<email>${this.xmlEscape(updates.email)}</email>`;
    }
    if (updates.roleId) {
      updateFields += `<role_id>${this.xmlEscape(updates.roleId)}</role_id>`;
    }
    if (updates.projectId !== undefined) {
      updateFields += `<project_id>${this.xmlEscape(updates.projectId)}</project_id>`;
    }
    if (updates.assetTypeId !== undefined) {
      updateFields += `<asset_type_id>${this.xmlEscape(updates.assetTypeId)}</asset_type_id>`;
    }
    if (updates.status !== undefined) {
      updateFields += `<status>${this.xmlEscape(updates.status)}</status>`;
    }

    if (!updateFields) {
      return; // Nothing to update
    }

    const updateUserSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_users xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_users qConstraint="0">
            <user_id>${this.xmlEscape(normalizedUserId)}</user_id>
          </m_users>
        </old>
        <new>
          <m_users qAccess="0" qConstraint="0" qInit="0" qValues="">
            ${updateFields}
          </m_users>
        </new>
      </tuple>
    </UpdateM_users>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    await this.heroService.ajax(null, null, {}, updateUserSoap);

    // Update cache
    const cached = this.userMasterCache.get(userId);
    if (cached) {
      this.userMasterCache.set(userId, {
        ...cached,
        ...(updates.email ? { email: updates.email } : {}),
        ...(updates.roleId ? { roleId: updates.roleId } : {}),
        ...(updates.projectId !== undefined ? { projectId: updates.projectId } : {}),
        ...(updates.assetTypeId !== undefined ? { assetTypeId: updates.assetTypeId } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {})
      });
    }
  }

  /**
   * Helper to find a user ID by their full name from the cache.
   * Useful when an API returns only a name but we need an ID for approvals.
   */
  findUserIdByName(name: string): string | undefined {
    if (!name) return undefined;
    const searchName = name.toLowerCase().trim();
    for (const record of this.userMasterCache.values()) {
      if (record.name.toLowerCase().trim() === searchName) {
        return record.userId;
      }
    }
    return undefined;
  }

  private mapRoleIdToCordysRole(roleId: string): string {
    switch (roleId) {
      case 'rol_01': return 'AMS_Admin';
      case 'rol_02': return 'AMS_TeamLead';
      case 'rol_03': return 'AMS_Employee';
      case 'rol_04': return 'AMS_AssetManager';
      case 'rol_05': return 'AMS_AssetAllocationTeam';
      default: return 'AMS_Employee';
    }
  }

  private async updateUserRoleInCordys(userEmail: string, newRoleId: string): Promise<void> {
    const newCordysRole = this.mapRoleIdToCordysRole(newRoleId);
    const allAmsRoles = ['AMS_Admin', 'AMS_TeamLead', 'AMS_Employee', 'AMS_AssetManager', 'AMS_AssetAllocationTeam'];

    // Helper for delay to avoid rapid-fire SOAP issues in Cordys
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // 1. Remove all OTHER AMS roles first (Clean Slate)
    for (const roleToRemove of allAmsRoles) {
      if (roleToRemove === newCordysRole) continue;

      const removeRoleSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <RemoveRolesFromUser xmlns="http://schemas.cordys.com/UserManagement/1.0/Organization">
      <User>
        <UserName>${this.xmlEscape(userEmail)}</UserName>
        <Roles>
          <Role application="">${this.xmlEscape(roleToRemove)}</Role>
        </Roles>
      </User>
    </RemoveRolesFromUser>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

      try {
        await this.heroService.ajax(null, null, {}, removeRoleSoap);
        await delay(300); // Small pause between role operations
      } catch (err) {
        // Silently ignore if role wasn't assigned or user missing from LDAP at this stage
      }
    }

    // 2. Assign the new Cordys role
    const assignRoleSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <AssignRolesToUser xmlns="http://schemas.cordys.com/UserManagement/1.0/Organization">
      <User>
        <UserName>${this.xmlEscape(userEmail)}</UserName>
        <Roles>
          <Role application="">${this.xmlEscape(newCordysRole)}</Role>
        </Roles>
      </User>
    </AssignRolesToUser>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.heroService.ajax(null, null, {}, assignRoleSoap);
      console.log(`[AdminDataService] Successfully assigned new role: ${newCordysRole}`);
    } catch (e: any) {
      console.error('Failed to assign Cordys role:', e);
      let errorDetail = e?.responseText || e?.errorThrown || '';
      
      // If user is missing from LDAP, we log it and proceed (allowing DB-only users)
      if (errorDetail.includes('getUserFailed') || errorDetail.includes('Could not get user')) {
        console.warn(`[AdminDataService] User ${userEmail} not found in Cordys LDAP. Skipping sync.`);
        return;
      }

      if (typeof errorDetail !== 'string') errorDetail = JSON.stringify(e);
      throw new Error(`Cordys Role Assignment Failed: ${errorDetail}`);
    }
  }

  getUserStatsFromUsers(users: User[]) {
    const roles = [...new Set(users.map(user => this.normalizeNullable(user.role, 'Unknown')).filter(Boolean))];
    return {
      total: users.length,
      active: users.filter(user => user.isActive).length,
      inactive: users.filter(user => !user.isActive).length,
      byRole: roles.map(role => ({
        role,
        count: users.filter(user => user.role === role).length
      }))
    };
  }

  getAdminStats() {
    return {
      totalAllocations: this.allocations.filter(a => a.status === 'Active').length,
      overdueReturns: this.allocations.filter(a => a.status === 'Overdue').length,
      maintenanceActive: this.maintenanceLogs.filter(m => m.status === 'In Progress' || m.status === 'Scheduled').length,
      activeProjects: 0,
      totalMaintenanceCost: this.maintenanceLogs.filter(m => m.status === 'Completed').reduce((sum, m) => sum + m.cost, 0)
    };
  }

  async GetAllAssetsAssignedToAllUsers(): Promise<AssignedAsset[]> {
    const soapMsg = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllAssetsAssignedToAllUsers xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    const response = await this.heroService.ajax(null, null, {}, soapMsg);
    let usersData = this.heroService.xmltojson(response, 'm_users');

    if (!usersData) return [];
    if (!Array.isArray(usersData)) usersData = [usersData];

    return usersData
      .filter((u: any) => this.normalizeSoapNullable(u.m_assets?.asset_id, 'null') !== 'null')
      .map((u: any) => ({
        userId: this.normalizeNullable(u.user_id, ''),
        userName: this.normalizeNullable(u.user_name, ''),
        email: this.normalizeNullable(u.email, ''),
        roleName: this.normalizeSoapNullable(u.m_roles?.role_name, ''),
        assetId: this.normalizeSoapNullable(u.m_assets?.asset_id, ''),
        assetName: this.normalizeSoapNullable(u.m_assets?.asset_name, ''),
        assetType: this.normalizeSoapNullable(u.m_asset_types?.asset_type, ''),
        subCategory: this.normalizeSoapNullable(u.m_asset_subcategories?.sub_category, '')
      })) as AssignedAsset[];
  }

  async getAllRequests(): Promise<AssetRequest[]> {
    const getAllRequestSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <Getallrequest xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    const response = await this.heroService.ajax(null, null, {}, getAllRequestSoap);
    let requestsData = this.heroService.xmltojson(response, 't_asset_requests');

    if (!requestsData) {
      return [];
    }

    if (!Array.isArray(requestsData)) {
      requestsData = [requestsData];
    }

    return requestsData.map((requestData: any) => {
      const emailApprovalRaw = this.normalizeNullable(requestData.email_approval, 'false').toLowerCase();
      return {
        requestId: this.normalizeNullable(requestData.request_id, ''),
        userId: this.normalizeNullable(requestData.user_id, ''),
        userName: this.normalizeSoapNullable(requestData.m_users?.name, 'Unknown User'),
        userEmail: this.normalizeSoapNullable(requestData.m_users?.email, ''),
        assetType: this.normalizeNullable(requestData.asset_type, '-'),
        reason: this.normalizeNullable(requestData.reason, '-'),
        urgency: this.normalizeNullable(requestData.urgency, '-'),
        status: this.normalizeNullable(requestData.status, 'Pending'),
        emailApproval: emailApprovalRaw === 'true' || emailApprovalRaw === '1' || emailApprovalRaw === 'yes',
        document: (() => {
          const t2 = this.normalizeSoapNullable(requestData.temp2, '');
          const d1 = this.normalizeSoapNullable(requestData.document, '');
          
          // Case 1: document column has a server file path (from UploadDocuments_AMS)
          if (d1 && (d1.includes('\\') || d1.includes('/') || /^[A-Z]:/i.test(d1))) return d1;

          // Case 2: document column has modern attachment format filename|base64
          if (d1.includes('|') || d1.startsWith('data:')) return d1;

          // Case 3: temp2 has modern attachment format filename|base64
          if (t2.includes('|') || t2.startsWith('data:')) return t2;
          
          // Case 4: Just filename in temp2
          if (t2 && t2 !== 'null') return t2;
          
          // Case 5: fallback to document if it's not a placeholder
          if (d1 && d1 !== 'ATTACHED' && d1 !== 'null' && !d1.includes('BPM')) return d1;
          
          return '';
        })(),
        createdAt: this.normalizeNullable(requestData.created_at, ''),
        subCategory: this.normalizeNullable(requestData.temp1, '-')
      };
    }) as AssetRequest[];
  }

  async getAllPolicies(): Promise<Policy[]> {
    const getAllPoliciesSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllPolicies xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    const response = await this.heroService.ajax(null, null, {}, getAllPoliciesSoap);
    let policiesData = this.heroService.xmltojson(response, 'm_policy_details') || this.heroService.xmltojson(response, 'm_policies');

    if (!policiesData) return [];
    if (!Array.isArray(policiesData)) policiesData = [policiesData];

    return policiesData.map((p: any) => ({
      id: this.normalizeSoapNullable(p.policy_id, ''),
      policyId: this.normalizeSoapNullable(p.policy_id, ''),
      name: this.normalizeSoapNullable(p.policy_name, 'Untitled Policy'),
      category: this.normalizeSoapNullable(p.category, 'General'),
      effectiveDate: this.normalizeSoapNullable(p.policy_purchase_date || p.effective_date, ''),
      expiryDate: this.normalizeSoapNullable(p.policy_expiry_date || p.expiry_date, ''),
      status: this.normalizeSoapNullable(p.flag || p.status, 'Active'),
      description: this.normalizeSoapNullable(p.description, ''),
      toMailId: this.normalizeSoapNullable(p.to_mailid, ''),
      fromMailId: this.normalizeSoapNullable(p.from_mailid, '')
    })) as Policy[];
  }

  async getAllInactivePolicies(): Promise<Policy[]> {
    const soapMsg = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <Allinactivepolicy xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    const response = await this.heroService.ajax(null, null, {}, soapMsg);
    let policiesData = this.heroService.xmltojson(response, 'm_policy_details') || this.heroService.xmltojson(response, 'm_policies');

    if (!policiesData) return [];
    if (!Array.isArray(policiesData)) policiesData = [policiesData];

    return policiesData.map((p: any) => ({
      id: this.normalizeSoapNullable(p.policy_id, ''),
      policyId: this.normalizeSoapNullable(p.policy_id, ''),
      name: this.normalizeSoapNullable(p.policy_name, 'Untitled Policy'),
      category: this.normalizeSoapNullable(p.category, 'General'),
      effectiveDate: this.normalizeSoapNullable(p.policy_purchase_date || p.effective_date, ''),
      expiryDate: this.normalizeSoapNullable(p.policy_expiry_date || p.expiry_date, ''),
      status: this.normalizeSoapNullable(p.flag || p.status, 'Inactive'),
      description: this.normalizeSoapNullable(p.description, ''),
      toMailId: this.normalizeSoapNullable(p.to_mailid, ''),
      fromMailId: this.normalizeSoapNullable(p.from_mailid, '')
    })) as Policy[];
  }

  private normalizeNullable(value: any, fallback: string): string {
    if (value === null || value === undefined) {
      return fallback;
    }

    const normalized = String(value).trim();
    return !normalized || normalized.toLowerCase() === 'null' ? fallback : normalized;
  }

  private normalizeNumber(value: any): number {
    const normalized = this.normalizeNullable(value, '0');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeSoapNullable(value: any, fallback: string): string {
    if (value === null || value === undefined) {
      return fallback;
    }

    if (typeof value === 'object') {
      if (value['@nil'] === 'true' || value['@null'] === 'true' || value.null === 'true') {
        return fallback;
      }
      // Handle cases where the value is an object containing a text property
      const textVal = value['#text'] || value['text'] || value['_'];
      if (textVal !== undefined && textVal !== null) {
        return this.normalizeNullable(textVal, fallback);
      }
      return fallback;
    }

    return this.normalizeNullable(value, fallback);
  }
  async changeUserPassword(email: string, newPassword: string): Promise<void> {
    const updatePasswordSoap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateUserInOrganization xmlns="http://schemas.cordys.com/UserManagement/1.0/Organization">
      <User>
        <UserName isAnonymous="">\${this.xmlEscape(email)}</UserName>
        <Credentials allowDuplicate="true">
          <UserIDPassword>
            <UserID>\${this.xmlEscape(email)}</UserID>
            <Password>\${this.xmlEscape(newPassword)}</Password>
          </UserIDPassword>
        </Credentials>
      </User>
    </UpdateUserInOrganization>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.heroService.ajax(null, null, {}, updatePasswordSoap);
    } catch (e: any) {
      console.error('Error changing password for user:', e);
      throw new Error('Failed to update user password.');
    }
  }

  async addPolicyDetail(policy: {
    policy_name: string;
    policy_purchase_date: string;
    policy_expiry_date: string;
    flag: string;
    to_mailid: string;
    from_mailid: string;
  }): Promise<void> {
    const soapMsg = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_policy_details xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <new>
          <m_policy_details qAccess="0" qConstraint="0" qInit="0" qValues="">
            <policy_name>${this.xmlEscape(policy.policy_name)}</policy_name>
            <policy_purchase_date>${this.xmlEscape(policy.policy_purchase_date)}</policy_purchase_date>
            <policy_expiry_date>${this.xmlEscape(policy.policy_expiry_date)}</policy_expiry_date>
            <flag>${this.xmlEscape(policy.flag)}</flag>
            <to_mailid>${this.xmlEscape(policy.to_mailid)}</to_mailid>
            <from_mailid>${this.xmlEscape(policy.from_mailid)}</from_mailid>
          </m_policy_details>
        </new>
      </tuple>
    </UpdateM_policy_details>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    await this.heroService.ajax(null, null, {}, soapMsg);
  }

  async updatePolicyDetail(policy: any, policyId?: string): Promise<void> {
    const soapMsg = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_policy_details xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_policy_details>
            <policy_id>${policyId}</policy_id>
          </m_policy_details>
        </old>
        <new>
          <m_policy_details qAccess="0" qConstraint="0" qInit="0" qValues="">
            <policy_name>${this.xmlEscape(policy.policy_name)}</policy_name>
            <policy_purchase_date>${this.xmlEscape(policy.policy_purchase_date)}</policy_purchase_date>
            <policy_expiry_date>${this.xmlEscape(policy.policy_expiry_date)}</policy_expiry_date>
            <flag>${this.xmlEscape(policy.flag)}</flag>
            <to_mailid>${this.xmlEscape(policy.to_mailid)}</to_mailid>
            <from_mailid>${this.xmlEscape(policy.from_mailid)}</from_mailid>
          </m_policy_details>
        </new>
      </tuple>
    </UpdateM_policy_details>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    await this.heroService.ajax(null, null, {}, soapMsg);
  }

  private xmlEscape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

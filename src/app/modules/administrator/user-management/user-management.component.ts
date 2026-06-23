import { Component, OnInit } from '@angular/core';
import { User } from '../../../core/models/user.model';
import { AssetService } from '../../../core/services/asset.service';
import { Asset } from '../../../core/models/asset.model';
import { AdminDataService, Role, Project, Allocation, AssetTypeAssignment, AssignedAsset } from '../../../core/services/admin-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MailService } from '../../../core/services/mail.service';

type UserTab = 'users' | 'roles' | 'projects' | 'assignments';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  readonly employeeRoleName = 'Employee';
  readonly teamLeadRoleName = 'Team Lead';
  readonly assetManagerRoleName = 'Asset Manager';
  readonly assetTeamMemberRoleName = 'Asset Allocation Team';

  users: User[] = [];
  filteredUsers: User[] = [];
  searchTerm = '';
  selectedRole = '';
  userRoles: string[] = [];
  currentPage = 1;
  pageSize = 5;

  activeTab: UserTab = 'users';

  roles: Role[] = [];
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  assetTypes: AssetTypeAssignment[] = [];
  allocations: Allocation[] = [];

  showAddUserModal = false;
  showAddRoleModal = false;
  showAddProjectModal = false;
  showAssignAssetModal = false;
  isSavingProject = false;
  isSavingUser = false;
  addUserEmailError = '';
  addProjectError = '';

  newRole: Partial<Role> = { name: '', code: '', description: '', isActive: true };
  newProject: Pick<Partial<Project>, 'name'> = { name: '' };
  newAllocation: Partial<Allocation> = { assetId: '', userId: '', department: '', status: 'Active' };
  newUser: {
    name: string;
    email: string;
    password: string;
    roleName: string;
    projectId: string;
    assetTypeId: string;
  } = {
    name: '',
    email: '',
    password: '',
    roleName: '',
    projectId: '',
    assetTypeId: ''
  };

  showProjectMembersModal = false;
  selectedProjectForMembers: Project | null = null;
  projectMembersList: User[] = [];

  showRoleMembersModal = false;
  selectedRoleForMembers: Role | null = null;
  roleMembersList: User[] = [];

  showEditModal = false;
  showInactiveModal = false;
  showAssetsModal = false;
  showChangePasswordModal = false;
  passwordChangeUser: User | null = null;
  newPassword = '';
  isSavingPassword = false;
  passwordError = '';

  isUpdatingUserStatus = false;
  editingUser: User | null = null;
  userToDeactivate: User | null = null;
  assetsToRelease: any[] = [];
  isCheckingAssetsBeforeDeactivate = false;
  selectedUser: User | null = null;
  selectedUserAssets: Asset[] = [];

  // Edit User Modal
  editUserForm: {
    email: string;
    roleName: string;
    projectId: string;
    assetTypeIds: string[];
  } = { email: '', roleName: '', projectId: '', assetTypeIds: [] };
  isSavingEdit = false;
  editUserEmailError = '';
  editUserAssignedAssets: AssignedAsset[] = [];
  isLoadingEditAssets = false;

  showUserAssetsSidebar = false;
  selectedSidebarUser: User | null = null;
  allAssignedAssets: AssignedAsset[] = [];
  userAssignedAssets: AssignedAsset[] = [];
  isLoadingUserAssets = false;

  // Confirmation Modal State
  showConfirmModal = false;
  showConfirmAction = true;
  confirmTitle = '';
  confirmMessage = '';
  confirmBtnText = 'Confirm';
  onConfirmCallback: (() => void) | null = null;

  constructor(
    private assetService: AssetService,
    private adminDataService: AdminDataService,
    private notificationService: NotificationService,
    private mailService: MailService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadRoles();
    await this.loadProjects();
    await this.loadAssetTypes();
    await this.loadUsers();
    this.allocations = this.adminDataService.getAllocations();
    this.filterUsers();
    this.filterProjects();
  }

  // --- Project Management Additions ---

  openProjectMembersModal(project: Project): void {
    this.selectedProjectForMembers = project;
    // memberCount in projects is from user count by project
    this.projectMembersList = this.users.filter(u => u.projectName === project.name || u.projectId === project.id);
    this.showProjectMembersModal = true;
  }

  closeProjectMembersModal(): void {
    this.showProjectMembersModal = false;
    this.selectedProjectForMembers = null;
    this.projectMembersList = [];
  }

  openRoleMembersModal(role: Role): void {
    const targetRoleName = role.name.trim().toLowerCase();
    this.selectedRoleForMembers = role;
    this.roleMembersList = this.users.filter(u => 
      (u.role || '').toString().trim().toLowerCase() === targetRoleName
    );
    
    // Supplement with Asset Type names if needed
    if (role.name === this.assetManagerRoleName || role.name === this.assetTeamMemberRoleName) {
      this.roleMembersList.forEach(user => {
        if (user.assetTypeId) {
          const ids = user.assetTypeId.split(',').map(id => id.trim()).filter(Boolean);
          const names = ids.map(id => {
            const type = this.assetTypes.find(t => t.id === id);
            return type ? type.name : null;
          }).filter(Boolean);
          
          if (names.length > 0) {
            user.assetTypeName = names.join(', ');
          }
        }
      });
    }
    
    this.showRoleMembersModal = true;
  }

  closeRoleMembersModal(): void {
    this.showRoleMembersModal = false;
    this.selectedRoleForMembers = null;
    this.roleMembersList = [];
  }

  async toggleProjectStatus(project: Project): Promise<void> {
    const newStatus = project.status === 'Active' ? 'Completed' : 'Active';

    // Restriction: Cannot inactivate project if members or team lead are assigned
    if (project.status === 'Active') {
      const hasTeamLead = project.teamLead && project.teamLead.trim() !== '' && project.teamLead !== '-';
      const hasMembers = (project.memberCount || 0) > 0;

      if (hasTeamLead || hasMembers) {
        this.openConfirmModal(
          'Action Required',
          'First remove the team lead or employee from the project before marking it as inactive.',
          () => {},
          true // isWarning only
        );
        return;
      }
    }

    const projectIdToUpdate = project.id || project.projectCode; // project_id
    if (!projectIdToUpdate) {
      this.notificationService.showToast('Unable to update project: Missing Project ID.', 'error');
      return;
    }

    try {
      await this.adminDataService.updateProjectStatus(projectIdToUpdate, newStatus);
      project.status = newStatus;
      this.notificationService.showToast(`Project ${project.name} marked as ${newStatus} successfully.`, 'success');
      // If we made it inactive, maybe reload projects just to be sure, though updating locally is fine
    } catch (e: any) {
      console.error('Error toggling project status:', e);
      this.notificationService.showToast('Failed to update project status. Please try again.', 'error');
    }
  }

  setTab(tab: UserTab): void {
    this.activeTab = tab;
  }

  // Generic Confirmation Modal Methods
  openConfirmModal(title: string, message: string, callback: () => void, isWarning: boolean = false) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.onConfirmCallback = callback;
    this.showConfirmAction = !isWarning;
    this.confirmBtnText = isWarning ? 'Close' : 'Confirm';
    this.showConfirmModal = true;
  }

  closeConfirmModal() {
    this.showConfirmModal = false;
    this.onConfirmCallback = null;
  }

  handleConfirm() {
    if (this.onConfirmCallback) {
      this.onConfirmCallback();
    }
    this.closeConfirmModal();
  }

  // Modals for add
  openAddUserModal(): void {
    this.resetNewUserForm();
    this.showAddUserModal = true;
  }

  closeAddUserModal(): void {
    this.showAddUserModal = false;
    this.isSavingUser = false;
    this.resetNewUserForm();
  }

  openAddRoleModal(): void { this.showAddRoleModal = true; }
  closeAddRoleModal(): void { this.showAddRoleModal = false; }

  openAddProjectModal(): void {
    this.newProject = { name: '' };
    this.showAddProjectModal = true;
  }

  closeAddProjectModal(): void {
    this.showAddProjectModal = false;
    this.isSavingProject = false;
    this.newProject = { name: '' };
    this.addProjectError = '';
  }

  openAssignAssetModal(): void { this.showAssignAssetModal = true; }
  closeAssignAssetModal(): void { this.showAssignAssetModal = false; }


  async openUserAssetsSidebar(user: User): Promise<void> {
    this.selectedSidebarUser = user;
    this.showUserAssetsSidebar = true;
    this.isLoadingUserAssets = true;
    this.userAssignedAssets = [];

    try {
      // Always fetch fresh data to ensure accuracy or use a slightly more nuanced caching strategy
      this.allAssignedAssets = await this.adminDataService.GetAllAssetsAssignedToAllUsers();
      this.userAssignedAssets = this.allAssignedAssets.filter(asset => asset.userId === user.id);
    } catch (error) {
      console.error('Error fetching assigned assets:', error);
    } finally {
      this.isLoadingUserAssets = false;
    }
  }

  closeUserAssetsSidebar(): void {
    this.showUserAssetsSidebar = false;
    this.selectedSidebarUser = null;
    this.userAssignedAssets = [];
  }

  onSearchTermChange(): void {
    if (this.activeTab === 'users') {
      this.filterUsers();
    } else if (this.activeTab === 'projects') {
      this.filterProjects();
    }
  }

  filterUsers(): void {
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch =
        !this.searchTerm ||
        user.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesRole = !this.selectedRole || user.role === this.selectedRole;
      return matchesSearch && matchesRole;
    });
    this.currentPage = 1;
  }

  filterProjects(): void {
    this.filteredProjects = this.projects.filter(project => {
      if (!this.searchTerm) return true;
      return project.name.toLowerCase().includes(this.searchTerm.toLowerCase());
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  get paginatedUsers(): User[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  getRangeStart(): number {
    return this.filteredUsers.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  getRangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(page, 1), this.totalPages);
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  getRoleBadgeClass(role: string): string {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole.includes('admin')) {
      return 'badge-blue';
    }
    if (normalizedRole.includes('asset manager')) {
      return 'badge-green';
    }
    if (normalizedRole.includes('allocation')) {
      return 'badge-amber';
    }
    if (normalizedRole.includes('lead')) {
      return 'badge-teal';
    }
    return 'badge-default';
  }

  async openEditModal(user: User): Promise<void> {
    this.editingUser = { ...user };
    this.editUserForm = {
      email: user.email,
      roleName: user.role,
      projectId: user.projectId || '',
      assetTypeIds: user.assetTypeId ? user.assetTypeId.split(',').map(id => id.trim()).filter(Boolean) : []
    };
    this.editUserEmailError = '';
    this.isSavingEdit = false;
    this.showEditModal = true;

    // Load assigned assets for this user
    this.isLoadingEditAssets = true;
    this.editUserAssignedAssets = [];
    try {
      const allAssets = await this.adminDataService.GetAllAssetsAssignedToAllUsers();
      this.editUserAssignedAssets = allAssets.filter(a => a.userId === user.id);
    } catch (error) {
      console.error('Error loading edit user assets:', error);
    } finally {
      this.isLoadingEditAssets = false;
    }
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingUser = null;
    this.editUserForm = { email: '', roleName: '', projectId: '', assetTypeIds: [] };
    this.editUserEmailError = '';
    this.editUserAssignedAssets = [];
    this.isSavingEdit = false;
  }

  isAssetTypeSelected(typeId: string): boolean {
    return this.editUserForm.assetTypeIds.includes(typeId);
  }

  toggleEditAssetType(typeId: string): void {
    const index = this.editUserForm.assetTypeIds.indexOf(typeId);
    if (index > -1) {
      this.editUserForm.assetTypeIds.splice(index, 1);
    } else {
      this.editUserForm.assetTypeIds.push(typeId);
    }
  }

  openChangePasswordModal(user: User): void {
    this.passwordChangeUser = user;
    this.newPassword = '';
    this.passwordError = '';
    this.isSavingPassword = false;
    this.showChangePasswordModal = true;
  }

  closeChangePasswordModal(): void {
    this.showChangePasswordModal = false;
    this.passwordChangeUser = null;
    this.newPassword = '';
    this.passwordError = '';
    this.isSavingPassword = false;
  }

  async saveNewPassword(): Promise<void> {
    if (!this.passwordChangeUser || !this.newPassword || this.isSavingPassword) return;
    
    if (this.newPassword.length < 8) {
        this.passwordError = 'Password must be at least 8 characters long.';
        return;
    }

    this.isSavingPassword = true;
    this.passwordError = '';

    try {
      await this.adminDataService.changeUserPassword(this.passwordChangeUser.email, this.newPassword);
      this.notificationService.showToast(`Password for \${this.passwordChangeUser.name} changed successfully.`, 'success');
      this.closeChangePasswordModal();
    } catch (e: any) {
      this.passwordError = 'Failed to change password. Please try again.';
      this.isSavingPassword = false;
    }
  }

  onEditUserEmailChange(email: string): void {
    this.editUserForm.email = email;
    const trimmed = email.trim().toLowerCase();
    // Allow same email as current user, but reject duplicates with other users
    if (trimmed && this.editingUser) {
      const isDuplicate = this.users.some(
        u => u.email.trim().toLowerCase() === trimmed && u.id !== this.editingUser!.id
      );
      this.editUserEmailError = isDuplicate ? 'This email already exists for another user.' : '';
    } else {
      this.editUserEmailError = '';
    }
  }

  onEditUserRoleChange(roleName: string): void {
    this.editUserForm.roleName = roleName;
    this.editUserForm.projectId = '';
    this.editUserForm.assetTypeIds = [];
  }

  get editRequiresProject(): boolean {
    return this.editUserForm.roleName === this.employeeRoleName || this.editUserForm.roleName === this.teamLeadRoleName;
  }

  get editRequiresAssetType(): boolean {
    return this.editUserForm.roleName === this.assetTeamMemberRoleName || 
           this.editUserForm.roleName === this.assetManagerRoleName;
  }

  get canSaveEditUser(): boolean {
    if (this.isSavingEdit || !!this.editUserEmailError) {
      return false;
    }
    if (!this.editUserForm.email.trim() || !this.editUserForm.roleName) {
      return false;
    }
    return true;
  }

  get availableProjectsForEditUser(): Project[] {
    if (!this.editingUser) return this.projects;

    if (this.editUserForm.roleName === this.teamLeadRoleName) {
      return this.projects.filter(project => {
        const hasNoLead = !project.teamLead?.trim() || project.teamLead === '-';
        const isCurrentLead = project.teamLeadId === this.editingUser?.id;
        return hasNoLead || isCurrentLead;
      });
    }

    return this.projects;
  }

  async saveUser(): Promise<void> {
    if (!this.editingUser || !this.canSaveEditUser) {
      return;
    }

    this.isSavingEdit = true;

    try {
      const targetRoleName = this.editUserForm.roleName.trim().toLowerCase();

      // Restriction: Ensure only one Asset Manager per Asset Type for each selected type
      if (targetRoleName === this.assetManagerRoleName.toLowerCase() && this.editUserForm.assetTypeIds.length > 0) {
        await this.loadAssetTypes(); // Get fresh data
        for (const typeId of this.editUserForm.assetTypeIds) {
          const existingType = this.assetTypes.find(t => t.id === typeId);
          if (existingType) {
            const amId = (existingType.assetManagerId || '').trim();
            const amName = (existingType.assetManager || '').trim();
            const hasManager = amId !== '' || amName !== '';
            
            if (hasManager && amId !== this.editingUser.id) {
              this.notificationService.showToast(`An Asset Manager is already assigned to the '${existingType.name}' asset type.`, 'error');
              this.isSavingEdit = false;
              return;
            }
          }
        }
      }

      // Restriction: Ensure only one Allocation Team Member per Asset Type
      if (targetRoleName === this.assetTeamMemberRoleName.toLowerCase() && this.editUserForm.assetTypeIds.length > 0) {
        await this.loadAssetTypes();
        for (const typeId of this.editUserForm.assetTypeIds) {
          const existingType = this.assetTypes.find(t => t.id === typeId);
          if (existingType) {
            const teamMember = (existingType.teamMembers || '').trim();
            if (teamMember !== '' && teamMember !== this.editingUser.name) {
              this.notificationService.showToast(`An Allocation Team Member is already assigned to the '${existingType.name}' asset type.`, 'error');
              this.isSavingEdit = false;
              return;
            }
          }
        }
      }

      // Restriction: Ensure only one Team Lead per Project
      if (targetRoleName === this.teamLeadRoleName.toLowerCase() && this.editUserForm.projectId) {
        await this.loadProjects(); // Get fresh data
        const targetProject = this.projects.find(p => p.id === this.editUserForm.projectId);
        if (targetProject) {
          const tlId = (targetProject.teamLeadId || '').trim();
          const tlName = (targetProject.teamLead || '').trim();
          const hasLead = (tlId !== '' && tlId !== '-') || (tlName !== '' && tlName !== '-');
          
          if (hasLead && tlId !== this.editingUser.id) {
            this.openConfirmModal(
              'Team Lead Already Assigned',
              `The project '${targetProject.name}' already has a Team Lead assigned. Please remove the existing Team Lead from that project first.`,
              () => {},
              true // isWarning only
            );
            this.isSavingEdit = false;
            return;
          }
        }
      }

      const selectedRole = this.roles.find(r => r.name.trim().toLowerCase() === targetRoleName);
      if (!selectedRole && this.editUserForm.roleName !== this.editingUser.role) {
        console.error('[UserManagement] Selected role not found in roles list:', targetRoleName);
        this.notificationService.showToast('Invalid role selected.', 'error');
        this.isSavingEdit = false;
        return;
      }

      const updates: {
        email?: string;
        roleId?: string;
        projectId?: string;
        assetTypeId?: string;
      } = {};

      // Only include changed fields
      if (this.editUserForm.email.trim() !== this.editingUser.email) {
        updates.email = this.editUserForm.email.trim();
      }
      if (this.editUserForm.roleName !== this.editingUser.role && selectedRole) {
        updates.roleId = selectedRole.id;
      }
      // Handle Project Clearing for roles like Asset Manager/Admin
      if (!this.editRequiresProject) {
        updates.projectId = '';
      } else if (this.editUserForm.projectId) {
        updates.projectId = this.editUserForm.projectId;
      }

      // Handle Asset Type Clearing for roles that don't need it
      if (!this.editRequiresAssetType) {
        updates.assetTypeId = '';
      } else {
        updates.assetTypeId = this.editUserForm.assetTypeIds.join(',');
      }

      await this.adminDataService.updateUserDetails(this.editingUser.id, updates);

      // 4. Role Change Cleanup (If role changed, remove from previous functional assignments)
      if (this.editUserForm.roleName !== this.editingUser.role) {
        // Clear Team Lead assignment
        if (this.editingUser.role === this.teamLeadRoleName) {
          const ledProject = this.projects.find(p => p.teamLeadId === this.editingUser?.id);
          if (ledProject) await this.adminDataService.assignTeamLeadToProject(ledProject.id, ''); 
        }

        // Clear Asset Manager assignment
        if (this.editingUser.role === this.assetManagerRoleName) {
          const managedType = this.assetTypes.find(t => t.assetManagerId === this.editingUser?.id);
          if (managedType) await this.adminDataService.clearAssetManagerFromType(managedType.id);
        }

        // Clear Allocation Team assignment
        if (this.editingUser.role === this.assetTeamMemberRoleName) {
          const allocationType = this.assetTypes.find(t => 
            (t.teamMembers || '').split(',').map(m => m.trim()).includes(this.editingUser?.name || '')
          );
          if (allocationType) {
            const updatedMembers = (allocationType.teamMembers || '')
              .split(',')
              .map(m => m.trim())
              .filter(m => m !== this.editingUser?.name)
              .join(', ');
            await this.adminDataService.updateAssetTypeTeamMembers(allocationType.id, updatedMembers);
          }
        }
      }

      // If role changed to TeamLead and a project was selected, assign as TL
      if (updates.roleId && targetRoleName === this.teamLeadRoleName.toLowerCase() && this.editUserForm.projectId) {
        await this.adminDataService.assignTeamLeadToProject(this.editUserForm.projectId, this.editingUser.id);
      }

      // Reload from DB to reflect changes
      await this.loadUsers();
      await this.loadRoles();
      await this.loadProjects();
      await this.loadAssetTypes();
      this.filterUsers();
      this.notificationService.showToast('User details updated successfully!', 'success');
      this.closeEditModal();

    } catch (error) {
      console.error('Unable to update user details.', error);
      const errorMsg = error instanceof Error ? error.message : 'Please try again.';
      this.notificationService.showToast(`Failed to update user details: ${errorMsg}`, 'error');
    } finally {
      this.isSavingEdit = false;
    }
  }

  onAddUserRoleChange(roleName: string): void {
    this.newUser.roleName = roleName;
    this.newUser.projectId = '';
    this.newUser.assetTypeId = '';
  }

  onAddUserEmailChange(email: string): void {
    this.newUser.email = email;
    this.addUserEmailError = this.isDuplicateEmail(email.trim())
      ? 'This email already exists. Same user cannot be added again.'
      : '';

    // Generate password from email prefix
    if (email.trim() && email.includes('@')) {
      const emailPrefix = email.split('@')[0].replace(/\s+/g, '').toLowerCase();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      this.newUser.password = `${emailPrefix}@ams${randomSuffix}`;
    }
  }

  onAddUserNameChange(name: string): void {
    this.newUser.name = name;
  }

  async saveNewUser(): Promise<void> {
    const name = this.newUser.name.trim();
    const email = this.newUser.email.trim();
    const roleName = this.newUser.roleName;
    const selectedRole = this.roles.find(role => role.name === roleName);

    if (!name || !email || !selectedRole || this.isSavingUser) {
      return;
    }

    if (this.isDuplicateEmail(email)) {
      this.addUserEmailError = 'This email already exists. Same user cannot be added again.';
      return;
    }

    if (this.requiresProjectSelection && !this.newUser.projectId) {
      return;
    }

    if (this.requiresAssetTypeSelection && !this.newUser.assetTypeId) {
      return;
    }

    // Restriction: Ensure only one Asset Manager per Asset Type
    if (roleName === this.assetManagerRoleName && this.newUser.assetTypeId) {
      await this.loadAssetTypes(); // Get fresh data
      const existingType = this.assetTypes.find(t => t.id === this.newUser.assetTypeId);
      if (existingType && (existingType.assetManagerId || existingType.assetManager)) {
        this.notificationService.showToast('An Asset Manager is already assigned to this asset type. Please remove the existing manager first.', 'error');
        this.isSavingUser = false;
        return;
      }
    }

    // Restriction: Ensure only one Allocation Team Member per Asset Type
    if (roleName === this.assetTeamMemberRoleName && this.newUser.assetTypeId) {
      await this.loadAssetTypes();
      const existingType = this.assetTypes.find(t => t.id === this.newUser.assetTypeId);
      if (existingType && existingType.teamMembers.trim()) {
        this.notificationService.showToast('An Allocation Team Member is already assigned to this asset type. Please remove the existing member first.', 'error');
        this.isSavingUser = false;
        return;
      }
    }

    this.isSavingUser = true;
    const generatedPassword = this.newUser.password || 'Qwerty@1234';

    try {
      // 1. Add User (This now includes strict Cordys creation check)
      console.log('[UserManagement] Initiating user registration flow...');
      const userId = await this.adminDataService.addUser({
        userId: this.generateNextUserId(),
        name,
        email,
        password: generatedPassword,
        roleId: selectedRole.id,
        projectId: this.newUser.projectId || undefined,
        assetTypeId: this.newUser.assetTypeId || undefined
      });

      // 2. Assign Project TL if needed
      if (roleName === this.teamLeadRoleName && this.newUser.projectId) {
        console.log('[UserManagement] Assigning Team Lead role to project...');
        await this.adminDataService.assignTeamLeadToProject(this.newUser.projectId, userId);
      }

      // 3. Send Welcome Email (MUST succeed or throw)
      console.log('[UserManagement] Dispatching welcome emails...');
      await this.mailService.sendWelcomeEmail(email, name, generatedPassword);

      // 4. Finalize
      console.log('[UserManagement] Registration flow completed successfully.');
      await this.loadUsers();
      await this.loadProjects();
      await this.loadAssetTypes();
      await this.loadRoles();
      this.filterUsers();
      this.notificationService.showToast(`User '${name}' created and welcome email sent!`, 'success');
      this.closeAddUserModal();

    } catch (error) {
      console.error('[UserManagement] Registration failed at some stage:', error);
      this.isSavingUser = false;
      const errorMsg = error instanceof Error ? error.message : 'Please try again.';
      this.notificationService.showToast(errorMsg, 'error');
    } finally {
      this.isSavingUser = false;
    }
  }

  async saveProject(): Promise<void> {
    const projectName = this.newProject.name?.trim();

    if (!projectName || this.isSavingProject) {
      return;
    }

    // Duplicate check
    const isDuplicate = this.projects.some(p => p.name.trim().toLowerCase() === projectName.toLowerCase());
    if (isDuplicate) {
      this.addProjectError = 'Project name already exists. Please use a different name.';
      return;
    }

    this.isSavingProject = true;
    this.addProjectError = '';

    try {
      await this.adminDataService.addProject(projectName);
      await this.loadProjects();
      this.notificationService.showToast(`Project '${projectName}' added successfully!`, 'success');
      this.closeAddProjectModal();

    } catch (error) {
      console.error('Unable to add project.', error);
      this.addProjectError = 'Unable to add project. Please try again.';
      this.isSavingProject = false;
    }
  }

  async openInactiveModal(user: User): Promise<void> {
    this.userToDeactivate = user;
    this.showInactiveModal = true;
    this.assetsToRelease = [];

    // Only check assets if we are marking a user INACTIVE
    if (user.isActive) {
      this.isCheckingAssetsBeforeDeactivate = true;
      try {
        const allAssets = await this.assetService.fetchAllRawAssets();
        this.assetsToRelease = allAssets.filter(asset => asset.temp1 === user.id);
      } catch (error) {
        console.error('Error fetching assets before deactivation:', error);
      } finally {
        this.isCheckingAssetsBeforeDeactivate = false;
      }
    }
  }

  closeInactiveModal(): void {
    this.showInactiveModal = false;
    this.isUpdatingUserStatus = false;
    this.isCheckingAssetsBeforeDeactivate = false;
    this.userToDeactivate = null;
    this.assetsToRelease = [];
  }

  async confirmInactive(): Promise<void> {
    if (this.userToDeactivate && !this.isUpdatingUserStatus) {
      this.isUpdatingUserStatus = true;
      try {
        const nextStatus = !this.userToDeactivate.isActive;

        // 1. Release assets if user is being deactivated
        if (!nextStatus && this.assetsToRelease.length > 0) {
          for (const asset of this.assetsToRelease) {
            await this.assetService.releaseAsset(asset);
          }
        }

        // 1.5 Release roles/assignments if user is being deactivated
        if (!nextStatus) {
          // Releasing Team Lead assignment from projects
          const ledProjects = this.projects.filter(p => p.teamLeadId === this.userToDeactivate?.id);
          for (const project of ledProjects) {
            await this.adminDataService.assignTeamLeadToProject(project.id, '');
            project.teamLeadId = '';
            project.teamLead = '';
          }

          // Releasing Asset Manager assignment from asset types
          const managedTypes = this.assetTypes.filter(t => t.assetManagerId === this.userToDeactivate?.id);
          for (const type of managedTypes) {
            await this.adminDataService.clearAssetManagerFromType(type.id);
            type.assetManagerId = '';
            type.assetManager = '';
          }

          // Releasing Allocation Team assignment from asset types
          const allocationTypes = this.assetTypes.filter(t => 
            (t.teamMembers || '').split(',').map(m => m.trim()).includes(this.userToDeactivate?.name || '')
          );
          for (const type of allocationTypes) {
            const updatedMembers = (type.teamMembers || '')
              .split(',')
              .map(m => m.trim())
              .filter(m => m !== this.userToDeactivate?.name)
              .join(', ');
            await this.adminDataService.updateAssetTypeTeamMembers(type.id, updatedMembers);
            type.teamMembers = updatedMembers;
          }
        }

        // 2. Update user status in DB AND clear their own assignments
        const nextStatusStr = nextStatus ? 'Active' : 'Inactive';
        await this.adminDataService.updateUserDetails(this.userToDeactivate.id, {
          status: nextStatusStr,
          projectId: !nextStatus ? '' : undefined,
          assetTypeId: !nextStatus ? '' : undefined
        });

        // 3. Update local state
        const updatedUser = { 
          ...this.userToDeactivate, 
          isActive: nextStatus,
          projectId: !nextStatus ? undefined : this.userToDeactivate.projectId,
          assetTypeId: !nextStatus ? undefined : this.userToDeactivate.assetTypeId
        };
        this.users = this.users.map(user => user.id === updatedUser.id ? updatedUser : user);
        this.filterUsers();
        this.notificationService.showToast(`User status marked as ${nextStatus ? 'Active' : 'Inactive'} successfully.`, 'success');
        this.closeInactiveModal();

      } catch (error) {
        console.error('Unable to mark user inactive.', error);
        this.isUpdatingUserStatus = false;
      }
    }
  }

  toggleUserActive(user: User): void {
    this.openInactiveModal(user).then();
  }

  get requiresProjectSelection(): boolean {
    return this.newUser.roleName === this.employeeRoleName || this.newUser.roleName === this.teamLeadRoleName;
  }

  get requiresAssetTypeSelection(): boolean {
    return this.newUser.roleName === this.assetManagerRoleName || this.newUser.roleName === this.assetTeamMemberRoleName;
  }

  get shouldShowProjectDropdown(): boolean {
    return this.requiresProjectSelection;
  }

  get shouldShowAssetTypeDropdown(): boolean {
    return this.requiresAssetTypeSelection;
  }

  get canSaveNewUser(): boolean {
    if (this.isSavingUser || !!this.addUserEmailError) {
      return false;
    }

    if (!this.newUser.name.trim() || !this.newUser.email.trim() || !this.newUser.roleName) {
      return false;
    }

    // Role-specific validation for Projects (Employee, Team Lead)
    if (this.requiresProjectSelection) {
      if (!this.newUser.projectId) return false;
      if (this.newUser.roleName === this.teamLeadRoleName && this.availableTeamLeadProjects.length === 0) return false;
    }

    // Role-specific validation for Asset Types (Asset Manager, Asset Team)
    if (this.requiresAssetTypeSelection) {
      if (!this.newUser.assetTypeId) return false;
      if (this.newUser.roleName === this.assetManagerRoleName && this.availableAssetTypesForNewUser.length === 0) return false;
      if (this.assetTypes.length === 0) return false;
    }

    return true;
  }

  get availableProjectsForNewUser(): Project[] {
    if (this.newUser.roleName === this.teamLeadRoleName) {
      return this.availableTeamLeadProjects;
    }

    if (this.newUser.roleName === this.employeeRoleName) {
      return this.projects;
    }

    return [];
  }

  get availableAssetTypesForNewUser(): AssetTypeAssignment[] {
    if (this.newUser.roleName === this.assetManagerRoleName) {
      return this.assetTypes.filter(assetType => !assetType.assetManager.trim());
    }

    if (this.newUser.roleName === this.assetTeamMemberRoleName) {
      return this.assetTypes.filter(assetType => !assetType.teamMembers.trim());
    }

    return [];
  }

  get availableTeamLeadProjects(): Project[] {
    return this.projects.filter(project => !project.teamLead?.trim());
  }

  openAssetsModal(user: User): void {
    this.selectedUser = user;
    this.selectedUserAssets = this.assetService.getAssetsByUser(user.id);
    this.showAssetsModal = true;
  }

  closeAssetsModal(): void {
    this.showAssetsModal = false;
    this.selectedUser = null;
    this.selectedUserAssets = [];
  }

  private async loadUsers(): Promise<void> {
    try {
      this.users = (await this.adminDataService.GetAllUserRoleProjectDetails()).reverse();
      
      // Enrich with asset type names for table display
      this.users.forEach(user => {
        if (user.assetTypeId) {
          const ids = user.assetTypeId.split(',').map(id => id.trim()).filter(Boolean);
          const names = ids.map(id => {
            const type = this.assetTypes.find(t => t.id === id);
            return type ? type.name : null;
          }).filter(Boolean);
          
          if (names.length > 0) {
            user.assetTypeName = names.join(', ');
          }
        }
      });

      this.updateProjectMemberCounts();
    } catch (error) {
      console.error('Unable to load DB users for admin user management.', error);
      this.users = [];
    }
  }

  private async loadRoles(): Promise<void> {
    try {
      this.roles = await this.adminDataService.getRolesFromDB();
      this.userRoles = this.roles.map(role => role.name);
    } catch (error) {
      console.error('Unable to load DB roles for admin user management.', error);
      this.roles = [];
      this.userRoles = [];
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      this.projects = await this.adminDataService.getProjectsFromDB();
      this.updateProjectMemberCounts();
      this.filterProjects();
    } catch (error) {
      console.error('Unable to load DB projects for admin user management.', error);
      this.projects = [];
      this.filteredProjects = [];
    }
  }

  private updateProjectMemberCounts(): void {
    if (!this.projects || !this.users || this.users.length === 0) return;
    
    this.projects.forEach(project => {
      // Calculate true membership count including both Employees and the Team Lead
      const members = this.users.filter(u => u.projectName === project.name || u.projectId === project.id);
      project.memberCount = members.length;
    });
  }

  private async loadAssetTypes(): Promise<void> {
    try {
      this.assetTypes = await this.adminDataService.getAssetTypeAssignmentDetails();
    } catch (error) {
      console.error('Unable to load DB asset types for admin user management.', error);
      this.assetTypes = [];
    }
  }

  private resetNewUserForm(): void {
    this.newUser = {
      name: '',
      email: '',
      password: '',
      roleName: '',
      projectId: '',
      assetTypeId: ''
    };
    this.addUserEmailError = '';
  }

  private generateNextUserId(): string {
    const nextNumber = this.users
      .map(user => {
        const match = user.id.match(/(\d+)$/);
        return match ? Number(match[1]) : 0;
      })
      .reduce((max, value) => Math.max(max, value), 0) + 1;

    return `usr_${String(nextNumber).padStart(3, '0')}`;
  }

  private isDuplicateEmail(email: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    return !!normalizedEmail && this.users.some(user => user.email.trim().toLowerCase() === normalizedEmail);
  }
}

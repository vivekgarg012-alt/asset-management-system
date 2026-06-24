import { Component, OnInit } from '@angular/core';
import { AdminDataService, Policy } from '../../../core/services/admin-data.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-policy-details',
  templateUrl: './policy-details.component.html',
  styleUrls: ['./policy-details.component.scss']
})
export class PolicyDetailsComponent implements OnInit {
  policies: Policy[] = [];
  loading = false;
  isSaving = false;
  showAddModal = false;
  isViewOnly = false;
  isEditMode = false;
  modalTitle = 'Add New Policy';

  activeTab: 'registry' | 'inactive' = 'registry';
  inactivePolicies: Policy[] = [];

  searchQuery = '';
  statusFilter = 'All';
  filteredPolicies: Policy[] = [];
  pagedPolicies: Policy[] = [];

  get basePolicies(): Policy[] {
    return this.activeTab === 'registry' ? this.policies : this.inactivePolicies;
  }
  
  currentPage = 1;
  pageSize = 5;
  totalPages = 1;

  stats = {
    totalPolicies: 0,
    expiringSoon: 0,
    activePolicies: 0,
    inactivePolicies: 0
  };

  newPolicy = {
    policy_name: '',
    policy_purchase_date: '',
    policy_expiry_date: '',
    flag: 'Active',
    to_mailid: '',
    from_mailid: 'pratichig@adnatesolutions.com'
  };

  errors = {
    policy_name: '',
    purchase_date: '',
    expiry_date: '',
    to_mailid: ''
  };

  userEmails: string[] = [];
  filteredUserEmails: string[] = [];
  showEmailSuggestions = false;
  emailChips: string[] = [];
  emailInputValue = '';

  constructor(
    private adminDataService: AdminDataService,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadPolicies();
    this.loadUserEmails();
  }

  async loadUserEmails() {
    try {
      const users = await this.adminDataService.GetAllUserRoleProjectDetails();
      this.userEmails = [...new Set(users.map(u => u.email).filter(Boolean))].sort();
    } catch (error) {
      console.error('Error loading user emails:', error);
    }
  }

  onToEmailInput() {
    if (this.isViewOnly) return;
    const val = this.emailInputValue || '';
    
    this.filteredUserEmails = this.userEmails.filter(email => 
      email.toLowerCase().includes(val.toLowerCase()) && 
      !this.emailChips.includes(email)
    );
    this.showEmailSuggestions = this.filteredUserEmails.length > 0;
  }

  addEmailChip(email: string) {
    if (this.isViewOnly) return;
    const cleanEmail = email.trim().replace(/[,;]$/, '');
    if (cleanEmail && this.validateEmail(cleanEmail) && !this.emailChips.includes(cleanEmail)) {
      this.emailChips.push(cleanEmail);
      this.emailInputValue = '';
      this.onToEmailInput();
      this.errors.to_mailid = '';
    }
  }

  onEmailKeyDown(event: any) {
    if (this.isViewOnly) return;
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addEmailChip(this.emailInputValue);
    } else if (event.key === 'Backspace' && !this.emailInputValue && this.emailChips.length > 0) {
      this.removeEmailChip(this.emailChips.length - 1);
    }
  }

  removeEmailChip(index: number) {
    if (this.isViewOnly) return;
    this.emailChips.splice(index, 1);
  }

  validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  async loadPolicies() {
    this.loading = true;
    try {
      this.policies = await this.adminDataService.getAllPolicies();
      this.inactivePolicies = await this.adminDataService.getAllInactivePolicies();
      this.applyFilters();
      this.calculateStats();
    } catch (error) {
      console.error('Error loading policies:', error);
      this.notificationService.showToast('Error loading policies', 'error');
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    let result = [...this.basePolicies];

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.policyId.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    if (this.statusFilter !== 'All') {
      result = result.filter(p => 
        (p.status || '').toLowerCase() === this.statusFilter.toLowerCase()
      );
    }

    result.sort((a, b) => {
       return b.policyId.localeCompare(a.policyId, undefined, { numeric: true, sensitivity: 'base' });
    });

    this.filteredPolicies = result;
    this.totalPages = Math.ceil(this.filteredPolicies.length / this.pageSize) || 1;
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.pagedPolicies = this.filteredPolicies.slice(startIndex, endIndex);
  }

  switchTab(tab: 'registry' | 'inactive') {
    this.activeTab = tab;
    this.searchQuery = '';
    this.statusFilter = 'All';
    this.applyFilters();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  onSearchChange() {
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  get startIndex(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredPolicies.length);
  }

  calculateStats() {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const allPoliciesCombined = [...this.policies, ...this.inactivePolicies];
    // Deduplicate by ID just in case
    const uniqueMap = new Map();
    allPoliciesCombined.forEach(p => uniqueMap.set(p.policyId, p));
    const uniquePolicies = Array.from(uniqueMap.values()) as Policy[];

    this.stats.totalPolicies = uniquePolicies.length;

    this.stats.expiringSoon = uniquePolicies.filter(p => {
      if (!p.expiryDate) return false;
      const expiry = new Date(p.expiryDate);
      return expiry > today && expiry <= thirtyDaysFromNow;
    }).length;

    this.stats.activePolicies = uniquePolicies.filter(p => p.status?.toLowerCase() === 'active').length;
    this.stats.inactivePolicies = uniquePolicies.filter(p => p.status?.toLowerCase() === 'inactive').length;
  }

  onAddPolicy() {
    this.modalTitle = 'Add New Policy';
    this.isViewOnly = false;
    this.isEditMode = false;
    this.resetNewPolicy();
    this.showAddModal = true;
  }

  onViewPolicy(policy: Policy) {
    this.modalTitle = 'Policy Details';
    this.isViewOnly = true;
    this.isEditMode = false;
    this.clearErrors();
    this.populateForm(policy);
    this.showAddModal = true;
  }

  onEditPolicy(policy: Policy) {
    this.modalTitle = 'Edit Policy';
    this.isEditMode = true;
    this.isViewOnly = false;
    this.clearErrors();
    this.populateForm(policy);
    this.showAddModal = true;
  }

  populateForm(policy: Policy) {
    this.newPolicy = {
      policy_name: policy.name,
      policy_purchase_date: policy.effectiveDate || '',
      policy_expiry_date: policy.expiryDate || '',
      flag: policy.status || 'Active',
      to_mailid: policy.toMailId || '',
      from_mailid: policy.fromMailId || ''
    };
    this.emailChips = this.getEmailList(policy.toMailId);
    this.emailInputValue = '';
  }

  resetNewPolicy() {
    this.newPolicy = {
      policy_name: '',
      policy_purchase_date: new Date().toISOString().split('T')[0],
      policy_expiry_date: '',
      flag: 'Active',
      to_mailid: '',
      from_mailid: 'pratichig@adnatesolutions.com'
    };
    this.emailChips = [];
    this.emailInputValue = '';
    this.clearErrors();
    this.showEmailSuggestions = false;
  }

  clearErrors() {
    this.errors = {
      policy_name: '',
      purchase_date: '',
      expiry_date: '',
      to_mailid: ''
    };
  }

  validateForm(): boolean {
    this.clearErrors();
    let isValid = true;
    const todayStr = new Date().toISOString().split('T')[0];

    if (!this.newPolicy.policy_name.trim()) {
      this.errors.policy_name = 'Policy name is required';
      isValid = false;
    }

    if (this.newPolicy.policy_purchase_date > todayStr) {
      this.errors.purchase_date = 'Purchase date cannot be in the future';
      isValid = false;
    }

    if (this.newPolicy.policy_expiry_date && this.newPolicy.policy_expiry_date < todayStr) {
      this.errors.expiry_date = 'Expiry date cannot be in the past';
      isValid = false;
    }
    
    if (this.newPolicy.policy_expiry_date && this.newPolicy.policy_purchase_date && 
        this.newPolicy.policy_expiry_date <= this.newPolicy.policy_purchase_date) {
      this.errors.expiry_date = 'Expiry date must be after purchase date';
      isValid = false;
    }

    if (this.emailChips.length === 0) {
      this.errors.to_mailid = 'At least one recipient email is required';
      isValid = false;
    }

    return isValid;
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  async onSavePolicy() {
    if (this.isViewOnly) return;
    this.newPolicy.to_mailid = this.emailChips.join('; ');

    if (!this.validateForm()) {
      this.notificationService.showToast('Please correct the errors in the form', 'warning');
      return;
    }

    this.isSaving = true;
    try {
      if (this.isEditMode) {
        const originalPolicy = this.policies.find(p => p.name === this.newPolicy.policy_name);
        await this.adminDataService.updatePolicyDetail(this.newPolicy, originalPolicy?.policyId);
        this.notificationService.showToast('Policy updated successfully', 'success');
      } else {
        await this.adminDataService.addPolicyDetail(this.newPolicy);
        this.notificationService.showToast('New policy added successfully', 'success');
      }
      this.showAddModal = false;
      await this.loadPolicies();
    } catch (error) {
      console.error('Error saving policy:', error);
      this.notificationService.showToast('Failed to save policy. Please try again.', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  async onTogglePolicyStatus(policy: Policy) {
    if (this.loading) return;
    this.loading = true;
    try {
      const newStatus = policy.status?.toLowerCase() === 'active' ? 'Inactive' : 'Active';
      const updatedPolicy = {
        policy_name: policy.name,
        policy_purchase_date: policy.effectiveDate || '',
        policy_expiry_date: policy.expiryDate || '',
        flag: newStatus,
        to_mailid: policy.toMailId || '',
        from_mailid: policy.fromMailId || ''
      };
      
      await this.adminDataService.updatePolicyDetail(updatedPolicy, policy.policyId);
      this.notificationService.showToast(`Policy marked as ${newStatus}`, 'success');
      await this.loadPolicies();
    } catch (error) {
      console.error('Error toggling policy status:', error);
      this.notificationService.showToast('Failed to update policy status', 'error');
      this.loading = false;
    }
  }

  getStatusBadgeClass(status: string): string {
    if (!status) return 'badge-default';
    const s = status.toLowerCase();
    if (s === 'active' || s === 'completed') return 'badge-green';
    if (s === 'draft' || s === 'pending') return 'badge-blue';
    if (s === 'expired' || s === 'inactive') return 'badge-red';
    return 'badge-default';
  }

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  getMinExpiryDate(): string {
    if (this.newPolicy.policy_purchase_date) {
      const date = new Date(this.newPolicy.policy_purchase_date);
      date.setDate(date.getDate() + 1);
      return date.toISOString().split('T')[0];
    }
    return this.getTodayDate();
  }

  getEmailList(toMailId: string | undefined): string[] {
    if (!toMailId) return [];
    return toMailId.split(';').map(e => e.trim()).filter(Boolean);
  }

  onFlagToggle(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.newPolicy.flag = isChecked ? 'Active' : 'Inactive';
  }
}

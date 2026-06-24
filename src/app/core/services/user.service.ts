import { Injectable } from '@angular/core';
import { User, UserRole, Department, Team } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private users: User[] = [
    { id: 'USR001', name: 'Admin User', email: 'admin@adnate.com', role: UserRole.ADMINISTRATOR, department: 'IT', team: 'System Admin', designation: 'System Administrator', isActive: true, joinDate: '2023-01-15' },
    { id: 'USR002', name: 'Rajesh Kumar', email: 'rajesh@adnate.com', role: UserRole.ASSET_MANAGER, department: 'IT', team: 'Asset Management', designation: 'Senior Asset Manager', isActive: true, joinDate: '2023-03-10' },
    { id: 'USR003', name: 'Priya Sharma', email: 'priya@adnate.com', role: UserRole.ALLOCATION_TEAM, department: 'IT', team: 'Asset Allocation', designation: 'Allocation Specialist', isActive: true, joinDate: '2023-05-20' },
    { id: 'USR004', name: 'Suresh Patel', email: 'suresh@adnate.com', role: UserRole.TEAM_LEAD, department: 'Engineering', team: 'Frontend', designation: 'Team Lead', isActive: true, joinDate: '2022-08-01', managerId: 'USR002' },
    { id: 'USR005', name: 'Ananya Desai', email: 'ananya@adnate.com', role: UserRole.EMPLOYEE, department: 'Engineering', team: 'Frontend', designation: 'Software Engineer', isActive: true, joinDate: '2024-01-10', managerId: 'USR004' },
    { id: 'USR006', name: 'Vikram Singh', email: 'vikram@adnate.com', role: UserRole.EMPLOYEE, department: 'Engineering', team: 'Backend', designation: 'Senior Developer', isActive: true, joinDate: '2023-06-01', managerId: 'USR004' },
    { id: 'USR007', name: 'Meera Nair', email: 'meera@adnate.com', role: UserRole.EMPLOYEE, department: 'Design', team: 'UX', designation: 'UX Designer', isActive: true, joinDate: '2024-02-15', managerId: 'USR004' },
    { id: 'USR008', name: 'Arjun Reddy', email: 'arjun@adnate.com', role: UserRole.TEAM_LEAD, department: 'Engineering', team: 'Backend', designation: 'Tech Lead', isActive: true, joinDate: '2022-04-10', managerId: 'USR002' },
    { id: 'USR009', name: 'Kavitha Iyer', email: 'kavitha@adnate.com', role: UserRole.ALLOCATION_TEAM, department: 'IT', team: 'Asset Allocation', designation: 'IT Support Lead', isActive: true, joinDate: '2023-09-01' },
    { id: 'USR010', name: 'Rahul Mehta', email: 'rahul@adnate.com', role: UserRole.EMPLOYEE, department: 'Engineering', team: 'Frontend', designation: 'Junior Developer', isActive: false, joinDate: '2024-06-01', managerId: 'USR004' }
  ];

  private departments: Department[] = [
    { id: 'DEP001', name: 'IT', headId: 'USR002', teams: [
      { id: 'TM001', name: 'System Admin', departmentId: 'DEP001', leadId: 'USR001', memberCount: 3 },
      { id: 'TM002', name: 'Asset Management', departmentId: 'DEP001', leadId: 'USR002', memberCount: 4 },
      { id: 'TM003', name: 'Asset Allocation', departmentId: 'DEP001', leadId: 'USR003', memberCount: 5 }
    ]},
    { id: 'DEP002', name: 'Engineering', headId: 'USR004', teams: [
      { id: 'TM004', name: 'Frontend', departmentId: 'DEP002', leadId: 'USR004', memberCount: 8 },
      { id: 'TM005', name: 'Backend', departmentId: 'DEP002', leadId: 'USR008', memberCount: 10 }
    ]},
    { id: 'DEP003', name: 'Design', headId: 'USR004', teams: [
      { id: 'TM006', name: 'UX', departmentId: 'DEP003', leadId: 'USR004', memberCount: 4 },
      { id: 'TM007', name: 'Visual Design', departmentId: 'DEP003', leadId: 'USR004', memberCount: 3 }
    ]}
  ];

  getUsers(): User[] { return [...this.users]; }

  getUserById(id: string): User | undefined { return this.users.find(u => u.id === id); }

  getUsersByRole(role: UserRole): User[] { return this.users.filter(u => u.role === role); }

  getUsersByDepartment(dept: string): User[] { return this.users.filter(u => u.department === dept); }

  getUsersByTeam(team: string): User[] { return this.users.filter(u => u.team === team); }

  addUser(user: User): void { this.users.push(user); }

  updateUser(updated: User): void {
    const idx = this.users.findIndex(u => u.id === updated.id);
    if (idx >= 0) this.users[idx] = updated;
  }

  deleteUser(id: string): void { this.users = this.users.filter(u => u.id !== id); }

  getDepartments(): Department[] { return [...this.departments]; }

  getTeams(): Team[] { return this.departments.flatMap(d => d.teams); }

  getUserStats() {
    return {
      total: this.users.length,
      active: this.users.filter(u => u.isActive).length,
      inactive: this.users.filter(u => !u.isActive).length,
      byRole: Object.values(UserRole).map(role => ({
        role,
        count: this.users.filter(u => u.role === role).length
      }))
    };
  }
}

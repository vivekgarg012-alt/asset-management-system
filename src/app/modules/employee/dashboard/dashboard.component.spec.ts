import { ComponentFixture, TestBed } from '@angular/core';
import { EmployeeDashboardComponent } from './dashboard.component';
import { CommonModule } from '@angular/common';

describe('EmployeeDashboardComponent', () => {
  let component: EmployeeDashboardComponent;
  let fixture: ComponentFixture<EmployeeDashboardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EmployeeDashboardComponent],
      imports: [CommonModule]
    });
    fixture = TestBed.createComponent(EmployeeDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

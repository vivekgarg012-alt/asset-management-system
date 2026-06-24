import { ComponentFixture, TestBed } from '@angular/core';
import { AllocationDashboardComponent } from './dashboard.component';
import { CommonModule } from '@angular/common';

describe('AllocationDashboardComponent', () => {
  let component: AllocationDashboardComponent;
  let fixture: ComponentFixture<AllocationDashboardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AllocationDashboardComponent],
      imports: [CommonModule]
    });
    fixture = TestBed.createComponent(AllocationDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core';
import { ManagerDashboardComponent } from './dashboard.component';
import { CommonModule } from '@angular/common';

describe('ManagerDashboardComponent', () => {
  let component: ManagerDashboardComponent;
  let fixture: ComponentFixture<ManagerDashboardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ManagerDashboardComponent],
      imports: [CommonModule]
    });
    fixture = TestBed.createComponent(ManagerDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

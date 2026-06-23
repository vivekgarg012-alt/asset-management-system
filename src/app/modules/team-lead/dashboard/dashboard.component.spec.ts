import { ComponentFixture, TestBed } from '@angular/core';
import { LeadDashboardComponent } from './dashboard.component';
import { CommonModule } from '@angular/common';

describe('LeadDashboardComponent', () => {
  let component: LeadDashboardComponent;
  let fixture: ComponentFixture<LeadDashboardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LeadDashboardComponent],
      imports: [CommonModule]
    });
    fixture = TestBed.createComponent(LeadDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

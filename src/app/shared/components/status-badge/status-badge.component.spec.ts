import { ComponentFixture, TestBed } from '@angular/core';
import { StatusBadgeComponent } from './status-badge.component';
import { CommonModule } from '@angular/common';

describe('StatusBadgeComponent', () => {
  let component: StatusBadgeComponent;
  let fixture: ComponentFixture<StatusBadgeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [StatusBadgeComponent],
      imports: [CommonModule]
    });
    fixture = TestBed.createComponent(StatusBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

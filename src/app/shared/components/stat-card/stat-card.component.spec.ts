import { ComponentFixture, TestBed } from '@angular/core';
import { StatCardComponent } from './stat-card.component';
import { CommonModule } from '@angular/common';

describe('StatCardComponent', () => {
  let component: StatCardComponent;
  let fixture: ComponentFixture<StatCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [StatCardComponent],
      imports: [CommonModule]
    });
    fixture = TestBed.createComponent(StatCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

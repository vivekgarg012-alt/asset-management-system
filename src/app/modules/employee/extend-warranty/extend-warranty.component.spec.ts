import { ComponentFixture, TestBed } from '@angular/core';
import { ExtendWarrantyComponent } from './extend-warranty.component';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router-testing';

describe('ExtendWarrantyComponent', () => {
  let component: ExtendWarrantyComponent;
  let fixture: ComponentFixture<ExtendWarrantyComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ExtendWarrantyComponent],
      imports: [ReactiveFormsModule, RouterTestingModule]
    });
    fixture = TestBed.createComponent(ExtendWarrantyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core';
import { RequestAssetComponent } from './request-asset.component';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router-testing';

describe('RequestAssetComponent', () => {
  let component: RequestAssetComponent;
  let fixture: ComponentFixture<RequestAssetComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RequestAssetComponent],
      imports: [ReactiveFormsModule, RouterTestingModule]
    });
    fixture = TestBed.createComponent(RequestAssetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

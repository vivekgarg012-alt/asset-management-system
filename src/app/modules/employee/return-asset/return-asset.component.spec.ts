import { ComponentFixture, TestBed } from '@angular/core';
import { ReturnAssetComponent } from './return-asset.component';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router-testing';

describe('ReturnAssetComponent', () => {
  let component: ReturnAssetComponent;
  let fixture: ComponentFixture<ReturnAssetComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReturnAssetComponent],
      imports: [ReactiveFormsModule, RouterTestingModule]
    });
    fixture = TestBed.createComponent(ReturnAssetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

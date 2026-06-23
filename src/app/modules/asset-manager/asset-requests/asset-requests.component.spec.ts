import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssetRequestsComponent } from './asset-requests.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

describe('AssetRequestsComponent', () => {
  let component: AssetRequestsComponent;
  let fixture: ComponentFixture<AssetRequestsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AssetRequestsComponent],
      imports: [CommonModule, FormsModule]
    });
    fixture = TestBed.createComponent(AssetRequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

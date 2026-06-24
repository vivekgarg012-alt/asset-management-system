import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssetInventoryComponent } from './asset-inventory.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

describe('AssetInventoryComponent', () => {
  let component: AssetInventoryComponent;
  let fixture: ComponentFixture<AssetInventoryComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AssetInventoryComponent],
      imports: [CommonModule, FormsModule]
    });
    fixture = TestBed.createComponent(AssetInventoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

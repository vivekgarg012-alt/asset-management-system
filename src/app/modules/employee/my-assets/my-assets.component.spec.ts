import { ComponentFixture, TestBed } from '@angular/core';
import { MyAssetsComponent } from './my-assets.component';
import { CommonModule } from '@angular/common';

describe('MyAssetsComponent', () => {
  let component: MyAssetsComponent;
  let fixture: ComponentFixture<MyAssetsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MyAssetsComponent],
      imports: [CommonModule]
    });
    fixture = TestBed.createComponent(MyAssetsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core';
import { MainLayoutComponent } from './main-layout.component';
import { RouterTestingModule } from '@angular/router-testing';

describe('MainLayoutComponent', () => {
  let component: MainLayoutComponent;
  let fixture: ComponentFixture<MainLayoutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MainLayoutComponent],
      imports: [RouterTestingModule]
    });
    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

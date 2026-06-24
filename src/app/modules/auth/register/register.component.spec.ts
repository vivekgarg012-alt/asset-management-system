import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RegisterComponent ],
      imports: [ 
        ReactiveFormsModule, 
        RouterTestingModule,
        HttpClientTestingModule 
      ],
      providers: [
        AuthService,
        NotificationService
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate password mismatch', () => {
    component.registerForm.patchValue({
      password: 'Password123!',
      confirmPassword: 'DifferentPassword123!'
    });
    expect(component.registerForm.errors?.['passwordMismatch']).toBeTruthy();
  });

  it('should validate password complexity', () => {
    let password = component.registerForm.controls['password'];
    
    password.setValue('onlylowercase');
    expect(password.errors?.['passwordComplexity']).toBeTruthy();
    
    password.setValue('Password123!');
    expect(password.errors).toBeNull();
  });

  it('should require terms agreement', () => {
    let agree = component.registerForm.controls['agreeTerms'];
    agree.setValue(false);
    expect(agree.valid).toBeFalsy();
    
    agree.setValue(true);
    expect(agree.valid).toBeTruthy();
  });
});

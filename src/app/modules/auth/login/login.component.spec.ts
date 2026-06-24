import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LoginComponent ],
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
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have invalid form when empty', () => {
    expect(component.loginForm.valid).toBeFalsy();
  });

  it('should validate email format', () => {
    let email = component.loginForm.controls['email'];
    email.setValue('invalid-email');
    expect(email.errors?.['email']).toBeTruthy();
    
    email.setValue('test@example.com');
    expect(email.errors).toBeNull();
  });

  it('should validate password length', () => {
    let password = component.loginForm.controls['password'];
    password.setValue('123');
    expect(password.errors?.['minlength']).toBeTruthy();
    
    password.setValue('123456');
    expect(password.errors).toBeNull();
  });
});

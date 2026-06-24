import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HeroService } from '../../../core/services/hero.service';

declare var $: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  showPassword = false;
  loginError = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
    private heroService: HeroService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {


    this.checkAutoLogin();

  }

  /**
   * Checks if there is an active Cordys SSO session on page load.
   * Flow:
   *  1. Call GetUserDetails (UserManagement/1.0/User) with no params to get the logged-in username.
   *  2. If a username is returned, call GetUserDetails (UserManagement/1.0/Organization) with that username.
   *  3. If Org user details found, verify in DB using getUserFromDB.
   *  4. If DB user found → store, set session, redirect to role-based dashboard.
   *  5. Any failure → silently stay on login page (no error shown to user).
   */
  checkAutoLogin(): void {
    if (this.authService.hasCheckedAutoLogin()) {
      console.log('Auto-login: Already checked on this page load.');
      console.log("Entered")
      return;
    }

    if (typeof $ === 'undefined' || !$.cordys || !$.cordys.authentication) {
      console.log('Auto-login: Cordys SDK not available.');
      return;
    }

    this.authService.setAutoLoginChecked(true);
    this.isLoading = true;
    console.log("Checkpoint");
    // Step 1: Get PreLoginInfo to initialize the SSO session context
    $.cordys.authentication.getPreloginInfo()
      .done(() => {
        // Step 2: Get the currently logged-in username from Cordys SSO
        const ssoUsername = $.cordys.authentication.getUserName ? $.cordys.authentication.getUserName() : '';
        console.log("Checkpoint2", ssoUsername)
        if (ssoUsername) {
          // Username resolved directly from SSO, proceed to Org API
          console.log("Checkpoint3")
          //  this.callOrgGetUserDetails(ssoUsername);

        } else {
          // Fallback: Call standard GetUserDetails (User namespace) to check for active session cookies
          this.heroService.ajax('GetUserDetails', 'http://schemas.cordys.com/UserManagement/1.0/User', {})
            .then((resp: any) => {
              const userInfo = this.heroService.xmltojson(resp, 'User');
              const resolvedUsername = userInfo?.UserName || userInfo?.username || '';

              if (resolvedUsername) {
                // Session cookie is active, proceed to Org API with resolved username
                this.callOrgGetUserDetails(resolvedUsername);
              } else {
                // No active session found, stay on login page
                console.log('Auto-login: No active session found. Staying on login page.');
                this.isLoading = false;
              }
            })
            .catch((err: any) => {
              // No session cookie active, stay on login page silently
              console.log('Auto-login: No active Cordys session.', err);

              this.isLoading = false;
            });
        }
      })
      .fail((err: any) => {
        // PreLoginInfo failed — user not logged in, stay on login page
        console.log('Auto-login: PreLoginInfo failed, user not authenticated.', err);
        this.isLoading = false;
      });
  }

  /**
   * Calls GetUserDetails in the Organization namespace with the given username.
   * If user details are found, proceeds to DB verification.
   * If not found, stays on login page.
   */
  private callOrgGetUserDetails(userName: string): void {
    const soapEnvelope = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetUserDetails xmlns="http://schemas.cordys.com/UserManagement/1.0/Organization">
      <UserName>${userName}</UserName>
    </GetUserDetails>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    this.heroService.ajax(null, null, {}, soapEnvelope)
      .then((resp: any) => {
        // Parse the User element from the response
        const orgUserDetails = this.heroService.xmltojson(resp, 'User');

        if (orgUserDetails && (orgUserDetails.UserName || orgUserDetails.username || orgUserDetails.Description)) {
          // User details found in Org namespace, now verify against DB
          console.log('Auto-login: Org user details found, verifying in DB...', orgUserDetails);
          const resolvedEmail = orgUserDetails.UserName || orgUserDetails.username || userName;
          this.verifyUserInDB(resolvedEmail);
        } else {
          // User not found in Org namespace, stay on login page
          console.log('Auto-login: User not found in Org namespace. Staying on login page.');
          this.isLoading = false;
        }
      })
      .catch((err: any) => {
        // Org GetUserDetails failed, stay on login page
        console.log('Auto-login: Org GetUserDetails failed. Staying on login page.', err);
        this.isLoading = false;
      });
  }

  /**
   * Verifies the Cordys user against the application database.
   * If found and active → store user, update session, and redirect to their dashboard.
   * If not found or inactive → stay on login page.
   */
  private verifyUserInDB(email: string): void {
    this.authService.getUserFromDB(email)
      .then((dbUser) => {
        if (dbUser) {
          // User verified in DB, establish session and redirect
          console.log('Auto-login: DB user verified. Redirecting to dashboard...', dbUser);
          localStorage.setItem('currentUser', JSON.stringify(dbUser));
          localStorage.setItem('userId', dbUser.id);
          this.authService.setCurrentUser(dbUser);
          this.isLoading = false;
          this.notificationService.showToast(`Welcome back, ${dbUser.name}!`, 'success');
          const route = this.authService.getRoleRoute(dbUser.role);
          this.router.navigate([route]);
        } else {
          // DB returned no user, stay on login page
          console.log('Auto-login: User not found in DB. Staying on login page.');
          this.isLoading = false;
        }
      })
      .catch((err: any) => {
        // DB lookup failed (user not found or deactivated), stay on login page
        console.log('Auto-login: DB verification failed. Staying on login page.', err);
        this.isLoading = false;
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.isLoading = true;
    this.loginError = '';
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (user) => {
        this.isLoading = false;
        this.notificationService.showToast(`Welcome back, ${user.name}!`, 'success');
        const route = this.authService.getRoleRoute(user.role);
        this.router.navigate([route]);
      },
      error: (err) => {
        this.isLoading = false;
        this.loginError = err.message || 'Login failed. Please try again.';
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if ((control as any).controls) {
        this.markFormGroupTouched(control as any);
      }
    });
  }

  // Helper for template
  get f() { return this.loginForm.controls; }
}

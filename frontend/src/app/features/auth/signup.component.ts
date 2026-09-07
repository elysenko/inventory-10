import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/** Cross-field check: the two password entries must agree. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './auth.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** Ships empty — no prefilled or seeded credentials anywhere. */
  readonly form = this.fb.nonNullable.group(
    {
      name: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  readonly error = signal<string | null>(null);
  /** Field-level error mapped from the API's 409 duplicate-email response. */
  readonly emailError = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly previewShortcut = COLOSSUS_PREVIEW ? 'Skip login — Demo Mode' : null;

  async submit(): Promise<void> {
    this.error.set(null);
    this.emailError.set(null);

    if (this.form.hasError('mismatch')) {
      this.error.set('Those passwords do not match.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter a valid email and a password of at least 8 characters.');
      return;
    }

    this.submitting.set(true);
    const { email, password, name } = this.form.getRawValue();
    const problem = await this.auth.signup(email, password, name);
    this.submitting.set(false);
    if (problem) {
      if (problem.toLowerCase().includes('email')) this.emailError.set(problem);
      else this.error.set(problem);
    }
  }

  skipLogin(): void {
    this.auth.previewSignIn();
    void this.router.navigate(['/items']);
  }
}

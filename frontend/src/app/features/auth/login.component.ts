import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './auth.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** Ships empty — no prefilled or seeded credentials anywhere. */
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  /**
   * Preview-only escape hatch, held in TypeScript behind the build-time constant so the
   * whole affordance is dead-code-eliminated from production bundles.
   */
  readonly previewShortcut = COLOSSUS_PREVIEW ? 'Skip login — Demo Mode' : null;

  async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter a valid email and a password of at least 8 characters.');
      return;
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    const problem = await this.auth.login(email, password);
    this.submitting.set(false);
    if (problem) this.error.set(problem);
  }

  skipLogin(): void {
    this.auth.previewSignIn();
    void this.router.navigate(['/items']);
  }
}

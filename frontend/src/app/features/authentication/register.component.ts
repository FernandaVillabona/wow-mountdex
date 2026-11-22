import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AuthShellComponent } from './auth-shell.component';

export const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{3,24}$/u;

export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell heading="Crear cuenta">
      @if (done()) {
        <p class="notice notice--ok" role="status">{{ done() }}</p>
        <a class="btn btn--red" routerLink="/login">Ir a iniciar sesión</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="r-user">Nombre visible</label>
            <input id="r-user" type="text" formControlName="username" autocomplete="nickname" [attr.aria-invalid]="invalid('username')" aria-describedby="r-user-help" />
            <span id="r-user-help" [class]="invalid('username') ? 'field__error' : 'faint'">3–24 caracteres: letras, números, guion o guion bajo.</span>
          </div>
          <div class="field">
            <label for="r-email">Correo electrónico</label>
            <input id="r-email" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="invalid('email')" />
            @if (invalid('email')) { <span class="field__error">Introduce un correo válido.</span> }
          </div>
          <div class="field">
            <label for="r-pass">Contraseña</label>
            <input id="r-pass" type="password" formControlName="password" autocomplete="new-password" [attr.aria-invalid]="invalid('password')" aria-describedby="r-pass-help" />
            <span id="r-pass-help" [class]="invalid('password') ? 'field__error' : 'faint'">Mínimo 8 caracteres, con al menos una letra y un número.</span>
          </div>
          <div class="field">
            <label for="r-confirm">Repite la contraseña</label>
            <input id="r-confirm" type="password" formControlName="confirm" autocomplete="new-password" />
            @if (form.hasError('mismatch') && form.controls.confirm.touched) { <span class="field__error">Las contraseñas no coinciden.</span> }
          </div>
          @if (error()) { <p class="notice notice--error" role="alert">{{ error() }}</p> }
          <p class="faint">Nunca introduzcas aquí tu contraseña de Battle.net: esta cuenta es independiente.</p>
          <button type="submit" class="btn btn--red" [disabled]="busy()">{{ busy() ? 'Creando…' : 'Crear cuenta' }}</button>
        </form>
        <p style="margin-top:1rem">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
      }
    </app-auth-shell>
  `,
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      username: ['', [Validators.required, Validators.pattern(USERNAME_PATTERN)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128), Validators.pattern(/^(?=.*\p{L})(?=.*\d).+$/u)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  protected invalid(name: 'username' | 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const { email, password, username } = this.form.getRawValue();
    const res = await this.auth.signUp(email.trim(), password, username.trim());
    this.busy.set(false);
    if (!res.ok) {
      this.error.set(res.message);
      return;
    }
    if (this.auth.isLoggedIn()) void this.router.navigateByUrl('/');
    else this.done.set(res.message);
  }
}

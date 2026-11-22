import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell heading="Iniciar sesión">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="l-email">Correo electrónico</label>
          <input id="l-email" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="invalid('email')" aria-describedby="l-email-err" />
          @if (invalid('email')) { <span id="l-email-err" class="field__error">Introduce un correo válido.</span> }
        </div>
        <div class="field">
          <label for="l-pass">Contraseña</label>
          <input id="l-pass" type="password" formControlName="password" autocomplete="current-password" [attr.aria-invalid]="invalid('password')" aria-describedby="l-pass-err" />
          @if (invalid('password')) { <span id="l-pass-err" class="field__error">Introduce tu contraseña.</span> }
        </div>
        @if (error()) { <p class="notice notice--error" role="alert">{{ error() }}</p> }
        <button type="submit" class="btn btn--red" [disabled]="busy()">{{ busy() ? 'Entrando…' : 'Entrar' }}</button>
      </form>
      <p class="links"><a routerLink="/recuperar">¿Olvidaste tu contraseña?</a> · <a routerLink="/registro">Crear cuenta</a></p>
      <p class="faint">Al iniciar sesión, el progreso guardado como invitado en este navegador se importará a tu cuenta sin duplicados.</p>
    </app-auth-shell>
  `,
  styles: `.links { margin-top: 1rem; }`,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly redirect = input<string>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected invalid(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    const res = await this.auth.signIn(email.trim(), password);
    this.busy.set(false);
    if (!res.ok) {
      this.error.set(res.message);
      return;
    }
    this.toast.show(res.message, 'success');
    const target = this.redirect();
    void this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('//') ? target : '/');
  }
}

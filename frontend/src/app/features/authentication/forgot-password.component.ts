import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell heading="Recuperar contraseña">
      @if (sent()) {
        <p class="notice notice--ok" role="status">{{ sent() }}</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="f-email">Correo de tu cuenta</label>
            <input id="f-email" type="email" formControlName="email" autocomplete="email" />
            @if (form.controls.email.invalid && form.controls.email.touched) { <span class="field__error">Introduce un correo válido.</span> }
          </div>
          @if (error()) { <p class="notice notice--error" role="alert">{{ error() }}</p> }
          <button type="submit" class="btn btn--red" [disabled]="busy()">Enviar enlace</button>
        </form>
      }
      <p style="margin-top:1rem"><a routerLink="/login">Volver a iniciar sesión</a></p>
    </app-auth-shell>
  `,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  protected readonly sent = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    const res = await this.auth.requestPasswordReset(this.form.getRawValue().email.trim());
    this.busy.set(false);
    if (res.ok) this.sent.set(res.message);
    else this.error.set(res.message);
  }
}

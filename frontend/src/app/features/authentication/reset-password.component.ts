import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthShellComponent } from './auth-shell.component';
import { passwordsMatch } from './register.component';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell heading="Nueva contraseña">
      @if (auth.isLoggedIn()) {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="n-pass">Nueva contraseña</label>
            <input id="n-pass" type="password" formControlName="password" autocomplete="new-password" />
            <span class="faint">Mínimo 8 caracteres, con al menos una letra y un número.</span>
          </div>
          <div class="field">
            <label for="n-confirm">Repite la contraseña</label>
            <input id="n-confirm" type="password" formControlName="confirm" autocomplete="new-password" />
            @if (form.hasError('mismatch') && form.controls.confirm.touched) { <span class="field__error">Las contraseñas no coinciden.</span> }
          </div>
          @if (error()) { <p class="notice notice--error" role="alert">{{ error() }}</p> }
          <button type="submit" class="btn btn--red" [disabled]="busy()">Guardar contraseña</button>
        </form>
      } @else {
        <p>Abre esta página desde el enlace que te enviamos por correo. Si el enlace caducó, solicita uno nuevo.</p>
        <a class="btn btn--red" routerLink="/recuperar">Solicitar enlace</a>
      }
    </app-auth-shell>
  `,
})
export class ResetPasswordComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128), Validators.pattern(/^(?=.*\p{L})(?=.*\d).+$/u)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    void this.auth.init();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    const res = await this.auth.updatePassword(this.form.getRawValue().password);
    this.busy.set(false);
    if (!res.ok) {
      this.error.set(res.message);
      return;
    }
    this.toast.show(res.message, 'success');
    void this.router.navigateByUrl('/perfil');
  }
}

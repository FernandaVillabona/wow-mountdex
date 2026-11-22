import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/** Marco común de las pantallas de autenticación; explica si las cuentas no están activadas. */
@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth panel">
      <div class="panel__title"><h1>{{ heading() }}</h1></div>
      <div class="panel__body">
        @if (auth.available) {
          <ng-content />
        } @else {
          <p><strong>Las cuentas de usuario no están activadas en esta instalación.</strong></p>
          <p class="muted">Puedes usar toda la MountDex como invitado: tu colección se guarda en este navegador. Para activar cuentas, el administrador debe configurar Supabase (ver <code>docs/deployment</code>).</p>
          <a class="btn btn--red" routerLink="/mountdex">Ir a la MountDex</a>
        }
      </div>
    </section>
  `,
  styles: `
    .auth { max-width: 460px; margin: 1rem auto; }
    .auth h1 { font-size: 1rem; margin: 0; }
  `,
})
export class AuthShellComponent {
  protected readonly auth = inject(AuthService);
  readonly heading = input.required<string>();
}

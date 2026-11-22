import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../shared/components/empty-state.component';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-empty-state title="Página no encontrada" text="Este rincón de Azeroth no aparece en la MountDex.">
      <a class="btn btn--red" routerLink="/">Volver al inicio</a>
    </app-empty-state>
  `,
})
export class NotFoundComponent {}

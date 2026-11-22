import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PreferencesService, ViewMode } from '../../core/services/preferences.service';

@Component({
  selector: 'app-view-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vt" role="group" aria-label="Tipo de vista">
      @for (o of options; track o.mode) {
        <button
          type="button"
          class="btn btn--sm"
          [attr.aria-pressed]="prefs.viewMode() === o.mode"
          (click)="prefs.setView(o.mode); prefs.beep('nav')"
        >
          <span aria-hidden="true">{{ o.icon }}</span> {{ o.label }}
        </button>
      }
    </div>
  `,
  styles: `.vt { display: inline-flex; gap: .3rem; }`,
})
export class ViewToggleComponent {
  protected readonly prefs = inject(PreferencesService);
  protected readonly options: { mode: ViewMode; label: string; icon: string }[] = [
    { mode: 'list', label: 'Lista', icon: '☰' },
    { mode: 'grid', label: 'Cuadrícula', icon: '▦' },
    { mode: 'compact', label: 'Compacta', icon: '≡' },
  ];
}

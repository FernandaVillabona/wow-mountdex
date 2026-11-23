import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import {
  AVAILABILITY_LABELS,
  DIFFICULTY_LABELS,
  FIELD_LABELS,
  FieldProvenance,
  METHOD_LABELS,
  TRUST_LABELS,
  MOUNT_TYPE_LABELS,
  PROBABILITY_STATUS_LABELS,
  RARITY_LABELS,
} from '../../core/models/catalog.models';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MountSpriteComponent } from '../../shared/components/mount-sprite.component';

@Component({
  selector: 'app-mount-detail',
  imports: [RouterLink, FormsModule, MountSpriteComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mount-detail.component.html',
  styleUrl: './mount-detail.component.scss',
})
export class MountDetailComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly collection = inject(CollectionService);
  protected readonly prefs = inject(PreferencesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  /** Parámetro de ruta (withComponentInputBinding). */
  readonly slug = input.required<string>();

  protected readonly mount = computed(() => this.catalog.mountBySlug().get(this.slug()) ?? null);
  protected readonly state = computed(() => {
    const m = this.mount();
    return m ? this.collection.get(m.id) : null;
  });
  protected readonly expansion = computed(() => (this.mount() ? this.catalog.expansionOf(this.mount()!) : null));
  protected readonly locations = computed(() => (this.mount() ? this.catalog.locationsOf(this.mount()!) : []));
  protected readonly nav = computed(() => (this.mount() ? this.catalog.neighbours(this.mount()!.id) : { prev: null, next: null }));

  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly L = {
    method: METHOD_LABELS,
    rarity: RARITY_LABELS,
    difficulty: DIFFICULTY_LABELS,
    availability: AVAILABILITY_LABELS,
    probability: PROBABILITY_STATUS_LABELS,
    type: MOUNT_TYPE_LABELS,
    trust: TRUST_LABELS,
  };

  /** Procedencia por campo, cargada bajo demanda. */
  private readonly provenanceMap = signal<Record<string, FieldProvenance>>({});
  protected readonly provenance = computed(() =>
    Object.entries(this.provenanceMap()).map(([field, p]) => ({
      field,
      label: FIELD_LABELS[field] ?? field,
      sourceName: this.catalog.dataSource(p.source)?.name ?? p.source,
      url: p.url,
      trust: p.trust,
      fetchedAt: p.fetchedAt,
    })),
  );

  constructor() {
    effect(() => {
      const m = this.mount();
      this.provenanceMap.set({});
      if (m) void this.catalog.provenanceOf(m).then((p) => { if (this.mount()?.id === m.id) this.provenanceMap.set(p); });
    });
    effect(() => {
      const m = this.mount();
      if (m) {
        untracked(() => {
          this.title.setTitle(`#${this.pad(m.id)} ${m.name} · MountDex`);
          this.prefs.pushRecent(m.id);
        });
      }
    });
  }

  protected pad(n: number): string {
    return String(n).padStart(4, '0');
  }

  protected toggle(field: 'obtained' | 'favorite' | 'target'): void {
    const m = this.mount();
    if (!m) return;
    this.collection.toggle(m.id, field);
    const on = this.collection.get(m.id)[field];
    this.prefs.beep(on ? 'confirm' : 'back');
    const msg = {
      obtained: on ? `${m.name} registrada como obtenida.` : `${m.name} marcada como pendiente.`,
      favorite: on ? 'Añadida a favoritas.' : 'Quitada de favoritas.',
      target: on ? 'Añadida a objetivos.' : 'Quitada de objetivos.',
    }[field];
    this.toast.show(msg, on ? 'success' : 'info', 2200);
  }

  protected setObtainedDate(value: string): void {
    const m = this.mount();
    if (!m || !value) return;
    const d = new Date(`${value}T12:00:00`);
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000) return;
    this.collection.update(m.id, { obtainedAt: d.toISOString() });
  }

  protected saveNotes(value: string): void {
    const m = this.mount();
    if (!m) return;
    const notes = value.slice(0, 2000);
    if (notes !== this.collection.get(m.id).notes) {
      this.collection.update(m.id, { notes });
      this.toast.show('Notas guardadas.', 'success', 1800);
    }
  }

  protected attempt(delta: number): void {
    const m = this.mount();
    if (m) this.collection.addAttempt(m.id, delta);
  }

  protected dateInput(iso: string | null): string {
    return iso ? iso.slice(0, 10) : '';
  }

  protected formatDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  }

  /** ← / → para navegar entre fichas (salvo si se está escribiendo). */
  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.key === 'ArrowLeft' ? this.nav().prev : e.key === 'ArrowRight' ? this.nav().next : null;
    if (target) {
      e.preventDefault();
      this.prefs.beep('nav');
      void this.router.navigate(['/montura', target.slug]);
    }
  }
}

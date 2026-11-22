import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { METHOD_LABELS, RARITY_LABELS } from '../../core/models/catalog.models';
import { GameRegion } from '../../core/models/collection.models';
import { AuthService } from '../../core/services/auth.service';
import { BlizzardService } from '../../core/services/blizzard.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { ToastService } from '../../core/services/toast.service';
import { ImportResult, importCsv, importJson, toCsv, toExport } from '../../core/utils/collection-io';
import { byContinent, byExpansion, byMethod, byRarity, overall } from '../../core/utils/collection-stats';
import { computeMilestones } from '../../core/utils/milestones';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';

@Component({
  selector: 'app-collection',
  imports: [RouterLink, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collection.component.html',
  styleUrl: './collection.component.scss',
})
export class CollectionComponent {
  private readonly catalog = inject(CatalogService);
  protected readonly collection = inject(CollectionService);
  protected readonly auth = inject(AuthService);
  protected readonly blizzard = inject(BlizzardService);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<'expansion' | 'continent' | 'method' | 'rarity'>('expansion');
  protected readonly pendingImport = signal<(ImportResult & { fileName: string }) | null>(null);
  protected readonly region = signal<GameRegion>('us');

  private readonly cat = computed(() => this.catalog.catalog()!);
  protected readonly total = computed(() => overall(this.cat(), this.collection.collection()));
  protected readonly breakdown = computed(() => {
    const col = this.collection.collection();
    switch (this.tab()) {
      case 'expansion': return byExpansion(this.cat(), col);
      case 'continent': return byContinent(this.cat(), col);
      case 'method': return byMethod(this.cat(), col, METHOD_LABELS);
      case 'rarity': return byRarity(this.cat(), col, RARITY_LABELS);
    }
  });
  protected readonly milestones = computed(() => computeMilestones(this.cat(), this.collection.collection()));
  protected readonly achievedCount = computed(() => this.milestones().filter((m) => m.achieved).length);

  protected readonly tabs = [
    { key: 'expansion', label: 'Expansión' },
    { key: 'continent', label: 'Continente' },
    { key: 'method', label: 'Método' },
    { key: 'rarity', label: 'Rareza' },
  ] as const;

  protected exportJson(): void {
    this.download('mountdex-coleccion.json', JSON.stringify(toExport(this.collection.collection()), null, 2), 'application/json');
  }

  protected exportCsv(): void {
    const names = this.catalog.mountById();
    const csv = toCsv(this.collection.collection(), (id) => names.get(id)?.name ?? '');
    this.download('mountdex-coleccion.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  }

  private download(name: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast.show(`Exportado ${name}.`, 'success');
  }

  protected async onFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.toast.show('El archivo supera 5 MB.', 'error');
      return;
    }
    const text = await file.text();
    const ids = new Set(this.catalog.mounts().map((m) => m.id));
    const result = /\.csv$/i.test(file.name) ? importCsv(text, ids) : importJson(text, ids);
    this.pendingImport.set({ ...result, fileName: file.name });
  }

  protected confirmImport(): void {
    const p = this.pendingImport();
    if (!p) return;
    this.collection.applyMany(p.entries);
    this.toast.show(`Importados ${p.entries.length} registros.`, 'success');
    this.pendingImport.set(null);
  }

  protected connectBlizzard(): void {
    this.blizzard.startAuthorization(this.region());
  }
}

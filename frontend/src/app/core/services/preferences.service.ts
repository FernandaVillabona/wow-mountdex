import { Injectable, inject, signal, untracked } from '@angular/core';
import { StorageService } from './storage.service';

export type ViewMode = 'list' | 'grid' | 'compact';

/** Preferencias por dispositivo: vista, sonido y monturas consultadas recientemente. */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly storage = inject(StorageService);

  readonly viewMode = signal<ViewMode>(this.storage.get<ViewMode>('pref:view', 'list'));
  readonly soundOn = signal<boolean>(this.storage.get<boolean>('pref:sound', false));
  readonly recent = signal<number[]>(this.storage.get<number[]>('recent', []));

  private audio: AudioContext | null = null;

  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.storage.set('pref:view', mode);
  }

  toggleSound(): void {
    this.soundOn.update((v) => !v);
    this.storage.set('pref:sound', this.soundOn());
    if (this.soundOn()) this.beep('confirm');
  }

  pushRecent(id: number): void {
    // untracked: puede llamarse desde un effect sin crear dependencia sobre `recent`.
    const list = [id, ...untracked(this.recent).filter((x) => x !== id)].slice(0, 8);
    this.recent.set(list);
    this.storage.set('recent', list);
  }

  remapRecent(mapping: Record<string, number>): void {
    const list = [...new Set(untracked(this.recent).map((id) => mapping[String(id)] ?? id))];
    this.recent.set(list);
    this.storage.set('recent', list);
  }

  /** Pitidos sintetizados con Web Audio (sin archivos de audio externos). */
  beep(kind: 'nav' | 'confirm' | 'back' = 'nav'): void {
    if (!this.soundOn()) return;
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = { nav: 880, confirm: 1320, back: 440 }[kind];
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (kind === 'confirm') osc.frequency.setValueAtTime(freq * 1.5, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      /* audio no disponible */
    }
  }
}

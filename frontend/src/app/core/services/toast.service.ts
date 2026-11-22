import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'error';
export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: ToastKind = 'info', ms = 3500): void {
    const id = ++this.seq;
    this.toasts.update((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}

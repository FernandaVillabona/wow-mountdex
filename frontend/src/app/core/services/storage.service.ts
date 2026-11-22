import { Injectable } from '@angular/core';

/** localStorage tolerante a fallos (modo privado, cuota llena, bloqueos). */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly prefix = 'mountdex:';

  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      /* ignorado */
    }
  }

  session<T>(key: string, value?: T): T | null {
    try {
      if (value === undefined) {
        const raw = sessionStorage.getItem(this.prefix + key);
        return raw === null ? null : (JSON.parse(raw) as T);
      }
      sessionStorage.setItem(this.prefix + key, JSON.stringify(value));
      return value;
    } catch {
      return null;
    }
  }

  clearSession(key: string): void {
    try {
      sessionStorage.removeItem(this.prefix + key);
    } catch {
      /* ignorado */
    }
  }
}

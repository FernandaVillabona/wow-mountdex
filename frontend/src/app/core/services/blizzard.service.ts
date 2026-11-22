import { Injectable, inject } from '@angular/core';
import { runtimeConfig } from '../config/runtime-config';
import { GameRegion } from '../models/collection.models';
import { normalize } from '../utils/mount-filters';
import { CatalogService } from './catalog.service';
import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';

export interface BlizzardMount {
  id: number;
  name: string;
}

export interface BlizzardImportResult {
  total: number;
  matchedIds: number[];
  matchedByName: number;
  unmatched: BlizzardMount[];
}

interface PendingAuth {
  state: string;
  region: GameRegion;
}

/**
 * Integración OAuth con Battle.net (Authorization Code).
 * - El client_id es público; el client_secret vive SOLO en la Edge Function `blizzard-import`.
 * - No se almacenan contraseñas ni tokens de Blizzard: el token se usa una vez en el servidor.
 */
@Injectable({ providedIn: 'root' })
export class BlizzardService {
  private readonly supabase = inject(SupabaseService);
  private readonly storage = inject(StorageService);
  private readonly catalog = inject(CatalogService);

  readonly configured =
    !!runtimeConfig.blizzardClientId && !!runtimeConfig.blizzardRedirectUri && this.supabase.configured;

  missingConfig(): string[] {
    const missing: string[] = [];
    if (!runtimeConfig.blizzardClientId) missing.push('NG_BLIZZARD_CLIENT_ID');
    if (!runtimeConfig.blizzardRedirectUri) missing.push('NG_BLIZZARD_REDIRECT_URI');
    if (!this.supabase.configured) missing.push('NG_SUPABASE_URL / NG_SUPABASE_ANON_KEY');
    return missing;
  }

  /** Redirige a Battle.net. El parámetro `state` protege contra CSRF. */
  startAuthorization(region: GameRegion): void {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const state = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    this.storage.session<PendingAuth>('blizzard-auth', { state, region });
    const url = new URL('https://oauth.battle.net/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', runtimeConfig.blizzardClientId);
    url.searchParams.set('redirect_uri', runtimeConfig.blizzardRedirectUri);
    url.searchParams.set('scope', 'wow.profile');
    url.searchParams.set('state', state);
    location.assign(url.toString());
  }

  async completeAuthorization(code: string, state: string): Promise<BlizzardImportResult> {
    const pending = this.storage.session<PendingAuth>('blizzard-auth');
    this.storage.clearSession('blizzard-auth');
    if (!pending || pending.state !== state) {
      throw new Error('La respuesta de Battle.net no coincide con la solicitud (state inválido). Vuelve a intentarlo.');
    }
    const db = await this.supabase.client();
    const { data, error } = await db.functions.invoke<{ mounts: BlizzardMount[] }>('blizzard-import', {
      body: { code, region: pending.region, redirectUri: runtimeConfig.blizzardRedirectUri },
    });
    if (error || !data) throw new Error('No se pudo obtener la colección desde Battle.net.');
    await this.catalog.load();
    return this.match(data.mounts);
  }

  /** Empareja por blizzard_id; si el catálogo no lo tiene, por nombre exacto normalizado. */
  match(mounts: BlizzardMount[]): BlizzardImportResult {
    const byBlizzard = new Map<number, number>();
    const byName = new Map<string, number>();
    for (const m of this.catalog.mounts()) {
      if (m.blizzardId !== null) byBlizzard.set(m.blizzardId, m.id);
      byName.set(normalize(m.name), m.id);
    }
    const matched = new Set<number>();
    const unmatched: BlizzardMount[] = [];
    let matchedByName = 0;
    for (const b of mounts) {
      const direct = byBlizzard.get(b.id);
      if (direct !== undefined) { matched.add(direct); continue; }
      const named = byName.get(normalize(b.name));
      if (named !== undefined) { matched.add(named); matchedByName++; continue; }
      unmatched.push(b);
    }
    return { total: mounts.length, matchedIds: [...matched], matchedByName, unmatched };
  }
}

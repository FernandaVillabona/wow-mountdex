import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runtimeConfig } from '../config/runtime-config';

/**
 * Crea el cliente de Supabase bajo demanda (import dinámico) para no cargar
 * la librería cuando la app funciona en modo solo local.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configured = !!(runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey);
  private clientPromise: Promise<SupabaseClient> | null = null;

  client(): Promise<SupabaseClient> {
    if (!this.configured) {
      return Promise.reject(new Error('Supabase no está configurado (NG_SUPABASE_URL / NG_SUPABASE_ANON_KEY).'));
    }
    this.clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    );
    return this.clientPromise;
  }
}

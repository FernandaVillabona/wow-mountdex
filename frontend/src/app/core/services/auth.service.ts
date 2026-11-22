import { Injectable, computed, inject, signal } from '@angular/core';
import type { User } from '@supabase/supabase-js';
import { Character, GameRegion, Profile } from '../models/collection.models';
import { SupabaseService } from './supabase.service';

export interface AuthResult {
  ok: boolean;
  message: string;
}

/** Traduce errores de Supabase sin filtrar detalles internos. */
function friendly(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? '';
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Confirma tu correo antes de iniciar sesión.';
  if (/already registered/i.test(msg)) return 'Ya existe una cuenta con ese correo.';
  if (/password should be/i.test(msg)) return 'La contraseña no cumple los requisitos mínimos.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera unos minutos.';
  if (/duplicate key|profiles_username_key/i.test(msg)) return 'Ese nombre visible ya está en uso.';
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  readonly available = this.supabase.configured;
  readonly user = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly ready = signal(!this.supabase.configured);
  readonly isLoggedIn = computed(() => !!this.user());
  /** true cuando el usuario llega desde el enlace de recuperación. */
  readonly recovering = signal(false);

  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (!this.available) return Promise.resolve();
    this.initPromise ??= (async () => {
      try {
        const db = await this.supabase.client();
        const { data } = await db.auth.getSession();
        this.user.set(data.session?.user ?? null);
        db.auth.onAuthStateChange((event, session) => {
          this.user.set(session?.user ?? null);
          if (event === 'PASSWORD_RECOVERY') this.recovering.set(true);
          if (!session) this.profile.set(null);
          else void this.loadProfile();
        });
        if (data.session) await this.loadProfile();
      } finally {
        this.ready.set(true);
      }
    })();
    return this.initPromise;
  }

  async signUp(email: string, password: string, username: string): Promise<AuthResult> {
    try {
      const db = await this.supabase.client();
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { username }, emailRedirectTo: `${location.origin}/login` },
      });
      if (error) throw error;
      return {
        ok: true,
        message: data.session
          ? 'Cuenta creada. ¡Bienvenido a la MountDex!'
          : 'Cuenta creada. Revisa tu correo para confirmarla.',
      };
    } catch (e) {
      return { ok: false, message: friendly(e) };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const db = await this.supabase.client();
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { ok: true, message: 'Sesión iniciada.' };
    } catch (e) {
      return { ok: false, message: friendly(e) };
    }
  }

  async signOut(): Promise<void> {
    const db = await this.supabase.client();
    await db.auth.signOut();
    this.user.set(null);
    this.profile.set(null);
  }

  async requestPasswordReset(email: string): Promise<AuthResult> {
    try {
      const db = await this.supabase.client();
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` });
      if (error) throw error;
      // Mensaje neutro: no revela si el correo existe.
      return { ok: true, message: 'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.' };
    } catch (e) {
      return { ok: false, message: friendly(e) };
    }
  }

  async updatePassword(password: string): Promise<AuthResult> {
    try {
      const db = await this.supabase.client();
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
      this.recovering.set(false);
      return { ok: true, message: 'Contraseña actualizada.' };
    } catch (e) {
      return { ok: false, message: friendly(e) };
    }
  }

  async loadProfile(): Promise<void> {
    const uid = this.user()?.id;
    if (!uid) return;
    const db = await this.supabase.client();
    const { data } = await db.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) {
      this.profile.set({
        id: data.id, username: data.username, avatarUrl: data.avatar_url, region: data.region, createdAt: data.created_at,
      });
    }
  }

  async updateProfile(patch: { username: string; avatarUrl: string | null; region: GameRegion }): Promise<AuthResult> {
    const uid = this.user()?.id;
    if (!uid) return { ok: false, message: 'Inicia sesión primero.' };
    try {
      const db = await this.supabase.client();
      const { error } = await db
        .from('profiles')
        .update({ username: patch.username, avatar_url: patch.avatarUrl, region: patch.region })
        .eq('id', uid);
      if (error) throw error;
      await this.loadProfile();
      return { ok: true, message: 'Perfil guardado.' };
    } catch (e) {
      return { ok: false, message: friendly(e) };
    }
  }

  async listCharacters(): Promise<Character[]> {
    const db = await this.supabase.client();
    const { data, error } = await db.from('characters').select('id, name, realm, region').order('created_at');
    if (error) throw error;
    return data as Character[];
  }

  async addCharacter(c: Omit<Character, 'id'>): Promise<AuthResult> {
    try {
      const db = await this.supabase.client();
      const { error } = await db.from('characters').insert(c);
      if (error) throw error;
      return { ok: true, message: 'Personaje añadido.' };
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      return { ok: false, message: /duplicate/i.test(msg) ? 'Ese personaje ya está registrado.' : friendly(e) };
    }
  }

  async removeCharacter(id: string): Promise<void> {
    const db = await this.supabase.client();
    const { error } = await db.from('characters').delete().eq('id', id);
    if (error) throw error;
  }
}

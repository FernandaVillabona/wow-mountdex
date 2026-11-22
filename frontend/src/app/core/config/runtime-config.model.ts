export interface RuntimeConfig {
  /** URL del proyecto Supabase. Vacío = modo solo local. */
  supabaseUrl: string;
  /** Clave anónima (pública por diseño; la seguridad la da RLS). */
  supabaseAnonKey: string;
  /** Client ID público de Blizzard. El secret vive solo en la Edge Function. */
  blizzardClientId: string;
  /** Debe coincidir con la Redirect URL registrada en develop.battle.net. */
  blizzardRedirectUri: string;
}

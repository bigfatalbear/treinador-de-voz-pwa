/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_BUCKET?: string;
  readonly VITE_SUPABASE_GOOGLE_ENABLED?: string;
  readonly VITE_CHOIR_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);
export const mediaBucket = import.meta.env.VITE_SUPABASE_BUCKET || 'media';
export const googleAuthEnabled = import.meta.env.VITE_SUPABASE_GOOGLE_ENABLED === 'true';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit'
      }
    })
  : null;

function requireClient(): SupabaseClient {
  if (!supabase) throw new Error('Supabase não está configurado.');
  return supabase;
}

export async function signInEmail(email: string, password: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUpEmail(
  email: string,
  password: string,
  name: string
): Promise<boolean> {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim() } }
  });
  if (error) throw error;
  return Boolean(data.session);
}

function appRedirectUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export async function signInGoogle(): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: appRedirectUrl() }
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: appRedirectUrl()
  });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOutSupabase(): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function deleteAccount(): Promise<void> {
  const client = requireClient();
  const { data, error } = await client.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
}

export function supabaseErrorMessage(error: unknown): string {
  const candidate = error as { message?: string; code?: string; status?: number } | null;
  if (!candidate) return 'Erro inesperado.';
  const message = candidate.message || '';
  const code = candidate.code || '';
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (normalized.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (normalized.includes('user already registered')) {
    return 'Este e-mail já possui conta. Entre com a senha.';
  }
  if (normalized.includes('password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (normalized.includes('should be different from the old password')) {
    return 'A nova senha precisa ser diferente da senha atual.';
  }
  if (normalized.includes('link is invalid') || normalized.includes('link has expired')) {
    return 'Este link de recuperação expirou. Solicite outro na tela de login.';
  }
  if (normalized.includes('email rate limit') || normalized.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Falha de rede. Verifique sua conexão.';
  }
  if (normalized.includes('jwt expired') || normalized.includes('session missing')) {
    return 'Sessão expirada. Entre novamente.';
  }
  if (normalized.includes('row-level security') || code === '42501' || candidate.status === 403) {
    return 'Sem permissão para esta ação.';
  }
  if (normalized.includes('código de convite')) return 'Código de convite inválido.';
  if (normalized.includes('naipe')) return 'Naipe inválido.';
  if (normalized.includes('informe seu nome')) return 'Informe seu nome com pelo menos 2 caracteres.';
  if (normalized.includes('duplicate key')) return 'Este registro já existe.';
  return message || 'Erro inesperado.';
}

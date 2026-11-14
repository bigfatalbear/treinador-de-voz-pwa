import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppUser, Member, Role, VoicePart } from '../types';
import {
  googleAuthEnabled,
  isSupabaseConfigured,
  requestPasswordReset as supabaseRequestPasswordReset,
  signInEmail as supabaseSignInEmail,
  signInGoogle as supabaseSignInGoogle,
  signOutSupabase,
  signUpEmail as supabaseSignUpEmail,
  supabase,
  supabaseErrorMessage,
  updatePassword as supabaseUpdatePassword
} from '../lib/supabase';
import { ensureLocalSeed, getMember, paths, saveMember, updateDocument } from '../lib/store';

type AuthStatus = 'loading' | 'signedOut' | 'onboarding' | 'recovery' | 'ready';
type AppMode = 'demo' | 'supabase';

interface AuthContextValue {
  status: AuthStatus;
  mode: AppMode;
  user: AppUser | null;
  member: Member | null;
  error: string;
  notice: string;
  authenticating: boolean;
  googleEnabled: boolean;
  clearError: () => void;
  clearNotice: () => void;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name: string) => Promise<boolean>;
  signInGoogle: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  signInDemo: (role: Role) => void;
  joinChoir: (code: string, voicePart: VoicePart, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMember: () => Promise<void>;
  updateMember: (patch: Partial<Member>) => Promise<void>;
  setRegentRole: (memberId: string, regent: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_SESSION_KEY = 'tdv:demo-session';
const MEMBER_CACHE_KEY = 'tdv:member-cache';
const RECOVERY_PENDING_KEY = 'tdv:password-recovery-pending';

interface DemoSession {
  role: Role;
  voicePart: VoicePart;
  name?: string;
}

function displayName(user: User): string {
  return (
    String(user.user_metadata?.name || user.user_metadata?.full_name || '').trim() ||
    user.email?.split('@')[0] ||
    'Coralista'
  );
}

function memberFromUser(user: User): Member {
  return {
    id: user.id,
    name: displayName(user),
    email: user.email || '',
    role: 'coralista',
    voicePart: 'soprano'
  };
}

function appUserFromSupabase(user: User): AppUser {
  return {
    uid: user.id,
    name: displayName(user),
    email: user.email || '',
    photoURL: String(user.user_metadata?.avatar_url || '') || undefined
  };
}

function demoMember(role: Role, voicePart: VoicePart): Member {
  return {
    id: role === 'regente' ? 'demo-regente' : 'demo-coralista',
    name: role === 'regente' ? 'Regente Demo' : 'Coralista Demo',
    email: role === 'regente' ? 'regente@demo.local' : 'coralista@demo.local',
    role,
    voicePart
  };
}

function cacheMember(member: Member): void {
  try {
    localStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify(member));
  } catch {
    // Espaço ou modo privado indisponível.
  }
}

function readCachedMember(uid: string): Member | null {
  try {
    const raw = localStorage.getItem(MEMBER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Member;
    return parsed?.id === uid ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AppMode = isSupabaseConfigured ? 'supabase' : 'demo';
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    ensureLocalSeed();
    if (!isSupabaseConfigured || !supabase) {
      try {
        const raw = localStorage.getItem(DEMO_SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw) as DemoSession;
          const demo = demoMember(session.role, session.voicePart);
          if (session.name) demo.name = session.name;
          setUser({ uid: demo.id, name: demo.name, email: demo.email });
          setMember(demo);
          setStatus('ready');
        } else {
          setStatus('signedOut');
        }
      } catch {
        setStatus('signedOut');
      }
      return;
    }

    const client = supabase;
    let cancelled = false;

    const hydrate = async (supabaseUser: User) => {
      setUser(appUserFromSupabase(supabaseUser));
      setStatus('loading');
      try {
        try {
          const { error: syncError } = await client.rpc('sync_regent_role');
          if (syncError) console.warn('sync_regent_role indisponível.', syncError);
        } catch (syncError) {
          console.warn('sync_regent_role indisponível.', syncError);
        }

        const existing = await getMember(supabaseUser.id);
        if (cancelled) return;
        if (existing) {
          cacheMember(existing);
          setMember(existing);
          setStatus('ready');
        } else {
          setMember(memberFromUser(supabaseUser));
          setStatus('onboarding');
        }
      } catch (memberError) {
        if (cancelled) return;
        const cached = readCachedMember(supabaseUser.id);
        if (cached && typeof navigator !== 'undefined' && !navigator.onLine) {
          setMember(cached);
          setStatus('ready');
          return;
        }
        setError(supabaseErrorMessage(memberError));
        setMember(memberFromUser(supabaseUser));
        setStatus('onboarding');
      }
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY') {
        try {
          sessionStorage.setItem(RECOVERY_PENDING_KEY, '1');
        } catch {
          // Armazenamento indisponível em modo privado.
        }
        if (session?.user) setUser(appUserFromSupabase(session.user));
        setMember(null);
        setError('');
        setNotice('');
        setStatus('recovery');
        return;
      }
      if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        let recoveryPending = false;
        try {
          recoveryPending = sessionStorage.getItem(RECOVERY_PENDING_KEY) === '1';
        } catch {
          recoveryPending = false;
        }
        if (recoveryPending) {
          setUser(appUserFromSupabase(session.user));
          setStatus('recovery');
          return;
        }
        void hydrate(session.user);
        return;
      }
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        try {
          sessionStorage.removeItem(RECOVERY_PENDING_KEY);
        } catch {
          // Armazenamento indisponível em modo privado.
        }
        setUser(null);
        setMember(null);
        setStatus('signedOut');
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    setError('');
    setNotice('');
    setAuthenticating(true);
    try {
      await supabaseSignInEmail(email, password);
    } catch (signInError) {
      setError(supabaseErrorMessage(signInError));
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const signUpEmail = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setError('');
      setNotice('');
      setAuthenticating(true);
      try {
        const hasSession = await supabaseSignUpEmail(email, password, name);
        if (!hasSession) {
          setError('Conta criada. Confirme seu e-mail antes de entrar.');
        }
        return hasSession;
      } catch (signUpError) {
        setError(supabaseErrorMessage(signUpError));
        return false;
      } finally {
        setAuthenticating(false);
      }
    },
    []
  );

  const signInGoogle = useCallback(async () => {
    setError('');
    setNotice('');
    setAuthenticating(true);
    try {
      await supabaseSignInGoogle();
    } catch (signInError) {
      setError(supabaseErrorMessage(signInError));
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    setError('');
    setNotice('');
    setAuthenticating(true);
    try {
      await supabaseRequestPasswordReset(email);
      return true;
    } catch (resetError) {
      setError(supabaseErrorMessage(resetError));
      return false;
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<boolean> => {
    setError('');
    setNotice('');
    setAuthenticating(true);
    try {
      await supabaseUpdatePassword(password);
      try {
        sessionStorage.removeItem(RECOVERY_PENDING_KEY);
      } catch {
        // Armazenamento indisponível em modo privado.
      }
      setNotice('Senha alterada. Entre com a nova senha.');
      try {
        await signOutSupabase();
      } catch {
        // A sessão de recuperação já pode ter expirado; o login continua válido.
      }
      setUser(null);
      setMember(null);
      setStatus('signedOut');
      return true;
    } catch (updateError) {
      setError(supabaseErrorMessage(updateError));
      return false;
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const signInDemo = useCallback((role: Role) => {
    ensureLocalSeed();
    let previous: DemoSession | null = null;
    try {
      const raw = localStorage.getItem(DEMO_SESSION_KEY);
      previous = raw ? (JSON.parse(raw) as DemoSession) : null;
    } catch {
      previous = null;
    }
    const session: DemoSession = {
      role,
      voicePart: role === 'regente' ? 'soprano' : 'contralto',
      name: previous?.name
    };
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
    const demo = demoMember(session.role, session.voicePart);
    if (session.name) demo.name = session.name;
    setUser({ uid: demo.id, name: demo.name, email: demo.email });
    setMember(demo);
    setError('');
    setNotice('');
    setStatus('ready');
  }, []);

  const joinChoir = useCallback(
    async (code: string, voicePart: VoicePart, name: string) => {
      if (!user) throw new Error('Sessão não encontrada.');
      const cleanName = name.trim();
      if (cleanName.length < 2) throw new Error('Informe seu nome.');
      if (mode === 'demo') {
        const demo = demoMember('coralista', voicePart);
        demo.name = cleanName;
        const session: DemoSession = { role: 'coralista', voicePart, name: cleanName };
        localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
        setMember(demo);
        setStatus('ready');
        return;
      }
      if (!supabase) throw new Error('Supabase não está configurado.');
      const { error: joinError } = await supabase.rpc('join_choir', {
        p_code: code.trim(),
        p_voice_part: voicePart,
        p_name: cleanName
      });
      if (joinError) throw new Error(supabaseErrorMessage(joinError));

      const existing = await getMember(user.uid);
      if (!existing) throw new Error('Não foi possível concluir a entrada no coral.');
      cacheMember(existing);
      setMember(existing);
      setStatus('ready');
    },
    [mode, user]
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem(MEMBER_CACHE_KEY);
    try {
      sessionStorage.removeItem(RECOVERY_PENDING_KEY);
    } catch {
      // Armazenamento indisponível em modo privado.
    }
    setNotice('');
    if (mode === 'supabase') {
      await signOutSupabase();
      return;
    }
    localStorage.removeItem(DEMO_SESSION_KEY);
    setUser(null);
    setMember(null);
    setStatus('signedOut');
  }, [mode]);

  const refreshMember = useCallback(async () => {
    if (!user) return;
    if (mode === 'demo') return;
    const fresh = await getMember(user.uid);
    if (fresh) {
      cacheMember(fresh);
      setMember(fresh);
    }
  }, [mode, user]);

  const setRegentRole = useCallback(
    async (memberId: string, regent: boolean) => {
      if (mode === 'demo') {
        const role: Role = regent ? 'regente' : 'coralista';
        await updateDocument<Member>(paths.members, memberId, { role });
        if (member?.id === memberId) {
          const nextMember = { ...member, role };
          cacheMember(nextMember);
          setMember(nextMember);
          const session: DemoSession = {
            role,
            voicePart: nextMember.voicePart,
            name: nextMember.name
          };
          localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
        }
        return;
      }
      if (!supabase) throw new Error('Supabase não está configurado.');
      const { error: roleError } = await supabase.rpc('set_regent_role', {
        p_member_id: memberId,
        p_regent: regent
      });
      if (roleError) throw new Error(supabaseErrorMessage(roleError));
      if (member?.id === memberId) await refreshMember();
    },
    [member, mode, refreshMember]
  );

  const updateMember = useCallback(
    async (patch: Partial<Member>) => {
      if (!member) return;
      const safePatch: Partial<Member> = {
        name: patch.name ?? member.name,
        voicePart: patch.voicePart ?? member.voicePart
      };
      await saveMember(member.id, safePatch);
      const nextMember = { ...member, ...safePatch };
      cacheMember(nextMember);
      if (mode === 'demo') {
        const session: DemoSession = {
          role: member.role,
          voicePart: safePatch.voicePart ?? member.voicePart,
          name: safePatch.name ?? member.name
        };
        localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
        setUser((current) => (current ? { ...current, name: session.name ?? current.name } : current));
      }
      setMember(nextMember);
    },
    [member, mode]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      mode,
      user,
      member,
      error,
      notice,
      authenticating,
      googleEnabled: googleAuthEnabled,
      clearError: () => setError(''),
      clearNotice: () => setNotice(''),
      signInEmail,
      signUpEmail,
      signInGoogle,
      requestPasswordReset,
      updatePassword,
      signInDemo,
      joinChoir,
      signOut,
      refreshMember,
      updateMember,
      setRegentRole
    }),
    [
      status,
      mode,
      user,
      member,
      error,
      notice,
      authenticating,
      signInEmail,
      signUpEmail,
      signInGoogle,
      requestPasswordReset,
      updatePassword,
      signInDemo,
      joinChoir,
      signOut,
      refreshMember,
      updateMember,
      setRegentRole
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}

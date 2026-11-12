import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { AppUser, Member, Role, VoicePart } from '../types';
import {
  auth,
  callFunction,
  completeRedirectSignIn,
  firebaseErrorMessage,
  isFirebaseConfigured,
  signInWithGoogle as firebaseGoogleSignIn,
  signOutFirebase
} from '../lib/firebase';
import { ensureLocalSeed, getMember, saveMember } from '../lib/store';

type AuthStatus = 'loading' | 'signedOut' | 'onboarding' | 'ready';
type AppMode = 'demo' | 'firebase';

interface AuthContextValue {
  status: AuthStatus;
  mode: AppMode;
  user: AppUser | null;
  member: Member | null;
  error: string;
  authenticating: boolean;
  clearError: () => void;
  signInGoogle: () => Promise<void>;
  signInDemo: (role: Role) => void;
  joinChoir: (code: string, voicePart: VoicePart, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMember: () => Promise<void>;
  updateMember: (patch: Partial<Member>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_SESSION_KEY = 'tdv:demo-session';
const MEMBER_CACHE_KEY = 'tdv:member-cache';

interface DemoSession {
  role: Role;
  voicePart: VoicePart;
  name?: string;
}

function memberFromUser(user: User): Member {
  return {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Coralista',
    email: user.email || '',
    role: 'coralista',
    voicePart: 'soprano'
  };
}

function appUserFromFirebase(user: User): AppUser {
  return {
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Coralista',
    email: user.email || '',
    photoURL: user.photoURL || undefined
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
  const mode: AppMode = isFirebaseConfigured ? 'firebase' : 'demo';
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    ensureLocalSeed();
    if (!isFirebaseConfigured || !auth) {
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

    let cancelled = false;
    void completeRedirectSignIn();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (cancelled) return;
      if (!firebaseUser) {
        setUser(null);
        setMember(null);
        setStatus('signedOut');
        return;
      }
      setUser(appUserFromFirebase(firebaseUser));
      setStatus('loading');
      void (async () => {
        try {
          try {
            await callFunction('syncRegentRole', {});
          } catch (functionError) {
            console.warn('syncRegentRole indisponível.', functionError);
          }
          const existing = await getMember(firebaseUser.uid);
          if (cancelled) return;
          if (existing) {
            cacheMember(existing);
            setMember(existing);
            setStatus('ready');
          } else {
            const draft = memberFromUser(firebaseUser);
            setMember(draft);
            setStatus('onboarding');
          }
        } catch (memberError) {
          if (cancelled) return;
          const cached = readCachedMember(firebaseUser.uid);
          if (cached && typeof navigator !== 'undefined' && !navigator.onLine) {
            setMember(cached);
            setStatus('ready');
            return;
          }
          setError(firebaseErrorMessage(memberError));
          setMember(memberFromUser(firebaseUser));
          setStatus('onboarding');
        }
      })();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signInGoogle = useCallback(async () => {
    setError('');
    setAuthenticating(true);
    try {
      await firebaseGoogleSignIn();
    } catch (signInError) {
      setError(firebaseErrorMessage(signInError));
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
      const response = await callFunction<Member, { code: string; voicePart: VoicePart; name: string }>(
        'joinChoir',
        { code: code.trim(), voicePart, name: cleanName }
      );
      const existing = response?.id ? response : await getMember(user.uid);
      if (!existing) throw new Error('Não foi possível concluir a entrada no coral.');
      cacheMember(existing);
      setMember(existing);
      setStatus('ready');
    },
    [mode, user]
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem(MEMBER_CACHE_KEY);
    if (mode === 'firebase') {
      await signOutFirebase();
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
      authenticating,
      clearError: () => setError(''),
      signInGoogle,
      signInDemo,
      joinChoir,
      signOut,
      refreshMember,
      updateMember
    }),
    [
      status,
      mode,
      user,
      member,
      error,
      authenticating,
      signInGoogle,
      signInDemo,
      joinChoir,
      signOut,
      refreshMember,
      updateMember
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}

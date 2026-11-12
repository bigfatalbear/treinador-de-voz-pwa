import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId
);

export const firebaseRegion = import.meta.env.VITE_FIREBASE_REGION || 'southamerica-east1';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    });
    const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (recaptchaSiteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true
      });
    }
    auth = getAuth(app);
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch {
      db = getFirestore(app);
    }
    storage = getStorage(app);
    functions = getFunctions(app, firebaseRegion);
  } catch (error) {
    console.error('Falha ao inicializar o Firebase. O app continuará em modo local.', error);
    app = null;
    auth = null;
    db = null;
    storage = null;
    functions = null;
  }
}

export { app, auth, db, storage, functions };

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Firebase Authentication não está configurado.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/operation-not-allowed'
    ) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function completeRedirectSignIn(): Promise<void> {
  if (!auth) return;
  try {
    await getRedirectResult(auth);
  } catch (error) {
    console.warn('Falha ao concluir o login por redirecionamento.', error);
  }
}

export async function signOutFirebase(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}

export async function callFunction<TResponse, TData extends object = object>(
  name: string,
  data: TData
): Promise<TResponse> {
  if (!functions) throw new Error('Cloud Functions não está configurado.');
  const callable = httpsCallable<TData, TResponse>(functions, name);
  const result = await callable(data);
  return result.data;
}

export function firebaseErrorMessage(error: unknown): string {
  const candidate = error as { code?: string; message?: string };
  if (!candidate) return 'Erro inesperado.';
  const code = candidate.code ?? '';
  const map: Record<string, string> = {
    'auth/popup-closed-by-user': 'Login cancelado. Tente novamente.',
    'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase Authentication.',
    'auth/network-request-failed': 'Falha de rede ao autenticar.',
    'permission-denied': 'Sem permissão para esta ação.',
    'unauthenticated': 'Sessão expirada. Entre novamente.',
    'functions/unauthenticated': 'Sessão expirada. Entre novamente.',
    'functions/permission-denied': 'Sem permissão para esta ação.',
    'functions/failed-precondition': 'Configuração do coral incompleta no servidor.',
    'functions/not-found': 'Recurso não encontrado.'
  };
  return map[code] || candidate.message || 'Erro inesperado.';
}

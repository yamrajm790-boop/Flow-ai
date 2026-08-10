import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
  User,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Construct config using environment variables with fallback to firebase-applet-config.json
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || 'gen-lang-client-0076726116';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || `${projectId}.firebaseapp.com`,
  projectId: projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || `${projectId}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`,
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
// Ensure browser local persistence is set
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase Auth] Could not set local persistence:', err);
});

export const database = getDatabase(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

if (import.meta.env.DEV) {
  console.log('Firebase initialized');
  console.log('Google provider initialized');
}

// Check if running inside an embedded iframe (e.g., AI Studio preview)
export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

// Helper to check if client is on mobile browser
export function isMobileBrowser(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isRedirectInProgress(): boolean {
  try {
    return sessionStorage.getItem('flow_ai_redirect_in_progress') === 'true';
  } catch (e) {
    return false;
  }
}

// Google Login handling
export async function signInWithGoogle(): Promise<User | null> {
  if (import.meta.env.DEV) {
    console.log('Google sign-in started');
  }

  try {
    // Try popup first
    const result = await signInWithPopup(auth, googleProvider);
    if (import.meta.env.DEV) {
      console.log('Google sign-in successful');
      if (result?.user?.uid) {
        console.log('Firebase UID available');
      }
    }
    return result.user;
  } catch (error: any) {
    if (import.meta.env.DEV) {
      console.warn('[Firebase Auth] Popup error:', error?.code || error);
    }

    // If user explicitly cancelled or closed popup, rethrow error
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      throw error;
    }

    // Mobile / popup-blocked fallback to redirect IF not running in an embedded iframe
    if (
      (error?.code === 'auth/popup-blocked' ||
        error?.code === 'auth/operation-not-supported-in-this-environment' ||
        isMobileBrowser()) &&
      !isInIframe()
    ) {
      if (import.meta.env.DEV) {
        console.log('[Firebase Auth] Falling back to signInWithRedirect');
      }
      try {
        sessionStorage.setItem('flow_ai_redirect_in_progress', 'true');
      } catch (e) {}
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    throw error;
  }
}

// Check redirect result on application boot (only once)
let redirectChecked = false;

export async function checkRedirectAuthResult(): Promise<User | null> {
  if (redirectChecked || isInIframe()) {
    try {
      sessionStorage.removeItem('flow_ai_redirect_in_progress');
    } catch (e) {}
    return null;
  }
  redirectChecked = true;

  try {
    // 6-second timeout for getRedirectResult so it never hangs indefinitely
    const redirectPromise = getRedirectResult(auth);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    const result = await Promise.race([redirectPromise, timeoutPromise]);

    try {
      sessionStorage.removeItem('flow_ai_redirect_in_progress');
    } catch (e) {}

    if (result?.user && import.meta.env.DEV) {
      console.log('Google sign-in successful (from redirect)');
      console.log('Firebase UID available');
    }
    return result?.user || null;
  } catch (error: any) {
    try {
      sessionStorage.removeItem('flow_ai_redirect_in_progress');
    } catch (e) {}
    if (import.meta.env.DEV) {
      console.warn('[Firebase Auth] Redirect result notice:', error?.message || error);
    }
    return null;
  }
}

// Sign Out
export async function logoutUser() {
  await firebaseSignOut(auth);
}

// Get fresh Firebase ID Token
export async function getFirebaseIdToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken();
  } catch (err) {
    console.error('[Firebase Auth] Failed to retrieve ID token:', err);
    return null;
  }
}

// Format friendly user-facing error messages
export function formatAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected authentication error occurred.';
  const code = error.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked. Please allow popups or try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Console. Please add flowaii.duckdns.org to Firebase Auth -> Settings -> Authorized Domains.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address using a different sign-in method.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase Console. Please enable Google provider in Firebase Console -> Authentication -> Sign-in method.';
    default:
      return typeof error === 'string' ? error : (error.message || 'Failed to sign in with Google. Please try again.');
  }
}

export { app };

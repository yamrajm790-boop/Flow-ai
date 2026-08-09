import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
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
export const database = getDatabase(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Helper to check if client is on mobile browser
export function isMobileBrowser(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Google Login with automatic mobile redirect fallback
export async function signInWithGoogle() {
  try {
    if (isMobileBrowser()) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn('[Firebase Auth] Popup error, falling back to redirect:', error?.code || error);
    if (
      error.code === 'auth/popup-blocked' ||
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request' ||
      isMobileBrowser()
    ) {
      if (error.code !== 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, googleProvider);
      }
    }
    throw error;
  }
}

// Check redirect result on application boot
export async function checkRedirectAuthResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error('[Firebase Auth] Redirect result error:', error);
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
    return await currentUser.getIdToken(true);
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
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked. Please allow popups or try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/unauthorized-domain':
      return 'Domain not authorized in Firebase Console.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address.';
    default:
      return error.message || 'Failed to sign in with Google. Please try again.';
  }
}

export { app };

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  checkRedirectAuthResult,
  logoutUser,
  getFirebaseIdToken,
  formatAuthErrorMessage,
  isRedirectInProgress,
} from '../lib/firebase';
import { syncUserProfileToRTDB } from '../lib/rtdb';
import { UserProfile } from '../types';
import { saveLocalUser, defaultGuestProfile, getLocalUser } from '../lib/storage';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  clearError: () => void;
  retryAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  error: null,
  loginWithGoogle: async () => {},
  logout: async () => {},
  getIdToken: async () => null,
  clearError: () => {},
  retryAuth: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isLoggingInRef = useRef<boolean>(false);

  const initAuth = useCallback(() => {
    setLoading(true);
    setError(null);

    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    // Safety timeout (15 seconds): ensure app never hangs on "Loading Flow AI Workspace..."
    timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] Initialization safety timeout reached.');
        const isUserOAuthAction = isLoggingInRef.current || isRedirectInProgress();
        const cachedUser = getLocalUser();

        if (isUserOAuthAction) {
          setError('Authentication request timed out. Please check your connection and retry.');
        } else {
          // If simply opening app, fall back to guest/cached user without showing error banner
          if (cachedUser) {
            setUser(cachedUser);
          } else {
            setUser(defaultGuestProfile);
          }
        }
        setLoading(false);
        isLoggingInRef.current = false;
      }
    }, 15000);

    // 1. Check redirect result first (if coming back from OAuth redirect)
    checkRedirectAuthResult()
      .then((redirectUser) => {
        if (redirectUser && isMounted) {
          console.log('[Auth] Redirect sign-in success for:', redirectUser.email);
        }
      })
      .catch((err) => {
        console.warn('[Auth] Redirect check notice:', err);
      });

    // 2. Main Firebase Auth State Listener
    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (!isMounted) return;

        setFirebaseUser(fbUser);

        if (fbUser) {
          setError(null); // Clear any existing auth error on successful auth state
          if (import.meta.env.DEV) {
            console.log('[Auth] Firebase user active:', fbUser.email);
          }

          // Sync profile to RTDB with a 4-second timeout so slow network won't stall UI
          try {
            const syncPromise = syncUserProfileToRTDB({
              uid: fbUser.uid,
              displayName: fbUser.displayName,
              email: fbUser.email,
              photoURL: fbUser.photoURL,
            });
            const rtdbTimeout = new Promise<null>((r) => setTimeout(() => r(null), 4000));
            const syncedProfile = await Promise.race([syncPromise, rtdbTimeout]);

            if (isMounted) {
              const finalProfile: UserProfile = syncedProfile || {
                id: fbUser.uid,
                email: fbUser.email || '',
                full_name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                avatar_url: fbUser.photoURL || undefined,
              };
              setUser(finalProfile);
              saveLocalUser(finalProfile);
            }
          } catch (syncErr) {
            if (isMounted) {
              const fallbackProfile: UserProfile = {
                id: fbUser.uid,
                email: fbUser.email || '',
                full_name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                avatar_url: fbUser.photoURL || undefined,
              };
              setUser(fallbackProfile);
              saveLocalUser(fallbackProfile);
            }
          } finally {
            if (isMounted) {
              setLoading(false);
              isLoggingInRef.current = false;
            }
          }
        } else {
          if (isMounted) {
            const cachedUser = getLocalUser();
            if (cachedUser && cachedUser.id === 'guest') {
              setUser(cachedUser);
            } else {
              setUser(null);
            }
            setLoading(false);
            isLoggingInRef.current = false;
          }
        }
      },
      (authErr) => {
        console.error('[Auth] onAuthStateChanged error:', authErr);
        if (timeoutId) clearTimeout(timeoutId);
        if (isMounted) {
          setUser(null);
          setError('Unable to verify your session. Please check your connection.');
          setLoading(false);
          isLoggingInRef.current = false;
        }
      }
    );

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const cleanup = initAuth();
    return () => cleanup();
  }, [initAuth]);

  const loginWithGoogle = async () => {
    if (isLoggingInRef.current) {
      console.warn('[Auth] Login request already in progress, ignoring duplicate call.');
      return;
    }

    isLoggingInRef.current = true;
    setLoading(true);
    setError(null);

    try {
      await signInWithGoogle();
      // onAuthStateChanged listener will handle session sync and set loading = false
    } catch (err: any) {
      console.error('[Auth] Google Login error:', err);
      const friendlyMsg = formatAuthErrorMessage(err);
      setError(friendlyMsg);
      setLoading(false);
      isLoggingInRef.current = false;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setFirebaseUser(null);
      localStorage.removeItem('flow_ai_user');
    } catch (err) {
      console.error('[Auth] Logout error:', err);
    } finally {
      setLoading(false);
      isLoggingInRef.current = false;
    }
  };

  const getIdToken = async () => {
    return await getFirebaseIdToken();
  };

  const clearError = () => setError(null);

  const retryAuth = () => {
    isLoggingInRef.current = false;
    initAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        error,
        loginWithGoogle,
        logout,
        getIdToken,
        clearError,
        retryAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


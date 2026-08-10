import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  checkRedirectAuthResult,
  logoutUser,
  getFirebaseIdToken,
  formatAuthErrorMessage,
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

  const initAuth = useCallback(() => {
    setLoading(true);
    setError(null);

    let isMounted = true;

    // 10-second timeout: ensure loading state never hangs indefinitely
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] Initialization 10-second timeout triggered.');
        const cachedUser = getLocalUser() || defaultGuestProfile;
        setUser(cachedUser);
        setError('Authentication request timed out. Please check your connection and retry.');
        setLoading(false);
      }
    }, 10000);

    // 1. Check for mobile redirect auth result on startup
    checkRedirectAuthResult()
      .then((redirectUser) => {
        if (redirectUser) {
          console.log('[Auth] Redirect sign-in success for:', redirectUser.email);
        }
      })
      .catch((err) => {
        console.warn('[Auth] Redirect check error:', err);
      });

    // 2. Main Firebase Auth State Listener (Source of Truth)
    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser) => {
        clearTimeout(timeoutId);
        if (!isMounted) return;

        if (import.meta.env.DEV) {
          console.log('Auth state changed');
        }

        setFirebaseUser(fbUser);

        if (fbUser) {
          if (import.meta.env.DEV) {
            console.log('Firebase UID available');
          }

          // Verify token retrieval for backend communication
          try {
            const token = await fbUser.getIdToken();
            if (token && import.meta.env.DEV) {
              console.log('Backend token verification successful');
            }
          } catch (tokErr) {
            if (import.meta.env.DEV) {
              console.warn('[Auth] Token retrieval notice:', tokErr);
            }
          }

          if (import.meta.env.DEV) {
            console.log('Profile synchronization started');
          }

          try {
            const syncedProfile = await syncUserProfileToRTDB({
              uid: fbUser.uid,
              displayName: fbUser.displayName,
              email: fbUser.email,
              photoURL: fbUser.photoURL,
            });
            if (isMounted) {
              setUser(syncedProfile);
              saveLocalUser(syncedProfile);
            }
          } catch (syncErr) {
            if (import.meta.env.DEV) {
              console.warn('[Auth] Profile sync error, using fallback:', syncErr);
            }
            const fallbackProfile: UserProfile = {
              id: fbUser.uid,
              email: fbUser.email || '',
              full_name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
              avatar_url: fbUser.photoURL || undefined,
            };
            if (isMounted) {
              setUser(fallbackProfile);
              saveLocalUser(fallbackProfile);
            }
          } finally {
            if (import.meta.env.DEV) {
              console.log('Profile synchronization completed');
            }
            if (isMounted) {
              setLoading(false);
            }
          }
        } else {
          if (isMounted) {
            const cachedUser = getLocalUser();
            // If cached user is guest, preserve guest session; otherwise unauthenticated user = null
            if (cachedUser && cachedUser.id === 'guest') {
              setUser(cachedUser);
            } else {
              setUser(null);
            }
            setLoading(false);
          }
        }
      },
      (authErr) => {
        console.error('[Auth] onAuthStateChanged error:', authErr);
        clearTimeout(timeoutId);
        if (isMounted) {
          setUser(null);
          setError('Unable to verify your session. Please check your connection.');
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const cleanup = initAuth();
    return () => cleanup();
  }, [initAuth]);

  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Firebase onAuthStateChanged listener will automatically receive the authenticated user,
      // sync the user profile, update user state, and set loading = false.
    } catch (err: any) {
      console.error('[Auth] Google Login error:', err);
      const friendlyMsg = formatAuthErrorMessage(err);
      setError(friendlyMsg);
      setLoading(false);
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
    }
  };

  const getIdToken = async () => {
    return await getFirebaseIdToken();
  };

  const clearError = () => setError(null);

  const retryAuth = () => {
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


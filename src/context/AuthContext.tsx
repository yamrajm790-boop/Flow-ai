import React, { createContext, useContext, useEffect, useState } from 'react';
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
import { saveLocalUser, defaultGuestProfile } from '../lib/storage';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  clearError: () => void;
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
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Check for mobile redirect result on mount
    checkRedirectAuthResult()
      .then((redirectUser) => {
        if (redirectUser) {
          console.log('[Auth] Redirect sign-in success for:', redirectUser.email);
        }
      })
      .catch((err) => {
        console.warn('[Auth] Redirect check error:', err);
      });

    // 2. Main Firebase Auth State Observer
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          // Sync profile to Realtime Database
          const syncedProfile = await syncUserProfileToRTDB({
            uid: fbUser.uid,
            displayName: fbUser.displayName,
            email: fbUser.email,
            photoURL: fbUser.photoURL,
          });
          setUser(syncedProfile);
          saveLocalUser(syncedProfile);
        } catch (syncErr) {
          console.warn('[Auth] Realtime DB sync fallback:', syncErr);
          const fallbackProfile: UserProfile = {
            id: fbUser.uid,
            email: fbUser.email || '',
            full_name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            avatar_url: fbUser.photoURL || undefined,
          };
          setUser(fallbackProfile);
          saveLocalUser(fallbackProfile);
        }
      } else {
        setUser(defaultGuestProfile);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const loggedInUser = await signInWithGoogle();
      if (loggedInUser) {
        const synced = await syncUserProfileToRTDB({
          uid: loggedInUser.uid,
          displayName: loggedInUser.displayName,
          email: loggedInUser.email,
          photoURL: loggedInUser.photoURL,
        });
        setUser(synced);
        saveLocalUser(synced);
      }
    } catch (err: any) {
      console.error('[Auth] Login error:', err);
      const friendlyMsg = formatAuthErrorMessage(err);
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(defaultGuestProfile);
      setFirebaseUser(null);
      saveLocalUser(defaultGuestProfile);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

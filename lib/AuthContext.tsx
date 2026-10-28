'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseConfigured, getFirebaseAuth } from "./firebase";

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  photoUrl: string | null;
  getIdToken: () => Promise<string | null>;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  configured: firebaseConfigured,
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
  authError: null,
});

function toAuthUser(fbUser: User): AuthUser {
  const email = (fbUser.email ?? "").toLowerCase();
  return {
    uid: fbUser.uid,
    email,
    name: fbUser.displayName?.trim() || email || "Teammate",
    photoUrl: fbUser.photoURL,
    getIdToken: async () => {
      try {
        return await fbUser.getIdToken();
      } catch {
        return null;
      }
    },
  };
}

/**
 * Firebase Google auth state. When `NEXT_PUBLIC_FIREBASE_*` is missing the
 * provider stays in dev mode (`user` is null, `configured` is false) and the
 * team API falls back to a local dev email so the UI remains usable.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      // Deferred so no state is set synchronously inside the effect body.
      const t = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(t);
    }
    const unsub = onAuthStateChanged(
      auth,
      async (fbUser) => {
        setUser(fbUser ? toAuthUser(fbUser) : null);
        setLoading(false);
        if (fbUser) {
          try {
            const token = await fbUser.getIdToken();
            await fetch("/api/users/upsert", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: fbUser.displayName,
                photo: fbUser.photoURL,
              }),
            });
          } catch {
            // Non-fatal: membership calls retry on demand.
          }
        }
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthError("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* env vars.");
      return;
    }
    setAuthError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign in failed.");
    }
  }, []);

  const signOutUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,
      signInWithGoogle,
      signOutUser,
      authError,
    }),
    [user, loading, signInWithGoogle, signOutUser, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

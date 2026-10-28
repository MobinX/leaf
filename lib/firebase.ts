import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  return value ?? "";
}

export const firebaseConfigured =
  Boolean(readEnv("NEXT_PUBLIC_FIREBASE_API_KEY")) &&
  Boolean(readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN")) &&
  Boolean(readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"));

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/** Firebase Auth instance, or `null` when env config is missing (dev mode). */
export function getFirebaseAuth(): Auth | null {
  if (!firebaseConfigured) return null;
  if (auth) return auth;
  if (!getApps().length) {
    app = initializeApp({
      apiKey: readEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
      authDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
      projectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    });
  }
  auth = getAuth(getApps()[0] ?? app!);
  return auth;
}

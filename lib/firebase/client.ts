import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedAuth: Auth | undefined;

/**
 * Lazily initializes Firebase client auth on first use rather than at
 * module load. `getAuth()` throws immediately if `apiKey` is missing/
 * invalid, and `/login` is statically prerendered, so an eager call here
 * would fail `next build` in any environment without client config
 * available at build time (e.g. CI) even though this only runs in the
 * browser at request time.
 */
export function getClientAuth(): Auth {
  if (!cachedAuth) {
    const firebaseApp = getApps().length
      ? getApp()
      : initializeApp(firebaseConfig);
    cachedAuth = getAuth(firebaseApp);
  }

  return cachedAuth;
}

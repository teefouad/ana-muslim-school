import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let cachedAdminAuth: Auth | undefined;

/**
 * Lazily initializes the Firebase Admin SDK on first use rather than at
 * module load. `next build` statically evaluates route modules (and their
 * imports) to collect page data, so an eager `initializeApp()` call here
 * would fail the production build in any environment without Admin
 * credentials configured (e.g. CI) even though those routes only need
 * credentials at request time.
 */
export function getAdminAuth(): Auth {
  if (!cachedAdminAuth) {
    cachedAdminAuth = getAuth(getAdminApp());
  }

  return cachedAdminAuth;
}

let cachedAdminFirestore: Firestore | undefined;

/**
 * Lazily initializes Firestore Admin access for the same reason as
 * `getAdminAuth` above -- avoids an eager credential-dependent call at
 * module load / build time.
 */
export function getAdminFirestore(): Firestore {
  if (!cachedAdminFirestore) {
    cachedAdminFirestore = getFirestore(getAdminApp());
  }

  return cachedAdminFirestore;
}

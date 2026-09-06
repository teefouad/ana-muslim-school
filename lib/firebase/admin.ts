import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

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
    // Only consumed by getAdminStorage()'s default bucket() lookup below --
    // reusing the public client config instead of adding a second secret
    // for the same bucket name.
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
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
 * Lazily initializes Firestore for the same reason as `getAdminAuth` above --
 * avoids running at module load / `next build` time in environments without
 * Admin credentials configured (e.g. CI).
 */
export function getAdminFirestore(): Firestore {
  if (!cachedAdminFirestore) {
    cachedAdminFirestore = getFirestore(getAdminApp());
  }

  return cachedAdminFirestore;
}

let cachedAdminStorage: Storage | undefined;

/**
 * Lazily initializes Storage for the same reason as `getAdminAuth` above --
 * avoids running at module load / `next build` time in environments without
 * Admin credentials configured (e.g. CI). `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
 * is checked here rather than in `getAdminApp()` -- Auth/Firestore-only
 * callers shouldn't fail just because the bucket isn't configured, but
 * `.bucket()` needs it and otherwise fails later with an opaque
 * "Bucket name not specified or invalid" error.
 */
export function getAdminStorage(): Storage {
  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    throw new Error(
      "Missing Firebase Storage bucket. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.",
    );
  }

  if (!cachedAdminStorage) {
    cachedAdminStorage = getStorage(getAdminApp());
  }

  return cachedAdminStorage;
}

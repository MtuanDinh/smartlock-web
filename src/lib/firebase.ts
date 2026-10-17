import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

export interface FirebaseInstances {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
}

let cachedInstances: FirebaseInstances | null = null;

export function getFirebaseInstances(): FirebaseInstances {
  if (cachedInstances) {
    return cachedInstances;
  }

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  };

  const app =
    getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  cachedInstances = { app, auth, db };
  return cachedInstances;
}

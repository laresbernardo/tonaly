import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth,
  inMemoryPersistence,
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  type Auth,
} from 'firebase/auth';
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence 
} from 'firebase/firestore';

// Firebase configuration using Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'mock-api-key-for-local-dev',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mock-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mock-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mock-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:1234567890',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-12345678'
};

function canUseBrowserStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__tonaly_storage_probe__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const hasBrowserStorage = canUseBrowserStorage();

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services (falls back to in-memory auth persistence in sandboxed iframes)
function createSafeAuth(): Auth {
  if (!hasBrowserStorage) {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  }
  try {
    return getAuth(app);
  } catch {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  }
}

export const auth = createSafeAuth();
export const db = getFirestore(app);

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Enable Multi-Tab Offline Persistence for Firestore when browser storage is available
if (hasBrowserStorage) {
  try {
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open.');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence is not supported by this browser.');
      }
    });
  } catch {
    // Ignore IndexedDB security restrictions in sandboxed contexts
  }
}

// Helper functions for authentication
export const signInWithGoogle = async (): Promise<void> => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export default app;

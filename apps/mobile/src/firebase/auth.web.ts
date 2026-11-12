import { browserLocalPersistence, browserPopupRedirectResolver, initializeAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as firebaseSignOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, getAuth, type Auth, type User, type Unsubscribe } from 'firebase/auth';
import { firebaseConfig } from './config';
import { getFirebaseApp } from './client';

let authInstance: Auth | null = null;
function getAuthClient() {
  if (firebaseConfig.mode === 'local' || firebaseConfig.mode === 'invalid') throw new Error('FIREBASE_SETUP_INVALID');
  if (!authInstance) {
    try { authInstance = initializeAuth(getFirebaseApp(), { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver }); }
    catch (error) {
      if ((error as { code?: string }).code !== 'auth/already-initialized') throw error;
      authInstance = getAuth(getFirebaseApp());
    }
    if (firebaseConfig.mode === 'emulator') connectAuthEmulator(authInstance, `http://${firebaseConfig.emulatorHost}:9099`, { disableWarnings: true });
  }
  return authInstance;
}
export const observeUser = (callback: (user: User | null) => void, onError: (error: unknown) => void): Unsubscribe => onAuthStateChanged(getAuthClient(), callback, onError);
export async function signInEmail(email: string, password: string) { return signInWithEmailAndPassword(getAuthClient(), email, password); }
export async function registerEmail(email: string, password: string) { return createUserWithEmailAndPassword(getAuthClient(), email, password); }
export async function resetPassword(email: string) { return sendPasswordResetEmail(getAuthClient(), email); }
export async function signOut() { await firebaseSignOut(getAuthClient()); }
export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(getAuthClient(), provider);
}

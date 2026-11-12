import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-expect-error Metro selects Firebase's React Native conditional export, which exposes this RN-only persistence helper.
import { getReactNativePersistence } from 'firebase/auth';
import { initializeAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as firebaseSignOut, onAuthStateChanged, GoogleAuthProvider, signInWithCredential, getAuth, type Auth, type User, type Unsubscribe } from 'firebase/auth';
import { firebaseConfig } from './config';
import { getFirebaseApp } from './client';
import { createAuthError } from './authErrors';
import { Platform } from 'react-native';

let authInstance: Auth | null = null;
function getAuthClient() {
  if (firebaseConfig.mode === 'local' || firebaseConfig.mode === 'invalid') throw new Error('FIREBASE_SETUP_INVALID');
  if (!authInstance) {
    try { authInstance = initializeAuth(getFirebaseApp(), { persistence: getReactNativePersistence(AsyncStorage) }); }
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
export async function signOut() {
  await firebaseSignOut(getAuthClient());
  try { const { GoogleSignin } = await import('@react-native-google-signin/google-signin'); await GoogleSignin.signOut(); } catch { /* Firebase logout already succeeded; provider cleanup is best effort. */ }
}
export async function signInGoogle() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  if (!webClientId || Platform.OS === 'ios' && (!iosClientId || !iosUrlScheme?.startsWith('com.googleusercontent.apps.'))) throw createAuthError('auth/google-setup');
  let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin;
  try { ({ GoogleSignin } = await import('@react-native-google-signin/google-signin')); }
  catch { throw createAuthError('auth/google-unavailable'); }
  GoogleSignin.configure({ webClientId, ...(iosClientId ? { iosClientId } : {}), offlineAccess: false, scopes: ['email', 'profile'] });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') throw createAuthError('auth/provider-cancelled');
  if (!response.data.idToken) throw createAuthError('auth/missing-id-token');
  return signInWithCredential(getAuthClient(), GoogleAuthProvider.credential(response.data.idToken));
}

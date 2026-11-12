import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { createAuthError } from './authErrors';

export function getFirebaseApp() {
  if (firebaseConfig.mode === 'local') throw createAuthError('FIREBASE_NOT_CONFIGURED');
  if (firebaseConfig.mode === 'invalid') throw createAuthError('FIREBASE_SETUP_INVALID');
  return getApps().length ? getApp() : initializeApp(firebaseConfig.config);
}

let database: Firestore | null = null;
export function getFirebaseDatabase() {
  if (firebaseConfig.mode === 'local' || firebaseConfig.mode === 'invalid') throw createAuthError('FIREBASE_SETUP_INVALID');
  if (!database) {
    database = getFirestore(getFirebaseApp());
    if (firebaseConfig.mode === 'emulator') connectFirestoreEmulator(database, firebaseConfig.emulatorHost, 8080);
  }
  return database;
}

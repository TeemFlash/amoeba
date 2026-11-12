import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Entry } from '../domain/types';
import { asyncStorage } from '../storage/asyncStorage';
import { createApplicationsRepository } from './applications';
import { firebaseConfig } from './config';
import { getFirebaseDatabase } from './client';
import { createAccountIntentStore, type AccountDraft, type PendingApplicationIntent } from './intents';
import { mapAuthError, type AuthErrorCode } from './authErrors';
import { createSessionGuard } from './sessionGuard';
import type { User } from 'firebase/auth';

export type FirebaseMode = 'local' | 'invalid' | 'configured';
const mode: FirebaseMode = firebaseConfig.mode === 'local' ? 'local' : firebaseConfig.mode === 'invalid' ? 'invalid' : 'configured';

export function useFirebaseAccount() {
  const guard = useRef(createSessionGuard());
  const userRef = useRef<User | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(mode === 'configured');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PendingApplicationIntent | null>(null);
  const [authError, setAuthError] = useState<AuthErrorCode | null>(null);
  const [storageError, setStorageError] = useState(false);
  const store = useMemo(() => createAccountIntentStore(asyncStorage), []);
  const applications = useMemo(() => {
    if (mode !== 'configured') return null;
    try { return createApplicationsRepository(getFirebaseDatabase()); }
    catch { return null; }
  }, []);

  const refresh = useCallback(async (uid: string, generation: number) => {
    if (!guard.current.isCurrent(uid, generation)) return null;
    if (!applications) { setHistoryError(true); return null; }
    const requestId = guard.current.beginRequest(uid, generation);
    if (requestId === null) return null;
    setLoadingHistory(true);
    setHistoryError(false);
    setHistoryReady(false);
    const [entriesResult, draftResult, intentResult] = await Promise.allSettled([
      applications.list(uid), store.loadDraft(uid), store.load(uid),
    ]);
    if (!guard.current.isCurrentRequest(uid, generation, requestId)) return null;
    setLoadingHistory(false);
    setStorageError(false);
    if (entriesResult.status === 'fulfilled') { setEntries(entriesResult.value); setHistoryReady(true); }
    else { setEntries([]); setHistoryError(true); }
    if (draftResult.status === 'fulfilled') setDraft(draftResult.value);
    else { setDraft(null); setStorageError(true); }
    if (intentResult.status === 'fulfilled') setPendingIntent(intentResult.value);
    else { setPendingIntent(null); setStorageError(true); }
    return entriesResult.status === 'fulfilled' ? entriesResult.value : null;
  }, [applications, store]);

  useEffect(() => {
    if (mode !== 'configured') return;
    let unsubscribe: (() => void) | undefined;
    let active = true;
    void import('./auth').then((auth) => {
      if (!active) return;
      try {
        unsubscribe = auth.observeUser((nextUser) => {
          if (!active) return;
          const nextUid = nextUser?.uid ?? null;
          const changed = guard.current.currentUid() !== nextUid;
          const generation = guard.current.begin(nextUid);
          userRef.current = nextUser;
          setUser(nextUser);
          setAuthLoading(false);
          setAuthError(null);
          if (changed) {
            setEntries([]); setDraft(null); setPendingIntent(null); setHistoryError(false); setHistoryReady(false); setStorageError(false); setLoadingHistory(false);
          }
          if (nextUser && changed) void refresh(nextUser.uid, generation);
        }, (error) => { if (active) { setAuthError(mapAuthError(error)); setAuthLoading(false); } });
      } catch (error) { setAuthError(mapAuthError(error)); setAuthLoading(false); }
    }).catch((error) => { if (active) { setAuthError(mapAuthError(error)); setAuthLoading(false); } });
    return () => { active = false; unsubscribe?.(); };
  }, [refresh]);

  const reportAuthError = useCallback((error: unknown) => setAuthError(mapAuthError(error)), []);
  const clearAuthError = useCallback(() => setAuthError(null), []);
  const replaceEntries = useCallback((next: Entry[]) => setEntries(next), []);
  const isCurrent = useCallback((uid: string, generation: number) => guard.current.isCurrent(uid, generation), []);
  const generationFor = useCallback((uid: string) => guard.current.currentUid() === uid ? guard.current.currentGeneration() : null, []);
  const clearSession = useCallback(() => {
    guard.current.invalidate();
    userRef.current = null;
    setUser(null); setEntries([]); setDraft(null); setPendingIntent(null); setHistoryError(false); setStorageError(false); setLoadingHistory(false);
  }, []);

  return {
    mode, user, authLoading, loadingHistory, historyError, historyReady, storageError, entries, draft, pendingIntent,
    authError, store, applications, refresh, setDraft, setPendingIntent, replaceEntries, reportAuthError, clearAuthError,
    isCurrent, generationFor, clearSession,
  };
}

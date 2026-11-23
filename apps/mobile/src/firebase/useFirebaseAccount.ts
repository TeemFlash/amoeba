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
import { createVolunteerRepository, watchAccountRole, type AccountRole } from './volunteers';

export type FirebaseMode = 'local' | 'invalid' | 'configured';
const mode: FirebaseMode = firebaseConfig.mode === 'local' ? 'local' : firebaseConfig.mode === 'invalid' ? 'invalid' : 'configured';

export function useFirebaseAccount(archiveOnly = false) {
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
  const [role, setRole] = useState<AccountRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(mode === 'configured');
  const [roleError, setRoleError] = useState(false);
  const roleSequence = useRef(0);
  const roleRefreshRef = useRef<((uid: string) => Promise<void>) | null>(null);
  const roleValueRef = useRef<AccountRole | null>(null);
  const store = useMemo(() => createAccountIntentStore(asyncStorage), []);
  const applications = useMemo(() => {
    if (mode !== 'configured') return null;
    try { return createApplicationsRepository(getFirebaseDatabase()); }
    catch { return null; }
  }, []);
  const volunteers = useMemo(() => {
    if (mode !== 'configured') return null;
    try { return createVolunteerRepository(getFirebaseDatabase()); }
    catch { return null; }
  }, []);

  const refresh = useCallback(async (uid: string, generation: number) => {
    if (!guard.current.isCurrent(uid, generation)) return null;
    if (roleValueRef.current !== 'resident') return null;
    if (!applications) { setHistoryError(true); return null; }
    const requestId = guard.current.beginRequest(uid, generation);
    if (requestId === null) return null;
    setLoadingHistory(true);
    setHistoryError(false);
    setHistoryReady(false);
    const [entriesResult, draftResult, intentResult] = await Promise.allSettled([
      applications.list(uid), archiveOnly ? Promise.resolve(null) : store.loadDraft(uid), archiveOnly ? Promise.resolve(null) : store.load(uid),
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
  }, [applications, archiveOnly, store]);

  useEffect(() => {
    if (mode !== 'configured') return;
    let unsubscribe: (() => void) | undefined;
    let stopRoleWatch: (() => void) | undefined;
    let roleTimer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const startRoleWatch = (uid: string, initialGeneration: number) => {
      let watchGeneration = initialGeneration;
      const sequence = ++roleSequence.current;
      stopRoleWatch?.();
      stopRoleWatch = undefined;
      clearTimeout(roleTimer);
      roleValueRef.current = null;
      setRole(null); setRoleLoading(true); setRoleError(false);
      setEntries([]); setDraft(null); setPendingIntent(null); setHistoryError(false); setHistoryReady(false); setStorageError(false); setLoadingHistory(false);
      const current = () => active && guard.current.isCurrent(uid, watchGeneration) && sequence === roleSequence.current;
      const applyRole = (nextRole: AccountRole) => {
        if (!current()) return;
        clearTimeout(roleTimer);
        const previous = roleValueRef.current;
        if (previous && previous !== nextRole) {
          const nextGeneration = guard.current.advance(uid);
          roleValueRef.current = null;
          setRole(null); setRoleLoading(true); setRoleError(false);
          setEntries([]); setDraft(null); setPendingIntent(null); setHistoryError(false); setHistoryReady(false); setStorageError(false); setLoadingHistory(false);
          if (nextGeneration !== null) startRoleWatch(uid, nextGeneration);
          return;
        }
        roleValueRef.current = nextRole;
        setRole(nextRole); setRoleLoading(false); setRoleError(false);
        if (nextRole === 'volunteer') {
          setEntries([]); setDraft(null); setPendingIntent(null); setHistoryError(false); setHistoryReady(false); setStorageError(false); setLoadingHistory(false);
        } else if (previous !== 'resident' && !archiveOnly) void refresh(uid, watchGeneration);
      };
      const failRole = () => {
        if (!current()) return;
        clearTimeout(roleTimer);
        if (roleValueRef.current !== null) {
          const nextGeneration = guard.current.advance(uid);
          if (nextGeneration !== null) watchGeneration = nextGeneration;
        } else guard.current.beginRequest(uid, watchGeneration);
        roleValueRef.current = null;
        setRole(null); setRoleLoading(false); setRoleError(true);
        setEntries([]); setDraft(null); setPendingIntent(null); setHistoryError(false); setHistoryReady(false); setStorageError(false); setLoadingHistory(false);
      };
      roleTimer = setTimeout(() => {
        if (current() && roleValueRef.current === null) { setRoleLoading(false); setRoleError(true); }
      }, 10_000);
      try { stopRoleWatch = watchAccountRole(getFirebaseDatabase(), uid, applyRole, failRole); }
      catch { failRole(); }
    };
    roleRefreshRef.current = async (uid) => {
      if (guard.current.currentUid() !== uid) return;
      startRoleWatch(uid, guard.current.currentGeneration());
    };
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
            stopRoleWatch?.();
            stopRoleWatch = undefined;
            clearTimeout(roleTimer);
            setEntries([]); setDraft(null); setPendingIntent(null); setHistoryError(false); setHistoryReady(false); setStorageError(false); setLoadingHistory(false);
            roleSequence.current += 1;
            roleValueRef.current = null;
            setRole(null); setRoleLoading(Boolean(nextUser)); setRoleError(false);
          }
          if (!nextUser) { roleValueRef.current = null; setRole(null); setRoleLoading(false); setRoleError(false); }
          if (nextUser && changed) {
            if (!volunteers) { setRoleLoading(false); setRoleError(true); return; }
            startRoleWatch(nextUser.uid, generation);
          }
        }, (error) => { if (active) { roleSequence.current += 1; roleValueRef.current = null; setRole(null); setRoleLoading(false); setRoleError(true); setEntries([]); setDraft(null); setPendingIntent(null); setAuthError(mapAuthError(error)); setAuthLoading(false); } });
      } catch (error) { setAuthError(mapAuthError(error)); setAuthLoading(false); }
    }).catch((error) => { if (active) { setAuthError(mapAuthError(error)); setAuthLoading(false); } });
    return () => { active = false; unsubscribe?.(); stopRoleWatch?.(); clearTimeout(roleTimer); roleSequence.current += 1; roleRefreshRef.current = null; };
  }, [archiveOnly, refresh, volunteers]);

  const reportAuthError = useCallback((error: unknown) => setAuthError(mapAuthError(error)), []);
  const clearAuthError = useCallback(() => setAuthError(null), []);
  const replaceEntries = useCallback((next: Entry[]) => setEntries(next), []);
  const isCurrent = useCallback((uid: string, generation: number) => guard.current.isCurrent(uid, generation), []);
  const generationFor = useCallback((uid: string) => guard.current.currentUid() === uid ? guard.current.currentGeneration() : null, []);
  const clearSession = useCallback(() => {
    guard.current.invalidate();
    userRef.current = null;
    roleSequence.current += 1;
    roleValueRef.current = null;
    setUser(null); setEntries([]); setDraft(null); setPendingIntent(null); setHistoryError(false); setStorageError(false); setLoadingHistory(false);
    setRole(null); setRoleLoading(false); setRoleError(false);
  }, []);
  const refreshRole = useCallback(async (uid: string) => {
    const nextGeneration = guard.current.advance(uid);
    if (nextGeneration !== null) await roleRefreshRef.current?.(uid);
  }, []);

  return {
    mode, user, authLoading, loadingHistory, historyError, historyReady, storageError, entries, draft, pendingIntent,
    role, roleLoading, roleError, refreshRole, volunteers,
    authError, store, applications, refresh, setDraft, setPendingIntent, replaceEntries, reportAuthError, clearAuthError,
    isCurrent, generationFor, clearSession,
  };
}

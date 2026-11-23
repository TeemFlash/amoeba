import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '../domain/types';
import type { createOperationsRepository } from '../firebase/operations';
import { t } from '../i18n';
import { Button, ErrorNotice, StatusTag } from '../ui/components';
import { operationalText as copy, type OperationalCopyKey } from './operationalCopy';

export type Operations = ReturnType<typeof createOperationsRepository>;
export type Confirmation = { action: OperationalCopyKey; body: OperationalCopyKey; summary: (locale: Locale) => string; run: () => Promise<void>; danger?: boolean };
export type Mutate = (run: () => Promise<void | OperationalCopyKey>, notice?: OperationalCopyKey) => Promise<boolean>;

export function useOperationalResource<T>(load: (() => Promise<T>) | null) {
  const [snapshot, setSnapshot] = useState<{ load: typeof load; data: T | null; error: boolean; loading: boolean } | null>(null);
  const trigger = useRef<() => void>(() => {});
  const refresh = useCallback(() => trigger.current(), []);
  useEffect(() => {
    if (!load) { trigger.current = () => {}; return; }
    let active = true;
    let sequence = 0;
    let pending = 0;
    const read = async (foreground: boolean) => {
      if (!active || (!foreground && pending > 0)) return;
      const request = ++sequence;
      pending += 1;
      if (foreground) setSnapshot((previous) => ({ load, data: previous?.load === load ? previous.data : null, error: false, loading: true }));
      try {
        const value = await load();
        if (active && request === sequence) setSnapshot({ load, data: value, error: false, loading: false });
      } catch {
        if (active && request === sequence) setSnapshot({ load, data: null, error: true, loading: false });
      } finally {
        pending -= 1;
      }
    };
    trigger.current = () => { void read(true); };
    void read(false);
    const timer = setInterval(() => void read(false), 20_000);
    return () => { active = false; clearInterval(timer); };
  }, [load]);
  const current = load && snapshot?.load === load ? snapshot : null;
  return { data: current?.data ?? null, error: current?.error ?? false, loading: current?.loading ?? Boolean(load), refresh };
}

export function ResourceState({ locale, loading, error, refresh }: { locale: Locale; loading: boolean; error: boolean; refresh: () => void }) {
  if (error) return <><ErrorNotice>{copy(locale, 'error')}</ErrorNotice><Button label={t(locale, 'retry')} kind="secondary" onPress={refresh} /></>;
  if (loading) return <StatusTag label={copy(locale, 'loading')} />;
  return null;
}


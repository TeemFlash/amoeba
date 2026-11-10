import { initialState, transition } from '../domain/transitions';
import { parseState } from '../domain/validation';
import type { AppState, Command, Repository, Result, StorageAdapter, Transition } from '../domain/types';

export const STORAGE_KEY = 'enactus-senior-demo:v1';

function snapshot(state: AppState): AppState {
  return { ...state, draft: state.draft ? { ...state.draft } : null, entries: state.entries.map((entry) => ({ ...entry })) };
}

export function createRepository(storage: StorageAdapter, now: () => string): Repository {
  let acceptedState: AppState | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work, work);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
  const writeState = async (state: AppState): Promise<void> => {
    await storage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  return {
    load: () => serialize(async () => {
      acceptedState = null;
      let raw: string | null;
      try { raw = await storage.getItem(STORAGE_KEY); }
      catch { return { ok: false, error: { code: 'STORAGE_READ_FAILED' } }; }
      if (raw === null) {
        const fresh = initialState();
        try { await writeState(fresh); }
        catch { return { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } }; }
        acceptedState = snapshot(fresh);
        return { ok: true, value: snapshot(acceptedState) };
      }
      const result = parseState(raw);
      if (!result.ok) return result;
      acceptedState = snapshot(result.value);
      return { ok: true, value: snapshot(acceptedState) };
    }),
    execute: (command: Command): Promise<Result<Transition>> => serialize(async () => {
      if (!acceptedState) return { ok: false, error: { code: 'STORAGE_READ_FAILED' } };
      const result = transition(acceptedState, command, now());
      if (!result.ok) return result;
      try { await writeState(result.value.state); }
      catch { return { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } }; }
      acceptedState = snapshot(result.value.state);
      return { ok: true, value: { ...result.value, state: snapshot(acceptedState) } };
    }),
    reset: () => serialize(async () => {
      try { await storage.removeItem(STORAGE_KEY); }
      catch { return { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } }; }
      acceptedState = initialState();
      return { ok: true, value: snapshot(acceptedState) };
    }),
  };
}

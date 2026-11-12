import type { StorageAdapter } from '../domain/types';

export const PREFERENCES_KEY = 'mobi-preferences:v1';

export type Preferences = {
  version: 1;
  welcomeCompleted: boolean;
  textSize: 'standard' | 'large';
};

export type StoreErrorCode = 'STORAGE_READ_FAILED' | 'STORAGE_WRITE_FAILED' | 'STORAGE_CORRUPT';

export class StoreError extends Error {
  readonly code: StoreErrorCode;
  constructor(code: StoreErrorCode) {
    super(code);
    this.name = 'StoreError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function parsePreferences(raw: string): Preferences {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new StoreError('STORAGE_CORRUPT'); }
  if (!isRecord(value)
    || Object.keys(value).length !== 3
    || value.version !== 1
    || typeof value.welcomeCompleted !== 'boolean'
    || (value.textSize !== 'standard' && value.textSize !== 'large')) {
    throw new StoreError('STORAGE_CORRUPT');
  }
  return { version: 1, welcomeCompleted: value.welcomeCompleted, textSize: value.textSize };
}

export function createPreferencesStore(storage: StorageAdapter) {
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work, work);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
  const read = async (): Promise<Preferences | null> => {
    let raw: string | null;
    try { raw = await storage.getItem(PREFERENCES_KEY); }
    catch { throw new StoreError('STORAGE_READ_FAILED'); }
    return raw === null ? null : parsePreferences(raw);
  };

  return {
    load: () => serialize(read),
    save: (next: Preferences): Promise<void> => {
      const snapshot: Preferences = { ...next };
      return serialize(async () => {
        // Validate before touching storage, then refuse to replace an unreadable record.
        if (Object.keys(snapshot).length !== 3 || snapshot.version !== 1 || typeof snapshot.welcomeCompleted !== 'boolean'
          || (snapshot.textSize !== 'standard' && snapshot.textSize !== 'large')) {
          throw new StoreError('STORAGE_CORRUPT');
        }
        await read();
        try { await storage.setItem(PREFERENCES_KEY, JSON.stringify(snapshot)); }
        catch { throw new StoreError('STORAGE_WRITE_FAILED'); }
      });
    },
  };
}

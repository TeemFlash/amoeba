import { cityIds, type CityId } from '../domain/cities';
import type { StorageAdapter } from '../domain/types';

export const CITY_PREFERENCE_KEY = 'amoeba:ui:v1:city';
export type CityPreferenceError = 'read' | 'write' | 'corrupt';

export async function loadCityPreference(storage: StorageAdapter): Promise<{ cityId: CityId | null; error: CityPreferenceError | null }> {
  try {
    const stored = await storage.getItem(CITY_PREFERENCE_KEY);
    if (stored === null) return { cityId: null, error: null };
    return cityIds.has(stored) ? { cityId: stored as CityId, error: null } : { cityId: null, error: 'corrupt' };
  } catch {
    return { cityId: null, error: 'read' };
  }
}

export async function saveCityPreference(storage: StorageAdapter, cityId: string): Promise<CityPreferenceError | null> {
  if (!cityIds.has(cityId)) return 'corrupt';
  try {
    const existing = await storage.getItem(CITY_PREFERENCE_KEY);
    if (existing !== null && !cityIds.has(existing)) return 'corrupt';
  } catch {
    return 'read';
  }
  try {
    await storage.setItem(CITY_PREFERENCE_KEY, cityId);
    return null;
  } catch {
    return 'write';
  }
}

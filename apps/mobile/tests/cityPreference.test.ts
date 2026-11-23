import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCities } from '../src/domain/cities';
import { CITY_PREFERENCE_KEY, loadCityPreference, saveCityPreference } from '../src/storage/cityPreference';
import type { StorageAdapter } from '../src/domain/types';

class MemoryStorage implements StorageAdapter {
  value: string | null = null;
  failRead = false;
  failWrite = false;
  async getItem(key: string) { assert.equal(key, CITY_PREFERENCE_KEY); if (this.failRead) throw Error('read'); return this.value; }
  async setItem(key: string, value: string) { assert.equal(key, CITY_PREFERENCE_KEY); if (this.failWrite) throw Error('write'); this.value = value; }
  async removeItem() { this.value = null; }
}

test('city search matches either localized name', () => {
  assert.equal(filterCities('Қарағанды', 'kz')[0]?.id, 'karaganda');
  assert.equal(filterCities('усть-камен', 'ru')[0]?.id, 'ust-kamenogorsk');
});

test('city choice persists and restores after reload', async () => {
  const storage = new MemoryStorage();
  assert.deepEqual(await loadCityPreference(storage), { cityId: null, error: null });
  assert.equal(await saveCityPreference(storage, 'almaty'), null);
  assert.deepEqual(await loadCityPreference(storage), { cityId: 'almaty', error: null });
});

test('read, corrupt data, and rejected writes never apply an unpersisted city', async () => {
  const storage = new MemoryStorage();
  storage.failRead = true;
  assert.deepEqual(await loadCityPreference(storage), { cityId: null, error: 'read' });
  assert.equal(await saveCityPreference(storage, 'almaty'), 'read');
  storage.failRead = false;
  storage.value = 'not-a-city';
  assert.deepEqual(await loadCityPreference(storage), { cityId: null, error: 'corrupt' });
  assert.equal(await saveCityPreference(storage, 'astana'), 'corrupt');
  assert.equal(storage.value, 'not-a-city');
  storage.value = null;
  storage.failWrite = true;
  assert.equal(await saveCityPreference(storage, 'almaty'), 'write');
  assert.equal(storage.value, null);
});

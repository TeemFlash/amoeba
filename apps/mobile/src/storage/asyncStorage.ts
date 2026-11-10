import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageAdapter } from '../domain/types';

export const asyncStorage: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

import { SkuMasterItem } from '../types';
import { LedgerEvent, LedgerFileMeta } from '../types/ledger';

/**
 * IndexedDB persistence.
 *
 * Only two things are stored: the normalized ledger events (plus the list of
 * source files) and the seller's SKU cost master. Everything else is derived.
 */

const DB_NAME = 'SellWiseDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

const KEYS = {
  SKU_MASTER: 'sku_master',
  LEDGER_EVENTS: 'ledger_events',
  LEDGER_FILES: 'ledger_files',
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function getStoredValue<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve((request.result as T) ?? null);
        db.close();
      };

      request.onerror = () => {
        reject(request.error);
        db.close();
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error reading key "${key}":`, err);
    return null;
  }
}

async function setStoredValue<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => {
        resolve();
        db.close();
      };

      request.onerror = () => {
        reject(request.error);
        db.close();
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error saving key "${key}":`, err);
  }
}

async function removeStoredValue(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
        db.close();
      };

      request.onerror = () => {
        reject(request.error);
        db.close();
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error removing key "${key}":`, err);
  }
}

export async function saveSkuMaster(skuMasterList: SkuMasterItem[]): Promise<void> {
  await setStoredValue(KEYS.SKU_MASTER, skuMasterList);
}

export async function loadSkuMaster(): Promise<SkuMasterItem[] | null> {
  return getStoredValue<SkuMasterItem[]>(KEYS.SKU_MASTER);
}

export async function saveLedgerEvents(events: LedgerEvent[]): Promise<void> {
  await setStoredValue(KEYS.LEDGER_EVENTS, events);
}

export async function saveLedgerFiles(files: LedgerFileMeta[]): Promise<void> {
  await setStoredValue(KEYS.LEDGER_FILES, files);
}

export async function clearLedgerState(): Promise<void> {
  await Promise.all([
    removeStoredValue(KEYS.LEDGER_EVENTS),
    removeStoredValue(KEYS.LEDGER_FILES),
  ]);
}

export async function loadLedgerState(): Promise<{
  events: LedgerEvent[] | null;
  files: LedgerFileMeta[] | null;
}> {
  const [events, files] = await Promise.all([
    getStoredValue<LedgerEvent[]>(KEYS.LEDGER_EVENTS),
    getStoredValue<LedgerFileMeta[]>(KEYS.LEDGER_FILES),
  ]);
  return { events, files };
}

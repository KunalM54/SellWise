import { ImportedOrderFile, OrderItem, ClaimItem, SkuMasterItem } from '../types';

const DB_NAME = 'SellWiseDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

const KEYS = {
  ORDER_FILE: 'order_file',
  ORDERS: 'orders',
  CLAIMS: 'claims',
  SKU_MASTER: 'sku_master',
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
      };

      request.onerror = () => {
        reject(request.error);
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
      };

      request.onerror = () => {
        reject(request.error);
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
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error removing key "${key}":`, err);
  }
}

/**
 * Save both the imported order file and the mapped orders into IndexedDB
 */
export async function saveOrderData(orderFile: ImportedOrderFile, orders: OrderItem[]): Promise<void> {
  await Promise.all([
    setStoredValue(KEYS.ORDER_FILE, orderFile),
    setStoredValue(KEYS.ORDERS, orders),
  ]);
}

/**
 * Save updated orders list
 */
export async function saveOrders(orders: OrderItem[]): Promise<void> {
  await setStoredValue(KEYS.ORDERS, orders);
}

/**
 * Save updated SKU master items
 */
export async function saveSkuMaster(skuMasterList: SkuMasterItem[]): Promise<void> {
  await setStoredValue(KEYS.SKU_MASTER, skuMasterList);
}

/**
 * Save updated claims items
 */
export async function saveClaims(claims: ClaimItem[]): Promise<void> {
  await setStoredValue(KEYS.CLAIMS, claims);
}

/**
 * Clear the imported order file and orders from IndexedDB
 */
export async function clearOrderData(): Promise<void> {
  await Promise.all([
    removeStoredValue(KEYS.ORDER_FILE),
    removeStoredValue(KEYS.ORDERS),
  ]);
}

/**
 * Load all saved app state from IndexedDB
 */
export async function loadSavedAppData(): Promise<{
  orderFile: ImportedOrderFile | null;
  orders: OrderItem[] | null;
  claims: ClaimItem[] | null;
  skuMasterList: SkuMasterItem[] | null;
}> {
  const [orderFile, orders, claims, skuMasterList] = await Promise.all([
    getStoredValue<ImportedOrderFile>(KEYS.ORDER_FILE),
    getStoredValue<OrderItem[]>(KEYS.ORDERS),
    getStoredValue<ClaimItem[]>(KEYS.CLAIMS),
    getStoredValue<SkuMasterItem[]>(KEYS.SKU_MASTER),
  ]);

  return {
    orderFile,
    orders,
    claims,
    skuMasterList,
  };
}

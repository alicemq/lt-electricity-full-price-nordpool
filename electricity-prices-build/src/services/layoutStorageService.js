const DB_NAME = 'nordpool-layouts';
const STORE_NAME = 'layouts';
const DB_VERSION = 1;

/**
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb-open-failed'));
  });
}

/**
 * @returns {Promise<string[]>}
 */
export async function listLayoutNames() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      const names = /** @type {string[]} */ (request.result).sort((a, b) => a.localeCompare(b));
      resolve(names);
    };
    request.onerror = () => reject(request.error ?? new Error('indexeddb-list-failed'));
    tx.oncomplete = () => db.close();
  });
}

/**
 * @param {string} name
 * @param {import('../lib/layoutCodec.js').LayoutConfigV1} config
 */
export async function saveNamedLayout(name, config) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('layout-name-required');
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({
      name: trimmed,
      config,
      updatedAt: new Date().toISOString(),
    });
    request.onsuccess = () => resolve(trimmed);
    request.onerror = () => reject(request.error ?? new Error('indexeddb-save-failed'));
    tx.oncomplete = () => db.close();
  });
}

/**
 * @param {string} name
 * @returns {Promise<import('../lib/layoutCodec.js').LayoutConfigV1|null>}
 */
export async function loadNamedLayout(name) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(name);
    request.onsuccess = () => {
      const row = request.result;
      resolve(row?.config ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error('indexeddb-load-failed'));
    tx.oncomplete = () => db.close();
  });
}

/**
 * @param {string} name
 */
export async function deleteNamedLayout(name) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(name);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error ?? new Error('indexeddb-delete-failed'));
    tx.oncomplete = () => db.close();
  });
}

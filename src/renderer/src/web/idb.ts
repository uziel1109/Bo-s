// Envoltorio mínimo de IndexedDB para la versión web (iPad).
const DB_NAME = 'bodyos';
const VERSION = 1;

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(store: 'kv' | 'photos', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const r = fn(t.objectStore(store));
        t.oncomplete = () => resolve(r ? r.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error('Transacción cancelada (¿almacenamiento lleno?)'));
      }),
  );
}

export const idbGet = <T,>(store: 'kv' | 'photos', key: string) => tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>);
export const idbPut = (store: 'kv' | 'photos', key: string, value: unknown) => tx(store, 'readwrite', (s) => void s.put(value, key));
export const idbDel = (store: 'kv' | 'photos', key: string) => tx(store, 'readwrite', (s) => void s.delete(key));
export const idbClear = (store: 'kv' | 'photos') => tx(store, 'readwrite', (s) => void s.clear());
export const idbKeys = (store: 'kv' | 'photos') => tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()).then((k) => (k ?? []).map(String));

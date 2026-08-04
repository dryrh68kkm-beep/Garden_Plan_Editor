// Local backup cache — IndexedDB instead of localStorage.
//
// localStorage's per-origin quota is small (often as low as 5MB on mobile
// Safari) and fills up fast once styles/plants/portfolio photos accumulate
// as base64 strings — once full, every localStorage.setItem() just throws,
// with no way to ask the browser for more room. IndexedDB's quota is tied
// to actual free disk space (typically hundreds of MB to GB), so moving the
// local backup here gives it a lot more room before hitting the same wall.
//
// Shared between app.js (admin, read+write) and showcase.js (read + one
// cache write) so both use the exact same storage. Exposes a tiny
// Promise-based key/value API mirroring how localStorage.getItem/setItem
// were used before, just async.
const LS = (() => {
  const DB_NAME = "garden_plan_editor_db";
  const STORE = "kv";
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("IndexedDB not available")); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function get(key, fallback) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result === undefined ? fallback : req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error(`Local cache read failed for ${key}, using fallback:`, err);
      return fallback;
    }
  }

  async function set(key, value) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (err) {
      console.error(`Local cache write failed for ${key}:`, err);
      return false;
    }
  }

  async function remove(key) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error(`Local cache delete failed for ${key}:`, err);
    }
  }

  // One-time migration: pull over anything already cached under the old
  // localStorage keys (from before this switch) so existing admins/visitors
  // don't lose their local backup on the next load, then clear those old
  // keys so localStorage stops accumulating alongside IndexedDB.
  async function migrateFromLocalStorage(keys) {
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        const existing = await get(key, undefined);
        if (existing === undefined) await set(key, JSON.parse(raw));
        localStorage.removeItem(key);
      } catch (err) {
        console.error(`Could not migrate old localStorage key ${key}:`, err);
      }
    }
  }

  return { get, set, remove, migrateFromLocalStorage };
})();

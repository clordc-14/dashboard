export const STORAGE_KEY = "sinopharm-new-drug-dashboard-v1";
const DB_NAME = "sinopharm-new-drug-dashboard";
const DB_VERSION = 1;
const STORE_NAME = "dashboard-state";
const RECORD_KEY = "latest";

export async function saveDashboardState(state) {
  if (hasIndexedDb()) {
    try {
      await saveToIndexedDb(state);
      removeLegacySessionState();
      return;
    } catch (error) {
      console.warn("IndexedDB 保存失败，尝试使用 sessionStorage。", error);
    }
  }

  try {
    const serialized = JSON.stringify(state);
    sessionStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    throw new Error("Excel 已解析，但浏览器本地缓存空间不足，无法保存完整数据。请精简 Excel 中无关 sheet、图片或大范围空白区域，或使用支持 IndexedDB 的现代浏览器后重新上传。");
  }
}

export async function loadDashboardState() {
  if (hasIndexedDb()) {
    try {
      const state = await loadFromIndexedDb();
      if (state) return state;
    } catch (error) {
      console.warn("IndexedDB 读取失败，尝试读取旧版 sessionStorage。", error);
    }
  }

  const serialized = sessionStorage.getItem(STORAGE_KEY);
  if (!serialized) return null;

  try {
    return JSON.parse(serialized);
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export async function clearDashboardState() {
  if (hasIndexedDb()) {
    try {
      await deleteFromIndexedDb();
    } catch (error) {
      console.warn("IndexedDB 清理失败。", error);
    }
  }
  removeLegacySessionState();
}

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地数据库。"));
    request.onblocked = () => reject(new Error("本地数据库正在被其他页面占用。"));
  });
}

async function runStoreTransaction(mode, action) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request = null;

    try {
      request = action(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      const result = request ? request.result : undefined;
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      const error = transaction.error || request?.error || new Error("本地数据库操作失败。");
      db.close();
      reject(error);
    };
    transaction.onabort = () => {
      const error = transaction.error || request?.error || new Error("本地数据库操作已中止。");
      db.close();
      reject(error);
    };
  });
}

function saveToIndexedDb(state) {
  return runStoreTransaction("readwrite", (store) => store.put(state, RECORD_KEY));
}

function loadFromIndexedDb() {
  return runStoreTransaction("readonly", (store) => store.get(RECORD_KEY));
}

function deleteFromIndexedDb() {
  return runStoreTransaction("readwrite", (store) => store.delete(RECORD_KEY));
}

function removeLegacySessionState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage access errors in restricted browser modes.
  }
}

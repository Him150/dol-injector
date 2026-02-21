import { useCallback, useState } from 'react';
import { addToast } from '@heroui/react';

const API_BASE = 'https://p.mise.run.place/https://s3-se.zdvsn3xs.workers.dev/text';
const PREFIX = 'dol/';
const TOKEN = 'Bearer bf283960-4826-49ac-b6ed-a8b72fbfd3c0';
const TARGET_DB_NAME = 'degrees-of-lewdity';

export type Item = {
  path: string;
  size: number;
  lastModified: number;
};
type ActionType = 'save' | 'load' | 'delete';

type IndexMeta = {
  name: string;
  keyPath: string | string[];
  unique: boolean;
};

type StoreDump = {
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IndexMeta[];
  records: unknown[];
};

type DbDump = {
  version: number;
  stores: Record<string, StoreDump>;
};

type IndexedDbDump = Record<string, DbDump>;

type BackupPayload = {
  localStorage: Record<string, string | null>;
  indexedDB: IndexedDbDump;
};

type ListApiResponse = {
  items?: Item[];
};

function getApiUrl(name?: string) {
  return name ? `${API_BASE}/${PREFIX}${name}` : `${API_BASE}/?list=1&prefix=${PREFIX}`;
}

export async function apiFetch(url: string, opt: RequestInit = {}) {
  return fetch(url, {
    ...opt,
    headers: {
      Authorization: TOKEN,
      ...(opt.headers || {}),
    },
  });
}

export async function loadList(): Promise<Item[]> {
  const res = await apiFetch(getApiUrl());
  const data = (await res.json()) as ListApiResponse;
  return data.items || [];
}

export async function loadFile(name: string, onProgress?: (percent: number) => void) {
  const res = await apiFetch(getApiUrl(name));
  const total = Number(res.headers.get('content-length') || 0);
  const reader = res.body?.getReader();

  if (!reader) {
    const text = await res.text();
    onProgress?.(100);
    await restoreBackup(text);
    return;
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loaded += value.length;
    if (total > 0) {
      onProgress?.(Math.min(99, Math.round((loaded / total) * 100)));
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const text = new TextDecoder().decode(merged);
  onProgress?.(100);
  await restoreBackup(text);
}

export async function saveFile(name: string, onProgress?: (percent: number) => void) {
  const content = await createBackup();
  const total = new TextEncoder().encode(content).length;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', getApiUrl(name), true);
    xhr.setRequestHeader('Authorization', TOKEN);

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || total <= 0) return;
      onProgress?.(Math.min(99, Math.round((event.loaded / total) * 100)));
    };
    xhr.onload = () => {
      onProgress?.(100);
      resolve();
    };
    xhr.onerror = () => reject(new Error('Failed to upload backup'));
    xhr.send(content);
  });
}

export async function deleteFile(name: string) {
  await apiFetch(getApiUrl(name), {
    method: 'DELETE',
  });
}

export async function exportIndexedDB(): Promise<IndexedDbDump> {
  if (!indexedDB.databases) return {};

  const dbList = await indexedDB.databases();
  const result: IndexedDbDump = {};

  for (const dbInfo of dbList) {
    const name = dbInfo.name;
    if (!name || name !== TARGET_DB_NAME) continue;

    result[name] = await new Promise<DbDump>(resolve => {
      const req = indexedDB.open(name);

      req.onerror = () => resolve({ version: 1, stores: {} });
      req.onsuccess = async () => {
        try {
          const db = req.result;
          const data: DbDump = { version: db.version, stores: {} };

          const tx = db.transaction(Array.from(db.objectStoreNames), 'readonly');

          await Promise.all(
            Array.from(db.objectStoreNames).map(
              storeName =>
                new Promise<void>(res => {
                  const store = tx.objectStore(storeName);
                  const getAllReq = store.getAll();

                  getAllReq.onerror = () => res();
                  getAllReq.onsuccess = () => {
                    data.stores[storeName] = {
                      keyPath: store.keyPath as string | string[] | null,
                      autoIncrement: store.autoIncrement,
                      indexes: Array.from(store.indexNames).reduce<IndexMeta[]>((acc, indexName) => {
                        const idx = store.index(indexName);
                        if (idx.keyPath == null) return acc;
                        acc.push({
                          name: indexName,
                          keyPath: idx.keyPath as string | string[],
                          unique: idx.unique,
                        });
                        return acc;
                      }, []),
                      records: getAllReq.result as unknown[],
                    };
                    res();
                  };
                }),
            ),
          );

          db.close();
          resolve(data);
        } catch {
          resolve({ version: 1, stores: {} });
        }
      };
    });
  }

  return result;
}

export async function importIndexedDB(data: IndexedDbDump) {
  if (!indexedDB.databases) return;

  const dbList = await indexedDB.databases();
  await Promise.all(
    dbList
      .filter(db => !!db.name || db.name !== TARGET_DB_NAME)
      .map(
        db =>
          new Promise<void>(resolve => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          }),
      ),
  );

  for (const [name, dbData] of Object.entries(data)) {
    await new Promise<void>(resolve => {
      const req = indexedDB.open(name, dbData.version);

      req.onerror = () => resolve();
      req.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const [storeName, storeData] of Object.entries(dbData.stores)) {
          const store = db.createObjectStore(storeName, {
            keyPath: storeData.keyPath,
            autoIncrement: storeData.autoIncrement,
          });
          storeData.indexes.forEach(idx => {
            if (idx.keyPath == null) return;
            store.createIndex(idx.name, idx.keyPath, { unique: idx.unique });
          });
        }
      };

      req.onsuccess = () => {
        const db = req.result;
        const storeNames = Object.keys(dbData.stores);
        if (storeNames.length === 0) {
          db.close();
          resolve();
          return;
        }

        const tx = db.transaction(storeNames, 'readwrite');

        for (const [storeName, storeData] of Object.entries(dbData.stores)) {
          const store = tx.objectStore(storeName);
          storeData.records.forEach(record => {
            store.add(record);
          });
        }

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
    });
  }
}

export async function createBackup() {
  const backup: BackupPayload = {
    localStorage: {},
    indexedDB: await exportIndexedDB(),
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    backup.localStorage[key] = localStorage.getItem(key);
  }

  return JSON.stringify(backup);
}

export async function restoreBackup(text: string) {
  const backup = JSON.parse(text) as Partial<BackupPayload>;

  localStorage.clear();
  Object.entries(backup.localStorage || {}).forEach(([k, v]) => localStorage.setItem(k, v ?? ''));

  if (backup.indexedDB) {
    await importIndexedDB(backup.indexedDB);
  }

  location.reload();
}

export function trimPrefix(path: string) {
  return path.replace(PREFIX, '');
}

export function useFeatures() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [del, setDel] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionType | null>(null);
  const [actionProgress, setActionProgress] = useState<{
    action: 'save' | 'load';
    fileName: string;
    value: number;
  } | null>(null);

  const showErrorToast = useCallback((action: string, error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error || 'Unknown error');
    addToast({
      title: `${action}失败`,
      description: detail,
      color: 'danger',
    });
  }, []);

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      setItems(await loadList());
    } catch (error) {
      showErrorToast('刷新', error);
    } finally {
      setListLoading(false);
    }
  }, [showErrorToast]);

  const openModal = useCallback(async () => {
    setOpen(true);
    await refresh();
  }, [refresh]);

  const saveByName = useCallback(
    async (fileName: string) => {
      if (!fileName.trim()) return;
      const target = fileName.trim();
      setActionLoading('save');
      setActionProgress({ action: 'save', fileName: target, value: 0 });
      try {
        await saveFile(target, value => setActionProgress({ action: 'save', fileName: target, value }));
        await refresh();
      } catch (error) {
        showErrorToast('保存', error);
      } finally {
        setActionProgress(null);
        setActionLoading(null);
      }
    },
    [refresh, showErrorToast],
  );

  const loadByName = useCallback(
    async (fileName: string) => {
      if (!fileName.trim()) return;
      const target = fileName.trim();
      setActionLoading('load');
      setActionProgress({ action: 'load', fileName: target, value: 0 });
      try {
        await loadFile(target, value => setActionProgress({ action: 'load', fileName: target, value }));
      } catch (error) {
        showErrorToast('加载', error);
      } finally {
        setActionProgress(null);
        setActionLoading(null);
      }
    },
    [showErrorToast],
  );

  const deleteByName = useCallback(
    async (fileName: string) => {
      setActionLoading('delete');
      try {
        await deleteFile(fileName);
        setDel(null);
        await refresh();
      } catch (error) {
        showErrorToast('删除', error);
      } finally {
        setActionLoading(null);
      }
    },
    [refresh, showErrorToast],
  );

  return {
    open,
    setOpen,
    items,
    name,
    setName,
    del,
    setDel,
    listLoading,
    actionLoading,
    actionProgress,
    openModal,
    refresh,
    saveByName,
    loadByName,
    deleteByName,
  };
}

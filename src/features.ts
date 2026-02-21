import { useCallback, useState } from 'react';

const API_BASE = 'https://p.mise.run.place/https://s3-se.zdvsn3xs.workers.dev/text';
const PREFIX = 'dol/';
const TOKEN = 'Bearer bf283960-4826-49ac-b6ed-a8b72fbfd3c0';
const TARGET_DB_NAME = 'degrees-of-lewdity';

export type Item = {
  path: string;
  size: number;
  lastModified: number;
};

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

export async function loadFile(name: string) {
  const res = await apiFetch(getApiUrl(name));
  const text = await res.text();
  await restoreBackup(text);
}

export async function saveFile(name: string) {
  const content = await createBackup();
  await apiFetch(getApiUrl(name), {
    method: 'PUT',
    body: content,
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
      .filter(db => !!db.name)
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
  const [actionLoading, setActionLoading] = useState<'save' | 'load' | 'delete' | null>(null);

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      setItems(await loadList());
    } finally {
      setListLoading(false);
    }
  }, []);

  const openModal = useCallback(async () => {
    setOpen(true);
    await refresh();
  }, [refresh]);

  const saveByName = useCallback(
    async (fileName: string) => {
      if (!fileName.trim()) return;
      setActionLoading('save');
      try {
        await saveFile(fileName.trim());
        await refresh();
      } finally {
        setActionLoading(null);
      }
    },
    [refresh],
  );

  const loadByName = useCallback(async (fileName: string) => {
    if (!fileName.trim()) return;
    setActionLoading('load');
    try {
      await loadFile(fileName.trim());
    } finally {
      setActionLoading(null);
    }
  }, []);

  const deleteByName = useCallback(
    async (fileName: string) => {
      setActionLoading('delete');
      try {
        await deleteFile(fileName);
        setDel(null);
        await refresh();
      } finally {
        setActionLoading(null);
      }
    },
    [refresh],
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
    openModal,
    refresh,
    saveByName,
    loadByName,
    deleteByName,
  };
}

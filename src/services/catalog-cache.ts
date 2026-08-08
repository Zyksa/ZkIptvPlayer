const DATABASE_NAME = 'zkplayer_catalog_cache'
const DATABASE_VERSION = 1
const STORE_NAME = 'catalogs'
const M3U_CACHE_KEY = 'm3u'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open catalog cache'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Catalog cache transaction aborted'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Catalog cache transaction failed'))
  })
}

export async function readM3uCatalogCache<T>(): Promise<T | null> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(M3U_CACHE_KEY)
    const value = await new Promise<T | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () => reject(request.error ?? new Error('Failed to read catalog cache'))
    })
    await transactionDone(transaction)
    return value ?? null
  } finally {
    database.close()
  }
}

export async function writeM3uCatalogCache<T>(value: T): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(value, M3U_CACHE_KEY)
    await transactionDone(transaction)
  } finally {
    database.close()
  }
}

export async function deleteM3uCatalogCache(): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(M3U_CACHE_KEY)
    await transactionDone(transaction)
  } finally {
    database.close()
  }
}

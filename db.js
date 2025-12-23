/* BTX Docs Saúde — IndexedDB (memória forte offline) */
(() => {
  const DB_NAME = "btx_docs_saude_db";
  const DB_VERSION = 1;

  const STORES = {
    settings:   "settings",
    patients:   "patients",
    appts:      "appointments",
    visits:     "visits",
    documents:  "documents"
  };

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (ev) => {
        const db = req.result;

        if(!db.objectStoreNames.contains(STORES.settings)){
          db.createObjectStore(STORES.settings);
        }

        if(!db.objectStoreNames.contains(STORES.patients)){
          const st = db.createObjectStore(STORES.patients, { keyPath: "id" });
          st.createIndex("by_name", "name", { unique:false });
        }

        if(!db.objectStoreNames.contains(STORES.appts)){
          const st = db.createObjectStore(STORES.appts, { keyPath: "id" });
          st.createIndex("by_date", "date", { unique:false });
          st.createIndex("by_patient", "patientId", { unique:false });
        }

        if(!db.objectStoreNames.contains(STORES.visits)){
          const st = db.createObjectStore(STORES.visits, { keyPath: "id" });
          st.createIndex("by_patient", "patientId", { unique:false });
          st.createIndex("by_date", "date", { unique:false });
        }

        if(!db.objectStoreNames.contains(STORES.documents)){
          const st = db.createObjectStore(STORES.documents, { keyPath: "id" });
          st.createIndex("by_patient", "patientId", { unique:false });
          st.createIndex("by_type", "type", { unique:false });
          st.createIndex("by_date", "date", { unique:false });
        }
      };

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async function tx(storeName, mode, fn){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);

      let result;
      Promise.resolve()
        .then(() => fn(store))
        .then((r) => { result = r; })
        .catch(reject);

      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  function getAll(store){
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function getByKey(store, key){
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  function put(store, value){
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function del(store, key){
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  function clear(store){
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  window.BTXDB = {
    STORES,
    async get(storeName, key){
      return tx(storeName, "readonly", (store) => getByKey(store, key));
    },
    async set(storeName, value){
      return tx(storeName, "readwrite", (store) => put(store, value));
    },
    async remove(storeName, key){
      return tx(storeName, "readwrite", (store) => del(store, key));
    },
    async all(storeName){
      return tx(storeName, "readonly", (store) => getAll(store));
    },
    async wipeAll(){
      await tx(STORES.settings, "readwrite", (s)=>clear(s));
      await tx(STORES.patients, "readwrite", (s)=>clear(s));
      await tx(STORES.appts, "readwrite", (s)=>clear(s));
      await tx(STORES.visits, "readwrite", (s)=>clear(s));
      await tx(STORES.documents, "readwrite", (s)=>clear(s));
      return true;
    }
  };
})();

/* BTX Docs Saúde — IndexedDB (memória forte) */
const BTX_DB = (() => {
  const DB_NAME = "btx_docs_saude_db";
  const DB_VER = 1;

  const STORES = {
    meta: "meta",
    profissional: "profissional",
    pacientes: "pacientes",
    agenda: "agenda",
    prontuario: "prontuario",
    drafts: "drafts"
  };

  function open(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);

      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains(STORES.meta)){
          db.createObjectStore(STORES.meta, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORES.profissional)){
          db.createObjectStore(STORES.profissional, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORES.pacientes)){
          const st = db.createObjectStore(STORES.pacientes, { keyPath: "id" });
          st.createIndex("by_nome", "nome", { unique:false });
          st.createIndex("by_tel", "tel", { unique:false });
        }
        if (!db.objectStoreNames.contains(STORES.agenda)){
          const st = db.createObjectStore(STORES.agenda, { keyPath: "id" });
          st.createIndex("by_data", "data", { unique:false });
          st.createIndex("by_pacienteId", "pacienteId", { unique:false });
        }
        if (!db.objectStoreNames.contains(STORES.prontuario)){
          const st = db.createObjectStore(STORES.prontuario, { keyPath: "id" });
          st.createIndex("by_pacienteId", "pacienteId", { unique:false });
          st.createIndex("by_data", "data", { unique:false });
        }
        if (!db.objectStoreNames.contains(STORES.drafts)){
          db.createObjectStore(STORES.drafts, { keyPath: "key" });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(db, store, mode="readonly"){
    return db.transaction(store, mode).objectStore(store);
  }

  async function get(store, key){
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = tx(db, store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(store, value){
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = tx(db, store, "readwrite").put(value);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function del(store, key){
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = tx(db, store, "readwrite").delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function clear(store){
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = tx(db, store, "readwrite").clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(store){
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = tx(db, store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function uid(prefix="id"){
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  return { STORES, get, put, del, clear, getAll, uid };
})();

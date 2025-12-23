/* BTX Docs Saúde — IndexedDB (memória forte, offline real) */
(() => {
  const DB_NAME = "btx_docs_saude_db";
  const DB_VER = 1;

  const STORES = {
    kv: "kv",                 // configs gerais (profissional etc.)
    agenda: "agenda",         // agendamentos
    patients: "patients",     // cadastro rápido de pacientes
    notes: "notes",           // prontuário/atendimentos por paciente
    drafts: "drafts"          // rascunhos por aba (ex.: receituário em edição)
  };

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = req.result;

        if (!db.objectStoreNames.contains(STORES.kv)){
          db.createObjectStore(STORES.kv, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORES.agenda)){
          const st = db.createObjectStore(STORES.agenda, { keyPath: "id" });
          st.createIndex("by_date", "date", { unique:false });
        }
        if (!db.objectStoreNames.contains(STORES.patients)){
          const st = db.createObjectStore(STORES.patients, { keyPath: "id" });
          st.createIndex("by_name", "nameLower", { unique:false });
          st.createIndex("by_phone", "phone", { unique:false });
        }
        if (!db.objectStoreNames.contains(STORES.notes)){
          const st = db.createObjectStore(STORES.notes, { keyPath: "id" });
          st.createIndex("by_patient", "patientId", { unique:false });
          st.createIndex("by_date", "dateISO", { unique:false });
        }
        if (!db.objectStoreNames.contains(STORES.drafts)){
          db.createObjectStore(STORES.drafts, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(storeName, mode, fn){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      const res = fn(store);
      t.oncomplete = () => resolve(res);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  const api = {
    STORES,

    async getKV(key){
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORES.kv, "readonly");
        const st = t.objectStore(STORES.kv);
        const req = st.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
    },

    async setKV(key, value){
      return tx(STORES.kv, "readwrite", (st) => st.put({ key, value }));
    },

    async delKV(key){
      return tx(STORES.kv, "readwrite", (st) => st.delete(key));
    },

    async put(store, obj){
      return tx(store, "readwrite", (st) => st.put(obj));
    },

    async del(store, id){
      return tx(store, "readwrite", (st) => st.delete(id));
    },

    async get(store, id){
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, "readonly");
        const st = t.objectStore(store);
        const req = st.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },

    async getAll(store){
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, "readonly");
        const st = t.objectStore(store);
        const req = st.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },

    async resetAll(){
      const db = await openDB();
      const stores = Object.values(STORES);
      return new Promise((resolve, reject) => {
        const t = db.transaction(stores, "readwrite");
        stores.forEach(name => t.objectStore(name).clear());
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    },

    async exportAll(){
      const out = {
        exportedAt: new Date().toISOString(),
        version: "btx-docs-saude-1.0",
        kv: await api.getAll(STORES.kv),
        agenda: await api.getAll(STORES.agenda),
        patients: await api.getAll(STORES.patients),
        notes: await api.getAll(STORES.notes),
        drafts: await api.getAll(STORES.drafts),
      };
      return out;
    },

    async importAll(data){
      if (!data || typeof data !== "object") throw new Error("Backup inválido.");
      const db = await openDB();
      const stores = Object.values(STORES);

      return new Promise((resolve, reject) => {
        const t = db.transaction(stores, "readwrite");
        try{
          // limpa e reimporta
          stores.forEach(name => t.objectStore(name).clear());

          (data.kv || []).forEach(x => t.objectStore(STORES.kv).put(x));
          (data.agenda || []).forEach(x => t.objectStore(STORES.agenda).put(x));
          (data.patients || []).forEach(x => t.objectStore(STORES.patients).put(x));
          (data.notes || []).forEach(x => t.objectStore(STORES.notes).put(x));
          (data.drafts || []).forEach(x => t.objectStore(STORES.drafts).put(x));

          t.oncomplete = () => resolve(true);
          t.onerror = () => reject(t.error);
        }catch(e){
          reject(e);
        }
      });
    }
  };

  window.BTXDB = api;
})();

/* BTX Docs Saúde — IndexedDB helper (memória forte) */
(function(){
  const DB_NAME = "btx_docs_saude_db";
  const DB_VER  = 1;

  const STORES = {
    settings: "settings",
    profissional: "profissional",
    pacientes: "pacientes",
    agenda: "agenda",
    atendimentos: "atendimentos",
    drafts: "drafts"
  };

  function openDB(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VER);

      req.onupgradeneeded = (e)=>{
        const db = req.result;

        if(!db.objectStoreNames.contains(STORES.settings)){
          db.createObjectStore(STORES.settings, { keyPath: "key" });
        }
        if(!db.objectStoreNames.contains(STORES.profissional)){
          db.createObjectStore(STORES.profissional, { keyPath: "id" });
        }
        if(!db.objectStoreNames.contains(STORES.pacientes)){
          const s = db.createObjectStore(STORES.pacientes, { keyPath: "id" });
          s.createIndex("by_nome", "nome", { unique:false });
          s.createIndex("by_tel", "tel", { unique:false });
        }
        if(!db.objectStoreNames.contains(STORES.agenda)){
          const s = db.createObjectStore(STORES.agenda, { keyPath: "id" });
          s.createIndex("by_data", "data", { unique:false });
          s.createIndex("by_pacienteId", "pacienteId", { unique:false });
        }
        if(!db.objectStoreNames.contains(STORES.atendimentos)){
          const s = db.createObjectStore(STORES.atendimentos, { keyPath: "id" });
          s.createIndex("by_pacienteId", "pacienteId", { unique:false });
          s.createIndex("by_data", "data", { unique:false });
        }
        if(!db.objectStoreNames.contains(STORES.drafts)){
          db.createObjectStore(STORES.drafts, { keyPath: "id" });
        }
      };

      req.onsuccess = ()=>resolve(req.result);
      req.onerror = ()=>reject(req.error);
    });
  }

  async function tx(store, mode="readonly"){
    const db = await openDB();
    return db.transaction(store, mode).objectStore(store);
  }

  function reqToPromise(req){
    return new Promise((resolve, reject)=>{
      req.onsuccess = ()=>resolve(req.result);
      req.onerror = ()=>reject(req.error);
    });
  }

  function id(){
    return (crypto?.randomUUID?.() || ("id_" + Date.now() + "_" + Math.random().toString(16).slice(2)));
  }

  const DB = {
    STORES,

    id,

    async setSetting(key, value){
      const s = await tx(STORES.settings, "readwrite");
      return reqToPromise(s.put({ key, value }));
    },
    async getSetting(key, def=null){
      const s = await tx(STORES.settings, "readonly");
      const r = await reqToPromise(s.get(key));
      return r ? r.value : def;
    },

    async saveProfissional(data){
      const s = await tx(STORES.profissional, "readwrite");
      return reqToPromise(s.put({ id:"main", ...data, updatedAt: Date.now() }));
    },
    async getProfissional(){
      const s = await tx(STORES.profissional, "readonly");
      return reqToPromise(s.get("main"));
    },
    async clearProfissional(){
      const s = await tx(STORES.profissional, "readwrite");
      return reqToPromise(s.delete("main"));
    },

    async upsertPaciente(p){
      const now = Date.now();
      const obj = { id: p.id || id(), ...p, updatedAt: now, createdAt: p.createdAt || now };
      const s = await tx(STORES.pacientes, "readwrite");
      await reqToPromise(s.put(obj));
      return obj;
    },
    async getPaciente(pacienteId){
      const s = await tx(STORES.pacientes, "readonly");
      return reqToPromise(s.get(pacienteId));
    },
    async listPacientes(){
      const s = await tx(STORES.pacientes, "readonly");
      return reqToPromise(s.getAll());
    },
    async searchPacientes(q){
      const all = await DB.listPacientes();
      const needle = (q||"").toLowerCase();
      return all.filter(p=>{
        const a = (p.nome||"").toLowerCase();
        const b = (p.tel||"").toLowerCase();
        return a.includes(needle) || b.includes(needle);
      });
    },

    async addAgenda(item){
      const obj = { id: id(), ...item, createdAt: Date.now() };
      const s = await tx(STORES.agenda, "readwrite");
      await reqToPromise(s.put(obj));
      return obj;
    },
    async listAgenda(){
      const s = await tx(STORES.agenda, "readonly");
      return reqToPromise(s.getAll());
    },
    async deleteAgenda(idAgenda){
      const s = await tx(STORES.agenda, "readwrite");
      return reqToPromise(s.delete(idAgenda));
    },

    async addAtendimento(item){
      const obj = { id: id(), ...item, createdAt: Date.now() };
      const s = await tx(STORES.atendimentos, "readwrite");
      await reqToPromise(s.put(obj));
      return obj;
    },
    async listAtendimentosByPaciente(pacienteId){
      const s = await tx(STORES.atendimentos, "readonly");
      const idx = s.index("by_pacienteId");
      return reqToPromise(idx.getAll(pacienteId));
    },

    async saveDraft(idDraft, data){
      const s = await tx(STORES.drafts, "readwrite");
      return reqToPromise(s.put({ id:idDraft, ...data, updatedAt: Date.now() }));
    },
    async getDraft(idDraft){
      const s = await tx(STORES.drafts, "readonly");
      return reqToPromise(s.get(idDraft));
    },

    async exportAll(){
      const prof = await DB.getProfissional();
      const pacientes = await DB.listPacientes();
      const agenda = await DB.listAgenda();
      const atendimentos = await (async ()=>{
        const s = await tx(STORES.atendimentos, "readonly");
        return reqToPromise(s.getAll());
      })();
      const settings = await (async ()=>{
        const s = await tx(STORES.settings, "readonly");
        return reqToPromise(s.getAll());
      })();

      return {
        exportedAt: new Date().toISOString(),
        prof,
        pacientes,
        agenda,
        atendimentos,
        settings
      };
    },

    async nukeAll(){
      const db = await openDB();
      await Promise.all(
        Object.values(STORES).map(store=>{
          return new Promise((resolve, reject)=>{
            const t = db.transaction(store, "readwrite");
            const s = t.objectStore(store);
            const req = s.clear();
            req.onsuccess = ()=>resolve(true);
            req.onerror = ()=>reject(req.error);
          });
        })
      );
      db.close();
    }
  };

  window.BTXDB = DB;
})();

/* BTX Docs Saúde — IndexedDB (memória forte / offline real) */
(function(){
  const DB_NAME = "btx_docs_saude_db";
  const DB_VER  = 1;

  const STORES = {
    meta: "meta",           // profissional + flags
    patients: "patients",   // pacientes
    agenda: "agenda",       // agendamentos
    visits: "visits"        // atendimentos/registro clínico (prontuário)
  };

  function openDB(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VER);

      req.onupgradeneeded = (e)=>{
        const db = req.result;

        if(!db.objectStoreNames.contains(STORES.meta)){
          db.createObjectStore(STORES.meta, { keyPath: "key" });
        }

        if(!db.objectStoreNames.contains(STORES.patients)){
          const s = db.createObjectStore(STORES.patients, { keyPath: "id" });
          s.createIndex("by_name", "name", { unique:false });
          s.createIndex("by_phone", "phone", { unique:false });
          s.createIndex("by_updated", "updatedAt", { unique:false });
        }

        if(!db.objectStoreNames.contains(STORES.agenda)){
          const s = db.createObjectStore(STORES.agenda, { keyPath: "id" });
          s.createIndex("by_date", "date", { unique:false });
          s.createIndex("by_patient", "patientId", { unique:false });
          s.createIndex("by_updated", "updatedAt", { unique:false });
        }

        if(!db.objectStoreNames.contains(STORES.visits)){
          const s = db.createObjectStore(STORES.visits, { keyPath: "id" });
          s.createIndex("by_patient", "patientId", { unique:false });
          s.createIndex("by_date", "date", { unique:false });
          s.createIndex("by_updated", "updatedAt", { unique:false });
        }
      };

      req.onsuccess = ()=>resolve(req.result);
      req.onerror = ()=>reject(req.error);
    });
  }

  async function tx(store, mode, fn){
    const db = await openDB();
    return new Promise((resolve, reject)=>{
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const res = fn(s);
      t.oncomplete = ()=>resolve(res);
      t.onerror = ()=>reject(t.error);
    });
  }

  function uid(prefix="id"){
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  // META
  async function metaGet(key){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const t = db.transaction(STORES.meta, "readonly");
      const s = t.objectStore(STORES.meta);
      const r = s.get(key);
      r.onsuccess = ()=>resolve(r.result ? r.result.value : null);
      r.onerror = ()=>reject(r.error);
    });
  }

  async function metaSet(key, value){
    return tx(STORES.meta, "readwrite", (s)=> s.put({ key, value, updatedAt: Date.now() }));
  }

  async function metaDel(key){
    return tx(STORES.meta, "readwrite", (s)=> s.delete(key));
  }

  // PATIENTS
  async function patientUpsert(p){
    if(!p.id) p.id = uid("p");
    p.updatedAt = Date.now();
    return tx(STORES.patients, "readwrite", (s)=> s.put(p));
  }

  async function patientGet(id){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const t = db.transaction(STORES.patients, "readonly");
      const s = t.objectStore(STORES.patients);
      const r = s.get(id);
      r.onsuccess = ()=>resolve(r.result || null);
      r.onerror = ()=>reject(r.error);
    });
  }

  async function patientAll(){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const t = db.transaction(STORES.patients, "readonly");
      const s = t.objectStore(STORES.patients);
      const r = s.getAll();
      r.onsuccess = ()=>resolve(r.result || []);
      r.onerror = ()=>reject(r.error);
    });
  }

  async function patientSearch(q){
    q = (q || "").trim().toLowerCase();
    const all = await patientAll();
    if(!q) return all.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    return all.filter(p=>{
      return (p.name||"").toLowerCase().includes(q) || (p.phone||"").toLowerCase().includes(q);
    }).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  }

  async function patientDelete(id){
    return tx(STORES.patients, "readwrite", (s)=> s.delete(id));
  }

  // AGENDA
  async function agendaUpsert(a){
    if(!a.id) a.id = uid("a");
    a.updatedAt = Date.now();
    return tx(STORES.agenda, "readwrite", (s)=> s.put(a));
  }

  async function agendaAll(){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const t = db.transaction(STORES.agenda, "readonly");
      const s = t.objectStore(STORES.agenda);
      const r = s.getAll();
      r.onsuccess = ()=>resolve(r.result || []);
      r.onerror = ()=>reject(r.error);
    });
  }

  async function agendaByDateRange(startISO, endISO){
    const all = await agendaAll();
    return all.filter(x => x.date >= startISO && x.date <= endISO)
      .sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time));
  }

  async function agendaDelete(id){
    return tx(STORES.agenda, "readwrite", (s)=> s.delete(id));
  }

  // VISITS / PRONTUÁRIO
  async function visitUpsert(v){
    if(!v.id) v.id = uid("v");
    v.updatedAt = Date.now();
    return tx(STORES.visits, "readwrite", (s)=> s.put(v));
  }

  async function visitsAll(){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const t = db.transaction(STORES.visits, "readonly");
      const s = t.objectStore(STORES.visits);
      const r = s.getAll();
      r.onsuccess = ()=>resolve(r.result || []);
      r.onerror = ()=>reject(r.error);
    });
  }

  async function visitsByPatient(patientId){
    const all = await visitsAll();
    return all.filter(v => v.patientId === patientId)
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  }

  async function visitDelete(id){
    return tx(STORES.visits, "readwrite", (s)=> s.delete(id));
  }

  // BACKUP
  async function exportAll(){
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      meta: {
        profissional: await metaGet("profissional"),
        lastPatientId: await metaGet("lastPatientId")
      },
      patients: await patientAll(),
      agenda: await agendaAll(),
      visits: await visitsAll(),
    };
    return payload;
  }

  async function importAll(payload){
    if(!payload || typeof payload !== "object") throw new Error("Backup inválido.");
    // Limpa e reinsere
    await clearAll();

    if(payload?.meta?.profissional) await metaSet("profissional", payload.meta.profissional);
    if(payload?.meta?.lastPatientId) await metaSet("lastPatientId", payload.meta.lastPatientId);

    const pts = payload.patients || [];
    const ag  = payload.agenda || [];
    const vs  = payload.visits || [];

    for(const p of pts) await patientUpsert(p);
    for(const a of ag) await agendaUpsert(a);
    for(const v of vs) await visitUpsert(v);
  }

  async function clearAll(){
    const db = await openDB();
    await Promise.all([
      new Promise((res,rej)=>{ const t=db.transaction(STORES.meta,"readwrite"); t.objectStore(STORES.meta).clear(); t.oncomplete=res; t.onerror=()=>rej(t.error); }),
      new Promise((res,rej)=>{ const t=db.transaction(STORES.patients,"readwrite"); t.objectStore(STORES.patients).clear(); t.oncomplete=res; t.onerror=()=>rej(t.error); }),
      new Promise((res,rej)=>{ const t=db.transaction(STORES.agenda,"readwrite"); t.objectStore(STORES.agenda).clear(); t.oncomplete=res; t.onerror=()=>rej(t.error); }),
      new Promise((res,rej)=>{ const t=db.transaction(STORES.visits,"readwrite"); t.objectStore(STORES.visits).clear(); t.oncomplete=res; t.onerror=()=>rej(t.error); }),
    ]);
  }

  window.BTXDB = {
    uid,
    metaGet, metaSet, metaDel,
    patientUpsert, patientGet, patientAll, patientSearch, patientDelete,
    agendaUpsert, agendaAll, agendaByDateRange, agendaDelete,
    visitUpsert, visitsByPatient, visitDelete, visitsAll,
    exportAll, importAll, clearAll
  };
})();

export const DB_NAME = "btx_docs_saude";
export const DB_VERSION = 1;

const STORES = ["kv", "agenda", "docs"];

let _db = null;

export function openDB(){
  if(_db) return Promise.resolve(_db);

  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      for (const s of STORES){
        if(!db.objectStoreNames.contains(s)){
          db.createObjectStore(s, { keyPath: "id" });
        }
      }
    };

    req.onsuccess = ()=>{ _db = req.result; resolve(_db); };
    req.onerror = ()=>reject(req.error || new Error("Falha no IndexedDB"));
  });
}

function storeTx(db, store, mode="readonly"){
  return db.transaction(store, mode).objectStore(store);
}

export async function put(store, obj){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const req = storeTx(db, store, "readwrite").put(obj);
    req.onsuccess = ()=>resolve(true);
    req.onerror = ()=>reject(req.error);
  });
}
export async function del(store, id){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const req = storeTx(db, store, "readwrite").delete(id);
    req.onsuccess = ()=>resolve(true);
    req.onerror = ()=>reject(req.error);
  });
}
export async function get(store, id){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const req = storeTx(db, store).get(id);
    req.onsuccess = ()=>resolve(req.result || null);
    req.onerror = ()=>reject(req.error);
  });
}
export async function all(store){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const req = storeTx(db, store).getAll();
    req.onsuccess = ()=>resolve(req.result || []);
    req.onerror = ()=>reject(req.error);
  });
}

// KV
export async function kvSet(key, value){ return put("kv", { id:key, value }); }
export async function kvGet(key, fallback=null){
  const r = await get("kv", key);
  return r ? r.value : fallback;
}

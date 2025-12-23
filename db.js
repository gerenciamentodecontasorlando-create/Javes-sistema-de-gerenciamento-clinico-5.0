/* BTX Docs Saúde — IndexedDB (memória forte) */
const DB_NAME = "btx_docs_saude_db";
const DB_VER  = 1;

const STORES = {
  prof: "prof",
  agenda: "agenda",
  pacientes: "pacientes",
  prontuario: "prontuario",
  drafts: "drafts"
};

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      Object.values(STORES).forEach(name=>{
        if(!db.objectStoreNames.contains(name)){
          const os = db.createObjectStore(name, { keyPath: "id" });
          os.createIndex("updatedAt", "updatedAt");
        }
      });
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

async function dbPut(store, obj){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(obj);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}

async function dbGet(store, id){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(id);
    req.onsuccess = ()=>resolve(req.result || null);
    req.onerror = ()=>reject(req.error);
  });
}

async function dbDel(store, id){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}

async function dbAll(store){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = ()=>resolve(req.result || []);
    req.onerror = ()=>reject(req.error);
  });
}

async function dbClear(store){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}

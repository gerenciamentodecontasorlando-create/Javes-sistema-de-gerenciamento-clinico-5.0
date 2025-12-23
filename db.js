// db.js — IndexedDB BTX Docs Saúde

const DB_NAME = "btx_docs_saude";
const DB_VERSION = 1;

let db = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains("pacientes")) {
        db.createObjectStore("pacientes", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("agenda")) {
        db.createObjectStore("agenda", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("prontuario")) {
        db.createObjectStore("prontuario", { keyPath: "id" });
      }
    };

    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };

    req.onerror = () => reject("Erro ao abrir IndexedDB");
  });
}

function tx(store, mode = "readonly") {
  return db.transaction(store, mode).objectStore(store);
}

export function save(store, data) {
  return new Promise((resolve) => {
    tx(store, "readwrite").put(data).onsuccess = resolve;
  });
}

export function getAll(store) {
  return new Promise((resolve) => {
    const req = tx(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

export function remove(store, id) {
  return new Promise((resolve) => {
    tx(store, "readwrite").delete(id).onsuccess = resolve;
  });
}

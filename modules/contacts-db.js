export class ContactsDB {
  constructor() {
    this.dbName = "ContactsAppDB";
    this.version = 1;
    this.dbPromise = this.initDB();
  }

  initDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        console.warn("IndexedDB not supported, falling back to localStorage");
        resolve(null);
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("contacts")) {
          const store = db.createObjectStore("contacts", { keyPath: "id" });
          store.createIndex("firstName", "firstName", { unique: false });
          store.createIndex("lastName", "lastName", { unique: false });
          store.createIndex("isFavorite", "isFavorite", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async withStore(mode, callback) {
    const db = await this.dbPromise;
    if (!db) {
      // Fallback to localStorage
      return callback(null);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contacts", mode);
      const store = tx.objectStore("contacts");
      const result = callback(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // LocalStorage helpers (fallback)
  _lsGetAll() {
    const raw = localStorage.getItem("contacts");
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  _lsSaveAll(arr) {
    localStorage.setItem("contacts", JSON.stringify(arr));
  }

  async addContact(contact) {
    return this.withStore("readwrite", (store) => {
      if (!store) {
        const all = this._lsGetAll();
        all.push(contact);
        this._lsSaveAll(all);
        return;
      }
      store.put(contact);
    });
  }

  async getContact(id) {
    return this.withStore("readonly", (store) => {
      if (!store) {
        return this._lsGetAll().find((c) => c.id === id) || null;
      }
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  }

  async updateContact(id, contact) {
    return this.withStore("readwrite", (store) => {
      if (!store) {
        const all = this._lsGetAll().map((c) => (c.id === id ? contact : c));
        this._lsSaveAll(all);
        return;
      }
      store.put(contact);
    });
  }

  async deleteContact(id) {
    return this.withStore("readwrite", (store) => {
      if (!store) {
        const all = this._lsGetAll().filter((c) => c.id !== id);
        this._lsSaveAll(all);
        return;
      }
      store.delete(id);
    });
  }

  async clearAll() {
    return this.withStore("readwrite", (store) => {
      if (!store) {
        this._lsSaveAll([]);
        return;
      }
      store.clear();
    });
  }

  async getAllContacts() {
    return this.withStore("readonly", (store) => {
      if (!store) {
        return this._lsGetAll();
      }
      return new Promise((resolve, reject) => {
        const result = [];
        const req = store.openCursor();
        req.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            result.push(cursor.value);
            cursor.continue();
          } else {
            // sort by first name then last name
            result.sort((a, b) => {
              const af = (a.firstName || "").toLowerCase();
              const bf = (b.firstName || "").toLowerCase();
              if (af === bf) {
                return (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
              }
              return af.localeCompare(bf);
            });
            resolve(result);
          }
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async importContacts(list) {
    if (!Array.isArray(list)) return;
    await this.clearAll();
    for (const contact of list) {
      await this.addContact(contact);
    }
  }
}


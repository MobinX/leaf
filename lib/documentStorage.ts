/**
 * DocumentStorage: IndexDB wrapper with RAM fallback
 * Handles document persistence and image caching
 */

import type { Document, DocumentMetadata } from './types';

const DB_NAME = 'LeafDocuments';
const STORE_NAME = 'documents';
const IMAGE_STORE_NAME = 'images';
const DB_VERSION = 1;

class DocumentStorageImpl {
  private db: IDBDatabase | null = null;
  private ramCache: Map<string, Document> = new Map();
  private ramImages: Map<string, Blob[]> = new Map();
  private useRamFallback = false;

  async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.useRamFallback = true;
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
        }
      };

      await new Promise((resolve, reject) => {
        request.onsuccess = () => {
          this.db = request.result;
          resolve(undefined);
        };
        request.onerror = () => {
          console.warn('IndexDB open failed, falling back to RAM');
          this.useRamFallback = true;
          resolve(undefined);
        };
      });
    } catch (err) {
      console.warn('IndexDB initialization failed, using RAM fallback', err);
      this.useRamFallback = true;
    }
  }

  async saveDocument(doc: Document): Promise<void> {
    // RAM cache as primary
    this.ramCache.set(doc.id, doc);
    this._updateMetadata(doc);

    if (this.useRamFallback || !this.db) {
      return;
    }

    try {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const serialized = this._serializeDocument(doc);
      store.put(serialized);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = reject;
      });
    } catch (error) {
      console.warn('IndexDB save failed', error);
    }
  }

  async getDocument(id: string): Promise<Document | null> {
    // Check RAM cache first
    if (this.ramCache.has(id)) {
      return this.ramCache.get(id)!;
    }

    if (this.useRamFallback || !this.db) {
      return null;
    }

    try {
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const doc = request.result;
          if (doc) {
            const deserialized = this._deserializeDocument(doc);
            this.ramCache.set(id, deserialized);
            resolve(deserialized);
          } else {
            resolve(null);
          }
        };
        request.onerror = reject;
      });
    } catch {
      return null;
    }
  }

  async listDocuments(): Promise<DocumentMetadata[]> {
    const stored = localStorage.getItem('documents');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  }

  async deleteDocument(id: string): Promise<void> {
    this.ramCache.delete(id);
    this.ramImages.delete(id);

    if (this.useRamFallback || !this.db) {
      this._updateMetadata(null, id);
      return;
    }

    try {
      const tx = this.db.transaction([STORE_NAME, IMAGE_STORE_NAME], 'readwrite');
      const docStore = tx.objectStore(STORE_NAME);
      const imgStore = tx.objectStore(IMAGE_STORE_NAME);
      
      docStore.delete(id);
      imgStore.delete(id);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = reject;
      });

      this._updateMetadata(null, id);
    } catch {
      this._updateMetadata(null, id);
    }
  }

  private _serializeDocument(doc: Document): any {
    // For now, simplify and avoid URL.createObjectURL which is not persistent
    const serialized = { ...doc } as any;
    if (serialized.inputs?.theory) {
      serialized.inputs.theory = serialized.inputs.theory.map((t: any) => ({
        ...t,
        images: [] // Don't store temporary blobs/objectURLs
      }));
    }
    // Add more cleanup if needed
    return serialized;
  }

  private _deserializeDocument(doc: any): Document {
    return doc as Document;
  }

  private _updateMetadata(doc: Document | null, deleteId?: string): void {
    const stored = localStorage.getItem('documents');
    let list: DocumentMetadata[] = [];
    if (stored) {
      try { list = JSON.parse(stored); } catch { list = []; }
    }
    
    let updated: DocumentMetadata[];
    if (deleteId) {
      updated = list.filter(d => d.id !== deleteId);
    } else if (doc) {
      const existing = list.findIndex(d => d.id === doc.id);
      const meta: DocumentMetadata = {
        id: doc.id,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      };
      if (existing >= 0) {
        updated = [...list];
        updated[existing] = meta;
      } else {
        updated = [...list, meta];
      }
    } else {
      updated = list;
    }
    localStorage.setItem('documents', JSON.stringify(updated));
  }
}

// Singleton instance
let storageInstance: DocumentStorageImpl | null = null;

export const DocumentStorage = {
  async getInstance(): Promise<DocumentStorageImpl> {
    if (!storageInstance) {
      storageInstance = new DocumentStorageImpl();
      await storageInstance.init();
    }
    return storageInstance;
  }
};

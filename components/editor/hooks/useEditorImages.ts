import { useState, useEffect, useCallback } from 'react';

export type StoredImage = {
  id: string;
  src: string;
  createdAt: number;
};

const IMAGE_DB_NAME = 'leaf-editor-images';
const IMAGE_STORE_NAME = 'uploadedImages';
const IMAGE_DB_VERSION = 1;
const MAX_STORED_IMAGES = 12;

export function useEditorImages() {
  const [savedImages, setSavedImages] = useState<StoredImage[]>([]);

  const openImageDb = useCallback(() =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
    }), []);

  const getAllStoredImages = useCallback(async () => {
    const db = await openImageDb();
    try {
      const images = await new Promise<StoredImage[]>((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
        const store = tx.objectStore(IMAGE_STORE_NAME);
        const request = store.getAll();
        request.onerror = () => reject(request.error ?? new Error('Failed to read saved images'));
        request.onsuccess = () => resolve((request.result as StoredImage[]) ?? []);
      });
      return images.sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_STORED_IMAGES);
    } finally {
      db.close();
    }
  }, [openImageDb]);

  const saveStoredImages = useCallback(async (images: StoredImage[]) => {
    const db = await openImageDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IMAGE_STORE_NAME);
        store.clear();
        for (const image of images) {
          store.put(image);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to save images'));
      });
    } finally {
      db.close();
    }
  }, [openImageDb]);

  const clearStoredImagesFromDb = useCallback(async () => {
    const db = await openImageDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
        tx.objectStore(IMAGE_STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to clear images'));
      });
    } finally {
      db.close();
    }
  }, [openImageDb]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    getAllStoredImages()
      .then((images) => setSavedImages(images))
      .catch((error) => {
        console.error('Failed to load saved images from IndexedDB', error);
      });
  }, [getAllStoredImages]);

  const persistSavedImages = useCallback(async (updater: (prev: StoredImage[]) => StoredImage[]) => {
    const next = updater(savedImages);
    setSavedImages(next);
    try {
      await saveStoredImages(next);
    } catch (error) {
      console.error('Failed to persist saved images to IndexedDB', error);
    }
  }, [savedImages, saveStoredImages]);

  const addStoredImage = useCallback((src: string) => {
    void persistSavedImages(prev => {
      const deduped = prev.filter(item => item.src !== src);
      return [{ id: crypto.randomUUID(), src, createdAt: Date.now() }, ...deduped].slice(0, MAX_STORED_IMAGES);
    });
  }, [persistSavedImages]);

  const clearStoredImages = useCallback(() => {
    setSavedImages([]);
    void clearStoredImagesFromDb().catch((error) => {
      console.error('Failed to clear saved images from IndexedDB', error);
    });
  }, [clearStoredImagesFromDb]);

  return {
    savedImages,
    addStoredImage,
    clearStoredImages
  };
}

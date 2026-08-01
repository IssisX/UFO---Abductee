/**
 * Storage service for persistent voxel models and application settings.
 * Uses IndexedDB with localStorage fallback to safely store 3D voxel builds.
 */

import { SavedModel, AIModelId } from '../types';

const DB_NAME = 'VoxelToyBoxDB';
const DB_VERSION = 1;
const BUILDS_STORE = 'customBuilds';
const REBUILDS_STORE = 'customRebuilds';
const SETTINGS_KEY_MODEL = 'voxel_selected_model';

// Utility for IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(BUILDS_STORE)) {
        db.createObjectStore(BUILDS_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(REBUILDS_STORE)) {
        db.createObjectStore(REBUILDS_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Fallback localStorage keys
const LS_BUILDS = 'voxel_custom_builds_v1';
const LS_REBUILDS = 'voxel_custom_rebuilds_v1';

export const storageService = {
  // --- Selected AI Model ---
  getSelectedModel(): AIModelId {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY_MODEL) as AIModelId;
      if (saved === 'gemini-3.6-flash' || saved === 'gemini-3.1-pro-preview') {
        return saved;
      }
    } catch (e) {
      console.warn('Storage read failed:', e);
    }
    return 'gemini-3.6-flash';
  },

  saveSelectedModel(modelId: AIModelId): void {
    try {
      localStorage.setItem(SETTINGS_KEY_MODEL, modelId);
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
  },

  // --- Custom Builds ---
  async getCustomBuilds(): Promise<SavedModel[]> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(BUILDS_STORE, 'readonly');
        const store = tx.objectStore(BUILDS_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(this.getCustomBuildsFallback());
      });
    } catch (e) {
      return this.getCustomBuildsFallback();
    }
  },

  async saveCustomBuild(model: SavedModel): Promise<SavedModel[]> {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(BUILDS_STORE, 'readwrite');
        const store = tx.objectStore(BUILDS_STORE);
        const req = store.add(model);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      const all = await this.getCustomBuilds();
      this.syncBuildsToFallback(all);
      return all;
    } catch (e) {
      const current = this.getCustomBuildsFallback();
      const updated = [...current, model];
      this.syncBuildsToFallback(updated);
      return updated;
    }
  },

  async deleteCustomBuild(index: number): Promise<SavedModel[]> {
    const current = await this.getCustomBuilds();
    if (index < 0 || index >= current.length) return current;
    
    const targetModel = current[index];
    current.splice(index, 1);

    try {
      const db = await openDB();
      const tx = db.transaction(BUILDS_STORE, 'readwrite');
      const store = tx.objectStore(BUILDS_STORE);
      // Clear and re-populate
      store.clear();
      current.forEach((item) => store.add(item));
    } catch (e) {
      console.warn('IndexedDB delete failed, using fallback', e);
    }
    this.syncBuildsToFallback(current);
    return current;
  },

  // --- Custom Rebuilds ---
  async getCustomRebuilds(): Promise<SavedModel[]> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(REBUILDS_STORE, 'readonly');
        const store = tx.objectStore(REBUILDS_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(this.getCustomRebuildsFallback());
      });
    } catch (e) {
      return this.getCustomRebuildsFallback();
    }
  },

  async saveCustomRebuild(model: SavedModel): Promise<SavedModel[]> {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(REBUILDS_STORE, 'readwrite');
        const store = tx.objectStore(REBUILDS_STORE);
        const req = store.add(model);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      const all = await this.getCustomRebuilds();
      this.syncRebuildsToFallback(all);
      return all;
    } catch (e) {
      const current = this.getCustomRebuildsFallback();
      const updated = [...current, model];
      this.syncRebuildsToFallback(updated);
      return updated;
    }
  },

  async deleteCustomRebuild(index: number): Promise<SavedModel[]> {
    const current = await this.getCustomRebuilds();
    if (index < 0 || index >= current.length) return current;
    
    current.splice(index, 1);

    try {
      const db = await openDB();
      const tx = db.transaction(REBUILDS_STORE, 'readwrite');
      const store = tx.objectStore(REBUILDS_STORE);
      store.clear();
      current.forEach((item) => store.add(item));
    } catch (e) {
      console.warn('IndexedDB delete failed, using fallback', e);
    }
    this.syncRebuildsToFallback(current);
    return current;
  },

  // --- Fallback Helpers ---
  getCustomBuildsFallback(): SavedModel[] {
    try {
      const raw = localStorage.getItem(LS_BUILDS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  syncBuildsToFallback(items: SavedModel[]): void {
    try {
      localStorage.setItem(LS_BUILDS, JSON.stringify(items));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  },

  getCustomRebuildsFallback(): SavedModel[] {
    try {
      const raw = localStorage.getItem(LS_REBUILDS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  syncRebuildsToFallback(items: SavedModel[]): void {
    try {
      localStorage.setItem(LS_REBUILDS, JSON.stringify(items));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }
};

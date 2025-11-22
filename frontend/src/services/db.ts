import type { AudioFile } from '../types';

const DB_NAME = 'schd:v1:db';
const DB_STORE_AUDIOS = 'audios';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(DB_STORE_AUDIOS)) {
                db.createObjectStore(DB_STORE_AUDIOS, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function storeAudio(file: File): Promise<{ id: string; name: string }> {
    const id = Math.random().toString(36).slice(2, 10);
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DB_STORE_AUDIOS, 'readwrite');
        tx.objectStore(DB_STORE_AUDIOS).put({ id, name: file.name, type: file.type, blob: file });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    return { id, name: file.name };
}

export async function getAudioUrl(id: string): Promise<string> {
    const db = await openDB();
    const rec = await new Promise<AudioFile>((resolve, reject) => {
        const tx = db.transaction(DB_STORE_AUDIOS, 'readonly');
        const get = tx.objectStore(DB_STORE_AUDIOS).get(id);
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
    });
    if (!rec || !rec.blob) throw new Error('audio not found');
    return URL.createObjectURL(rec.blob);
}

export async function deleteAudio(id: string): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DB_STORE_AUDIOS, 'readwrite');
        tx.objectStore(DB_STORE_AUDIOS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

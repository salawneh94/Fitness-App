import { createStore, get, set, del, keys } from 'idb-keyval';

// Progress photos are binary blobs — kept out of localStorage (small quota) in their
// own IndexedDB object store, referenced by id from the zustand-persisted ProgressPhoto records.
const photoDb = createStore('fitness-app-photos', 'photos');

export function savePhotoBlob(id: string, blob: Blob): Promise<void> {
  return set(id, blob, photoDb);
}

export function getPhotoBlob(id: string): Promise<Blob | undefined> {
  return get(id, photoDb);
}

export function deletePhotoBlob(id: string): Promise<void> {
  return del(id, photoDb);
}

export function listPhotoIds(): Promise<IDBValidKey[]> {
  return keys(photoDb);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

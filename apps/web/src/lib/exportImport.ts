import { blobToDataUrl, dataUrlToBlob, listPhotoIds, getPhotoBlob, savePhotoBlob } from './photoStore';

const STORAGE_KEY = 'fitness-app-storage';
const EXPORT_VERSION = 1;

interface ExportBundle {
  version: number;
  exportedAt: string;
  appState: unknown;
  photos: Record<string, string>; // photoId -> data URL
}

export async function exportAllData(): Promise<void> {
  const rawState = localStorage.getItem(STORAGE_KEY);
  const appState = rawState ? JSON.parse(rawState) : null;

  const photoIds = await listPhotoIds();
  const photos: Record<string, string> = {};
  for (const id of photoIds) {
    const blob = await getPhotoBlob(String(id));
    if (blob) photos[String(id)] = await blobToDataUrl(blob);
  }

  const bundle: ExportBundle = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appState,
    photos,
  };

  const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fittrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importAllData(file: File): Promise<void> {
  const text = await file.text();
  const bundle = JSON.parse(text) as ExportBundle;

  if (!bundle || typeof bundle !== 'object' || !('appState' in bundle)) {
    throw new Error('This file doesn’t look like a FitTrack backup.');
  }

  if (bundle.appState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle.appState));
  }

  for (const [id, dataUrl] of Object.entries(bundle.photos ?? {})) {
    const blob = await dataUrlToBlob(dataUrl);
    await savePhotoBlob(id, blob);
  }
}

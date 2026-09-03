import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';

const STORAGE_BUCKET = 'progress-photos';

// Constructed lazily (not at module scope) so simply importing this file never touches the
// native filesystem — only actually saving/reading/deleting a photo does.
function getPhotosDir(): Directory {
  const dir = new Directory(Paths.document, 'progress-photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Downscales a picked/captured photo and copies it into permanent local storage under `id`. */
export async function savePhotoFromUri(id: string, sourceUri: string, maxDim = 900, quality = 0.82): Promise<string> {
  const context = ImageManipulator.manipulate(sourceUri).resize({ width: maxDim, height: maxDim });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality });

  const dest = new File(getPhotosDir(), `${id}.jpg`);
  if (dest.exists) dest.delete();
  await new File(result.uri).copy(dest);
  return dest.uri;
}

export function getPhotoUri(id: string): string | null {
  const file = new File(getPhotosDir(), `${id}.jpg`);
  return file.exists ? file.uri : null;
}

export function deletePhotoFile(id: string) {
  const file = new File(getPhotosDir(), `${id}.jpg`);
  if (file.exists) file.delete();
}

export function hasPhotoFile(id: string): boolean {
  return new File(getPhotosDir(), `${id}.jpg`).exists;
}

/** Uploads the already-resized local file for `id` to Storage, returning its object path. */
export async function uploadPhotoToStorage(userId: string, id: string): Promise<string> {
  const path = `${userId}/${id}.jpg`;
  const bytes = await new File(getPhotosDir(), `${id}.jpg`).bytes();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/** Downloads a remote photo into local storage under `id`, e.g. after pulling on a new device. */
export async function downloadPhotoFromStorage(userId: string, id: string): Promise<string> {
  const path = `${userId}/${id}.jpg`;
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) throw error ?? new Error(`No data downloading ${path}`);

  const bytes = new Uint8Array(await data.arrayBuffer());
  const dest = new File(getPhotosDir(), `${id}.jpg`);
  if (dest.exists) dest.delete();
  dest.create();
  dest.write(bytes);
  return dest.uri;
}

export async function deletePhotoFromStorage(userId: string, id: string): Promise<void> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([`${userId}/${id}.jpg`]);
  if (error) throw error;
}

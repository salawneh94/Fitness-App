import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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

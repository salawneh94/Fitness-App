import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { todayISO } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';

/** Bumped only if the shape changes in a way an importer would need to branch on. */
export const EXPORT_FORMAT_VERSION = 1;

/**
 * Everything this device holds about the user, as one JSON document.
 *
 * The web app had export/import and the mobile rewrite lost it. That matters more than it looks:
 * this is a paid app whose whole value is a long history, and someone who can't get their data
 * out doesn't really own it. It's also the thing that answers a data-portability request without
 * anyone having to touch the database.
 *
 * Progress photos appear as their metadata only. The images live in Supabase Storage keyed by
 * photo id, and inlining them as base64 would turn a small shareable file into tens of megabytes.
 */
export function buildExport(): string {
  const s = useAppStore.getState();
  return JSON.stringify(
    {
      format: 'fittrack-export',
      version: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      profile: s.profile,
      weightHistory: s.weightHistory,
      stepsHistory: s.stepsHistory,
      sleepHistory: s.sleepHistory,
      measurementsHistory: s.measurementsHistory,
      foodEntries: s.foodEntries,
      scheduledWorkouts: s.scheduledWorkouts,
      workoutLogs: s.workoutLogs,
      savedMeals: s.savedMeals,
      // Already metadata only — the images themselves live in Storage, keyed by photo id.
      progressPhotos: s.progressPhotos,
    },
    null,
    2
  );
}

export function exportFilename(): string {
  return `fittrack-export-${todayISO()}.json`;
}

export type ExportOutcome = 'shared' | 'downloaded' | 'unavailable' | 'failed';

/**
 * Hand the export to the OS share sheet (or the browser's download, on web).
 *
 * Writing to the cache directory rather than documents is deliberate: once the share sheet has
 * copied it wherever the user chose, our copy is just a duplicate of their data sitting on disk,
 * and the OS can reclaim it whenever it likes.
 */
export async function shareExport(): Promise<ExportOutcome> {
  const json = buildExport();

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFilename();
      link.click();
      URL.revokeObjectURL(url);
      return 'downloaded';
    } catch {
      return 'failed';
    }
  }

  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    const file = new File(Paths.cache, exportFilename());
    file.create({ overwrite: true });
    file.write(json);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export FitTrack data',
      UTI: 'public.json',
    });
    return 'shared';
  } catch {
    return 'failed';
  }
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Award, CalendarCheck, Camera, Trash2, Plus } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { computeStreaks } from '../lib/streaks';
import { estimate1RM } from '../lib/calc';
import { resizeImageFile } from '../lib/imageResize';
import { savePhotoBlob, getPhotoBlob, deletePhotoBlob } from '../lib/photoStore';
import Card from '../components/ui/Card';
import StatTile from '../components/ui/StatTile';
import WeightChart from '../components/charts/WeightChart';
import StrengthChart from '../components/charts/StrengthChart';

export default function ProgressPage() {
  const profile = useAppStore((s) => s.profile);
  const foodEntries = useAppStore((s) => s.foodEntries);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const weightHistory = useAppStore((s) => s.weightHistory);
  const progressPhotos = useAppStore((s) => s.progressPhotos);
  const addProgressPhoto = useAppStore((s) => s.addProgressPhoto);
  const removeProgressPhoto = useAppStore((s) => s.removeProgressPhoto);

  if (!profile) return null;

  const streaks = computeStreaks(foodEntries, workoutLogs, profile.createdAt.slice(0, 10));

  const exerciseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of workoutLogs) {
      for (const ex of log.exerciseLogs ?? []) {
        map.set(ex.exerciseId, ex.exerciseName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [workoutLogs]);

  const [selectedExercise, setSelectedExercise] = useState<string>('');
  useEffect(() => {
    if (!selectedExercise && exerciseOptions.length > 0) setSelectedExercise(exerciseOptions[0].id);
  }, [exerciseOptions, selectedExercise]);

  const strengthData = useMemo(() => {
    if (!selectedExercise) return [];
    const byDate = new Map<string, number>();
    for (const log of workoutLogs) {
      const exLog = log.exerciseLogs?.find((e) => e.exerciseId === selectedExercise);
      if (!exLog) continue;
      const best = Math.max(...exLog.sets.map((s) => estimate1RM(s.weightKg, s.reps)));
      byDate.set(log.date, Math.max(byDate.get(log.date) ?? 0, best));
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  }, [workoutLogs, selectedExercise]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Progress</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your consistency, strength, and body trends over time.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Flame} label="Current Streak" value={`${streaks.currentStreak}d`} sub="active days in a row" accent="var(--series-2)" />
        <StatTile icon={Award} label="Best Streak" value={`${streaks.bestStreak}d`} sub="your longest run" accent="var(--series-4)" />
        <StatTile icon={CalendarCheck} label="7-Day Adherence" value={`${Math.round(streaks.adherence7d * 100)}%`} sub="days logged this week" accent="var(--series-1)" />
        <StatTile icon={CalendarCheck} label="30-Day Adherence" value={`${Math.round(streaks.adherence30d * 100)}%`} sub="days logged this month" accent="var(--series-3)" />
      </div>

      <Card title="Weight Trend">
        <WeightChart data={weightHistory} />
      </Card>

      <Card title="Strength Progress (estimated 1-rep max)">
        {exerciseOptions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Log sets with weight & reps on the Workouts page to start tracking strength gains here.
          </p>
        ) : (
          <>
            <select
              className="mb-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
            >
              {exerciseOptions.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            <StrengthChart data={strengthData} />
          </>
        )}
      </Card>

      <PhotosCard photos={progressPhotos} onAdd={addProgressPhoto} onRemove={removeProgressPhoto} />
    </div>
  );
}

function PhotosCard({
  photos,
  onAdd,
  onRemove,
}: {
  photos: { id: string; date: string; note?: string }[];
  onAdd: (photo: { date: string; note?: string }) => string;
  onRemove: (id: string) => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = photos.filter((p) => !urls[p.id]);
      if (missing.length === 0) return;
      const next: Record<string, string> = {};
      for (const p of missing) {
        const blob = await getPhotoBlob(p.id);
        if (blob) next[p.id] = URL.createObjectURL(blob);
      }
      if (!cancelled) setUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const blob = await resizeImageFile(file);
    const id = onAdd({ date: new Date().toISOString().slice(0, 10) });
    await savePhotoBlob(id, blob);
    setUrls((prev) => ({ ...prev, [id]: URL.createObjectURL(blob) }));
  }

  async function handleRemove(id: string) {
    onRemove(id);
    await deletePhotoBlob(id);
    setUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setViewing(null);
  }

  const sorted = [...photos].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card
      title="Progress Photos"
      action={
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400"
        >
          <Camera size={15} /> Add photo
        </button>
      }
    >
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      {sorted.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-800 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <Plus size={20} />
          Take or upload your first progress photo
        </button>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {sorted.map((p) => (
            <button
              key={p.id}
              onClick={() => setViewing(p.id)}
              className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 relative group"
            >
              {urls[p.id] && <img src={urls[p.id]} alt={p.date} className="w-full h-full object-cover" />}
              <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-0.5">
                {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </button>
          ))}
        </div>
      )}

      {viewing && urls[viewing] && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img src={urls[viewing]} alt="" className="w-full rounded-xl mb-3" />
            <div className="flex justify-between items-center">
              <span className="text-white text-sm">
                {new Date(photos.find((p) => p.id === viewing)!.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <div className="flex gap-2">
                <button onClick={() => handleRemove(viewing)} className="flex items-center gap-1 text-sm text-red-400 px-3 py-1.5 rounded-lg bg-white/10">
                  <Trash2 size={14} /> Delete
                </button>
                <button onClick={() => setViewing(null)} className="text-sm text-white px-3 py-1.5 rounded-lg bg-white/10">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

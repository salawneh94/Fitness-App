import { useEffect, useState } from 'react';
import { getPhotoBlob } from '../lib/photoStore';
import Card from './ui/Card';

interface PhotoMeta {
  id: string;
  date: string;
}

export default function PhotoCompareSlider({ photos }: { photos: PhotoMeta[] }) {
  const sorted = [...photos].sort((a, b) => a.date.localeCompare(b.date));
  const [beforeId, setBeforeId] = useState(sorted[0]?.id ?? '');
  const [afterId, setAfterId] = useState(sorted[sorted.length - 1]?.id ?? '');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [sliderPct, setSliderPct] = useState(50);

  useEffect(() => {
    if (sorted.length === 0) return;
    if (!beforeId) setBeforeId(sorted[0].id);
    if (!afterId) setAfterId(sorted[sorted.length - 1].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const id of [beforeId, afterId]) {
        if (!id || urls[id]) continue;
        const blob = await getPhotoBlob(id);
        if (blob && !cancelled) setUrls((prev) => ({ ...prev, [id]: URL.createObjectURL(blob) }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beforeId, afterId]);

  if (sorted.length < 2) {
    return (
      <Card title="Compare Progress Photos">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Add at least two progress photos to compare them side by side.
        </p>
      </Card>
    );
  }

  const beforeDate = sorted.find((p) => p.id === beforeId)?.date;
  const afterDate = sorted.find((p) => p.id === afterId)?.date;

  return (
    <Card title="Compare Progress Photos">
      <div className="flex gap-3 mb-4">
        <label className="flex-1 block">
          <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Before</span>
          <select
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
            value={beforeId}
            onChange={(e) => setBeforeId(e.target.value)}
          >
            {sorted.map((p) => (
              <option key={p.id} value={p.id}>
                {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 block">
          <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>After</span>
          <select
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
            value={afterId}
            onChange={(e) => setAfterId(e.target.value)}
          >
            {sorted.map((p) => (
              <option key={p.id} value={p.id}>
                {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </option>
            ))}
          </select>
        </label>
      </div>

      {urls[beforeId] && urls[afterId] ? (
        <div className="relative aspect-[3/4] max-w-sm mx-auto rounded-2xl overflow-hidden select-none bg-gray-100 dark:bg-neutral-800">
          <img src={urls[beforeId]} alt="Before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${sliderPct}%)` }}>
            <img src={urls[afterId]} alt="After" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
          </div>
          <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${sliderPct}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center pointer-events-none"
            style={{ left: `${sliderPct}%` }}
          >
            <span className="text-xs text-gray-500">↔</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderPct}
            onChange={(e) => setSliderPct(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize m-0"
            aria-label="Comparison slider"
          />
          <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full">
            {beforeDate && new Date(beforeDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full">
            {afterDate && new Date(afterDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading photos…
        </div>
      )}
    </Card>
  );
}

import { ExternalLink, X } from 'lucide-react';
import type { Exercise } from '@fittrack/shared';

export default function ExerciseVideoModal({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{exercise.name}</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {exercise.equipment} {exercise.sets && exercise.reps ? `· ${exercise.sets} × ${exercise.reps}` : exercise.notes ? `· ${exercise.notes}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {exercise.videoId ? (
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${exercise.videoId}?rel=0`}
              title={`${exercise.name} tutorial`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800 p-6 text-center">
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              No verified in-app video yet for this exercise — search YouTube instead.
            </p>
          </div>
        )}

        <a
          href={exercise.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm text-cyan-600 dark:text-cyan-400 mt-3"
        >
          <ExternalLink size={14} /> {exercise.videoId ? 'More videos on YouTube' : 'Search YouTube'}
        </a>
      </div>
    </div>
  );
}

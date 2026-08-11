import { useState } from 'react';
import { CheckCircle2, PlayCircle, Dumbbell, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLAN_TEMPLATES } from '../data/planTemplates';
import type { ScheduledWorkout, Weekday } from '../types';
import { useAppStore } from '../store/useAppStore';
import { recommendPlan } from '../lib/planRecommendation';
import Card from '../components/ui/Card';

const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export default function PlansPage() {
  const profile = useAppStore((s) => s.profile);
  const setScheduledWorkouts = useAppStore((s) => s.setScheduledWorkouts);
  const recommendation = profile ? recommendPlan(profile) : null;
  const [expandedId, setExpandedId] = useState<string | null>(recommendation?.template.id ?? PLAN_TEMPLATES[0]?.id ?? null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const navigate = useNavigate();

  function applyPlan(templateId: string) {
    const template = PLAN_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const workouts: ScheduledWorkout[] = template.days.slice(0, 7).map((d, i) => ({
      id: uid(),
      day: WEEKDAYS[i],
      name: `${d.label}: ${d.focus}`,
      exercises: d.exercises,
    }));
    setScheduledWorkouts(workouts);
    setAppliedId(templateId);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Workout Plan Ideas</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Proven training splits — pick one and apply it to your weekly schedule in one click.
        </p>
      </div>

      {recommendation && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30">
          <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Recommended for you: {recommendation.template.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{recommendation.reason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {PLAN_TEMPLATES.map((t) => {
          const isOpen = expandedId === t.id;
          const isApplied = appliedId === t.id;
          const isRecommended = recommendation?.template.id === t.id;
          return (
            <Card key={t.id} className={`!p-0 overflow-hidden ${isRecommended ? 'ring-2 ring-emerald-400' : ''}`}>
              <button
                onClick={() => setExpandedId(isOpen ? null : t.id)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Dumbbell size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                      {t.name}
                      {isRecommended && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
                          Recommended
                        </span>
                      )}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.split} · {t.daysPerWeek} days/week</p>
                  </div>
                </div>
                {isApplied && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 size={14} /> Applied
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-gray-100 dark:border-neutral-800 pt-4">
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{t.description}</p>
                  <div className="grid sm:grid-cols-2 gap-3 mb-4">
                    {t.days.map((d) => (
                      <div key={d.label} className="rounded-xl bg-gray-50 dark:bg-neutral-800 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                          {d.label} · {d.focus}
                        </p>
                        <ul className="space-y-1">
                          {d.exercises.map((ex) => (
                            <li key={ex.id} className="flex items-center justify-between text-sm">
                              <span style={{ color: 'var(--text-primary)' }}>{ex.name}</span>
                              <a
                                href={ex.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 dark:text-emerald-400 shrink-0"
                                aria-label={`Watch demo for ${ex.name}`}
                              >
                                <PlayCircle size={15} />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => applyPlan(t.id)}
                    className="text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Apply to weekly schedule
                  </button>
                  {isApplied && (
                    <button
                      onClick={() => navigate('/workouts')}
                      className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 ml-2"
                    >
                      View schedule
                    </button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

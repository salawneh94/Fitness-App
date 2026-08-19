import { useState } from 'react';
import { Check } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { todayISO } from '../lib/calc';
import Card from './ui/Card';
import WeightInput from './ui/WeightInput';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';

export default function QuickLogCard() {
  const profile = useAppStore((s) => s.profile);
  const weightHistory = useAppStore((s) => s.weightHistory);
  const stepsHistory = useAppStore((s) => s.stepsHistory);
  const sleepHistory = useAppStore((s) => s.sleepHistory);
  const updateWeight = useAppStore((s) => s.updateWeight);
  const updateSteps = useAppStore((s) => s.updateSteps);
  const updateSleep = useAppStore((s) => s.updateSleep);

  const today = todayISO();
  const todayWeight = weightHistory.find((w) => w.date === today)?.weightKg ?? profile?.weightKg ?? '';
  const todaySteps = stepsHistory.find((s) => s.date === today)?.steps ?? '';
  const todaySleep = sleepHistory.find((s) => s.date === today)?.hours ?? '';

  const [weight, setWeight] = useState<number | ''>(todayWeight);
  const [steps, setSteps] = useState<number | ''>(todaySteps);
  const [sleep, setSleep] = useState<number | ''>(todaySleep);
  const [saved, setSaved] = useState(false);

  function save() {
    if (weight !== '') updateWeight(Number(weight));
    if (steps !== '') updateSteps(Number(steps));
    if (sleep !== '') updateSleep(Number(sleep));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card title="Log Today">
      <div className="grid grid-cols-3 gap-3 mb-3">
        <label className="block">
          <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Weight</span>
          <WeightInput valueKg={weight} onChangeKg={setWeight} unit={profile?.unitSystem ?? 'metric'} min={0} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Steps</span>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={steps}
            onChange={(e) => setSteps(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Sleep (hrs)</span>
          <input
            type="number"
            min={0}
            max={24}
            step={0.5}
            className={inputCls}
            value={sleep}
            onChange={(e) => setSleep(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
      </div>
      <button
        onClick={save}
        className="flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
      >
        {saved ? <Check size={15} /> : null}
        {saved ? 'Saved' : 'Save'}
      </button>
    </Card>
  );
}

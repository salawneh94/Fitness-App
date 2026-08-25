import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { ActivityLevel, Goal, Profile, Sex, UnitSystem } from '../types';
import { ACTIVITY_LABELS, GOAL_LABELS, bmi, planDailyTargets } from '../lib/calc';
import { exportAllData, importAllData } from '../lib/exportImport';
import Card from '../components/ui/Card';
import TargetPlanNote from '../components/TargetPlanNote';
import WeightInput from '../components/ui/WeightInput';
import HeightInput from '../components/ui/HeightInput';
import UnitToggle from '../components/ui/UnitToggle';
import OnboardingWizard from './OnboardingWizard';

const GOALS: Goal[] = ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance', 'general_health'];
const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';

export default function ProfilePage() {
  const existing = useAppStore((s) => s.profile);
  // First-time setup uses the step-by-step wizard; editing an existing profile uses this single-page form.
  if (!existing) return <OnboardingWizard />;
  return <EditProfileForm />;
}

function EditProfileForm() {
  const existing = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: existing?.name ?? '',
    age: existing?.age ?? 28,
    sex: (existing?.sex ?? 'male') as Sex,
    heightCm: existing?.heightCm ?? 175,
    weightKg: existing?.weightKg ?? 75,
    goal: (existing?.goal ?? 'build_muscle') as Goal,
    targetWeightKg: existing?.targetWeightKg ?? 75,
    timeframeWeeks: existing?.timeframeWeeks ?? 12,
    expectations:
      existing?.expectations ?? '',
    activityLevel: (existing?.activityLevel ?? 'moderate') as ActivityLevel,
    preferredDaysPerWeek: existing?.preferredDaysPerWeek ?? 4,
    unitSystem: (existing?.unitSystem ?? 'metric') as UnitSystem,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const profile: Profile = {
      ...form,
      age: Number(form.age),
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      targetWeightKg: Number(form.targetWeightKg),
      timeframeWeeks: Number(form.timeframeWeeks),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    setProfile(profile);
    navigate('/');
  }

  const preview: Profile = {
    ...form,
    age: Number(form.age),
    heightCm: Number(form.heightCm),
    weightKg: Number(form.weightKg),
    targetWeightKg: Number(form.targetWeightKg),
    timeframeWeeks: Number(form.timeframeWeeks),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  const targets = form.heightCm && form.weightKg && form.age ? planDailyTargets(preview) : null;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        Edit Profile
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        This powers your calorie & macro targets and personalizes your dashboard.
      </p>

      <form onSubmit={submit} className="space-y-6">
        <Card title="About you">
          <div className="flex justify-end mb-4">
            <UnitToggle value={form.unitSystem} onChange={(unitSystem) => setForm((f) => ({ ...f, unitSystem }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Name">
                <input
                  required
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe"
                />
              </Field>
            </div>
            <Field label="Age">
              <input
                required
                type="number"
                min={13}
                max={100}
                className={inputCls}
                value={form.age}
                onChange={(e) => setForm((f) => ({ ...f, age: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Sex">
              <select
                className={inputCls}
                value={form.sex}
                onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value as Sex }))}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Height">
              <HeightInput
                valueCm={form.heightCm}
                onChangeCm={(heightCm) => setForm((f) => ({ ...f, heightCm: heightCm === '' ? 0 : heightCm }))}
                unit={form.unitSystem}
              />
            </Field>
            <Field label="Current Weight">
              <WeightInput
                valueKg={form.weightKg}
                onChangeKg={(weightKg) => setForm((f) => ({ ...f, weightKg: weightKg === '' ? 0 : weightKg }))}
                unit={form.unitSystem}
              />
            </Field>
          </div>
        </Card>

        <Card title="Your goal">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Primary goal">
                <select
                  className={inputCls}
                  value={form.goal}
                  onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value as Goal }))}
                >
                  {GOALS.map((g) => (
                    <option key={g} value={g}>{GOAL_LABELS[g]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Target weight">
              <WeightInput
                valueKg={form.targetWeightKg}
                onChangeKg={(targetWeightKg) => setForm((f) => ({ ...f, targetWeightKg: targetWeightKg === '' ? 0 : targetWeightKg }))}
                unit={form.unitSystem}
              />
            </Field>
            <Field label="Timeframe (weeks)">
              <input
                type="number"
                min={1}
                max={104}
                className={inputCls}
                value={form.timeframeWeeks}
                onChange={(e) => setForm((f) => ({ ...f, timeframeWeeks: Number(e.target.value) }))}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Activity level">
                <select
                  className={inputCls}
                  value={form.activityLevel}
                  onChange={(e) => setForm((f) => ({ ...f, activityLevel: e.target.value as ActivityLevel }))}
                >
                  {ACTIVITIES.map((a) => (
                    <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="How many days a week can you train?">
                <input
                  type="number"
                  min={1}
                  max={7}
                  className={inputCls}
                  value={form.preferredDaysPerWeek}
                  onChange={(e) => setForm((f) => ({ ...f, preferredDaysPerWeek: Number(e.target.value) }))}
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="What do you expect to achieve? (optional notes)">
                <textarea
                  className={inputCls}
                  rows={3}
                  value={form.expectations}
                  onChange={(e) => setForm((f) => ({ ...f, expectations: e.target.value }))}
                  placeholder="e.g. Lose 5kg and feel stronger in daily life, be able to do 10 pull-ups, run a 5k..."
                />
              </Field>
            </div>
          </div>
        </Card>

        {targets && (
          <Card title="Your calculated daily targets" className="bg-orange-50/60 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{targets.calories}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>kcal / day</p>
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{targets.proteinG}g</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>protein</p>
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{targets.carbsG}g</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>carbs</p>
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{targets.fatG}g</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>fat</p>
              </div>
            </div>
            <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
              BMI: {bmi(preview).toFixed(1)} — targets recalculate automatically as your weight & activity change.
            </p>
            <TargetPlanNote profile={preview} plan={targets} />
          </Card>
        )}

        <button
          type="submit"
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-full transition-colors"
        >
          Save Changes
        </button>
      </form>

      {existing && <DataSection />}
    </div>
  );
}

function DataSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleExport() {
    setBusy('export');
    setMessage(null);
    try {
      await exportAllData();
      setMessage({ type: 'success', text: 'Backup downloaded.' });
    } catch {
      setMessage({ type: 'error', text: 'Export failed — please try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('import');
    setMessage(null);
    try {
      await importAllData(file);
      window.location.reload();
    } catch {
      setMessage({ type: 'error', text: 'That file doesn’t look like a valid FitTrack backup.' });
      setBusy(null);
    }
  }

  return (
    <Card title="Your Data" className="mt-6">
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Everything is stored locally in this browser. Export a backup to keep it safe or move it to another
        device/browser, then import it there.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleExport}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium disabled:opacity-50"
        >
          {busy === 'export' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export backup
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium disabled:opacity-50"
        >
          {busy === 'import' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Import backup
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
      </div>
      {message && (
        <p className={`text-sm mt-3 ${message.type === 'error' ? 'text-red-500' : 'text-orange-600 dark:text-orange-400'}`}>
          {message.text}
        </p>
      )}
      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
        Importing replaces all current data in this browser with the contents of the backup file.
      </p>
    </Card>
  );
}

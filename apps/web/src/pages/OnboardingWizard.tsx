import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Check } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { ActivityLevel, Goal, Profile, Sex, UnitSystem } from '@fittrack/shared';
import { ACTIVITY_LABELS, GOAL_LABELS, planDailyTargets } from '@fittrack/shared';
import TargetPlanNote from '../components/TargetPlanNote';
import WeightInput from '../components/ui/WeightInput';
import HeightInput from '../components/ui/HeightInput';
import UnitToggle from '../components/ui/UnitToggle';

const GOALS: Goal[] = ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance', 'general_health'];
const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

const inputCls =
  'w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500';

interface WizardForm {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  targetWeightKg: number;
  timeframeWeeks: number;
  expectations: string;
  activityLevel: ActivityLevel;
  preferredDaysPerWeek: number;
  unitSystem: UnitSystem;
}

const STEP_COUNT = 8;

export default function OnboardingWizard() {
  const setProfile = useAppStore((s) => s.setProfile);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>({
    name: '',
    age: 28,
    sex: 'male',
    heightCm: 175,
    weightKg: 75,
    goal: 'build_muscle',
    targetWeightKg: 75,
    timeframeWeeks: 12,
    expectations: '',
    activityLevel: 'moderate',
    preferredDaysPerWeek: 4,
    unitSystem: 'metric',
  });

  function patch(update: Partial<WizardForm>) {
    setForm((f) => ({ ...f, ...update }));
  }

  function finish() {
    const profile: Profile = { ...form, createdAt: new Date().toISOString() };
    setProfile(profile);
    navigate('/');
  }

  const canProceed = [
    form.name.trim().length > 0,
    true, // sex always has a default
    form.age >= 13 && form.age <= 100,
    form.heightCm >= 100 && form.heightCm <= 250 && form.weightKg >= 30 && form.weightKg <= 300,
    true, // goal always has a default
    true, // activity/days always have defaults
    form.targetWeightKg >= 30 && form.timeframeWeeks >= 1,
    true, // review
  ][step];

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 ${step === 0 ? 'invisible' : ''}`}
          aria-label="Back"
        >
          <ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} />
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === step ? 20 : 6,
                background: i <= step ? 'var(--brand-primary)' : 'var(--gridline)',
              }}
            />
          ))}
        </div>
        <div className="w-9" />
      </div>

      <div className="flex-1">
        {step === 0 && <StepName value={form.name} onChange={(name) => patch({ name })} />}
        {step === 1 && <StepSex value={form.sex} onChange={(sex) => patch({ sex })} />}
        {step === 2 && <StepAge value={form.age} onChange={(age) => patch({ age })} />}
        {step === 3 && (
          <StepBody
            heightCm={form.heightCm}
            weightKg={form.weightKg}
            unit={form.unitSystem}
            onHeight={(heightCm) => patch({ heightCm })}
            onWeight={(weightKg) => patch({ weightKg })}
            onUnit={(unitSystem) => patch({ unitSystem })}
          />
        )}
        {step === 4 && <StepGoal value={form.goal} onChange={(goal) => patch({ goal })} />}
        {step === 5 && (
          <StepActivity
            activityLevel={form.activityLevel}
            preferredDaysPerWeek={form.preferredDaysPerWeek}
            onActivity={(activityLevel) => patch({ activityLevel })}
            onDays={(preferredDaysPerWeek) => patch({ preferredDaysPerWeek })}
          />
        )}
        {step === 6 && (
          <StepTarget
            targetWeightKg={form.targetWeightKg}
            timeframeWeeks={form.timeframeWeeks}
            expectations={form.expectations}
            unit={form.unitSystem}
            onTargetWeight={(targetWeightKg) => patch({ targetWeightKg })}
            onTimeframe={(timeframeWeeks) => patch({ timeframeWeeks })}
            onExpectations={(expectations) => patch({ expectations })}
          />
        )}
        {step === 7 && <StepReview form={form} />}
      </div>

      <button
        onClick={() => (step === STEP_COUNT - 1 ? finish() : setStep((s) => s + 1))}
        disabled={!canProceed}
        className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 active:not-disabled:scale-[0.98] text-white font-semibold py-3.5 rounded-full transition-all mt-8"
      >
        {step === STEP_COUNT - 1 ? 'Start Tracking' : 'Continue'}
      </button>
    </div>
  );
}

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h1>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
    </div>
  );
}

function StepName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <StepHeader title="What's your name?" sub="So we can personalize your experience." />
      <input
        autoFocus
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jane Doe"
      />
    </div>
  );
}

function StepSex({ value, onChange }: { value: Sex; onChange: (v: Sex) => void }) {
  const options: { key: Sex; label: string }[] = [
    { key: 'male', label: 'Male' },
    { key: 'female', label: 'Female' },
    { key: 'other', label: 'Other' },
  ];
  return (
    <div>
      <StepHeader title="Tell us about yourself" sub="This helps us tailor your calorie targets." />
      <div className="space-y-3">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-medium transition-colors ${
              value === o.key
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30'
                : 'border-gray-200 dark:border-slate-800'
            }`}
            style={{ color: 'var(--text-primary)' }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepAge({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <StepHeader title="How old are you?" sub="This helps us create your personalized plan." />
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => onChange(Math.max(13, value - 1))}
          className="w-11 h-11 rounded-full border border-gray-300 dark:border-slate-700 flex items-center justify-center"
          aria-label="Decrease age"
        >
          <Minus size={18} style={{ color: 'var(--text-primary)' }} />
        </button>
        <span className="text-5xl font-bold w-24 text-center tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(100, value + 1))}
          className="w-11 h-11 rounded-full border border-gray-300 dark:border-slate-700 flex items-center justify-center"
          aria-label="Increase age"
        >
          <Plus size={18} style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>
    </div>
  );
}

function StepBody({
  heightCm,
  weightKg,
  unit,
  onHeight,
  onWeight,
  onUnit,
}: {
  heightCm: number;
  weightKg: number;
  unit: UnitSystem;
  onHeight: (cm: number) => void;
  onWeight: (kg: number) => void;
  onUnit: (u: UnitSystem) => void;
}) {
  return (
    <div>
      <StepHeader title="Height & weight" sub="Used to calculate your daily calorie and macro targets." />
      <div className="flex justify-end mb-4">
        <UnitToggle value={unit} onChange={onUnit} />
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Height</span>
          <HeightInput valueCm={heightCm} onChangeCm={(v) => onHeight(v === '' ? 0 : v)} unit={unit} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Current weight</span>
          <WeightInput valueKg={weightKg} onChangeKg={(v) => onWeight(v === '' ? 0 : v)} unit={unit} />
        </label>
      </div>
    </div>
  );
}

function StepGoal({ value, onChange }: { value: Goal; onChange: (g: Goal) => void }) {
  return (
    <div>
      <StepHeader title="What's your goal?" sub="This shapes your calorie targets and plan recommendations." />
      <div className="space-y-2.5">
        {GOALS.map((g) => (
          <button
            key={g}
            onClick={() => onChange(g)}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 font-medium transition-colors ${
              value === g ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' : 'border-gray-200 dark:border-slate-800'
            }`}
            style={{ color: 'var(--text-primary)' }}
          >
            {GOAL_LABELS[g]}
            {value === g && (
              <span className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center shrink-0">
                <Check size={13} className="text-white" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepActivity({
  activityLevel,
  preferredDaysPerWeek,
  onActivity,
  onDays,
}: {
  activityLevel: ActivityLevel;
  preferredDaysPerWeek: number;
  onActivity: (a: ActivityLevel) => void;
  onDays: (d: number) => void;
}) {
  return (
    <div>
      <StepHeader title="How active are you?" sub="We'll use this to fine-tune your calorie targets." />
      <div className="space-y-2.5 mb-6">
        {ACTIVITIES.map((a) => (
          <button
            key={a}
            onClick={() => onActivity(a)}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
              activityLevel === a ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' : 'border-gray-200 dark:border-slate-800'
            }`}
            style={{ color: 'var(--text-primary)' }}
          >
            {ACTIVITY_LABELS[a]}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          How many days a week can you train?
        </span>
        <input
          type="number"
          min={1}
          max={7}
          className={inputCls}
          value={preferredDaysPerWeek}
          onChange={(e) => onDays(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

function StepTarget({
  targetWeightKg,
  timeframeWeeks,
  expectations,
  unit,
  onTargetWeight,
  onTimeframe,
  onExpectations,
}: {
  targetWeightKg: number;
  timeframeWeeks: number;
  expectations: string;
  unit: UnitSystem;
  onTargetWeight: (kg: number) => void;
  onTimeframe: (weeks: number) => void;
  onExpectations: (v: string) => void;
}) {
  return (
    <div>
      <StepHeader title="Set your target" sub="What are you aiming for, and by when?" />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Target weight</span>
            <WeightInput valueKg={targetWeightKg} onChangeKg={(v) => onTargetWeight(v === '' ? 0 : v)} unit={unit} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Timeframe (weeks)</span>
            <input
              type="number"
              min={1}
              max={104}
              className={inputCls}
              value={timeframeWeeks}
              onChange={(e) => onTimeframe(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            What do you expect to achieve? (optional)
          </span>
          <textarea
            className={inputCls}
            rows={3}
            value={expectations}
            onChange={(e) => onExpectations(e.target.value)}
            placeholder="e.g. Lose 5kg and feel stronger in daily life, be able to do 10 pull-ups, run a 5k..."
          />
        </label>
      </div>
    </div>
  );
}

function StepReview({ form }: { form: WizardForm }) {
  const profile: Profile = { ...form, createdAt: new Date().toISOString() };
  const targets = planDailyTargets(profile);
  return (
    <div>
      <StepHeader title={`You're all set, ${form.name.split(' ')[0]}`} sub="Here's what we calculated for your daily targets." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 py-4">
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{targets.calories}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>kcal / day</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 py-4">
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{targets.proteinG}g</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>protein</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 py-4">
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{targets.carbsG}g</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>carbs</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 py-4">
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{targets.fatG}g</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>fat</p>
        </div>
      </div>
      <TargetPlanNote profile={profile} plan={targets} />
      <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
        You can fine-tune anything later from your Profile page.
      </p>
    </div>
  );
}

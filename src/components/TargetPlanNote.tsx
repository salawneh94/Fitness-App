import { AlertTriangle, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { Profile } from '../types';
import type { TargetPlan } from '../lib/calc';
import { displayWeight, weightUnitLabel } from '../lib/units';

/**
 * Explains where the calorie number came from.
 *
 * The target is derived from the user's own goal weight and timeframe, so it should be visible
 * what pace that implies — and, when the requested pace isn't safe, what the plan does instead
 * rather than silently producing a different number.
 */
export default function TargetPlanNote({ profile, plan }: { profile: Profile; plan: TargetPlan }) {
  const unit = profile.unitSystem;
  const label = weightUnitLabel(unit);

  const rate = displayWeight(Math.abs(plan.appliedWeeklyRateKg), unit);
  const rateText = `${rate.toFixed(2)} ${label}/week`;
  const losing = plan.appliedWeeklyRateKg < -0.001;
  const gaining = plan.appliedWeeklyRateKg > 0.001;

  const Icon = losing ? TrendingDown : gaining ? TrendingUp : Minus;

  let headline: string;
  if (losing) headline = `Losing about ${rateText}`;
  else if (gaining) headline = `Gaining about ${rateText}`;
  else headline = 'Holding your current weight';

  const targetText =
    profile.targetWeightKg != null
      ? `${displayWeight(profile.targetWeightKg, unit).toFixed(1)} ${label}`
      : null;

  let detail: string | null = null;
  if (plan.projectedWeeks != null && targetText) {
    detail = `Reaching ${targetText} in about ${plan.projectedWeeks} week${plan.projectedWeeks === 1 ? '' : 's'}.`;
  }

  let warning: string | null = null;
  if (plan.hitCalorieFloor) {
    warning =
      'Your timeframe would require eating less than is safe, so calories are held at a healthy minimum and the timeline is stretched instead.';
  } else if (plan.rateWasCapped) {
    const requested = displayWeight(Math.abs(plan.requestedWeeklyRateKg), unit).toFixed(2);
    warning = `That timeframe asks for ${requested} ${label}/week, which is faster than is safe to sustain. The plan uses ${rateText} instead — adjust your timeframe to match.`;
  }

  return (
    <div className="mt-4 pt-4 border-t border-orange-200/70 dark:border-orange-900/60">
      <div className="flex items-start gap-2">
        <Icon size={16} className="shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {headline}
          </p>
          {detail && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {detail}
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Maintenance is about {plan.tdee} kcal/day for your body and activity level.
          </p>
        </div>
      </div>

      {warning && (
        <div className="flex items-start gap-2 mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{warning}</p>
        </div>
      )}
    </div>
  );
}

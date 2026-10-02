import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { Profile, WorkoutLogEntry } from '@fittrack/shared';
import { colors, displayDistance, distanceUnitLabel, formatDistance, parseISODate, todayISO, weeklyCardio } from '@fittrack/shared';
import Card from './ui/card';
import SimpleBarChart from './charts/simple-bar-chart';
import PressableScale from './ui/pressable-scale';
import LogCardioModal from './log-cardio-modal';

/**
 * Eight weeks of cardio: distance per week, and this week in words.
 *
 * Shown to anyone who has logged cardio, and — with an empty state and a way in — to anyone whose
 * goal is endurance, for whom it's the chart that matters most.
 */
export default function CardioCard({ profile, workoutLogs }: { profile: Profile; workoutLogs: WorkoutLogEntry[] }) {
  const [logging, setLogging] = useState(false);
  const unit = profile.unitSystem;
  const weeks = useMemo(() => weeklyCardio(workoutLogs, todayISO(), 8), [workoutLogs]);
  const anyCardio = useMemo(() => workoutLogs.some((l) => (l.cardio?.length ?? 0) > 0), [workoutLogs]);
  if (!anyCardio && profile.goal !== 'improve_endurance') return null;

  const thisWeek = weeks[weeks.length - 1];
  const hasDistance = weeks.some((w) => w.distanceKm > 0);
  // Weeks with time but no distance (a spin class, a rope session) still count — chart minutes then.
  const data = weeks.map((w) => ({
    label: parseISODate(w.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: hasDistance ? Math.round(displayDistance(w.distanceKm, unit) * 10) / 10 : w.minutes,
  }));

  return (
    <Card
      title="Cardio"
      action={
        <PressableScale hapticStyle="selection" accessibilityRole="button" onPress={() => setLogging(true)}>
          <Text className="text-xs font-semibold" style={{ color: colors.brandPrimary }}>
            + Log
          </Text>
        </PressableScale>
      }
    >
      {!anyCardio ? (
        <Text className="text-sm" style={{ color: colors.textMuted }}>
          Log a run, ride or swim and your weekly distance builds up here.
        </Text>
      ) : (
        <>
          <Text className="text-sm mb-3" style={{ color: colors.textSecondary }}>
            This week:{' '}
            <Text className="font-semibold" style={{ color: colors.textPrimary }}>
              {[thisWeek.distanceKm > 0 ? formatDistance(thisWeek.distanceKm, unit) : null, `${thisWeek.minutes} min`, `${thisWeek.sessions} ${thisWeek.sessions === 1 ? 'session' : 'sessions'}`]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Text>
          <Text className="text-[11px] uppercase tracking-wide mb-1" style={{ color: colors.textMuted }}>
            {hasDistance ? `${distanceUnitLabel(unit)} per week` : 'minutes per week'}
          </Text>
          <SimpleBarChart data={data} color={colors.series3} />
        </>
      )}
      {logging && <LogCardioModal onClose={() => setLogging(false)} />}
    </Card>
  );
}

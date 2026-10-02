import { describe, expect, it } from 'vitest';
import { canMakeUpToday, isCustomised, mondayOf, planBlock, planWeekNumber, weekOverview } from './planProgress';
import { PLAN_TEMPLATES } from './data/planTemplates';
import type { ScheduledWorkout, WorkoutLogEntry } from './types';

// 2026-10-02 is a Friday.
const FRI = '2026-10-02';

const sched = (day: ScheduledWorkout['day'], name: string): ScheduledWorkout => ({ id: day, day, name, exercises: [] });
const log = (date: string, workoutName = 'Any'): WorkoutLogEntry => ({ id: `${date}-${workoutName}`, date, workoutName, durationMin: 45 });
const schedule = [sched('Mon', 'Upper'), sched('Wed', 'Lower'), sched('Fri', 'Upper'), sched('Sat', 'Lower')];

describe('mondayOf', () => {
  it('finds the Monday of the week, across month and year boundaries', () => {
    expect(mondayOf(FRI)).toBe('2026-09-28');
    expect(mondayOf('2026-09-28')).toBe('2026-09-28'); // Monday itself
    expect(mondayOf('2026-10-04')).toBe('2026-09-28'); // Sunday belongs to the week before it
    expect(mondayOf('2027-01-02')).toBe('2026-12-28');
  });
});

describe('planWeekNumber', () => {
  it('counts calendar weeks from the start', () => {
    expect(planWeekNumber(FRI, FRI)).toBe(1);
    expect(planWeekNumber('2026-09-28', '2026-10-04')).toBe(1);
    expect(planWeekNumber('2026-09-14', FRI)).toBe(3);
  });

  it('turns over on Monday, even for a plan started late in a week', () => {
    // Started Thursday; the schedule starts over the following Monday — week 2.
    expect(planWeekNumber('2026-10-01', '2026-10-04')).toBe(1);
    expect(planWeekNumber('2026-10-01', '2026-10-05')).toBe(2);
  });

  it('is never below 1, even with a start date in the future', () => {
    expect(planWeekNumber('2026-11-01', FRI)).toBe(1);
  });

  it('survives a daylight-saving change inside the span', () => {
    // Europe and the US both shift clocks between these dates; pure date arithmetic must not care.
    expect(planWeekNumber('2026-03-02', '2026-04-06')).toBe(6);
    expect(planWeekNumber('2026-10-19', '2026-11-09')).toBe(4);
  });
});

describe('weekOverview', () => {
  it('marks each day against what was logged', () => {
    const w = weekOverview(schedule, [log('2026-09-28'), log('2026-10-02')], FRI);
    expect(w.days.map((d) => `${d.day}:${d.status}`)).toEqual([
      'Mon:done', 'Tue:rest', 'Wed:missed', 'Thu:rest', 'Fri:done', 'Sat:upcoming', 'Sun:rest',
    ]);
    expect([w.planned, w.done, w.extras]).toEqual([4, 2, 0]);
  });

  it('shows today as still to do until something is logged', () => {
    const w = weekOverview(schedule, [], FRI);
    expect(w.days[4].status).toBe('today');
    expect(w.next).toEqual({ day: 'Fri', date: FRI, workoutName: 'Upper' });
  });

  it('counts any session on a scheduled day as done, and unscheduled sessions as extras', () => {
    const w = weekOverview(schedule, [log('2026-09-29'), log('2026-09-30')], FRI);
    expect(w.days[1]).toMatchObject({ day: 'Tue', status: 'done', extra: true });
    expect(w.days[2]).toMatchObject({ day: 'Wed', status: 'done', extra: false });
    expect([w.done, w.extras]).toEqual([1, 1]);
  });

  it('ignores sessions from other weeks', () => {
    const w = weekOverview(schedule, [log('2026-09-21'), log('2026-10-05')], FRI);
    expect(w.done).toBe(0);
  });

  it('points to next week once this week’s sessions are behind it', () => {
    const w = weekOverview(schedule, [], '2026-10-04'); // Sunday
    expect(w.next).toEqual({ day: 'Mon', date: '2026-10-05', workoutName: 'Upper' });
  });

  it('has no next session without a schedule', () => {
    const w = weekOverview([], [log(FRI)], FRI);
    expect(w.next).toBeNull();
    expect([w.planned, w.done, w.extras]).toEqual([0, 0, 1]);
  });
});

describe('isCustomised', () => {
  const template = PLAN_TEMPLATES[0];
  const asBuilt = template.days.map((d, i) => sched((['Mon', 'Wed', 'Fri', 'Sat', 'Sun', 'Tue', 'Thu'] as const)[i], d.focus));

  it('is false for the schedule exactly as the template builds it', () => {
    expect(isCustomised(template, asBuilt)).toBe(false);
  });

  it('notices a renamed, removed or added session', () => {
    expect(isCustomised(template, [{ ...asBuilt[0], name: 'Push day' }, ...asBuilt.slice(1)])).toBe(true);
    expect(isCustomised(template, asBuilt.slice(1))).toBe(true);
    expect(isCustomised(template, [...asBuilt, sched('Sun', 'Cardio')])).toBe(true);
  });

  it('does not count moving a session to another day as customising it', () => {
    expect(isCustomised(template, [{ ...asBuilt[0], day: 'Tue' }, ...asBuilt.slice(1)])).toBe(false);
  });
});

describe('making up a missed session', () => {
  it('counts a later session with the missed workout’s name as making it up', () => {
    // Wednesday's Lower missed; done on Thursday (a rest day) instead.
    const w = weekOverview(schedule, [log('2026-09-28', 'Upper'), log('2026-10-01', 'Lower')], FRI);
    expect(w.days[2]).toMatchObject({ day: 'Wed', status: 'made_up', madeUpOn: '2026-10-01' });
    // Thursday's session is spoken for — it isn't also an extra.
    expect(w.days[3]).toMatchObject({ day: 'Thu', status: 'rest', extra: false });
    expect([w.done, w.extras]).toEqual([2, 0]);
    expect(w.missed).toEqual([]);
  });

  it('needs the name to match — a different session on a rest day is an extra, and the miss stands', () => {
    const w = weekOverview(schedule, [log('2026-09-28', 'Upper'), log('2026-10-01', 'Easy run')], FRI);
    expect(w.days[2].status).toBe('missed');
    expect(w.days[3]).toMatchObject({ status: 'done', extra: true });
    expect(w.missed).toEqual([{ day: 'Wed', date: '2026-09-30', workoutName: 'Lower' }]);
  });

  it('cannot be made up before it was missed', () => {
    // A Lower logged Monday is Monday's session (any session counts), not Wednesday's in advance.
    const w = weekOverview(schedule, [log('2026-09-28', 'Lower')], FRI);
    expect(w.days[0].status).toBe('done');
    expect(w.days[2].status).toBe('missed');
  });

  it('uses each session once: one make-up for two misses of the same workout', () => {
    const twoLowers = [sched('Mon', 'Lower'), sched('Wed', 'Lower')];
    const w = weekOverview(twoLowers, [log('2026-10-01', 'Lower')], FRI);
    expect(w.days[0].status).toBe('made_up');
    expect(w.days[2].status).toBe('missed');
    expect(w.done).toBe(1);
  });

  it('prefers a day’s own workout when two sessions land on it', () => {
    // Friday: today's Upper plus a make-up of Wednesday's Lower.
    const w = weekOverview(schedule, [log(FRI, 'Lower'), log(FRI, 'Upper')], FRI);
    expect(w.days[4].status).toBe('done');
    expect(w.days[2]).toMatchObject({ status: 'made_up', madeUpOn: FRI });
    expect(w.extras).toBe(0);
  });
});

describe('canMakeUpToday', () => {
  it('only on a free day', () => {
    const thursday = '2026-10-01';
    expect(canMakeUpToday(weekOverview(schedule, [], thursday), thursday)).toBe(true);
    // Something already trained today.
    expect(canMakeUpToday(weekOverview(schedule, [log(thursday, 'Easy run')], thursday), thursday)).toBe(false);
    // Today has its own session — to do, or done.
    expect(canMakeUpToday(weekOverview(schedule, [], FRI), FRI)).toBe(false);
    expect(canMakeUpToday(weekOverview(schedule, [log(FRI, 'Upper')], FRI), FRI)).toBe(false);
  });
});

describe('planBlock', () => {
  const ul = PLAN_TEMPLATES.find((t) => t.id === 'upper-lower')!;
  it('reports the week against the template length, and completion after the last week', () => {
    expect(planBlock(ul, '2026-09-14', FRI)).toEqual({ week: 3, of: 10, complete: false });
    expect(planBlock(ul, '2026-07-27', FRI)).toEqual({ week: 10, of: 10, complete: false }); // last week
    expect(planBlock(ul, '2026-07-20', FRI)).toEqual({ week: 11, of: 10, complete: true });
  });

  it('every template has a sensible length', () => {
    for (const t of PLAN_TEMPLATES) expect(t.weeks).toBeGreaterThanOrEqual(4);
  });
});

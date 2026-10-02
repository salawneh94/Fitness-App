import { describe, expect, it } from 'vitest';
import { parseISODate, withinLastDays } from './calc';

describe('withinLastDays', () => {
  it('includes today and the six days before for a 7-day window', () => {
    expect(withinLastDays('2026-10-02', '2026-10-02', 7)).toBe(true);
    expect(withinLastDays('2026-09-26', '2026-10-02', 7)).toBe(true);
    expect(withinLastDays('2026-09-25', '2026-10-02', 7)).toBe(false);
    expect(withinLastDays('2026-10-03', '2026-10-02', 7)).toBe(false); // not the future
  });
});

describe('parseISODate', () => {
  // The bug it exists to prevent: new Date('2026-10-02') is UTC midnight, which renders as
  // October 1st anywhere west of Greenwich. Run under any TZ, this must still be the 2nd.
  it('is the same calendar day in the local timezone', () => {
    const d = parseISODate('2026-10-02');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 10, 2]);
  });
});

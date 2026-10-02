import { describe, expect, it } from 'vitest';
import { formatWater, waterQuickAddsMl, waterTargetMl } from './water';

describe('waterTargetMl', () => {
  it('is the drinks share of the EFSA adequate intake, rounded to 250 ml', () => {
    expect(waterTargetMl('male', false)).toBe(2000); // 2.5 L × 0.8
    expect(waterTargetMl('female', false)).toBe(1500); // 2.0 L × 0.8 = 1600 → 1500
    expect(waterTargetMl('other', false)).toBe(1750); // 2.25 L × 0.8 = 1800 → 1750
  });

  it('adds half a litre on a training day', () => {
    expect(waterTargetMl('male', true)).toBe(2500);
    expect(waterTargetMl('female', true)).toBe(2000); // 2100 → 2000
  });
});

describe('water units', () => {
  it('offers a glass and a bottle in the user’s units', () => {
    expect(waterQuickAddsMl('metric')).toEqual([250, 500]);
    expect(waterQuickAddsMl('imperial')).toEqual([237, 500]);
  });

  it('formats litres above 1 L, ml below, and fl oz for imperial', () => {
    expect(formatWater(750, 'metric')).toBe('750 ml');
    expect(formatWater(1250, 'metric')).toBe('1.25 L'); // not "1.3 L"
    expect(formatWater(1750, 'metric')).toBe('1.75 L');
    expect(formatWater(2000, 'metric')).toBe('2 L');
    expect(formatWater(500, 'imperial')).toBe('17 fl oz');
  });
});

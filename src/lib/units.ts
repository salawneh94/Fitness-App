import type { UnitSystem } from '../types';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function inToCm(inch: number): number {
  return inch * CM_PER_IN;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cmToIn(cm);
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inToCm(feet * 12 + inches);
}

export function weightUnitLabel(unit: UnitSystem): string {
  return unit === 'imperial' ? 'lb' : 'kg';
}

export function displayWeight(kg: number, unit: UnitSystem): number {
  return unit === 'imperial' ? kgToLb(kg) : kg;
}

export function toKgFromDisplay(value: number, unit: UnitSystem): number {
  return unit === 'imperial' ? lbToKg(value) : value;
}

export function formatWeight(kg: number, unit: UnitSystem, digits = 1): string {
  const value = displayWeight(kg, unit);
  return `${value.toFixed(digits)} ${weightUnitLabel(unit)}`;
}

export function formatHeight(cm: number, unit: UnitSystem): string {
  if (unit === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}

export function lengthUnitLabel(unit: UnitSystem): string {
  return unit === 'imperial' ? 'in' : 'cm';
}

export function displayLength(cm: number, unit: UnitSystem): number {
  return unit === 'imperial' ? cmToIn(cm) : cm;
}

export function toCmFromDisplay(value: number, unit: UnitSystem): number {
  return unit === 'imperial' ? inToCm(value) : value;
}

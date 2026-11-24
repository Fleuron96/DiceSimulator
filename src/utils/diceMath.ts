import { RollMode } from '../types/dice';

export const HOUSE_EDGE_PCT = 1; // 1 %
export const RTP_PCT = 99; // 99 %
export const MIN_WIN_CHANCE = 0.01;
export const MAX_WIN_CHANCE = 98.99;
export const MIN_BET = 0.00000001;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function round8(value: number): number {
  return Math.round((value + Number.EPSILON) * 100000000) / 100000000;
}

export function clampWinChance(chance: number): number {
  if (!Number.isFinite(chance)) return 49.5;
  return round4(Math.min(MAX_WIN_CHANCE, Math.max(MIN_WIN_CHANCE, chance)));
}

/**
 * Computes Multiplier M = 99 / P (strict 1% House Edge)
 */
export function multiplierFromChance(winChance: number): number {
  const safeChance = clampWinChance(winChance);
  return round4(RTP_PCT / safeChance);
}

/**
 * Computes Win Chance P = 99 / M (strict 1% House Edge)
 */
export function chanceFromMultiplier(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 1) {
    return MAX_WIN_CHANCE;
  }
  return clampWinChance(RTP_PCT / multiplier);
}

/**
 * Computes target number C from winChance P and roll mode.
 * - Lancer au Dessus (over): C = 100 - P
 * - Lancer en Dessous (under): C = P
 */
export function targetFromChance(winChance: number, mode: RollMode): number {
  const safeChance = clampWinChance(winChance);
  const raw = mode === 'over' ? 100 - safeChance : safeChance;
  return round4(raw);
}

/**
 * Computes winChance P from target number C and roll mode.
 */
export function chanceFromTarget(target: number, mode: RollMode): number {
  const rawChance = mode === 'over' ? 100 - target : target;
  return clampWinChance(rawChance);
}

export function formatTargetDisplay(target: number): string {
  const r2 = round2(target);
  if (Math.abs(target - r2) < 0.0005) {
    return r2.toFixed(2);
  }
  return target.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatRollDisplay(rollValue: number, target: number): string {
  const r2 = round2(rollValue);
  if (Math.abs(rollValue - target) < 0.01 && Math.abs(r2 - target) < 0.005) {
    return rollValue.toFixed(4);
  }
  return Math.min(99.99, Math.max(0, r2)).toFixed(2);
}

export function formatCrypto(amount: number): string {
  if (!Number.isFinite(amount)) return '0.00000000';
  return amount.toFixed(8);
}

export function formatCompactCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '0,00 $US';
  return (
    amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' $US'
  );
}

/**
 * Deterministic PRNG utilities (xmur3 hash + mulberry32)
 */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(seedInt: number): () => number {
  let a = seedInt >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed?: string): () => number {
  if (seed && seed.trim().length > 0) {
    const seedGen = xmur3(seed.trim());
    return mulberry32(seedGen());
  }
  return () => Math.random();
}

/**
 * Generates a calibrated Dice roll in [0, 100) with 4-decimal resolution
 * so that P(roll > 100 - P) = P/100 in 'over' mode and P(roll < P) = P/100 in 'under' mode.
 */
export function generateDiceRoll(rng: () => number): number {
  return Math.floor(rng() * 1000000) / 10000;
}

export function evaluateRollWin(
  rollValue: number,
  winChance: number,
  mode: RollMode
): boolean {
  const target = mode === 'over' ? 100 - winChance : winChance;
  return mode === 'over' ? rollValue > target : rollValue < target;
}

export function generateRandomSeed(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'STAKE-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

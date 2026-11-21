// Series de aproximación (calentamiento) y calculadora de discos para la barra.
import type { Exercise } from './exercises';

export interface WarmupSet {
  weight: number;
  reps: number;
  label: string;
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Calentamiento progresivo antes de la primera serie de trabajo de un ejercicio compuesto:
 * - Barra: barra vacía ×10 → 50 % ×5 → 70 % ×3 → 85 % ×1 (este último solo si la carga es alta).
 * - Mancuernas o máquinas: 50 % ×8 → 75 % ×4.
 * No hace falta en aislamientos ni con cargas ligeras: la primera serie ya sirve de calentamiento.
 * Las series de aproximación no cuentan como series efectivas.
 */
export function warmupSets(ex: Pick<Exercise, 'compound' | 'equipment' | 'loadStep'>, workWeight: number, barWeight = 20): WarmupSet[] {
  if (!ex.compound || workWeight <= 0) return [];
  const barbell = ex.equipment.includes('barra');
  if (barbell) {
    if (workWeight <= barWeight * 1.6) return workWeight > barWeight ? [{ weight: barWeight, reps: 10, label: 'Barra vacía' }] : [];
    const step = 2.5; // dos discos de 1.25 kg
    const out: WarmupSet[] = [{ weight: barWeight, reps: 10, label: 'Barra vacía' }];
    for (const [pct, reps] of [
      [0.5, 5],
      [0.7, 3],
      [0.85, 1],
    ] as const) {
      if (pct === 0.85 && workWeight < 60) continue;
      const w = Math.max(barWeight, roundTo(workWeight * pct, step));
      if (w > out[out.length - 1].weight && w < workWeight) out.push({ weight: w, reps, label: `${Math.round(pct * 100)} %` });
    }
    return out;
  }
  const step = ex.loadStep > 0 ? ex.loadStep : 1;
  if (workWeight < step * 4) return [];
  return [
    { weight: Math.max(step, roundTo(workWeight * 0.5, step)), reps: 8, label: '50 %' },
    { weight: Math.max(step, roundTo(workWeight * 0.75, step)), reps: 4, label: '75 %' },
  ].filter((s, i, a) => s.weight < workWeight && (i === 0 || s.weight > a[i - 1].weight));
}

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateResult {
  perSide: number[]; // discos por lado, de mayor a menor
  achieved: number; // peso total real con esos discos
  remainder: number; // diferencia con el objetivo (si no se puede exacto)
}

/** Discos por lado para llegar a un peso total (algoritmo voraz con discos en pares). */
export function platesFor(total: number, barWeight = 20, plates: number[] = DEFAULT_PLATES): PlateResult {
  let side = Math.max(0, (total - barWeight) / 2);
  const perSide: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side + 1e-9 >= p) {
      perSide.push(p);
      side -= p;
    }
  }
  const achieved = Math.round((barWeight + 2 * perSide.reduce((a, b) => a + b, 0)) * 100) / 100;
  return { perSide, achieved, remainder: Math.round((total - achieved) * 100) / 100 };
}

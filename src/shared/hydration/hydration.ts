// Hidratación orientativa. No existe una cantidad universal obligatoria: la sed, el color de la orina,
// el clima y la actividad son las guías principales.
import type { Profile, SweatLevel, WaterLog } from '../types';
import { isBlocked, type SafetyFlag } from '../safety/screening';
import { round } from '../utils';

export interface HydrationTarget {
  baseMl: number;
  exerciseMl: number;
  heatMl: number;
  totalMl: number;
  restricted: boolean;
  electrolytes: { recommended: boolean; reason: string };
  notes: string[];
}

const SWEAT_L_PER_H: Record<SweatLevel, number> = { bajo: 0.4, medio: 0.6, alto: 0.8 };

/**
 * Base: ingesta adecuada de agua total EFSA (2.5 L hombres / 2.0 L mujeres), de la cual ~20 % proviene
 * de los alimentos → bebidas ≈ 2.0 / 1.6 L, escalada suavemente por peso corporal.
 * Ejercicio: reponer ~0.4–0.8 L por hora según sudoración (ACSM 2007), sin buscar reponer el 100 %.
 * Calor: +250 ml (25–30 °C) o +500 ml (> 30 °C).
 */
export function hydrationTarget(p: Pick<Profile, 'sex' | 'weightKg' | 'sweatLevel' | 'ambientTempC' | 'fluidRestrictionMl'>, trainingMinutes: number, flags: SafetyFlag[]): HydrationTarget {
  const notes: string[] = [];
  const baseRef = p.sex === 'hombre' ? 2000 : 1600;
  const refKg = p.sex === 'hombre' ? 75 : 62;
  const scale = Math.min(1.25, Math.max(0.85, p.weightKg / refKg));
  const baseMl = Math.round((baseRef * scale) / 50) * 50;
  const exerciseMl = Math.round((SWEAT_L_PER_H[p.sweatLevel] * 1000 * (trainingMinutes / 60)) / 50) * 50;
  const heatMl = p.ambientTempC > 30 ? 500 : p.ambientTempC >= 25 ? 250 : 0;
  let total = baseMl + exerciseMl + heatMl;
  const restricted = isBlocked(flags, 'hidratacion') || !!p.fluidRestrictionMl;
  if (p.fluidRestrictionMl) {
    total = p.fluidRestrictionMl;
    notes.push(`Meta fijada por la restricción indicada por tu médico (${p.fluidRestrictionMl} ml).`);
  } else if (restricted) {
    notes.push('Tienes una condición en la que la cantidad de líquidos debe indicarla tu médico. La cifra mostrada es solo una referencia general.');
  }
  notes.push('Es una guía orientativa: bebe según tu sed y observa que tu orina sea de color amarillo pálido.');
  notes.push('No bebas más de ~1 L por hora de forma sostenida: el exceso de agua puede causar hiponatremia.');
  const longSession = trainingMinutes >= 75;
  const hot = p.ambientTempC >= 28;
  const recommended = !restricted && ((longSession && p.sweatLevel !== 'bajo') || (hot && p.sweatLevel === 'alto' && trainingMinutes >= 45));
  return {
    baseMl,
    exerciseMl,
    heatMl,
    totalMl: Math.round(total / 50) * 50,
    restricted,
    electrolytes: {
      recommended,
      reason: recommended
        ? 'Sesión prolongada o calurosa con sudoración relevante: un aporte de sodio (≈300–600 mg/h, o una comida salada) puede ayudar.'
        : restricted
          ? 'Con tu condición, cualquier electrolito debe indicarlo tu médico.'
          : 'No es necesario: tu alimentación habitual cubre los electrolitos en sesiones de < 60–75 min.',
    },
    notes,
  };
}

export function dayWaterTotal(logs: WaterLog[], date: string): number {
  return logs.filter((l) => l.date === date).reduce((a, l) => a + l.ml, 0);
}

export function hourlyDistribution(logs: WaterLog[], date: string): { hour: number; ml: number }[] {
  const map = new Map<number, number>();
  for (const l of logs.filter((x) => x.date === date)) {
    const h = Number(l.time.slice(0, 2));
    map.set(h, (map.get(h) ?? 0) + l.ml);
  }
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, ml: map.get(h) ?? 0 }));
}

export const QUICK_AMOUNTS = [
  { label: 'Vaso', ml: 250 },
  { label: 'Taza', ml: 350 },
  { label: 'Botella chica', ml: 500 },
  { label: 'Botella grande', ml: 1000 },
];

export function pctOf(v: number, t: number) {
  return t > 0 ? round(Math.min(100, (v / t) * 100)) : 0;
}

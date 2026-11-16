// Cardio y actividad diaria. Distingue cardio de entrenamiento de fuerza y NO convierte el gasto estimado
// en calorías adicionales para comer.
import type { CardioFitness, CardioLog, CardioModality, Profile, StepsLog } from '../types';
import { affected, isBlocked, type SafetyFlag } from '../safety/screening';
import { addDays, mean, round, weekStart } from '../utils';

export const MODALITY_LABEL: Record<CardioModality, string> = {
  caminata: 'Caminata',
  bicicleta_estatica: 'Bicicleta estática',
  ciclismo: 'Ciclismo',
  caminadora: 'Caminadora',
  eliptica: 'Elíptica',
  remo: 'Remo',
  natacion: 'Natación',
  otro: 'Otro',
};

/** MET aproximados (Compendio de Actividades Físicas, Ainsworth 2011) por modalidad e intensidad. */
const MET: Record<CardioModality, Record<CardioLog['intensity'], number>> = {
  caminata: { baja: 3.0, moderada: 3.8, alta: 5.0, intervalos: 5.0 },
  caminadora: { baja: 3.5, moderada: 4.3, alta: 6.0, intervalos: 7.0 },
  bicicleta_estatica: { baja: 4.0, moderada: 6.8, alta: 8.8, intervalos: 8.5 },
  ciclismo: { baja: 4.0, moderada: 6.8, alta: 10.0, intervalos: 9.0 },
  eliptica: { baja: 4.5, moderada: 5.0, alta: 7.0, intervalos: 7.5 },
  remo: { baja: 4.8, moderada: 7.0, alta: 8.5, intervalos: 9.0 },
  natacion: { baja: 5.0, moderada: 7.0, alta: 9.8, intervalos: 9.5 },
  otro: { baja: 3.5, moderada: 5.0, alta: 7.0, intervalos: 7.5 },
};

/** Gasto ESTIMADO de la sesión (kcal netas = (MET − 1) × kg × h). Solo informativo. */
export function estimateCardioKcal(modality: CardioModality, intensity: CardioLog['intensity'], minutes: number, weightKg: number): number {
  return Math.round((MET[modality][intensity] - 1) * weightKg * (minutes / 60));
}

/** FC máxima estimada (Tanaka 2001) y zonas por % de FCmáx. */
export function heartRateZones(age: number) {
  const max = Math.round(208 - 0.7 * age);
  const z = (a: number, b: number) => [Math.round(max * a), Math.round(max * b)] as [number, number];
  return {
    max,
    zones: [
      { key: 'z1', label: 'Zona 1 · Recuperación', range: z(0.5, 0.6), desc: 'Muy fácil, conversación fluida.' },
      { key: 'z2', label: 'Zona 2 · Base aeróbica', range: z(0.6, 0.7), desc: 'Puedes hablar en frases completas. Ideal para LISS.' },
      { key: 'z3', label: 'Zona 3 · Tempo', range: z(0.7, 0.8), desc: 'Conversación entrecortada.' },
      { key: 'z4', label: 'Zona 4 · Umbral', range: z(0.8, 0.9), desc: 'Solo palabras sueltas.' },
      { key: 'z5', label: 'Zona 5 · Máximo', range: z(0.9, 1.0), desc: 'Esfuerzo máximo, intervalos cortos.' },
    ],
  };
}

export interface StepsTarget {
  baseline: number | null;
  target: number;
  reason: string;
}

/** Meta de pasos: línea base de los últimos 7 días + 1 000–2 000, con techo en 12 000; sin datos, 7 000. */
export function stepsTarget(logs: StepsLog[], today: string): StepsTarget {
  const from = addDays(today, -7);
  const recent = logs.filter((l) => l.date >= from && l.date < today && l.steps > 0).map((l) => l.steps);
  if (recent.length < 3) return { baseline: null, target: 7000, reason: 'Sin suficientes registros: meta inicial de 7 000 pasos. Se ajustará con tu promedio real.' };
  const base = Math.round(mean(recent));
  const inc = base < 6000 ? 2000 : base < 9000 ? 1500 : 1000;
  const target = Math.min(12000, Math.round((base + inc) / 500) * 500);
  return {
    baseline: base,
    target: Math.max(target, base),
    reason: base >= 12000 ? 'Tu promedio ya es alto: mantenerlo es suficiente.' : `Promedio de 7 días: ${base.toLocaleString('es-MX')} pasos. Aumento gradual de ${inc.toLocaleString('es-MX')}.`,
  };
}

export interface CardioPlan {
  weeklyMinutesTarget: number;
  sessions: { type: string; modality: string; minutes: number; perWeek: number; intensity: string; notes: string }[];
  hiitAllowed: boolean;
  notes: string[];
}

/**
 * Recomendación semanal:
 * - Base: OMS 150–300 min/sem de actividad moderada (los pasos cuentan parcialmente).
 * - En pérdida de grasa con entrenamiento de fuerza, el cardio es complementario: 2–3 sesiones de LISS
 *   (zona 2) de 20–40 min; intervalos (máx. 1/sem) solo con buena capacidad y sin banderas cardiovasculares,
 *   alejados del día de pierna para no interferir con la recuperación (efecto de interferencia).
 */
export function cardioPlan(p: Pick<Profile, 'cardioFitness' | 'trainingDays' | 'experience'>, flags: SafetyFlag[]): CardioPlan {
  const fit: CardioFitness = p.cardioFitness;
  const hiitBlocked = isBlocked(flags, 'hiit') || affected(flags, 'hiit').length > 0;
  const hiitAllowed = !hiitBlocked && fit !== 'baja';
  const liss = fit === 'baja' ? { minutes: 20, perWeek: 3 } : fit === 'media' ? { minutes: 30, perWeek: 3 } : { minutes: 35, perWeek: 2 };
  const sessions: CardioPlan['sessions'] = [
    { type: 'LISS (baja intensidad)', modality: 'Caminata inclinada, bicicleta estática o elíptica', minutes: liss.minutes, perWeek: liss.perWeek, intensity: 'Zona 2 (60–70 % FCmáx) o RPE 3–4/10', notes: 'Puede hacerse después de pesas o en días sin fuerza.' },
  ];
  if (hiitAllowed)
    sessions.push({ type: 'Intervalos (opcional)', modality: 'Bicicleta estática o elíptica (bajo impacto)', minutes: 20, perWeek: 1, intensity: '6–8 × 30 s fuerte (RPE 8) / 90 s suave', notes: 'Al menos 24 h antes de un día de pierna. Omítelo si tu recuperación es baja.' });
  const notes = [
    'La actividad diaria (pasos) suele aportar más gasto que el cardio formal y genera menos fatiga.',
    'El gasto calórico mostrado por relojes y máquinas es una estimación con error amplio; BODY OS no lo suma a tus calorías para comer.',
  ];
  if (hiitBlocked) notes.push('Intervalos de alta intensidad deshabilitados por tus datos de salud hasta contar con valoración médica.');
  if (fit === 'baja') notes.push('Con capacidad cardiovascular baja se inicia con 20 min y se progresa 5 min cada 1–2 semanas.');
  return { weeklyMinutesTarget: sessions.reduce((a, s) => a + s.minutes * s.perWeek, 0), sessions, hiitAllowed, notes };
}

export function weeklyCardioSummary(logs: CardioLog[], date: string) {
  const ws = weekStart(date);
  const we = addDays(ws, 6);
  const w = logs.filter((l) => l.date >= ws && l.date <= we);
  return {
    sessions: w.length,
    minutes: w.reduce((a, l) => a + l.minutes, 0),
    hiit: w.filter((l) => l.intensity === 'intervalos' || l.intensity === 'alta').length,
    estKcal: round(w.reduce((a, l) => a + (l.device_kcal ?? 0), 0)),
  };
}

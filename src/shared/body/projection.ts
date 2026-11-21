// Simulador de transformación: proyección semanal NO lineal.
//
// Modelo (simplificado, inspirado en Hall 2008 y Forbes 2000):
// - El balance energético semanal = (ingesta − GET) × 7.
// - La pérdida se reparte entre masa grasa (9 440 kcal/kg) y masa libre de grasa (1 816 kcal/kg)
//   según la curva de Forbes: fracción magra p = 10.4 / (10.4 + MG). El entrenamiento de fuerza con
//   proteína suficiente reduce esa fracción (factor 0.4; HIPÓTESIS basada en la literatura de recomposición).
// - El GET se recalcula cada semana con la nueva masa libre de grasa (Katch-McArdle × PAL calibrado),
//   más una adaptación termogénica pequeña (hasta −5 %) — por eso la pérdida se desacelera.
// - La ingesta se recalibra cada 4 semanas para mantener el ritmo del escenario (como lo haría la app).
// - La ganancia muscular potencial depende de la experiencia y del tamaño del déficit (ESTIMACIÓN).
import type { Experience, ScenarioKey, Sex } from '../types';
import { round } from '../utils';
import { bmrKatch } from './composition';

export const FAT_KCAL_PER_KG = 9440;
export const LEAN_KCAL_PER_KG = 1816;

export interface Scenario {
  key: ScenarioKey;
  label: string;
  weeklyRatePct: number; // % del peso corporal por semana
  maxDeficitPct: number; // tope del déficit respecto al GET
  muscleFactor: number; // fracción del potencial de ganancia muscular que se conserva en déficit
  description: string;
}

export const SCENARIOS: Record<ScenarioKey, Scenario> = {
  conservador: {
    key: 'conservador',
    label: 'Conservador',
    weeklyRatePct: 0.5,
    maxDeficitPct: 20,
    muscleFactor: 1,
    description: '≈0.5 % del peso por semana. Máxima preservación muscular y rendimiento; más tiempo.',
  },
  moderado: {
    key: 'moderado',
    label: 'Moderado',
    weeklyRatePct: 0.75,
    maxDeficitPct: 25,
    muscleFactor: 0.7,
    description: '≈0.75 % por semana. Equilibrio entre velocidad, adherencia y conservación de músculo.',
  },
  agresivo: {
    key: 'agresivo',
    label: 'Agresivo (seguro)',
    weeklyRatePct: 1.0,
    maxDeficitPct: 30,
    muscleFactor: 0.4,
    description: '≈1 % por semana (tope seguro). Más hambre y fatiga; solo con % de grasa alto y supervisión de la recuperación.',
  },
};

/** Recomendación de escenario según % de grasa y sexo. */
export function recommendedScenario(sex: Sex, bf: number, targetBf: number): ScenarioKey {
  const offset = sex === 'mujer' ? 8 : 0;
  const gap = bf - targetBf;
  if (gap <= 3) return 'conservador';
  if (bf >= 30 + offset) return 'agresivo';
  if (bf >= 24 + offset) return 'moderado';
  return 'conservador';
}

/** Ganancia muscular mensual potencial EN DÉFICIT con entrenamiento de fuerza (rango, kg/mes). */
export function muscleGainPotential(exp: Experience, sex: Sex): { low: number; high: number } {
  const base = exp === 'principiante' ? { low: 0.25, high: 0.5 } : exp === 'intermedio' ? { low: 0.1, high: 0.25 } : { low: 0, high: 0.1 };
  const f = sex === 'mujer' ? 0.5 : 1;
  return { low: base.low * f, high: base.high * f };
}

export interface ProjectionInput {
  sex: Sex;
  weightKg: number;
  bfPct: number;
  targetBfPct: number;
  tdee: number; // GET actual (estimado u observado)
  experience: Experience;
  resistanceTraining: boolean;
  scenario: ScenarioKey;
  minCalories: number;
  maxWeeks?: number;
}

export interface ProjectionWeek {
  week: number;
  weight: number;
  fatMass: number;
  leanMass: number;
  bf: number;
  intake: number;
  tdee: number;
}

export interface ProjectionResult {
  scenario: Scenario;
  weeks: ProjectionWeek[];
  reached: boolean;
  weeksToGoal: number | null;
  finalWeight: number;
  weightLost: number;
  fatLost: number;
  leanChange: number;
  muscleGainRange: { low: number; high: number }; // kg en todo el periodo (estimación)
  initialIntake: number;
  initialDeficit: number;
}

function intakeForRate(weight: number, tdee: number, sc: Scenario, minCalories: number): number {
  const desiredDeficit = (sc.weeklyRatePct / 100) * weight * 7700 / 7; // aproximación clásica para fijar el objetivo
  const capped = Math.min(desiredDeficit, tdee * (sc.maxDeficitPct / 100));
  return Math.max(minCalories, Math.round(tdee - capped));
}

export function simulate(input: ProjectionInput): ProjectionResult {
  const sc = SCENARIOS[input.scenario];
  const maxWeeks = input.maxWeeks ?? 104;
  let fm = (input.weightKg * input.bfPct) / 100;
  let lm = input.weightKg - fm;
  // Calibramos el PAL para que el GET inicial coincida con el estimado.
  const pal = input.tdee / bmrKatch(lm);
  let adaptation = 0; // fracción de reducción del GET por termogénesis adaptativa
  const gain = muscleGainPotential(input.experience, input.sex);
  const weeklyGainMid = input.resistanceTraining ? (((gain.low + gain.high) / 2) * sc.muscleFactor) / 4.345 : 0;
  const leanProtect = input.resistanceTraining ? 0.4 : 1;

  let tdee = input.tdee;
  let intake = intakeForRate(input.weightKg, tdee, sc, input.minCalories);
  const initialIntake = intake;
  const weeks: ProjectionWeek[] = [
    { week: 0, weight: round(input.weightKg, 1), fatMass: round(fm, 1), leanMass: round(lm, 1), bf: round(input.bfPct, 1), intake, tdee: Math.round(tdee) },
  ];
  let reached = input.bfPct <= input.targetBfPct;
  let weeksToGoal: number | null = reached ? 0 : null;

  for (let w = 1; w <= maxWeeks && !reached; w++) {
    if ((w - 1) % 4 === 0 && w > 1) intake = intakeForRate(fm + lm, tdee, sc, input.minCalories);
    const balance = (intake - tdee) * 7; // negativo = déficit
    if (balance < 0) {
      const p = (10.4 / (10.4 + fm)) * leanProtect;
      const kcalPerKg = (1 - p) * FAT_KCAL_PER_KG + p * LEAN_KCAL_PER_KG;
      const dW = balance / kcalPerKg; // negativo
      fm += dW * (1 - p);
      lm += dW * p;
    } else {
      fm += balance / FAT_KCAL_PER_KG;
    }
    // Ganancia muscular por entrenamiento; su costo energético se descuenta de la masa grasa.
    lm += weeklyGainMid;
    fm -= (weeklyGainMid * LEAN_KCAL_PER_KG) / FAT_KCAL_PER_KG;
    adaptation = Math.min(0.05, adaptation + 0.003);
    tdee = bmrKatch(lm) * pal * (1 - adaptation);
    const weight = fm + lm;
    const bf = (fm / weight) * 100;
    weeks.push({ week: w, weight: round(weight, 1), fatMass: round(fm, 1), leanMass: round(lm, 1), bf: round(bf, 1), intake, tdee: Math.round(tdee) });
    if (bf <= input.targetBfPct) {
      reached = true;
      weeksToGoal = w;
    }
  }
  const last = weeks[weeks.length - 1];
  const totalWeeks = last.week;
  return {
    scenario: sc,
    weeks,
    reached,
    weeksToGoal,
    finalWeight: last.weight,
    weightLost: round(input.weightKg - last.weight, 1),
    fatLost: round((input.weightKg * input.bfPct) / 100 - last.fatMass, 1),
    leanChange: round(last.leanMass - (input.weightKg - (input.weightKg * input.bfPct) / 100), 1),
    muscleGainRange: input.resistanceTraining
      ? { low: round(((gain.low * sc.muscleFactor) / 4.345) * totalWeeks, 1), high: round(((gain.high * sc.muscleFactor) / 4.345) * totalWeeks, 1) }
      : { low: 0, high: 0 },
    initialIntake,
    initialDeficit: Math.round(input.tdee - initialIntake),
  };
}

export function simulateAll(input: Omit<ProjectionInput, 'scenario'>): Record<ScenarioKey, ProjectionResult> {
  return {
    conservador: simulate({ ...input, scenario: 'conservador' }),
    moderado: simulate({ ...input, scenario: 'moderado' }),
    agresivo: simulate({ ...input, scenario: 'agresivo' }),
  };
}

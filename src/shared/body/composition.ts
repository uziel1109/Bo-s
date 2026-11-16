// Motor de composición corporal.
// Todas las fórmulas tienen referencia en src/shared/references.ts.
import type { ActivityLevel, BodyFatMethod, Profile, Sex } from '../types';
import { clamp, round } from '../utils';

export const DIRECT_METHODS: BodyFatMethod[] = ['dexa', 'bodpod', 'pesaje_hidrostatico'];
export const DEVICE_METHODS: BodyFatMethod[] = ['bioimpedancia', 'plicometria'];

export const METHOD_LABEL: Record<BodyFatMethod, string> = {
  dexa: 'DEXA',
  bodpod: 'BOD POD (pletismografía)',
  pesaje_hidrostatico: 'Pesaje hidrostático',
  bioimpedancia: 'Bioimpedancia (báscula/equipo)',
  plicometria: 'Plicometría (pliegues cutáneos)',
  navy: 'Fórmula US Navy (circunferencias)',
  rfm: 'Relative Fat Mass (estatura/cintura)',
  cun_bae: 'CUN-BAE (IMC, edad y sexo)',
  visual: 'Estimación visual',
};

/** Error típico aproximado (± puntos porcentuales) de cada método frente a un método de referencia. */
export const METHOD_ERROR: Record<BodyFatMethod, number> = {
  dexa: 1.5,
  bodpod: 2.5,
  pesaje_hidrostatico: 2.5,
  bioimpedancia: 4.5,
  plicometria: 3.5,
  navy: 4,
  rfm: 4.5,
  cun_bae: 5,
  visual: 6,
};

export function bmi(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

export function bmiCategory(v: number): string {
  if (v < 18.5) return 'Bajo peso';
  if (v < 25) return 'Normal';
  if (v < 30) return 'Sobrepeso';
  if (v < 35) return 'Obesidad grado I';
  if (v < 40) return 'Obesidad grado II';
  return 'Obesidad grado III';
}

/** US Navy (Hodgdon y Beckett, 1984), versión métrica en cm. Devuelve null si faltan datos o son incoherentes. */
export function navyBodyFat(sex: Sex, heightCm: number, waistCm?: number | null, neckCm?: number | null, hipCm?: number | null): number | null {
  if (!waistCm || !neckCm || !heightCm) return null;
  if (sex === 'hombre') {
    const d = waistCm - neckCm;
    if (d <= 0) return null;
    const v = 495 / (1.0324 - 0.19077 * Math.log10(d) + 0.15456 * Math.log10(heightCm)) - 450;
    return clamp(v, 2, 70);
  }
  if (!hipCm) return null;
  const d = waistCm + hipCm - neckCm;
  if (d <= 0) return null;
  const v = 495 / (1.29579 - 0.35004 * Math.log10(d) + 0.221 * Math.log10(heightCm)) - 450;
  return clamp(v, 5, 70);
}

/** Relative Fat Mass (Woolcott y Bergman, 2018). */
export function rfmBodyFat(sex: Sex, heightCm: number, waistCm?: number | null): number | null {
  if (!waistCm || !heightCm) return null;
  const v = 64 - 20 * (heightCm / waistCm) + (sex === 'mujer' ? 12 : 0);
  return clamp(v, 2, 70);
}

/** CUN-BAE (Gómez-Ambrosi et al., 2012). sexo: 0 hombre, 1 mujer. */
export function cunBaeBodyFat(sex: Sex, age: number, bmiValue: number): number {
  const s = sex === 'mujer' ? 1 : 0;
  const b = bmiValue;
  const v =
    -44.988 +
    0.503 * age +
    10.689 * s +
    3.172 * b -
    0.026 * b * b +
    0.181 * b * s -
    0.02 * b * age -
    0.005 * b * b * s +
    0.00021 * b * b * age;
  return clamp(v, 2, 70);
}

export interface BodyFatEstimate {
  value: number;
  method: BodyFatMethod;
  error: number; // ± puntos
  isMeasured: boolean; // true solo para métodos de medición directa o con equipo
  label: string;
  alternatives: { method: BodyFatMethod; value: number }[];
}

export interface BodyFatInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  waistCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
  measured?: { value: number; method: BodyFatMethod } | null;
}

/**
 * Selecciona la mejor estimación disponible:
 * 1) Medición registrada con un método de referencia o equipo.
 * 2) US Navy (requiere cintura y cuello; en mujeres también cadera).
 * 3) RFM (requiere cintura).
 * 4) CUN-BAE (solo IMC, edad y sexo).
 */
export function estimateBodyFat(input: BodyFatInput): BodyFatEstimate {
  const b = bmi(input.weightKg, input.heightCm);
  const alternatives: { method: BodyFatMethod; value: number }[] = [];
  const navy = navyBodyFat(input.sex, input.heightCm, input.waistCm, input.neckCm, input.hipCm);
  const rfm = rfmBodyFat(input.sex, input.heightCm, input.waistCm);
  const cun = cunBaeBodyFat(input.sex, input.age, b);
  if (navy != null) alternatives.push({ method: 'navy', value: round(navy, 1) });
  if (rfm != null) alternatives.push({ method: 'rfm', value: round(rfm, 1) });
  alternatives.push({ method: 'cun_bae', value: round(cun, 1) });

  if (input.measured && input.measured.value > 2 && input.measured.value < 70) {
    const m = input.measured.method;
    return {
      value: input.measured.value,
      method: m,
      error: METHOD_ERROR[m],
      isMeasured: DIRECT_METHODS.includes(m) || DEVICE_METHODS.includes(m),
      label: METHOD_LABEL[m],
      alternatives,
    };
  }
  const pick: { method: BodyFatMethod; value: number } =
    navy != null ? { method: 'navy', value: navy } : rfm != null ? { method: 'rfm', value: rfm } : { method: 'cun_bae', value: cun };
  return {
    value: round(pick.value, 1),
    method: pick.method,
    error: METHOD_ERROR[pick.method],
    isMeasured: false,
    label: METHOD_LABEL[pick.method],
    alternatives,
  };
}

export function fatMass(weightKg: number, bfPct: number): number {
  return (weightKg * bfPct) / 100;
}

export function leanMass(weightKg: number, bfPct: number): number {
  return weightKg - fatMass(weightKg, bfPct);
}

/** Peso al que se alcanzaría el % objetivo conservando la masa libre de grasa actual. */
export function weightAtBodyFat(ffmKg: number, targetBfPct: number): number {
  return ffmKg / (1 - targetBfPct / 100);
}

/** Mifflin-St Jeor (1990). */
export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'hombre' ? 5 : -161);
}

/** Katch-McArdle: requiere masa libre de grasa. */
export function bmrKatch(ffmKg: number): number {
  return 370 + 21.6 * ffmKg;
}

/** Nivel de actividad cotidiana SIN contar el entrenamiento planificado. */
export const ACTIVITY_BASE: Record<ActivityLevel, { factor: number; label: string; desc: string }> = {
  sedentario: { factor: 1.2, label: 'Sedentario', desc: 'Trabajo sentado, < 5 000 pasos/día' },
  ligero: { factor: 1.3, label: 'Ligero', desc: 'Algo de caminata, 5 000–7 500 pasos/día' },
  moderado: { factor: 1.4, label: 'Moderado', desc: 'De pie gran parte del día, 7 500–10 000 pasos' },
  alto: { factor: 1.55, label: 'Alto', desc: 'Trabajo físico, > 10 000 pasos/día' },
  muy_alto: { factor: 1.7, label: 'Muy alto', desc: 'Trabajo físico pesado todo el día' },
};

export interface TdeeBreakdown {
  bmr: number;
  bmrMethod: 'mifflin' | 'katch';
  baseFactor: number;
  trainingAdd: number;
  cardioAdd: number;
  pal: number;
  tdee: number;
}

/**
 * Gasto energético total estimado = TMB × PAL.
 * PAL = factor de actividad cotidiana + aporte del entrenamiento de fuerza (≈0.03 por sesión semanal, máx. 0.18)
 * + aporte del cardio (≈0.01 por cada 30 min/semana, máx. 0.12). Es una ESTIMACIÓN inicial que el sistema
 * sustituye progresivamente por el gasto observado a partir de tus registros (ver analytics/adaptive.ts).
 */
export function estimateTdee(params: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bf: BodyFatEstimate;
  activity: ActivityLevel;
  strengthSessionsPerWeek: number;
  cardioMinutesPerWeek?: number;
}): TdeeBreakdown {
  const ffm = leanMass(params.weightKg, params.bf.value);
  // Katch-McArdle solo si el % de grasa proviene de una medición con equipo/directa.
  const useKatch = params.bf.isMeasured;
  const bmr = useKatch ? bmrKatch(ffm) : bmrMifflin(params.sex, params.weightKg, params.heightCm, params.age);
  const baseFactor = ACTIVITY_BASE[params.activity].factor;
  const trainingAdd = Math.min(0.18, 0.03 * params.strengthSessionsPerWeek);
  const cardioAdd = Math.min(0.12, ((params.cardioMinutesPerWeek ?? 0) / 30) * 0.01);
  const pal = Math.min(2.2, baseFactor + trainingAdd + cardioAdd);
  return {
    bmr: round(bmr),
    bmrMethod: useKatch ? 'katch' : 'mifflin',
    baseFactor,
    trainingAdd: round(trainingAdd, 3),
    cardioAdd: round(cardioAdd, 3),
    pal: round(pal, 3),
    tdee: round(bmr * pal),
  };
}

export interface CompositionSnapshot {
  weight: number;
  bmi: number;
  bmiCategory: string;
  bf: BodyFatEstimate;
  fatMass: number;
  leanMass: number;
  goalWeight: number; // peso al % objetivo con masa magra actual
  fatToLose: number;
  targetBf: number;
  progressPct: number; // avance desde % inicial hacia objetivo
}

export function compositionSnapshot(
  profile: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'targetBodyFat'>,
  current: { weight: number; waist?: number | null; neck?: number | null; hip?: number | null; measured?: { value: number; method: BodyFatMethod } | null },
  initialBf?: number | null,
): CompositionSnapshot {
  const bf = estimateBodyFat({
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: current.weight,
    waistCm: current.waist,
    neckCm: current.neck,
    hipCm: current.hip,
    measured: current.measured,
  });
  const fm = fatMass(current.weight, bf.value);
  const lm = current.weight - fm;
  const goalWeight = weightAtBodyFat(lm, profile.targetBodyFat);
  const b = bmi(current.weight, profile.heightCm);
  const start = initialBf ?? bf.value;
  const span = start - profile.targetBodyFat;
  const progress = span <= 0 ? 100 : clamp(((start - bf.value) / span) * 100, 0, 100);
  return {
    weight: current.weight,
    bmi: round(b, 1),
    bmiCategory: bmiCategory(b),
    bf,
    fatMass: round(fm, 1),
    leanMass: round(lm, 1),
    goalWeight: round(goalWeight, 1),
    fatToLose: round(Math.max(0, current.weight - goalWeight), 1),
    targetBf: profile.targetBodyFat,
    progressPct: round(progress),
  };
}

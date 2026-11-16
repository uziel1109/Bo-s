// Cálculo de calorías y macronutrientes.
import type { MealSlot, NutritionTargets, Profile, ScenarioKey } from '../types';
import { SCENARIOS } from '../body/projection';
import { calorieFloor, isBlocked, type SafetyFlag } from '../safety/screening';
import { clamp, round } from '../utils';

export interface TargetInput {
  profile: Profile;
  weightKg: number;
  bfPct: number;
  tdee: number;
  bmr: number;
  tdeeMethod: string;
  scenario: ScenarioKey;
  flags: SafetyFlag[];
}

/** Escenario efectivamente permitido tras aplicar las reglas de seguridad. */
export function allowedScenario(requested: ScenarioKey, flags: SafetyFlag[]): { scenario: ScenarioKey | 'mantenimiento'; reason?: string } {
  if (isBlocked(flags, 'deficit')) return { scenario: 'mantenimiento', reason: 'Un hallazgo de salud requiere valoración médica antes de iniciar un déficit calórico.' };
  if (requested === 'agresivo' && (isBlocked(flags, 'agresivo') || flags.some((f) => f.affects.includes('agresivo'))))
    return { scenario: flags.some((f) => f.id === 'tca') ? 'conservador' : 'moderado', reason: 'El escenario agresivo no es apropiado con tus condiciones de salud registradas.' };
  if (flags.some((f) => f.id === 'tca') && requested !== 'conservador') return { scenario: 'conservador', reason: 'Por tu antecedente, se usa el escenario conservador.' };
  return { scenario: requested };
}

export function calculateTargets(input: TargetInput): NutritionTargets {
  const { profile, weightKg, bfPct, tdee, bmr } = input;
  const rationale: string[] = [];
  const allowed = allowedScenario(input.scenario, input.flags);
  if (allowed.reason) rationale.push(allowed.reason);
  const ffm = weightKg * (1 - bfPct / 100);
  const floor = calorieFloor(profile.sex);
  let kcal = tdee;
  let rate = 0;
  let floorApplied = false;

  if (allowed.scenario !== 'mantenimiento' && bfPct > profile.targetBodyFat) {
    const sc = SCENARIOS[allowed.scenario];
    rate = sc.weeklyRatePct;
    const desired = ((rate / 100) * weightKg * 7700) / 7;
    const cap = tdee * (sc.maxDeficitPct / 100);
    const deficit = Math.min(desired, cap);
    if (desired > cap) rationale.push(`El déficit se limitó al ${sc.maxDeficitPct}% de tu gasto para proteger masa muscular y rendimiento.`);
    kcal = tdee - deficit;
    if (kcal < floor) {
      kcal = floor;
      floorApplied = true;
      rationale.push(`Se aplicó el mínimo de ${floor} kcal/día: por debajo de esa cifra se requiere supervisión profesional.`);
    }
    rationale.push(`Escenario ${sc.label}: objetivo ≈${rate}% del peso corporal por semana.`);
  } else if (bfPct <= profile.targetBodyFat) {
    rationale.push('Ya estás en o por debajo de tu % de grasa objetivo: calorías de mantenimiento para recomposición.');
  } else {
    rationale.push('Calorías de mantenimiento hasta contar con valoración médica.');
  }
  kcal = Math.round(kcal / 10) * 10;

  // Proteína: 2.0 g/kg del peso objetivo (= peso con la masa magra actual al % objetivo),
  // lo que equivale a ≈2.3–2.6 g/kg de masa libre de grasa (Helms 2014; Morton 2018).
  const refWeight = Math.min(weightKg, ffm / (1 - profile.targetBodyFat / 100));
  let protein = 2.0 * refWeight;
  protein = clamp(protein, 1.6 * Math.min(weightKg, refWeight), 2.4 * weightKg);
  const proteinRenal = isBlocked(input.flags, 'proteina');
  if (proteinRenal) {
    protein = 0.8 * weightKg;
    rationale.push('Por condición renal/hepática la proteína se fija en 0.8 g/kg (requerimiento general) hasta que tu médico indique otra cifra.');
  }
  protein = Math.round(protein);
  if (protein * 4 > kcal * 0.4) {
    protein = Math.round((kcal * 0.4) / 4);
  }

  // Grasa: 25 % de las calorías, nunca menos de 0.6 g/kg del peso de referencia.
  let fat = Math.max((kcal * 0.25) / 9, 0.6 * refWeight);
  // Carbohidratos: el resto.
  let carbs = (kcal - protein * 4 - fat * 9) / 4;
  if (carbs < 50) {
    fat = Math.max(0.5 * refWeight, (kcal * 0.2) / 9);
    carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  }
  // Fibra: 14 g por cada 1 000 kcal (IOM).
  const fiber = clamp(Math.round((kcal / 1000) * 14), 25, 45);

  return {
    kcal,
    protein,
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber,
    tdee: Math.round(tdee),
    bmr: Math.round(bmr),
    deficit: Math.round(tdee - kcal),
    deficitPct: round(((tdee - kcal) / tdee) * 100, 1),
    weeklyRatePct: rate,
    proteinPerKg: round(protein / weightKg, 2),
    rationale,
    floorApplied,
    method: input.tdeeMethod,
  };
}

export const MEAL_LABEL: Record<MealSlot, string> = {
  desayuno: 'Desayuno',
  colacion1: 'Colación matutina',
  comida: 'Comida',
  colacion2: 'Colación vespertina',
  cena: 'Cena',
  extra: 'Otros',
};

/** Comidas que se usan según el número de comidas por día. */
export function mealSlots(n: number): MealSlot[] {
  if (n <= 2) return ['comida', 'cena'];
  if (n === 3) return ['desayuno', 'comida', 'cena'];
  if (n === 4) return ['desayuno', 'comida', 'colacion2', 'cena'];
  return ['desayuno', 'colacion1', 'comida', 'colacion2', 'cena'];
}

/** Distribución de macros por comida: comidas principales reciben más; la proteína se reparte de forma más uniforme. */
export function distributeMacros(t: { kcal: number; protein: number; carbs: number; fat: number; fiber: number }, slots: MealSlot[]) {
  const weight: Record<MealSlot, number> = { desayuno: 1, colacion1: 0.5, comida: 1.3, colacion2: 0.5, cena: 1, extra: 0 };
  const proteinWeight: Record<MealSlot, number> = { desayuno: 1, colacion1: 0.6, comida: 1.1, colacion2: 0.6, cena: 1, extra: 0 };
  const tw = slots.reduce((a, s) => a + weight[s], 0);
  const pw = slots.reduce((a, s) => a + proteinWeight[s], 0);
  return slots.map((s) => ({
    slot: s,
    kcal: Math.round((t.kcal * weight[s]) / tw),
    protein: Math.round((t.protein * proteinWeight[s]) / pw),
    carbs: Math.round((t.carbs * weight[s]) / tw),
    fat: Math.round((t.fat * weight[s]) / tw),
    fiber: Math.round((t.fiber * weight[s]) / tw),
  }));
}

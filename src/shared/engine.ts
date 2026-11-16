// Motor central: combina el perfil y los registros para producir el estado actual del usuario.
// Es una función pura: misma entrada → misma salida (fácil de probar).
import type { BodyLog, CardioLog, FoodLog, NutritionTargets, Profile, RecoveryLog, StepsLog, WaterLog, WorkoutSession, Adjustment } from './types';
import { compositionSnapshot, estimateTdee, type CompositionSnapshot, type TdeeBreakdown } from './body/composition';
import { simulateAll, recommendedScenario, type ProjectionResult } from './body/projection';
import { calculateTargets } from './nutrition/targets';
import { calorieFloor, screenProfile, type SafetyFlag } from './safety/screening';
import { blendedTdee, dailyIntake, observedTdee, weightTrend, type DayIntake, type ObservedTdee } from './analytics/trend';
import type { Routine } from './training/generator';
import { hydrationTarget, type HydrationTarget } from './hydration/hydration';
import type { ScenarioKey } from './types';

export interface ActivePlan {
  id: string;
  created_at: string;
  targets: NutritionTargets;
  scenario: ScenarioKey;
  reason: string;
}

export interface AppData {
  profile: Profile;
  bodyLogs: BodyLog[];
  foodLogs: FoodLog[];
  waterLogs: WaterLog[];
  cardioLogs: CardioLog[];
  stepsLogs: StepsLog[];
  recoveryLogs: RecoveryLog[];
  sessions: WorkoutSession[];
  routine: Routine | null;
  plan: ActivePlan | null;
  adjustments: Adjustment[];
}

export interface EngineState {
  today: string;
  flags: SafetyFlag[];
  currentWeight: number;
  trendWeight: number | null;
  initialWeight: number;
  latestMeasures: { waist: number | null; neck: number | null; hip: number | null };
  composition: CompositionSnapshot;
  initialComposition: CompositionSnapshot;
  tdeeFormula: TdeeBreakdown;
  observed: ObservedTdee;
  tdee: { tdee: number; weightObserved: number; method: string };
  recommendedScenario: ScenarioKey;
  recommendedTargets: NutritionTargets;
  targets: NutritionTargets; // plan activo (o recomendado si no hay plan)
  projections: Record<ScenarioKey, ProjectionResult>;
  intake: Map<string, DayIntake>;
  hydration: HydrationTarget;
  strengthSessionsPerWeek: number;
}

function latest<T extends { date: string }>(xs: T[], pick: (x: T) => number | null | undefined): { value: number; date: string } | null {
  const s = [...xs].sort((a, b) => b.date.localeCompare(a.date));
  for (const x of s) {
    const v = pick(x);
    if (v != null && v > 0) return { value: v, date: x.date };
  }
  return null;
}

export function computeState(data: AppData, today: string): EngineState {
  const p = data.profile;
  const flags = screenProfile(p);
  const logs = data.bodyLogs.filter((l) => l.date <= today);
  const lw = latest(logs, (l) => l.weight);
  const currentWeight = lw?.value ?? p.weightKg;
  const trend = weightTrend(logs);
  const trendWeight = trend.length ? trend[trend.length - 1].trend : null;
  const firstW = [...logs].filter((l) => l.weight).sort((a, b) => a.date.localeCompare(b.date))[0];
  const initialWeight = firstW?.weight ?? p.weightKg;
  const waist = latest(logs, (l) => l.waist)?.value ?? p.waistCm ?? null;
  const neck = latest(logs, (l) => l.neck)?.value ?? p.neckCm ?? null;
  const hip = latest(logs, (l) => l.hip)?.value ?? p.hipCm ?? null;
  const measuredLog = [...logs].sort((a, b) => b.date.localeCompare(a.date)).find((l) => l.bf_percent && l.bf_method);
  const measured = measuredLog
    ? { value: measuredLog.bf_percent as number, method: measuredLog.bf_method! }
    : p.knownBodyFat && p.knownBodyFatMethod
      ? { value: p.knownBodyFat, method: p.knownBodyFatMethod }
      : null;
  // Para la composición actual se usa el peso de tendencia si existe (menos ruido).
  const compWeight = trendWeight ?? currentWeight;
  const composition = compositionSnapshot(p, { weight: compWeight, waist, neck, hip, measured });
  const initialComposition = compositionSnapshot(p, { weight: initialWeight, waist: p.waistCm, neck: p.neckCm, hip: p.hipCm, measured: p.knownBodyFat && p.knownBodyFatMethod ? { value: p.knownBodyFat, method: p.knownBodyFatMethod } : null });
  composition.progressPct = compositionSnapshot(p, { weight: compWeight, waist, neck, hip, measured }, initialComposition.bf.value).progressPct;

  const strengthSessionsPerWeek = data.routine?.daysPerWeek ?? p.trainingDays.length;
  const tdeeFormula = estimateTdee({
    sex: p.sex,
    age: p.age,
    heightCm: p.heightCm,
    weightKg: compWeight,
    bf: composition.bf,
    activity: p.activityLevel,
    strengthSessionsPerWeek,
    cardioMinutesPerWeek: 60,
  });
  const intake = dailyIntake(data.foodLogs);
  const observed = observedTdee(logs, intake, today);
  const tdee = blendedTdee(tdeeFormula.tdee, observed);
  const recScenario = recommendedScenario(p.sex, composition.bf.value, p.targetBodyFat);
  const scenario = p.scenario ?? recScenario;
  const recommendedTargets = calculateTargets({ profile: p, weightKg: compWeight, bfPct: composition.bf.value, tdee: tdee.tdee, bmr: tdeeFormula.bmr, tdeeMethod: tdee.method, scenario, flags });
  const targets = data.plan?.targets ?? recommendedTargets;
  const projections = simulateAll({
    sex: p.sex,
    weightKg: compWeight,
    bfPct: composition.bf.value,
    targetBfPct: p.targetBodyFat,
    tdee: tdee.tdee,
    experience: p.experience,
    resistanceTraining: true,
    minCalories: calorieFloor(p.sex),
  });
  const todayDay = new Date(today + 'T12:00:00').getDay();
  const trainingToday = data.routine?.days.find((d) => d.weekday === todayDay);
  const hydration = hydrationTarget({ ...p, weightKg: compWeight }, trainingToday ? Math.min(p.sessionMinutes, trainingToday.estMinutes) : 0, flags);
  return {
    today,
    flags,
    currentWeight,
    trendWeight,
    initialWeight,
    latestMeasures: { waist, neck, hip },
    composition,
    initialComposition,
    tdeeFormula,
    observed,
    tdee,
    recommendedScenario: recScenario,
    recommendedTargets,
    targets,
    projections,
    intake,
    hydration,
    strengthSessionsPerWeek,
  };
}

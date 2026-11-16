// Tendencias de peso y gasto energético observado.
import type { BodyLog, FoodLog } from '../types';
import { addDays, dateRange, daysBetween, linearRegression, mean, round, weekStart } from '../utils';

export interface DayIntake {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  entries: number;
  meals: number;
}

export function dailyIntake(logs: FoodLog[]): Map<string, DayIntake> {
  const m = new Map<string, DayIntake & { mealSet: Set<string> }>();
  for (const l of logs) {
    const d = m.get(l.date) ?? { date: l.date, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, entries: 0, meals: 0, mealSet: new Set<string>() };
    d.kcal += l.kcal;
    d.protein += l.protein;
    d.carbs += l.carbs;
    d.fat += l.fat;
    d.fiber += l.fiber;
    d.entries += 1;
    d.mealSet.add(l.meal);
    m.set(l.date, d);
  }
  const out = new Map<string, DayIntake>();
  for (const [k, v] of m) {
    const { mealSet, ...rest } = v;
    out.set(k, { ...rest, meals: mealSet.size, kcal: round(rest.kcal), protein: round(rest.protein, 1), carbs: round(rest.carbs, 1), fat: round(rest.fat, 1), fiber: round(rest.fiber, 1) });
  }
  return out;
}

/** Un día se considera registrado de forma completa si tiene ≥2 comidas y ≥800 kcal (heurística). */
export function isCompleteDay(d?: DayIntake): boolean {
  return !!d && d.meals >= 2 && d.kcal >= 800;
}

export interface TrendPoint {
  date: string;
  weight: number | null; // registro real
  trend: number; // media móvil exponencial
}

/**
 * Peso de tendencia: media móvil exponencial (α = 0.1) sobre días con registro; los días sin registro
 * conservan la tendencia previa. Suaviza fluctuaciones de agua, sal y glucógeno.
 */
export function weightTrend(logs: BodyLog[], alpha = 0.1): TrendPoint[] {
  const ws = logs.filter((l) => l.weight != null && l.weight > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (!ws.length) return [];
  const byDate = new Map(ws.map((l) => [l.date, l.weight as number]));
  const out: TrendPoint[] = [];
  let t = ws[0].weight as number;
  for (const d of dateRange(ws[0].date, ws[ws.length - 1].date)) {
    const w = byDate.get(d);
    if (w != null) t = t + alpha * (w - t);
    out.push({ date: d, weight: w ?? null, trend: round(t, 2) });
  }
  return out;
}

/** Ritmo de cambio (kg/semana y % del peso/semana) por regresión lineal de los pesos de los últimos N días. */
export function weightRate(logs: BodyLog[], today: string, days = 21): { kgPerWeek: number; pctPerWeek: number; n: number; r2: number } | null {
  const from = addDays(today, -days);
  const pts = logs.filter((l) => l.weight && l.date >= from && l.date <= today).map((l) => ({ x: daysBetween(from, l.date), y: l.weight as number }));
  if (pts.length < 4) return null;
  const { slope, r2 } = linearRegression(pts);
  const avg = mean(pts.map((p) => p.y));
  return { kgPerWeek: round(slope * 7, 2), pctPerWeek: round(((slope * 7) / avg) * 100, 2), n: pts.length, r2: round(r2, 2) };
}

export interface WeekAvg {
  weekStart: string;
  avgWeight: number | null;
  weighIns: number;
  avgWaist: number | null;
}

export function weeklyAverages(logs: BodyLog[]): WeekAvg[] {
  const m = new Map<string, { w: number[]; waist: number[] }>();
  for (const l of logs) {
    const k = weekStart(l.date);
    const e = m.get(k) ?? { w: [], waist: [] };
    if (l.weight) e.w.push(l.weight);
    if (l.waist) e.waist.push(l.waist);
    m.set(k, e);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, e]) => ({ weekStart: k, avgWeight: e.w.length ? round(mean(e.w), 2) : null, weighIns: e.w.length, avgWaist: e.waist.length ? round(mean(e.waist), 1) : null }));
}

export interface ObservedTdee {
  tdee: number | null;
  days: number;
  completeDays: number;
  avgIntake: number | null;
  trendChangeKg: number | null;
  confidence: 'nula' | 'baja' | 'media' | 'alta';
  explanation: string;
}

/**
 * Gasto energético OBSERVADO: GET ≈ ingesta media − (Δ peso de tendencia × 7 700 kcal) / días.
 * Requiere ≥14 días, ≥70 % de días con registro completo de comida y ≥6 pesajes.
 */
export function observedTdee(bodyLogs: BodyLog[], intake: Map<string, DayIntake>, today: string, windowDays = 28): ObservedTdee {
  const from = addDays(today, -windowDays + 1);
  const days = dateRange(from, today);
  const complete = days.map((d) => intake.get(d)).filter((d): d is DayIntake => isCompleteDay(d));
  const weighIns = bodyLogs.filter((l) => l.weight && l.date >= from && l.date <= today);
  const trend = weightTrend(bodyLogs.filter((l) => l.date <= today));
  const firstLog = bodyLogs.filter((l) => l.weight).map((l) => l.date).sort()[0];
  const span = firstLog ? Math.min(windowDays, daysBetween(firstLog, today) + 1) : 0;
  const base: ObservedTdee = { tdee: null, days: span, completeDays: complete.length, avgIntake: complete.length ? Math.round(mean(complete.map((c) => c.kcal))) : null, trendChangeKg: null, confidence: 'nula', explanation: '' };
  if (span < 14 || weighIns.length < 6 || complete.length < span * 0.7) {
    base.explanation = `Se necesitan ≥14 días con ≥6 pesajes y ≥70 % de días con comida registrada completa (tienes ${span} días, ${weighIns.length} pesajes y ${complete.length} días completos).`;
    return base;
  }
  const startT = trend.find((t) => t.date >= addDays(today, -span + 1));
  const endT = trend[trend.length - 1];
  if (!startT || !endT) return base;
  const dW = endT.trend - startT.trend;
  const nDays = Math.max(1, daysBetween(startT.date, endT.date));
  const tdee = Math.round((base.avgIntake as number) - (dW * 7700) / nDays);
  const conf = span >= 28 && complete.length >= span * 0.85 ? 'alta' : span >= 21 ? 'media' : 'baja';
  return { ...base, tdee, trendChangeKg: round(dW, 2), confidence: conf, explanation: `Ingesta media de ${base.avgIntake} kcal y cambio de tendencia de ${round(dW, 2)} kg en ${nDays} días.` };
}

/** Combina el GET estimado por fórmula con el observado, ponderando por la confianza de los datos. */
export function blendedTdee(formula: number, observed: ObservedTdee): { tdee: number; weightObserved: number; method: string } {
  if (observed.tdee == null) return { tdee: formula, weightObserved: 0, method: 'Fórmula (Mifflin-St Jeor/Katch-McArdle × factor de actividad)' };
  const w = observed.confidence === 'alta' ? 0.8 : observed.confidence === 'media' ? 0.6 : 0.35;
  // Se descartan observaciones absurdas (errores de registro).
  if (observed.tdee < formula * 0.6 || observed.tdee > formula * 1.5) return { tdee: formula, weightObserved: 0, method: 'Fórmula (el gasto observado parece inconsistente con tus registros; revisa que estén completos)' };
  return { tdee: Math.round(formula * (1 - w) + observed.tdee * w), weightObserved: w, method: `Combinado: ${Math.round(w * 100)} % datos reales (${observed.tdee} kcal) + ${Math.round((1 - w) * 100)} % fórmula` };
}

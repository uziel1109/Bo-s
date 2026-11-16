// Resumen mensual: lo más importante del mes en una tarjeta para guardar o compartir.
import type { AppData, EngineState } from '../engine';
import { compositionSnapshot } from '../body/composition';
import { dayPlanFor } from '../nutrition/phases';
import { calorieFloor } from '../safety/screening';
import { bestE1rm, sessionVolume } from '../training/progression';
import { addDays, dateRange, mean, parseISODate, round, toISODate } from '../utils';
import { isCompleteDay, weightTrend } from './trend';

export interface MonthlySummary {
  month: string; // YYYY-MM
  label: string; // "noviembre de 2026"
  from: string;
  to: string; // último día considerado (hoy si el mes está en curso)
  days: number;
  complete: boolean;
  weight: { start: number | null; end: number | null; diff: number | null };
  waist: { start: number | null; end: number | null; diff: number | null };
  bf: { start: number | null; end: number | null; diff: number | null; measured: boolean };
  training: { sessions: number; planned: number; volumeKg: number; prs: { name: string; from: number; to: number }[] };
  nutrition: { loggedDays: number; onTargetDays: number; proteinDays: number; avgKcal: number | null; avgProtein: number | null };
  activity: { stepsAvg: number | null; cardioMin: number };
  weighIns: number;
  highlights: string[];
}

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: toISODate(new Date(y, m, 0, 12)) };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

export function monthlySummary(data: AppData, st: EngineState, month: string, today: string): MonthlySummary {
  const b = monthBounds(month);
  const to = b.to > today ? today : b.to;
  const from = b.from;
  const days = dateRange(from, to);
  const inM = (d: string) => d >= from && d <= to;
  const p = data.profile;

  // Peso: tendencia al inicio y al final (menos ruido que el registro diario).
  const trend = weightTrend(data.bodyLogs.filter((l) => l.date <= to));
  const startT = [...trend].reverse().find((t) => t.date < from) ?? trend.find((t) => inM(t.date)) ?? null;
  const endT = [...trend].reverse().find((t) => inM(t.date)) ?? null;
  const wStart = startT ? round(startT.trend, 1) : null;
  const wEnd = endT ? round(endT.trend, 1) : null;

  const waists = data.bodyLogs.filter((l) => l.waist && l.date <= to).sort((a, c) => a.date.localeCompare(c.date));
  const waistStartLog = [...waists].reverse().find((l) => l.date < from) ?? waists.find((l) => inM(l.date)) ?? null;
  const waistEndLog = [...waists].reverse().find((l) => inM(l.date)) ?? null;
  const waistStart = waistStartLog?.waist ?? null;
  const waistEnd = waistEndLog?.waist ?? null;

  const measuredIn = data.bodyLogs.filter((l) => inM(l.date) && l.bf_percent && l.bf_method).sort((a, c) => a.date.localeCompare(c.date));
  const bfAt = (w: number | null, waist: number | null) => (w ? compositionSnapshot(p, { weight: w, waist, neck: st.latestMeasures.neck, hip: st.latestMeasures.hip, measured: null }).bf.value : null);
  const bfStart = bfAt(wStart, waistStart);
  const bfEnd = measuredIn.length ? (measuredIn[measuredIn.length - 1].bf_percent as number) : bfAt(wEnd, waistEnd);

  // Entrenamiento
  const sessions = data.sessions.filter((s) => s.completed && inM(s.date));
  const planned = data.routine ? days.filter((d) => data.routine!.days.some((x) => x.weekday === parseISODate(d).getDay())).length : 0;
  const prs: MonthlySummary['training']['prs'] = [];
  const ids = new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
  for (const id of ids) {
    const before = data.sessions.filter((s) => s.completed && s.date < from).flatMap((s) => s.exercises.filter((e) => e.exerciseId === id));
    const during = sessions.flatMap((s) => s.exercises.filter((e) => e.exerciseId === id));
    const prev = Math.max(0, ...before.map((e) => bestE1rm(e.sets)));
    const best = Math.max(0, ...during.map((e) => bestE1rm(e.sets)));
    if (prev > 0 && best > prev * 1.005) prs.push({ name: during[0].name, from: round(prev, 1), to: round(best, 1) });
  }
  prs.sort((a, c) => c.to / c.from - a.to / a.from);

  // Nutrición (con el objetivo de cada día, incluidas recargas y eventos)
  const ctx = { tdee: st.tdee.tdee, floor: calorieFloor(p.sex), legWeekdays: st.legWeekdays };
  const logged = days.map((d) => ({ d, i: st.intake.get(d) })).filter((x) => isCompleteDay(x.i));
  let onTarget = 0;
  let proteinDays = 0;
  for (const { d, i } of logged) {
    const t = dayPlanFor(d, st.targets, data.phases, ctx).targets;
    if (Math.abs(i!.kcal - t.kcal) <= t.kcal * 0.1) onTarget++;
    if (i!.protein >= t.protein * 0.9) proteinDays++;
  }
  const steps = data.stepsLogs.filter((s) => inM(s.date) && s.steps > 0).map((s) => s.steps);
  const cardioMin = data.cardioLogs.filter((c) => inM(c.date)).reduce((a, c) => a + c.minutes, 0);
  const weighIns = new Set(data.bodyLogs.filter((l) => inM(l.date) && l.weight).map((l) => l.date)).size;

  const s: MonthlySummary = {
    month,
    label: monthLabel(month),
    from,
    to,
    days: days.length,
    complete: to === b.to,
    weight: { start: wStart, end: wEnd, diff: wStart != null && wEnd != null ? round(wEnd - wStart, 1) : null },
    waist: { start: waistStart, end: waistEnd, diff: waistStart != null && waistEnd != null && waistEndLog !== waistStartLog ? round(waistEnd - waistStart, 1) : null },
    bf: { start: bfStart, end: bfEnd, diff: bfStart != null && bfEnd != null ? round(bfEnd - bfStart, 1) : null, measured: measuredIn.length > 0 },
    training: { sessions: sessions.length, planned, volumeKg: Math.round(sessions.reduce((a, x) => a + sessionVolume(x), 0)), prs: prs.slice(0, 5) },
    nutrition: { loggedDays: logged.length, onTargetDays: onTarget, proteinDays, avgKcal: logged.length ? Math.round(mean(logged.map((x) => x.i!.kcal))) : null, avgProtein: logged.length ? Math.round(mean(logged.map((x) => x.i!.protein))) : null },
    activity: { stepsAvg: steps.length ? Math.round(mean(steps)) : null, cardioMin: Math.round(cardioMin) },
    weighIns,
    highlights: [],
  };
  s.highlights = highlights(s);
  return s;
}

function highlights(s: MonthlySummary): string[] {
  const h: string[] = [];
  if (s.weight.diff != null && s.weight.diff <= -0.3) h.push(`Bajaste ${Math.abs(s.weight.diff).toLocaleString('es-MX')} kg (tendencia).`);
  if (s.waist.diff != null && s.waist.diff <= -0.5) h.push(`${Math.abs(s.waist.diff).toLocaleString('es-MX')} cm menos de cintura.`);
  if (s.training.prs.length) h.push(`${s.training.prs.length} marca${s.training.prs.length > 1 ? 's' : ''} personal${s.training.prs.length > 1 ? 'es' : ''} de fuerza.`);
  if (s.training.planned && s.training.sessions >= s.training.planned * 0.9) h.push('Cumpliste prácticamente todos tus entrenamientos.');
  if (s.nutrition.loggedDays >= s.days * 0.8) h.push(`Registraste tu comida ${s.nutrition.loggedDays} de ${s.days} días.`);
  if (s.nutrition.loggedDays && s.nutrition.proteinDays / s.nutrition.loggedDays >= 0.8) h.push('Proteína cumplida en la gran mayoría de los días.');
  if (s.weight.diff != null && s.weight.diff > -0.3 && s.waist.diff != null && s.waist.diff <= -1) h.push('Peso estable con cintura menor: señal de recomposición.');
  return h.slice(0, 4);
}

/** Meses con algún dato, del más reciente al más antiguo (incluye el actual). */
export function monthsWithData(data: AppData, today: string): string[] {
  const set = new Set<string>([today.slice(0, 7)]);
  for (const l of data.bodyLogs) set.add(l.date.slice(0, 7));
  for (const l of data.foodLogs) set.add(l.date.slice(0, 7));
  for (const s of data.sessions) set.add(s.date.slice(0, 7));
  return [...set].filter((m) => m <= today.slice(0, 7)).sort().reverse();
}

export function previousMonth(month: string): string {
  return addDays(`${month}-01`, -1).slice(0, 7);
}

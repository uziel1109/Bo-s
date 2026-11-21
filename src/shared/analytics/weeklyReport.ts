// Informe semanal automático (lunes a domingo).
import type { AppData, EngineState } from '../engine';
import type { Claim } from '../types';
import { addDays, dateRange, mean, round, weekStart } from '../utils';
import { isCompleteDay } from './trend';
import { analyzeAdaptation, type AdjustmentDraft } from './adaptation';
import { bestE1rm } from '../training/progression';

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  avgWeight: number | null;
  prevAvgWeight: number | null;
  weightDiff: number | null;
  weighIns: number;
  waistAvg: number | null;
  prevWaistAvg: number | null;
  waistDiff: number | null;
  calories: { loggedDays: number; avg: number | null; target: number; daysWithin10pct: number };
  macros: { proteinAvg: number | null; proteinTarget: number; proteinDaysOk: number; carbsAvg: number | null; fatAvg: number | null };
  strength: { exercises: number; prs: { name: string; e1rm: number }[]; sessionsDone: number; sessionsPlanned: number };
  activity: { stepsAvg: number | null; cardioMin: number; cardioSessions: number };
  hydration: { avgMl: number | null; target: number; daysOk: number };
  recovery: { sleepAvg: number | null; sleepQuality: number | null; energy: number | null; soreness: number | null; label: string };
  claims: Claim[];
  proposals: AdjustmentDraft[];
}

export function buildWeeklyReport(data: AppData, st: EngineState, anyDateInWeek: string): WeeklyReport {
  const ws = weekStart(anyDateInWeek);
  const we = addDays(ws, 6);
  const pws = addDays(ws, -7);
  const pwe = addDays(ws, -1);
  const inW = (d: string) => d >= ws && d <= we;
  const inP = (d: string) => d >= pws && d <= pwe;
  const avgOf = (xs: number[]) => (xs.length ? round(mean(xs), 2) : null);
  const wW = data.bodyLogs.filter((l) => inW(l.date) && l.weight).map((l) => l.weight as number);
  const pW = data.bodyLogs.filter((l) => inP(l.date) && l.weight).map((l) => l.weight as number);
  const wWa = data.bodyLogs.filter((l) => inW(l.date) && l.waist).map((l) => l.waist as number);
  const pWa = data.bodyLogs.filter((l) => inP(l.date) && l.waist).map((l) => l.waist as number);
  const avgWeight = avgOf(wW);
  const prevAvgWeight = avgOf(pW);
  const waistAvg = wWa.length ? round(mean(wWa), 1) : null;
  const prevWaistAvg = pWa.length ? round(mean(pWa), 1) : null;
  const days = dateRange(ws, we);
  const t = st.targets;
  const intakeDays = days.map((d) => st.intake.get(d)).filter(isCompleteDay);
  const kcals = intakeDays.map((d) => d!.kcal);
  const prot = intakeDays.map((d) => d!.protein);
  const steps = data.stepsLogs.filter((s) => inW(s.date) && s.steps > 0).map((s) => s.steps);
  const cardio = data.cardioLogs.filter((c) => inW(c.date));
  const water = days.map((d) => data.waterLogs.filter((w) => w.date === d).reduce((a, w) => a + w.ml, 0));
  const waterLogged = water.filter((w) => w > 0);
  const rec = data.recoveryLogs.filter((r) => inW(r.date));
  const ra = (k: 'sleep_hours' | 'sleep_quality' | 'energy' | 'soreness') => {
    const xs = rec.map((r) => r[k]).filter((x): x is number => typeof x === 'number');
    return xs.length ? round(mean(xs), 1) : null;
  };
  const sleepAvg = ra('sleep_hours');
  const sleepQuality = ra('sleep_quality');
  const energy = ra('energy');
  const soreness = ra('soreness');
  let recLabel = 'Sin datos de recuperación';
  if (sleepAvg != null || energy != null) {
    const score = (sleepAvg != null ? Math.min(1, sleepAvg / 8) : 0.75) * 0.4 + ((sleepQuality ?? 3) / 5) * 0.2 + ((energy ?? 3) / 5) * 0.25 + ((6 - (soreness ?? 3)) / 5) * 0.15;
    recLabel = score >= 0.8 ? 'Buena' : score >= 0.65 ? 'Aceptable' : 'Baja: prioriza el sueño y considera reducir volumen';
  }
  // Fuerza: récords (mejor e1RM de la semana mayor que cualquier semana anterior)
  const done = data.sessions.filter((s) => s.completed);
  const weekSessions = done.filter((s) => inW(s.date));
  const prs: { name: string; e1rm: number }[] = [];
  const exIds = new Set(weekSessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
  for (const id of exIds) {
    const best = Math.max(...weekSessions.flatMap((s) => s.exercises.filter((e) => e.exerciseId === id).map((e) => bestE1rm(e.sets))));
    const prior = Math.max(0, ...done.filter((s) => s.date < ws).flatMap((s) => s.exercises.filter((e) => e.exerciseId === id).map((e) => bestE1rm(e.sets))));
    if (prior > 0 && best > prior) {
      const name = weekSessions.flatMap((s) => s.exercises).find((e) => e.exerciseId === id)?.name ?? id;
      prs.push({ name, e1rm: round(best, 1) });
    }
  }
  const adapt = analyzeAdaptation(data, st, we);
  return {
    weekStart: ws,
    weekEnd: we,
    avgWeight,
    prevAvgWeight,
    weightDiff: avgWeight != null && prevAvgWeight != null ? round(avgWeight - prevAvgWeight, 2) : null,
    weighIns: wW.length,
    waistAvg,
    prevWaistAvg,
    waistDiff: waistAvg != null && prevWaistAvg != null ? round(waistAvg - prevWaistAvg, 1) : null,
    calories: { loggedDays: intakeDays.length, avg: kcals.length ? Math.round(mean(kcals)) : null, target: t.kcal, daysWithin10pct: kcals.filter((k) => Math.abs(k - t.kcal) <= t.kcal * 0.1).length },
    macros: {
      proteinAvg: prot.length ? Math.round(mean(prot)) : null,
      proteinTarget: t.protein,
      proteinDaysOk: prot.filter((p) => p >= t.protein * 0.9).length,
      carbsAvg: intakeDays.length ? Math.round(mean(intakeDays.map((d) => d!.carbs))) : null,
      fatAvg: intakeDays.length ? Math.round(mean(intakeDays.map((d) => d!.fat))) : null,
    },
    strength: { exercises: exIds.size, prs, sessionsDone: weekSessions.length, sessionsPlanned: data.routine?.daysPerWeek ?? 0 },
    activity: { stepsAvg: steps.length ? Math.round(mean(steps)) : null, cardioMin: cardio.reduce((a, c) => a + c.minutes, 0), cardioSessions: cardio.length },
    hydration: { avgMl: waterLogged.length ? Math.round(mean(waterLogged)) : null, target: st.hydration.totalMl, daysOk: water.filter((w) => w >= st.hydration.totalMl * 0.8).length },
    recovery: { sleepAvg, sleepQuality, energy, soreness, label: recLabel },
    claims: adapt.claims,
    proposals: adapt.proposals,
  };
}

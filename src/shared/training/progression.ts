// Sobrecarga progresiva (doble progresión con RIR), detección de estancamientos y semanas de descarga,
// y estadísticas por grupo muscular.
import type { ExerciseLog, Muscle, RecoveryLog, SetLog, WorkoutSession } from '../types';
import { getExercise } from './exercises';
import { addDays, daysBetween, round, weekStart } from '../utils';

/** 1RM estimado (Epley) incorporando las repeticiones en reserva: reps efectivas = reps + RIR. */
export function e1rm(weight: number, reps: number, rir = 0): number {
  if (weight <= 0 || reps <= 0) return 0;
  const r = reps + Math.max(0, rir ?? 0);
  if (r === 1) return weight;
  return weight * (1 + r / 30);
}

export function bestE1rm(sets: SetLog[]): number {
  return Math.max(0, ...sets.filter((s) => s.done).map((s) => e1rm(s.weight, s.reps, s.rir ?? 0)));
}

export function setRir(s: SetLog): number | null {
  if (s.rir != null) return s.rir;
  if (s.rpe != null) return Math.max(0, 10 - s.rpe);
  return null;
}

/** Serie efectiva: completada y a RIR ≤ 4 (o sin dato de esfuerzo, se asume efectiva). */
export function isEffective(s: SetLog): boolean {
  if (!s.done || s.reps <= 0) return false;
  const r = setRir(s);
  return r == null || r <= 4;
}

export type ProgressionAction = 'subir_peso' | 'subir_reps' | 'mantener' | 'reducir_carga' | 'revisar_dolor' | 'sin_datos';

export interface ProgressionAdvice {
  exerciseId: string;
  action: ProgressionAction;
  suggestedWeight: number | null;
  suggestedReps: string;
  reason: string;
}

/**
 * Doble progresión:
 * - Si TODAS las series de trabajo alcanzaron el tope del rango con RIR ≥ objetivo − 1 → subir peso (paso del ejercicio, o ~2.5 %).
 * - Si están dentro del rango → mantener peso y sumar repeticiones.
 * - Si la última sesión quedó por debajo del mínimo en ≥ la mitad de las series en DOS sesiones seguidas → reducir carga ~5–10 %.
 * - Si se registró dolor → revisar técnica/ejercicio, no progresar.
 */
export function progressionAdvice(history: ExerciseLog[]): ProgressionAdvice | null {
  if (!history.length) return null;
  const last = history[history.length - 1];
  const ex = getExercise(last.exerciseId);
  const step = ex?.loadStep ?? 2.5;
  const work = last.sets.filter((s) => s.done && s.reps > 0);
  const base = { exerciseId: last.exerciseId };
  if (!work.length) return { ...base, action: 'sin_datos', suggestedWeight: null, suggestedReps: `${last.repMin}–${last.repMax}`, reason: 'Sin series registradas en la última sesión.' };
  const topWeight = Math.max(...work.map((s) => s.weight));
  if (last.pain || work.some((s) => s.pain))
    return { ...base, action: 'revisar_dolor', suggestedWeight: topWeight, suggestedReps: `${last.repMin}–${last.repMax}`, reason: 'Registraste dolor o molestia: no se progresa. Revisa la técnica, reduce el rango o usa una alternativa; si persiste, consulta a un profesional.' };

  const allTop = work.length >= last.targetSets && work.every((s) => s.reps >= last.repMax && (setRir(s) == null || (setRir(s) as number) >= last.targetRir - 1));
  if (allTop) {
    const inc = step > 0 ? step : 0;
    if (inc === 0)
      return { ...base, action: 'subir_reps', suggestedWeight: topWeight, suggestedReps: `${last.repMax}+`, reason: 'Completaste el rango en todas las series. Sin carga externa: aumenta repeticiones, ralentiza la fase excéntrica o usa una variante más difícil.' };
    // Incremento: el paso del ejercicio, o ~2.5 % redondeado al paso si la carga ya es alta.
    const pct = Math.round((topWeight * 0.025) / inc) * inc;
    const newW = round(topWeight + Math.max(inc, pct), 1);
    return { ...base, action: 'subir_peso', suggestedWeight: newW, suggestedReps: `${last.repMin}–${last.repMin + 2}`, reason: `Alcanzaste ${last.repMax} repeticiones en todas las series con el esfuerzo objetivo. Sube a ${newW} kg y vuelve al inicio del rango.` };
  }
  const belowCount = (l: ExerciseLog) => l.sets.filter((s) => s.done && s.reps < l.repMin).length;
  const prev = history.length >= 2 ? history[history.length - 2] : null;
  if (belowCount(last) >= Math.ceil(work.length / 2) && prev && belowCount(prev) >= Math.ceil(prev.sets.filter((s) => s.done).length / 2)) {
    const newW = round(topWeight * 0.92 / (step || 1)) * (step || 1);
    return { ...base, action: 'reducir_carga', suggestedWeight: newW || topWeight, suggestedReps: `${last.repMin}–${last.repMax}`, reason: 'Dos sesiones seguidas por debajo del rango: reduce ~8 % la carga y reconstruye. Revisa sueño, calorías y fatiga.' };
  }
  if (belowCount(last) >= Math.ceil(work.length / 2))
    return { ...base, action: 'mantener', suggestedWeight: topWeight, suggestedReps: `${last.repMin}–${last.repMax}`, reason: 'Quedaste por debajo del rango en esta sesión. Mantén la carga; una mala sesión aislada no justifica cambios.' };
  return { ...base, action: 'subir_reps', suggestedWeight: topWeight, suggestedReps: `${last.repMin}–${last.repMax}`, reason: 'Estás dentro del rango: mantén el peso e intenta sumar 1 repetición en alguna serie.' };
}

/** Historial por ejercicio (orden cronológico). */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string): { date: string; log: ExerciseLog }[] {
  return sessions
    .filter((s) => s.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((s) => s.exercises.filter((e) => e.exerciseId === exerciseId).map((log) => ({ date: s.date, log })));
}

export interface MuscleStats {
  muscle: Muscle;
  sets: number; // series totales (primario 1, secundario 0.5)
  effectiveSets: number;
  frequency: number; // sesiones en la semana que lo trabajan como primario o secundario
  lastTrained: string | null;
  recoveryPct: number; // estimación 0–100
}

/** Estadísticas por músculo para la semana que contiene `date`. */
export function muscleWeekStats(sessions: WorkoutSession[], date: string, now = date): Record<Muscle, MuscleStats> {
  const ws = weekStart(date);
  const we = addDays(ws, 6);
  const out = {} as Record<Muscle, MuscleStats>;
  const touch = (m: Muscle) => (out[m] ??= { muscle: m, sets: 0, effectiveSets: 0, frequency: 0, lastTrained: null, recoveryPct: 100 });
  const lastByMuscle = new Map<Muscle, { date: string; sets: number }>();
  for (const s of sessions.filter((x) => x.completed)) {
    const inWeek = s.date >= ws && s.date <= we;
    const hit = new Set<Muscle>();
    const setsByMuscle = new Map<Muscle, number>();
    for (const e of s.exercises) {
      const ex = getExercise(e.exerciseId);
      if (!ex) continue;
      const done = e.sets.filter((x) => x.done && x.reps > 0);
      const eff = done.filter(isEffective).length;
      const add = (m: Muscle, f: number) => {
        hit.add(m);
        setsByMuscle.set(m, (setsByMuscle.get(m) ?? 0) + eff * f);
        if (inWeek) {
          const st = touch(m);
          st.sets += done.length * f;
          st.effectiveSets += eff * f;
        }
      };
      add(ex.primary, 1);
      ex.secondary.forEach((m) => add(m, 0.5));
    }
    for (const m of hit) {
      if (inWeek) touch(m).frequency += 1;
      const prev = lastByMuscle.get(m);
      if (!prev || s.date >= prev.date) lastByMuscle.set(m, { date: s.date, sets: setsByMuscle.get(m) ?? 0 });
    }
  }
  for (const [m, info] of lastByMuscle) {
    const st = touch(m);
    st.lastTrained = info.date;
    // Recuperación ESTIMADA: 48 h para ≤ 4 series efectivas, hasta 72 h para ≥ 8.
    const need = 48 + Math.min(24, Math.max(0, info.sets - 4) * 6);
    const hrs = Math.max(0, daysBetween(info.date, now)) * 24;
    st.recoveryPct = Math.round(Math.min(100, (hrs / need) * 100));
  }
  for (const k of Object.keys(out) as Muscle[]) {
    out[k].sets = round(out[k].sets, 1);
    out[k].effectiveSets = round(out[k].effectiveSets, 1);
  }
  return out;
}

export interface DeloadAdvice {
  recommended: boolean;
  reasons: string[];
  weeksSinceDeload: number;
}

/**
 * Semana de descarga recomendada si:
 * - ≥ 3 ejercicios con rendimiento estancado o en descenso (e1RM) en las últimas 3 sesiones de cada uno, Y
 *   señales de fatiga (energía/sueño bajos, dolor muscular alto o RPE de sesión ≥ 9); o
 * - ≥ 8 semanas de entrenamiento continuo con señales de fatiga.
 */
export function deloadAdvice(sessions: WorkoutSession[], recovery: RecoveryLog[], today: string, lastDeload?: string | null): DeloadAdvice {
  const done = sessions.filter((s) => s.completed).sort((a, b) => a.date.localeCompare(b.date));
  const reasons: string[] = [];
  const first = done[0]?.date;
  const since = lastDeload ?? first ?? today;
  const weeksSince = Math.floor(daysBetween(since, today) / 7);
  const ids = new Set(done.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
  let stalled = 0;
  for (const id of ids) {
    const h = exerciseHistory(done, id).slice(-3);
    if (h.length < 3) continue;
    const v = h.map((x) => bestE1rm(x.log.sets));
    if (v[2] <= v[0] * 1.005 && v[1] <= v[0] * 1.01) stalled++;
  }
  const recent = recovery.filter((r) => daysBetween(r.date, today) <= 10 && daysBetween(r.date, today) >= 0);
  const avg = (k: keyof RecoveryLog) => {
    const xs = recent.map((r) => r[k]).filter((x): x is number => typeof x === 'number');
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const energy = avg('energy');
  const soreness = avg('soreness');
  const sleepQ = avg('sleep_quality');
  const recentRpe = done.filter((s) => daysBetween(s.date, today) <= 10).map((s) => s.session_rpe ?? 0);
  const fatigue = (energy != null && energy <= 2.5) || (soreness != null && soreness >= 4) || (sleepQ != null && sleepQ <= 2.5) || (recentRpe.length >= 2 && recentRpe.filter((r) => r >= 9).length >= 2);
  if (stalled >= 3) reasons.push(`${stalled} ejercicios sin progreso en sus últimas 3 sesiones.`);
  if (fatigue) reasons.push('Indicadores de fatiga en tus registros de recuperación o esfuerzo de sesión.');
  if (weeksSince >= 8) reasons.push(`${weeksSince} semanas de entrenamiento continuo sin descarga.`);
  const recommended = fatigue && (stalled >= 3 || weeksSince >= 8);
  return { recommended, reasons, weeksSinceDeload: weeksSince };
}

export function sessionVolume(s: WorkoutSession): number {
  return round(s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).reduce((b, x) => b + x.weight * x.reps, 0), 0));
}

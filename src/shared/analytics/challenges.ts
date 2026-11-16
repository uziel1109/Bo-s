// Retos semanales: cada lunes se eligen 3 metas alcanzables según los puntos más débiles de la semana anterior.
// Las metas suben poco a poco (la semana pasada + 1 día) para que sean retadoras pero realistas.
import type { AppData, EngineState } from '../engine';
import { dayPlanFor } from '../nutrition/phases';
import { calorieFloor } from '../safety/screening';
import { stepsTarget } from '../cardio/cardio';
import { addDays, dateRange, parseISODate, weekStart } from '../utils';
import { isCompleteDay } from './trend';

export type ChallengeKey = 'proteina' | 'calorias' | 'registro' | 'pasos' | 'pesaje' | 'entrenos' | 'agua' | 'sueno';

export const CHALLENGE_INFO: Record<ChallengeKey, { title: (n: number, of: number) => string; unit: string }> = {
  proteina: { title: (n) => `Proteína cumplida ${n} días`, unit: 'días' },
  calorias: { title: (n) => `Calorías en tu objetivo (±10 %) ${n} días`, unit: 'días' },
  registro: { title: (n) => `Registrar toda tu comida ${n} días`, unit: 'días' },
  pasos: { title: (n) => `Meta de pasos ${n} días`, unit: 'días' },
  pesaje: { title: (n) => `Pesarte ${n} mañanas`, unit: 'días' },
  entrenos: { title: (n, of) => `${n} de ${of} entrenamientos`, unit: 'sesiones' },
  agua: { title: (n) => `Hidratación orientativa ${n} días`, unit: 'días' },
  sueno: { title: (n) => `Dormir 7 h o más ${n} noches`, unit: 'noches' },
};

export interface Challenge {
  key: ChallengeKey;
  goal: number;
  max: number; // máximo posible en la semana
}

export interface ChallengeProgress extends Challenge {
  title: string;
  value: number;
  done: boolean;
  possible: boolean; // aún se puede lograr con los días que quedan
  lastWeek: number;
}

/** Cuenta, para cada métrica, cuántos días de [from, to] se cumplió. */
export function countMetrics(data: AppData, st: EngineState, from: string, to: string): Record<ChallengeKey, number> {
  const days = dateRange(from, to);
  const ctx = { tdee: st.tdee.tdee, floor: calorieFloor(data.profile.sex), legWeekdays: st.legWeekdays };
  let proteina = 0;
  let calorias = 0;
  let registro = 0;
  let pasos = 0;
  let agua = 0;
  for (const d of days) {
    const i = st.intake.get(d);
    const t = dayPlanFor(d, st.targets, data.phases, ctx).targets;
    if (isCompleteDay(i)) {
      registro++;
      if (i!.protein >= t.protein * 0.9) proteina++;
      if (Math.abs(i!.kcal - t.kcal) <= t.kcal * 0.1) calorias++;
    }
    const s = data.stepsLogs.find((x) => x.date === d)?.steps ?? 0;
    if (s > 0 && s >= stepsTarget(data.stepsLogs, d).target) pasos++;
    const ml = data.waterLogs.filter((w) => w.date === d).reduce((a, w) => a + w.ml, 0);
    if (ml >= st.hydration.totalMl * 0.9) agua++;
  }
  const pesaje = new Set(data.bodyLogs.filter((l) => l.weight && l.date >= from && l.date <= to).map((l) => l.date)).size;
  const entrenos = data.sessions.filter((s) => s.completed && s.date >= from && s.date <= to).length;
  const sueno = data.recoveryLogs.filter((r) => r.date >= from && r.date <= to && (r.sleep_hours ?? 0) >= 7).length;
  return { proteina, calorias, registro, pasos, pesaje, entrenos, agua, sueno };
}

function plannedSessions(data: AppData, from: string, to: string): number {
  if (!data.routine) return 0;
  return dateRange(from, to).filter((d) => data.routine!.days.some((x) => x.weekday === parseISODate(d).getDay())).length;
}

/** Elige los retos de la semana que empieza en `ws` (lunes). */
export function pickChallenges(data: AppData, st: EngineState, ws: string): Challenge[] {
  const prevFrom = addDays(ws, -7);
  const prevTo = addDays(ws, -1);
  const last = countMetrics(data, st, prevFrom, prevTo);
  const planned = plannedSessions(data, ws, addDays(ws, 6));
  const max: Record<ChallengeKey, number> = { proteina: 7, calorias: 7, registro: 7, pasos: 7, pesaje: 7, entrenos: planned, agua: 7, sueno: 7 };
  const everLogged = {
    sueno: data.recoveryLogs.some((r) => r.sleep_hours != null),
    pasos: data.stepsLogs.some((s) => s.steps > 0),
    agua: data.waterLogs.length > 0,
  };
  const candidates = (Object.keys(max) as ChallengeKey[])
    .filter((k) => max[k] > 0)
    // Sin ningún registro histórico, el reto mediría la falta de registro, no el hábito: solo se propone "registro".
    .filter((k) => !(k in everLogged) || everLogged[k as keyof typeof everLogged])
    .map((k) => ({ k, ratio: last[k] / max[k] }))
    .filter((x) => x.ratio < 1);
  // Prioridad ante empate: lo que más influye en el resultado.
  const weight: Record<ChallengeKey, number> = { registro: 0, proteina: 0.01, calorias: 0.02, entrenos: 0.03, pesaje: 0.04, pasos: 0.05, sueno: 0.06, agua: 0.07 };
  candidates.sort((a, b) => a.ratio + weight[a.k] - (b.ratio + weight[b.k]));
  // Calorías y proteína dependen del registro: si "registro" está muy bajo, se reta primero solo el registro.
  const chosen: ChallengeKey[] = [];
  for (const c of candidates) {
    if (chosen.length >= 3) break;
    if ((c.k === 'proteina' || c.k === 'calorias') && chosen.includes('registro') && last.registro < 3) continue;
    chosen.push(c.k);
  }
  return chosen.map((k) => {
    const m = max[k];
    const floor = k === 'entrenos' ? m : Math.ceil(m * 0.5);
    return { key: k, max: m, goal: Math.min(m, Math.max(last[k] + 1, floor)) };
  });
}

export function challengeProgress(data: AppData, st: EngineState, ws: string, list: Challenge[], today: string): ChallengeProgress[] {
  const we = addDays(ws, 6);
  const to = today < we ? today : we;
  const now = to >= ws ? countMetrics(data, st, ws, to) : null;
  const last = countMetrics(data, st, addDays(ws, -7), addDays(ws, -1));
  const left = today < we ? dateRange(addDays(today, 1), we).length : 0;
  return list.map((c) => {
    const value = now?.[c.key] ?? 0;
    return { ...c, title: CHALLENGE_INFO[c.key].title(c.goal, c.max), value, done: value >= c.goal, possible: value + left + (today <= we ? 1 : 0) >= c.goal, lastWeek: last[c.key] };
  });
}

/** Semanas seguidas (hasta la anterior) en que se cumplieron todos los retos guardados. */
export function challengeStreak(data: AppData, st: EngineState, stored: Record<string, Challenge[]>, today: string): number {
  let n = 0;
  for (let ws = addDays(weekStart(today), -7); stored[ws]; ws = addDays(ws, -7)) {
    const pr = challengeProgress(data, st, ws, stored[ws], addDays(ws, 6));
    if (pr.length && pr.every((p) => p.done)) n++;
    else break;
  }
  return n;
}

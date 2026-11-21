// Hitos del proceso: se calculan a partir de tus registros (no se guardan), con la fecha en que se lograron.
// La app solo guarda cuáles ya celebró, para no repetirlos.
import type { AppData } from '../engine';
import type { Profile } from '../types';
import { compositionSnapshot } from '../body/composition';
import { bestE1rm } from '../training/progression';
import { addDays, round } from '../utils';
import { dailyIntake, isCompleteDay, weightTrend } from './trend';

export type MilestoneKind = 'peso' | 'cintura' | 'grasa' | 'meta' | 'fuerza' | 'constancia' | 'entrenos';

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  date: string;
  title: string;
  detail: string;
  /** Mayor = más importante (para ordenar la celebración). */
  weight: number;
}

const KG = [1, 3, 5, 10, 15, 20, 25, 30];
const PCT = [5, 10, 15, 20];
const WAIST = [3, 5, 10, 15];
const STREAK = [7, 14, 30, 60, 100, 200, 365];
const SESSIONS = [1, 10, 25, 50, 100, 200];
const STRENGTH_PCT = [10, 25, 50];

const fmt = (n: number, d = 1) => n.toLocaleString('es-MX', { maximumFractionDigits: d });

export function computeMilestones(data: AppData, today: string): Milestone[] {
  const out: Milestone[] = [];
  const p: Profile = data.profile;
  const logs = data.bodyLogs.filter((l) => l.date <= today);

  // ── Peso (tendencia, para que un día de agua no cuente)
  const trend = weightTrend(logs);
  const start = trend[0]?.trend ?? p.weightKg;
  for (const t of KG) {
    const hit = trend.find((x) => start - x.trend >= t - 1e-9);
    if (hit) out.push({ id: `kg_${t}`, kind: 'peso', date: hit.date, title: t === 1 ? '¡Tu primer kilo menos!' : `¡${t} kg menos!`, detail: `Tu peso de tendencia pasó de ${fmt(start)} a ${fmt(hit.trend)} kg.`, weight: 10 + t });
  }
  for (const t of PCT) {
    const hit = trend.find((x) => (start - x.trend) / start >= t / 100 - 1e-9);
    if (hit) out.push({ id: `pct_${t}`, kind: 'peso', date: hit.date, title: `¡${t} % de tu peso inicial!`, detail: `Bajaste ${fmt(start - hit.trend)} kg desde que empezaste.`, weight: 20 + t * 2 });
  }

  // ── Cintura
  const waists = logs.filter((l) => l.waist).sort((a, b) => a.date.localeCompare(b.date));
  const w0 = waists[0]?.waist ?? p.waistCm ?? null;
  if (w0) {
    for (const t of WAIST) {
      const hit = waists.find((l) => w0 - (l.waist as number) >= t - 1e-9);
      if (hit) out.push({ id: `waist_${t}`, kind: 'cintura', date: hit.date, title: `¡${t} cm menos de cintura!`, detail: `De ${fmt(w0)} a ${fmt(hit.waist as number)} cm: la señal más clara de que pierdes grasa.`, weight: 15 + t });
    }
  }

  // ── % de grasa (medido o estimado con peso de tendencia + medidas de esa fecha)
  const trendOn = (d: string) => [...trend].reverse().find((x) => x.date <= d)?.trend ?? null;
  let neck = p.neckCm ?? null;
  let hip = p.hipCm ?? null;
  let waist = p.waistCm ?? null;
  const bfSeries: { date: string; bf: number; measured: boolean }[] = [];
  for (const l of [...logs].sort((a, b) => a.date.localeCompare(b.date))) {
    neck = l.neck ?? neck;
    hip = l.hip ?? hip;
    waist = l.waist ?? waist;
    if (l.bf_percent && l.bf_method) {
      bfSeries.push({ date: l.date, bf: l.bf_percent, measured: true });
      continue;
    }
    if (!l.waist) continue; // solo se reestima cuando hay medida nueva
    const w = trendOn(l.date);
    if (!w) continue;
    bfSeries.push({ date: l.date, bf: compositionSnapshot(p, { weight: w, waist, neck, hip, measured: null }).bf.value, measured: false });
  }
  const bf0 = p.knownBodyFat ?? compositionSnapshot(p, { weight: p.weightKg, waist: p.waistCm, neck: p.neckCm, hip: p.hipCm, measured: null }).bf.value;
  for (let level = Math.floor(bf0) - 1; level >= p.targetBodyFat; level--) {
    const hit = bfSeries.find((x) => x.bf <= level + 1e-9);
    if (!hit) break;
    const isGoal = level <= p.targetBodyFat;
    out.push({
      id: `bf_${level}`,
      kind: isGoal ? 'meta' : 'grasa',
      date: hit.date,
      title: isGoal ? `¡Llegaste a tu meta de ${p.targetBodyFat} % de grasa!` : `¡Bajaste a ${level} % de grasa!`,
      detail: `${hit.measured ? 'Medido' : 'Estimado con tus medidas'}: ${fmt(hit.bf)} % (empezaste en ${fmt(bf0)} %).`,
      weight: isGoal ? 100 : 30 + (bf0 - level) * 3,
    });
  }

  // ── Fuerza: +10/25/50 % de tu 1RM estimado inicial en cada ejercicio
  const sessions = data.sessions.filter((s) => s.completed && s.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const firstBest = new Map<string, { e1rm: number; name: string }>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      const b = bestE1rm(e.sets);
      if (b <= 0) continue;
      const first = firstBest.get(e.exerciseId);
      if (!first) {
        firstBest.set(e.exerciseId, { e1rm: b, name: e.name });
        continue;
      }
      for (const t of STRENGTH_PCT) {
        const id = `str_${e.exerciseId}_${t}`;
        if (b >= first.e1rm * (1 + t / 100) && !out.some((m) => m.id === id))
          out.push({ id, kind: 'fuerza', date: s.date, title: `¡${e.name}: +${t} % de fuerza!`, detail: `Tu 1RM estimado pasó de ${fmt(first.e1rm)} a ${fmt(round(b, 1))} kg.`, weight: 12 + t / 2 });
      }
    }
  }

  // ── Entrenamientos completados
  SESSIONS.forEach((n) => {
    const s = sessions[n - 1];
    if (s) out.push({ id: `ses_${n}`, kind: 'entrenos', date: s.date, title: n === 1 ? '¡Tu primer entrenamiento registrado!' : `¡${n} entrenamientos!`, detail: 'Cada sesión suma para conservar y ganar músculo mientras bajas grasa.', weight: 8 + n / 10 });
  });

  // ── Constancia: días seguidos con la comida registrada
  const intake = dailyIntake(data.foodLogs.filter((f) => f.date <= today));
  const days = [...intake.keys()].filter((d) => isCompleteDay(intake.get(d))).sort();
  let run = 0;
  let prev: string | null = null;
  const reached = new Set<number>();
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    prev = d;
    for (const t of STREAK)
      if (run === t && !reached.has(t)) {
        reached.add(t);
        out.push({ id: `streak_${t}`, kind: 'constancia', date: d, title: `¡${t} días seguidos registrando tu comida!`, detail: 'La constancia es lo que más predice el resultado.', weight: 10 + t / 5 });
      }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.weight - b.weight);
}

/** Hitos logrados que aún no se han celebrado, del más importante al menos. */
export function pendingMilestones(all: Milestone[], seen: string[] | null | undefined): Milestone[] {
  if (!seen) return [];
  const s = new Set(seen);
  return all.filter((m) => !s.has(m.id)).sort((a, b) => b.weight - a.weight);
}

/** Próximos hitos de peso y grasa, con cuánto falta. */
export function nextMilestones(all: Milestone[], currentTrend: number | null, startWeight: number, currentBf: number, targetBf: number): { title: string; left: string }[] {
  const out: { title: string; left: string }[] = [];
  const have = new Set(all.map((m) => m.id));
  if (currentTrend != null) {
    const lost = startWeight - currentTrend;
    const nextKg = KG.find((t) => !have.has(`kg_${t}`));
    if (nextKg) out.push({ title: nextKg === 1 ? 'Tu primer kilo menos' : `${nextKg} kg menos`, left: `te faltan ${fmt(Math.max(0.1, nextKg - lost))} kg` });
  }
  let nextBf = Math.floor(currentBf - 1e-9);
  while (nextBf >= targetBf && have.has(`bf_${nextBf}`)) nextBf--;
  if (nextBf >= targetBf) out.push({ title: nextBf <= targetBf ? `Tu meta de ${targetBf} %` : `${nextBf} % de grasa`, left: `te falta ≈${fmt(Math.max(0.1, currentBf - nextBf))} punto${currentBf - nextBf > 1.05 ? 's' : ''}` });
  return out;
}

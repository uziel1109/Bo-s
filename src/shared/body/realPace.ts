// Proyección "a tu ritmo real": usa tu cambio de peso medido (no las fórmulas) para estimar cuándo llegarías
// al peso que corresponde a tu % de grasa objetivo, si mantienes el ritmo actual.
import type { BodyLog } from '../types';
import { weightRate } from '../analytics/trend';
import { addDays, daysBetween, round } from '../utils';

export interface RealPace {
  status: 'sin_datos' | 'sin_perdida' | 'en_meta' | 'ok';
  windowDays: number;
  weighIns: number;
  kgPerWeek: number | null;
  pctPerWeek: number | null;
  weeksToGoal: number | null;
  etaDate: string | null;
  fastWarning: boolean; // > 1 %/semana sostenido
  message: string;
}

/**
 * Requiere ≥ 14 días entre el primer y el último pesaje de la ventana y ≥ 6 pesajes (usa 28 días si existen,
 * si no, 21). Supone un % semanal constante: semanas = ln(meta/actual) / ln(1 + r).
 * Las primeras 2 semanas de una dieta suelen incluir pérdida de agua y glucógeno, por eso se excluyen
 * cuando el historial es corto.
 */
export function realPace(logs: BodyLog[], today: string, currentWeight: number, goalWeight: number): RealPace {
  const weights = logs.filter((l) => l.weight && l.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const base = { windowDays: 0, weighIns: 0, kgPerWeek: null, pctPerWeek: null, weeksToGoal: null, etaDate: null, fastWarning: false };
  if (currentWeight <= goalWeight) return { ...base, status: 'en_meta', message: 'Ya estás en (o por debajo de) tu peso aproximado de meta.' };
  const first = weights[0]?.date;
  const history = first ? daysBetween(first, today) : 0;
  // Si llevas menos de 5 semanas, se ignoran los primeros 14 días (agua y glucógeno).
  const skipEarly = history < 35 && history >= 28 ? 14 : 0;
  const windowDays = Math.min(28, Math.max(0, history - skipEarly));
  const inWindow = weights.filter((l) => l.date >= addDays(today, -windowDays));
  if (windowDays < 14 || inWindow.length < 6)
    return { ...base, windowDays, weighIns: inWindow.length, status: 'sin_datos', message: `Se necesitan al menos 2 semanas y 6 pesajes para medir tu ritmo real (tienes ${Math.max(0, history)} días y ${inWindow.length} pesajes en la ventana).` };
  const r = weightRate(logs, today, windowDays);
  if (!r) return { ...base, windowDays, weighIns: inWindow.length, status: 'sin_datos', message: 'Faltan pesajes para medir tu ritmo real.' };
  const rate = r.pctPerWeek / 100;
  if (rate >= -0.0005)
    return { ...base, windowDays, weighIns: r.n, kgPerWeek: r.kgPerWeek, pctPerWeek: r.pctPerWeek, status: 'sin_perdida', message: 'A tu ritmo actual tu peso no está bajando; la fecha no se puede estimar.' };
  const weeks = Math.log(goalWeight / currentWeight) / Math.log(1 + rate);
  const w = Math.max(1, Math.ceil(weeks));
  return {
    windowDays,
    weighIns: r.n,
    kgPerWeek: r.kgPerWeek,
    pctPerWeek: r.pctPerWeek,
    weeksToGoal: w,
    etaDate: addDays(today, w * 7),
    fastWarning: r.pctPerWeek < -1,
    status: 'ok',
    message: `A tu ritmo de los últimos ${windowDays} días (${round(r.kgPerWeek, 2)} kg/sem, ${r.pctPerWeek} %/sem)${history < 28 ? '; incluye tus primeras semanas, en las que se pierde agua y glucógeno, así que puede ser optimista' : ''}.`,
  };
}

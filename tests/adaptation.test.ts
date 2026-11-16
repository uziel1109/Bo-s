import { describe, expect, it } from 'vitest';
import { computeState, type AppData } from '../src/shared/engine';
import { analyzeAdaptation } from '../src/shared/analytics/adaptation';
import { observedTdee, weightTrend, dailyIntake, weightRate } from '../src/shared/analytics/trend';
import { buildWeeklyReport } from '../src/shared/analytics/weeklyReport';
import { answer, QUESTIONS, dailyCoach, matchQuestion } from '../src/shared/assistant/assistant';
import { defaultProfile } from '../src/shared/profileDefaults';
import { addDays, dateRange } from '../src/shared/utils';
import type { BodyLog, FoodLog } from '../src/shared/types';
import { hydrationTarget } from '../src/shared/hydration/hydration';
import { screenProfile, isBlocked } from '../src/shared/safety/screening';
import { assessSupplements } from '../src/shared/supplements/supplements';
import { stepsTarget, heartRateZones, cardioPlan } from '../src/shared/cardio/cardio';
import { generateDayTasks } from '../src/shared/calendar';

const TODAY = '2026-11-15';
const profile = { ...defaultProfile(), age: 32, heightCm: 178, weightKg: 95, waistCm: 102, neckCm: 40, createdAt: '2026-10-01T08:00:00Z' };

function makeData(opts: { weights: (i: number) => number | null; kcal: (i: number) => number | null; waist?: (i: number) => number | null; days?: number }): AppData {
  const days = opts.days ?? 35;
  const start = addDays(TODAY, -days + 1);
  const bodyLogs: BodyLog[] = [];
  const foodLogs: FoodLog[] = [];
  dateRange(start, TODAY).forEach((d, i) => {
    const w = opts.weights(i);
    const wa = opts.waist?.(i) ?? null;
    if (w != null || wa != null) bodyLogs.push({ id: d, date: d, weight: w, waist: wa });
    const k = opts.kcal(i);
    if (k != null) {
      foodLogs.push({ id: d + 'a', date: d, meal: 'desayuno', name: 'x', grams: 100, kcal: k / 2, protein: 80, carbs: 100, fat: 30, fiber: 10 });
      foodLogs.push({ id: d + 'b', date: d, meal: 'comida', name: 'y', grams: 100, kcal: k / 2, protein: 80, carbs: 100, fat: 30, fiber: 10 });
    }
  });
  return { profile, bodyLogs, foodLogs, waterLogs: [], cardioLogs: [], stepsLogs: [], recoveryLogs: [], sessions: [], routine: null, plan: null, adjustments: [] };
}

describe('Tendencia y gasto observado', () => {
  it('la tendencia suaviza fluctuaciones', () => {
    const logs = dateRange('2026-11-01', '2026-11-10').map((d, i) => ({ id: d, date: d, weight: 90 + (i % 2 ? 1 : -1) }));
    const tr = weightTrend(logs);
    const last = tr.slice(-5);
    const max = Math.max(...last.map((t) => t.trend));
    const min = Math.min(...last.map((t) => t.trend));
    expect(max - min).toBeLessThan(0.5);
  });

  it('recupera el GET real a partir de ingesta y peso', () => {
    // Peso baja 0.5 kg/semana con 2 000 kcal → GET real ≈ 2000 + 0.5×7700/7 = 2550
    const data = makeData({ weights: (i) => 95 - (0.5 / 7) * i, kcal: () => 2000, days: 35 });
    const obs = observedTdee(data.bodyLogs, dailyIntake(data.foodLogs), TODAY);
    expect(obs.tdee).not.toBeNull();
    expect(Math.abs(obs.tdee! - 2550)).toBeLessThan(120);
    expect(obs.confidence).toBe('alta');
  });

  it('sin datos suficientes no inventa el gasto', () => {
    const data = makeData({ weights: (i) => (i % 5 === 0 ? 95 : null), kcal: (i) => (i % 3 === 0 ? 2000 : null) });
    expect(observedTdee(data.bodyLogs, dailyIntake(data.foodLogs), TODAY).tdee).toBeNull();
  });

  it('ritmo por regresión', () => {
    const data = makeData({ weights: (i) => 95 - 0.1 * i, kcal: () => 2000 });
    const r = weightRate(data.bodyLogs, TODAY, 21)!;
    expect(r.kgPerWeek).toBeCloseTo(-0.7, 1);
  });
});

describe('Reglas de adaptación', () => {
  it('NO reduce calorías por una fluctuación de 1–2 días', () => {
    // Pierde a buen ritmo y los últimos 2 días sube 1.5 kg (agua/sal)
    const data = makeData({ weights: (i) => (i >= 33 ? 95 - 0.1 * 33 + 1.5 : 95 - 0.1 * i), kcal: () => 2000, waist: (i) => 102 - 0.1 * i });
    const st = computeState(data, TODAY);
    const a = analyzeAdaptation(data, st, TODAY);
    expect(a.proposals.find((p) => p.kind === 'calorias')).toBeUndefined();
  });

  it('propone reducir tras 3 semanas de estancamiento real con buen registro', () => {
    const data = makeData({ weights: (i) => 95 + (i % 2 ? 0.3 : -0.3), kcal: () => 2100, waist: () => 102 });
    data.plan = { id: 'p', created_at: '2026-10-01T00:00:00Z', scenario: 'moderado', reason: '', targets: { ...computeState(data, TODAY).recommendedTargets, kcal: 2100 } };
    const st = computeState(data, TODAY);
    const a = analyzeAdaptation(data, st, TODAY);
    const p = a.proposals.find((x) => x.kind === 'calorias');
    expect(p).toBeDefined();
    expect((p!.payload as { kcalDelta: number }).kcalDelta).toBeLessThan(0);
    expect((p!.payload as { kcalDelta: number }).kcalDelta).toBeGreaterThanOrEqual(-200);
    expect(p!.justification.length).toBeGreaterThan(1);
  });

  it('no propone recortes si el registro es insuficiente', () => {
    const data = makeData({ weights: () => 95, kcal: (i) => (i % 3 === 0 ? 2100 : null), waist: () => 102 });
    data.plan = { id: 'p', created_at: '2026-10-01T00:00:00Z', scenario: 'moderado', reason: '', targets: { ...computeState(data, TODAY).recommendedTargets, kcal: 2100 } };
    const st = computeState(data, TODAY);
    const a = analyzeAdaptation(data, st, TODAY);
    expect(a.proposals.find((x) => x.kind === 'calorias')).toBeUndefined();
    expect(a.claims.some((c) => /Registra tu comida/.test(c.text))).toBe(true);
  });

  it('reconoce recomposición (peso estable, cintura baja)', () => {
    const data = makeData({ weights: () => 95, kcal: () => 2100, waist: (i) => 104 - 0.1 * i });
    data.plan = { id: 'p', created_at: '2026-10-01T00:00:00Z', scenario: 'moderado', reason: '', targets: { ...computeState(data, TODAY).recommendedTargets, kcal: 2100 } };
    const st = computeState(data, TODAY);
    const a = analyzeAdaptation(data, st, TODAY);
    expect(a.proposals.find((x) => x.kind === 'calorias')).toBeUndefined();
    expect(a.claims.some((c) => c.kind === 'hipotesis' && /recomposición/.test(c.text))).toBe(true);
  });

  it('propone aumentar si la pérdida es demasiado rápida', () => {
    const data = makeData({ weights: (i) => 95 - 0.25 * i, kcal: () => 2100, waist: () => 102 });
    data.plan = { id: 'p', created_at: '2026-10-01T00:00:00Z', scenario: 'moderado', reason: '', targets: { ...computeState(data, TODAY).recommendedTargets, kcal: 2100 } };
    const st = computeState(data, TODAY);
    const p = analyzeAdaptation(data, st, TODAY).proposals.find((x) => x.kind === 'calorias');
    expect((p!.payload as { kcalDelta: number }).kcalDelta).toBeGreaterThan(0);
  });
});

describe('Informe semanal y asistente', () => {
  const data = makeData({ weights: (i) => 95 - 0.1 * i, kcal: () => 2000, waist: (i) => 102 - 0.05 * i });
  const st = computeState(data, TODAY);

  it('informe con los 10 apartados', () => {
    const r = buildWeeklyReport(data, st, '2026-11-12');
    expect(r.weekStart).toBe('2026-11-09');
    expect(r.avgWeight).not.toBeNull();
    expect(r.weightDiff!).toBeCloseTo(-0.7, 1);
    expect(r.waistDiff!).toBeLessThan(0);
    expect(r.calories.loggedDays).toBe(7);
    expect(r.macros.proteinAvg).toBe(160);
  });

  it('responde todas las preguntas con afirmaciones tipificadas', () => {
    for (const q of QUESTIONS) {
      const a = answer(q.key, data, st);
      expect(a.length, q.key).toBeGreaterThan(0);
      for (const c of a) expect(['dato', 'estimacion', 'hipotesis', 'recomendacion']).toContain(c.kind);
    }
    expect(matchQuestion('¿por qué no bajo de peso?')).toBe('estancado');
    expect(matchQuestion('cuanto me falta para el 20%')).toBe('falta');
    const c = dailyCoach(data, st);
    expect(c.today.length).toBeGreaterThan(0);
  });
});

describe('Seguridad, hidratación, cardio, suplementos y calendario', () => {
  it('banderas de presión arterial', () => {
    const f = screenProfile({ ...profile, systolic: 185, diastolic: 100 });
    expect(f.some((x) => x.level === 'urgente')).toBe(true);
    const f2 = screenProfile({ ...profile, systolic: 145, diastolic: 85 });
    expect(isBlocked(f2, 'hiit')).toBe(true);
    expect(isBlocked(screenProfile(profile), 'deficit')).toBe(false);
  });

  it('hidratación orientativa y respeto de restricciones médicas', () => {
    const h = hydrationTarget({ sex: 'hombre', weightKg: 75, sweatLevel: 'medio', ambientTempC: 20, fluidRestrictionMl: null }, 60, []);
    expect(h.totalMl).toBe(2600);
    expect(h.electrolytes.recommended).toBe(false);
    const r = hydrationTarget({ sex: 'hombre', weightKg: 75, sweatLevel: 'alto', ambientTempC: 35, fluidRestrictionMl: 1500 }, 90, []);
    expect(r.totalMl).toBe(1500);
    expect(r.electrolytes.recommended).toBe(false);
    const long = hydrationTarget({ sex: 'hombre', weightKg: 75, sweatLevel: 'alto', ambientTempC: 30, fluidRestrictionMl: null }, 90, []);
    expect(long.electrolytes.recommended).toBe(true);
  });

  it('cardio: pasos, zonas y HIIT condicionado', () => {
    expect(stepsTarget([], TODAY).target).toBe(7000);
    const logs = dateRange(addDays(TODAY, -7), addDays(TODAY, -1)).map((d) => ({ date: d, steps: 5000 }));
    expect(stepsTarget(logs, TODAY).target).toBe(7000);
    expect(heartRateZones(30).max).toBe(187);
    expect(cardioPlan(profile, screenProfile({ ...profile, conditions: ['cardiopatia'] })).hiitAllowed).toBe(false);
    expect(cardioPlan(profile, []).hiitAllowed).toBe(true);
  });

  it('suplementos: nada por defecto sin justificación, valoración con riesgo', () => {
    const ctx = { proteinTarget: 160, avgProteinIntake: 120, loggedDays: 7, trainingMinutes: 60, weightKg: 95 };
    const res = assessSupplements(profile, [], ctx);
    expect(res.find((r) => r.supplement.key === 'creatina')!.cls).toBe('util');
    expect(res.find((r) => r.supplement.key === 'proteina')!.cls).toBe('util');
    expect(res.find((r) => r.supplement.key === 'vitamina_d')!.cls).toBe('valoracion');
    const renal = { ...profile, conditions: ['renal'] };
    const r2 = assessSupplements(renal, screenProfile(renal), ctx);
    expect(r2.find((r) => r.supplement.key === 'creatina')!.cls).toBe('valoracion');
    const ok = assessSupplements(profile, [], { ...ctx, avgProteinIntake: 170 });
    expect(ok.find((r) => r.supplement.key === 'proteina')!.cls).toBe('no_necesario');
  });

  it('calendario genera tareas del día', () => {
    const tasks = generateDayTasks('2026-11-16', profile, null, [{ supplement_key: 'creatina', name: 'Creatina', dose: '5 g', timing: 'cualquier hora', active: 1 }]);
    expect(tasks.some((t) => t.key === 'cintura')).toBe(true); // lunes
    expect(tasks.some((t) => t.key === 'sup_creatina')).toBe(true);
    expect(tasks.filter((t) => t.type === 'comida').length).toBe(4);
  });
});

import { realPace } from '../src/shared/body/realPace';
describe('Fecha estimada a tu ritmo real', () => {
  const mk = (days: number, perDay: number) => dateRange(addDays(TODAY, -days + 1), TODAY).map((d, i) => ({ id: d, date: d, weight: 95 + perDay * i }));
  it('sin datos suficientes no inventa una fecha', () => {
    expect(realPace(mk(7, -0.1), TODAY, 94.4, 85).status).toBe('sin_datos');
  });
  it('calcula con el % semanal medido', () => {
    const logs = mk(42, -0.1); // −0.7 kg/sem
    const cur = logs[logs.length - 1].weight;
    const r = realPace(logs, TODAY, cur, 80);
    expect(r.status).toBe('ok');
    expect(r.kgPerWeek).toBeCloseTo(-0.7, 1);
    const expected = Math.ceil(Math.log(80 / cur) / Math.log(1 + r.pctPerWeek! / 100));
    expect(r.weeksToGoal).toBe(expected);
    expect(r.fastWarning).toBe(false);
  });
  it('avisa si el ritmo supera 1 %/semana y detecta estancamiento', () => {
    expect(realPace(mk(30, -0.2), TODAY, 89, 80).fastWarning).toBe(true);
    expect(realPace(mk(30, 0), TODAY, 95, 80).status).toBe('sin_perdida');
    expect(realPace(mk(30, -0.1), TODAY, 79, 80).status).toBe('en_meta');
  });
});

import { buildIcs, icsEventCount, parseTime } from '../src/shared/calendarIcs';
import { generateRoutine } from '../src/shared/training/generator';
describe('Recordatorios para el calendario (.ics)', () => {
  const p = { ...profile, trainingDays: [1, 3, 5], trainingSchedule: 'de 6:30 a 7:30' };
  const r = generateRoutine(p);
  const opts = { training: true, trainingTime: parseTime(p.trainingSchedule), weighIn: true, weighInTime: '07:00', measures: true, review: true, photos: true, meals: false, alarmMinutes: 15 };
  const ics = buildIcs(p, r, opts, new Date(2026, 10, 15, 9)); // domingo 15 nov 2026
  it('extrae la hora del horario escrito', () => {
    expect(parseTime('de 6:30 a 7:30')).toBe('06:30');
    expect(parseTime('por la tarde')).toBe('07:00');
    expect(parseTime('19.15 h')).toBe('19:15');
  });
  it('genera un iCalendar válido con eventos recurrentes y alarmas', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
    expect(icsEventCount(ics)).toBe(3 + 4); // 3 entrenos + pesaje, medidas, revisión, fotos
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(ics).toContain('DTSTART:20261116T063000'); // primer lunes, 6:30
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYDAY=1SU');
    expect(ics).toContain('TRIGGER:-PT15M');
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBe(icsEventCount(ics));
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toMatch(/[^\r]\n/); // solo CRLF
  });
  it('comidas opcionales', () => {
    const withMeals = buildIcs(p, r, { ...opts, meals: true }, new Date(2026, 10, 15, 9));
    expect(icsEventCount(withMeals)).toBe(7 + p.mealsPerDay);
  });
});

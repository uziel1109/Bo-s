import { describe, expect, it } from 'vitest';
import { computeState, type AppData } from '../src/shared/engine';
import { monthlySummary, monthsWithData, monthBounds } from '../src/shared/analytics/monthly';
import { challengeProgress, challengeStreak, countMetrics, pickChallenges } from '../src/shared/analytics/challenges';
import { defaultProfile } from '../src/shared/profileDefaults';
import { addDays, dateRange } from '../src/shared/utils';
import type { BodyLog, FoodLog, WorkoutSession } from '../src/shared/types';

const TODAY = '2026-11-16'; // lunes
const profile = { ...defaultProfile(), age: 32, heightCm: 178, weightKg: 95, waistCm: 102, neckCm: 40, createdAt: '2026-09-01T08:00:00Z' };

function makeData(): AppData {
  const bodyLogs: BodyLog[] = [];
  const foodLogs: FoodLog[] = [];
  const sessions: WorkoutSession[] = [];
  dateRange('2026-09-20', TODAY).forEach((d, i) => {
    bodyLogs.push({ id: d, date: d, weight: 95 - i * 0.06, waist: i % 7 === 0 ? 102 - i * 0.05 : null });
    // Octubre: proteína alta casi todos los días; semana pasada (9–15 nov) solo 2 días.
    const lowProteinWeek = d >= '2026-11-09' && d <= '2026-11-15' && !['2026-11-09', '2026-11-10'].includes(d);
    foodLogs.push({ id: d + 'a', date: d, meal: 'desayuno', name: 'x', grams: 1, kcal: 1000, protein: lowProteinWeek ? 50 : 100, carbs: 100, fat: 30, fiber: 10 });
    foodLogs.push({ id: d + 'b', date: d, meal: 'comida', name: 'y', grams: 1, kcal: 1100, protein: lowProteinWeek ? 50 : 100, carbs: 100, fat: 30, fiber: 10 });
  });
  // Press de banca: 80×8 en septiembre, 85×8 en octubre (marca personal).
  const sess = (date: string, w: number): WorkoutSession => ({ id: date, date, completed: 1, exercises: [{ exerciseId: 'press_banca', name: 'Press de banca', targetSets: 1, repMin: 6, repMax: 10, targetRir: 2, sets: [{ weight: w, reps: 8, rir: 2, done: true }] }] });
  sessions.push(sess('2026-09-25', 80), sess('2026-10-08', 82.5), sess('2026-10-22', 85));
  return { profile, bodyLogs, foodLogs, waterLogs: [], cardioLogs: [], stepsLogs: [], recoveryLogs: [], sessions, routine: null, plan: null, adjustments: [] };
}

describe('Resumen mensual', () => {
  const data = makeData();
  const st = computeState(data, TODAY);

  it('calcula cambios del mes con la tendencia y detecta marcas personales', () => {
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    const s = monthlySummary(data, st, '2026-10', TODAY);
    expect(s.complete).toBe(true);
    expect(s.days).toBe(31);
    expect(s.weight.diff!).toBeLessThan(-1);
    expect(s.weight.diff!).toBeGreaterThan(-2.5);
    expect(s.waist.diff!).toBeLessThan(0);
    expect(s.bf.diff!).toBeLessThan(0);
    expect(s.training.sessions).toBe(2);
    expect(s.training.prs.map((p) => p.name)).toEqual(['Press de banca']);
    expect(s.training.prs[0].to).toBeGreaterThan(s.training.prs[0].from);
    expect(s.nutrition.loggedDays).toBe(31);
    expect(s.weighIns).toBe(31);
    expect(s.highlights.join(' ')).toMatch(/Bajaste/);
  });

  it('el mes en curso llega hasta hoy', () => {
    const s = monthlySummary(data, st, '2026-11', TODAY);
    expect(s.complete).toBe(false);
    expect(s.to).toBe(TODAY);
    expect(s.days).toBe(16);
    expect(monthsWithData(data, TODAY)).toEqual(['2026-11', '2026-10', '2026-09']);
  });
});

describe('Retos semanales', () => {
  const data = makeData();
  const st = computeState(data, TODAY);

  it('elige los puntos débiles de la semana pasada con metas alcanzables', () => {
    const last = countMetrics(data, st, addDays(TODAY, -7), addDays(TODAY, -1));
    expect(last.registro).toBe(7);
    expect(last.proteina).toBe(2);
    const ch = pickChallenges(data, st, TODAY);
    expect(ch.length).toBeGreaterThan(0);
    expect(ch.length).toBeLessThanOrEqual(3);
    const keys = ch.map((c) => c.key);
    expect(keys).toContain('proteina');
    // Sin registros de pasos, agua ni sueño no se proponen esos retos.
    expect(keys).not.toContain('pasos');
    expect(keys).not.toContain('agua');
    expect(keys).not.toContain('sueno');
    // Registro ya está al 100 %: no se reta.
    expect(keys).not.toContain('registro');
    const p = ch.find((c) => c.key === 'proteina')!;
    expect(p.goal).toBe(4); // mitad de la semana como mínimo
  });

  it('mide el avance de la semana y la racha', () => {
    const ch = [{ key: 'pesaje' as const, goal: 5, max: 7 }];
    const prog = challengeProgress(data, st, TODAY, ch, TODAY);
    expect(prog[0].value).toBe(1);
    expect(prog[0].possible).toBe(true);
    const prev = addDays(TODAY, -7);
    expect(challengeStreak(data, st, { [prev]: [{ key: 'pesaje', goal: 7, max: 7 }] }, TODAY)).toBe(1);
    expect(challengeStreak(data, st, { [prev]: [{ key: 'proteina', goal: 5, max: 7 }] }, TODAY)).toBe(0);
  });
});

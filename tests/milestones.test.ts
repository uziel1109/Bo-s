import { describe, expect, it } from 'vitest';
import { computeMilestones, nextMilestones, pendingMilestones } from '../src/shared/analytics/milestones';
import type { AppData } from '../src/shared/engine';
import { defaultProfile } from '../src/shared/profileDefaults';
import { addDays, dateRange } from '../src/shared/utils';
import type { BodyLog, FoodLog, WorkoutSession } from '../src/shared/types';

const TODAY = '2026-11-16';
const profile = { ...defaultProfile(), age: 32, heightCm: 178, weightKg: 95, waistCm: 102, neckCm: 40, targetBodyFat: 20 };

function data(days = 120): AppData {
  const bodyLogs: BodyLog[] = [];
  const foodLogs: FoodLog[] = [];
  const sessions: WorkoutSession[] = [];
  dateRange(addDays(TODAY, -days + 1), TODAY).forEach((d, i) => {
    bodyLogs.push({ id: d, date: d, weight: 95 - i * 0.07, waist: i % 7 === 0 ? 102 - i * 0.06 : null, neck: i % 7 === 0 ? 40 : null });
    if (i < 35) {
      foodLogs.push({ id: d + 'a', date: d, meal: 'desayuno', name: 'x', grams: 1, kcal: 700, protein: 60, carbs: 50, fat: 20, fiber: 5 });
      foodLogs.push({ id: d + 'b', date: d, meal: 'comida', name: 'y', grams: 1, kcal: 900, protein: 70, carbs: 80, fat: 25, fiber: 8 });
    }
    if (i % 3 === 0) sessions.push({ id: d, date: d, completed: 1, exercises: [{ exerciseId: 'press_banca', name: 'Press de banca', targetSets: 1, repMin: 6, repMax: 10, targetRir: 2, sets: [{ weight: 60 + i * 0.25, reps: 8, rir: 2, done: true }] }] });
  });
  return { profile, bodyLogs, foodLogs, waterLogs: [], cardioLogs: [], stepsLogs: [], recoveryLogs: [], sessions, routine: null, plan: null, adjustments: [] };
}

describe('Hitos', () => {
  const all = computeMilestones(data(), TODAY);
  const ids = all.map((m) => m.id);

  it('detecta kilos, % de peso, cintura, grasa, fuerza, entrenos y constancia', () => {
    expect(ids).toEqual(expect.arrayContaining(['kg_1', 'kg_3', 'kg_5', 'pct_5', 'waist_3', 'waist_5', 'ses_1', 'ses_10', 'ses_25', 'streak_7', 'streak_14', 'streak_30', 'str_press_banca_10', 'str_press_banca_25']));
    expect(ids).not.toContain('kg_10');
    expect(ids).not.toContain('streak_60');
    expect(ids.some((id) => id.startsWith('bf_'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('las fechas son las del día en que se logró, en orden', () => {
    const kg1 = all.find((m) => m.id === 'kg_1')!;
    const kg3 = all.find((m) => m.id === 'kg_3')!;
    expect(kg1.date < kg3.date).toBe(true);
    expect(all.find((m) => m.id === 'streak_30')!.date).toBe(addDays(TODAY, -120 + 30));
    for (let i = 1; i < all.length; i++) expect(all[i - 1].date <= all[i].date).toBe(true);
  });

  it('la primera vez no celebra lo que ya existía; luego solo lo nuevo, lo más importante primero', () => {
    expect(pendingMilestones(all, undefined)).toEqual([]);
    const seen = ids.filter((id) => id !== 'kg_5' && id !== 'ses_1');
    const p = pendingMilestones(all, seen);
    expect(p.map((m) => m.id)).toEqual(['kg_5', 'ses_1']);
  });

  it('propone el siguiente hito con lo que falta', () => {
    const next = nextMilestones(all, 87.3, 95, 23.4, 20);
    expect(next[0].title).toBe('10 kg menos');
    expect(next[0].left).toMatch(/2[.,]3 kg/);
    expect(next.some((n) => /grasa|meta/.test(n.title))).toBe(true);
  });
});

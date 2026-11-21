import { describe, expect, it } from 'vitest';
import { dayPlanFor, etaWithBreaks, eventBanking, inDietBreak, maintenanceKcalOn, maintenanceWeeks, nextDietBreak, weekPlan, legDaysFromRoutine, type PhaseSettings } from '../src/shared/nutrition/phases';
import type { NutritionTargets } from '../src/shared/types';
import { addDays } from '../src/shared/utils';

const base: NutritionTargets = { kcal: 2000, protein: 170, carbs: 180, fat: 65, fiber: 30, tdee: 2600, bmr: 1800, deficit: 600, deficitPct: 23, weeklyRatePct: 0.75, proteinPerKg: 2, rationale: [], floorApplied: false, method: 'x' };
const ctx = { tdee: 2600, floor: 1500, legWeekdays: [1, 4] };
const MON = '2026-11-16'; // lunes

describe('Fases de dieta', () => {
  it('sin configuración devuelve el plan base', () => {
    const d = dayPlanFor(MON, base, null, ctx);
    expect(d.kind).toBe('deficit');
    expect(d.kcal).toBe(2000);
  });

  it('descanso de dieta: semanas de mantenimiento tras N semanas de déficit', () => {
    const ps: PhaseSettings = { dietBreak: { enabled: true, everyWeeks: 8, lengthDays: 14, anchor: MON } };
    expect(inDietBreak(ps.dietBreak, addDays(MON, 55))).toBe(false);
    expect(inDietBreak(ps.dietBreak, addDays(MON, 56))).toBe(true);
    expect(inDietBreak(ps.dietBreak, addDays(MON, 69))).toBe(true);
    expect(inDietBreak(ps.dietBreak, addDays(MON, 70))).toBe(false);
    const d = dayPlanFor(addDays(MON, 60), base, ps, ctx);
    expect(d.kind).toBe('descanso_dieta');
    expect(d.kcal).toBe(2600);
    expect(d.targets.protein).toBe(170);
    expect(nextDietBreak(ps.dietBreak, MON)).toEqual({ start: addDays(MON, 56), end: addDays(MON, 69) });
    // La fecha estimada se recorre los días de descanso.
    const r = etaWithBreaks(ps.dietBreak, MON, addDays(MON, 100));
    expect(r.extraDays).toBe(14);
    expect(r.eta).toBe(addDays(MON, 114));
  });

  it('recargas en días de pierna: solo suben carbohidratos y se compensa el resto de la semana', () => {
    const ps: PhaseSettings = { refeed: { enabled: true, mode: 'dias_pierna', weekdays: [], compensate: true } };
    const week = weekPlan(MON, base, ps, ctx);
    const refeeds = week.filter((d) => d.kind === 'recarga');
    expect(refeeds.length).toBe(2);
    expect(refeeds[0].kcal).toBe(2600);
    expect(refeeds[0].targets.fat).toBe(65);
    expect(refeeds[0].targets.carbs).toBe(180 + 150);
    // Promedio semanal ≈ plan base (±30 kcal por redondeo).
    const avg = week.reduce((a, d) => a + d.kcal, 0) / 7;
    expect(Math.abs(avg - 2000)).toBeLessThan(30);
    for (const d of week) expect(d.kcal).toBeGreaterThanOrEqual(1500);
  });

  it('evento: ahorra en los días previos y suma el día del evento', () => {
    const ev = { id: 'e', date: addDays(MON, 5), name: 'Boda', extraKcal: 800, bankDays: 4 };
    const b = eventBanking(ev, 2000, 1500);
    expect(b.perDay).toBe(200);
    expect(b.shortfall).toBe(0);
    const ps: PhaseSettings = { events: [ev] };
    const week = weekPlan(MON, base, ps, ctx);
    expect(week[0].kind).toBe('deficit');
    expect(week.slice(1, 5).every((d) => d.kind === 'ahorro' && d.kcal === 1800)).toBe(true);
    expect(week[5].kind).toBe('evento');
    expect(week[5].kcal).toBe(2800);
    expect(week[5].targets.protein).toBe(170);
  });

  it('el ahorro nunca baja del mínimo de seguridad y avisa del excedente', () => {
    const b = eventBanking({ id: 'e', date: MON, name: 'x', extraKcal: 1500, bankDays: 3 }, 1600, 1500);
    expect(b.perDay).toBe(100);
    expect(b.shortfall).toBe(1200);
  });

  it('fase de mantenimiento gradual y directa', () => {
    const m = { start: MON, fromKcal: 2000, toKcal: 2600, mode: 'gradual' as const, goalWeight: 80 };
    expect(maintenanceWeeks(m)).toBe(5);
    expect(maintenanceKcalOn(m, MON)).toBe(2120);
    expect(maintenanceKcalOn(m, addDays(MON, 7))).toBe(2240);
    expect(maintenanceKcalOn(m, addDays(MON, 70))).toBe(2600);
    const d = { ...m, mode: 'directo' as const };
    expect(maintenanceKcalOn(d, MON)).toBe(2420);
    expect(maintenanceKcalOn(d, addDays(MON, 8))).toBe(2600);
    // Sustituye descansos, recargas y eventos.
    const p = dayPlanFor(addDays(MON, 3), base, { maintenance: m, refeed: { enabled: true, mode: 'dias_fijos', weekdays: [4], compensate: true } }, ctx);
    expect(p.kind).toBe('mantenimiento');
    expect(p.targets.protein).toBe(170);
  });

  it('detecta los días de pierna de la rutina', () => {
    const routine = { days: [{ weekday: 1, exercises: [{ exerciseId: 'sentadilla_barra' }, { exerciseId: 'peso_muerto_rumano' }] }, { weekday: 3, exercises: [{ exerciseId: 'press_banca' }] }] };
    const prim: Record<string, string> = { sentadilla_barra: 'cuadriceps', peso_muerto_rumano: 'isquiotibiales', press_banca: 'pecho' };
    expect(legDaysFromRoutine(routine, (id) => prim[id])).toEqual([1]);
  });
});

import { computeState, noTrainingActive, type AppData } from '../src/shared/engine';
import { defaultProfile } from '../src/shared/profileDefaults';
import { generateRoutine } from '../src/shared/training/generator';

describe('Modo sin entrenamiento', () => {
  const today = '2026-11-16';
  const profile = { ...defaultProfile(), age: 32, heightCm: 178, weightKg: 95, waistCm: 102, neckCm: 40, trainingDays: [1, 2, 4, 5] };
  const routine = generateRoutine(profile);
  const base: AppData = { profile, bodyLogs: [], foodLogs: [], waterLogs: [], cardioLogs: [], stepsLogs: [], recoveryLogs: [], sessions: [], routine, plan: null, adjustments: [] };

  it('vigencia con fecha de fin', () => {
    expect(noTrainingActive({ enabled: true, since: today, until: '2026-11-20' }, '2026-11-20')).toBe(true);
    expect(noTrainingActive({ enabled: true, since: today, until: '2026-11-20' }, '2026-11-21')).toBe(false);
    expect(noTrainingActive({ enabled: false, since: today }, today)).toBe(false);
  });

  it('sin plan fijo: baja el gasto y las calorías; la proteína no cambia', () => {
    const on = computeState({ ...base, routine: null, noTraining: { enabled: true, since: today } }, today);
    const off = computeState(base, today);
    expect(on.noTraining.active).toBe(true);
    expect(on.tdeeFormula.tdee).toBeLessThan(off.tdeeFormula.tdee - 150);
    expect(on.targets.kcal).toBeLessThan(off.targets.kcal);
    expect(on.targets.protein).toBe(off.targets.protein);
    expect(on.strengthSessionsPerWeek).toBe(0);
  });

  it('con plan fijo: resta el gasto del entrenamiento sin bajar del mínimo seguro', () => {
    const off = computeState(base, today);
    const plan = { id: 'p', created_at: '2026-11-01T00:00:00Z', scenario: 'moderado' as const, reason: '', targets: off.recommendedTargets };
    const on = computeState({ ...base, plan, routine: null, noTraining: { enabled: true, since: today } }, today);
    expect(on.noTraining.kcalDelta).toBeLessThan(-150);
    expect(on.targets.kcal).toBe(plan.targets.kcal + on.noTraining.kcalDelta);
    expect(on.targets.protein).toBe(plan.targets.protein);
    const low = computeState({ ...base, plan: { ...plan, targets: { ...plan.targets, kcal: 1550 } }, routine: null, noTraining: { enabled: true, since: today } }, today);
    expect(low.targets.kcal).toBe(1500);
    expect(low.noTraining.floorLimited).toBe(true);
  });
});

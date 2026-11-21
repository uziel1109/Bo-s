import { describe, expect, it } from 'vitest';
import { bmi, bmrKatch, bmrMifflin, cunBaeBodyFat, estimateBodyFat, estimateTdee, navyBodyFat, rfmBodyFat, weightAtBodyFat, compositionSnapshot } from '../src/shared/body/composition';
import { simulate, simulateAll, recommendedScenario } from '../src/shared/body/projection';

describe('Fórmulas de composición corporal', () => {
  it('IMC', () => {
    expect(bmi(85, 175)).toBeCloseTo(27.755, 2);
  });

  it('Mifflin-St Jeor (valores calculados a mano)', () => {
    expect(bmrMifflin('hombre', 85, 175, 30)).toBeCloseTo(1798.75, 2);
    expect(bmrMifflin('mujer', 60, 165, 25)).toBeCloseTo(1345.25, 2);
  });

  it('Katch-McArdle', () => {
    expect(bmrKatch(60)).toBeCloseTo(1666, 5);
  });

  it('US Navy hombre (178 cm, cintura 90, cuello 38) ≈ 20.2 %', () => {
    expect(navyBodyFat('hombre', 178, 90, 38)).toBeCloseTo(20.15, 1);
  });

  it('US Navy mujer requiere cadera', () => {
    expect(navyBodyFat('mujer', 165, 75, 33, null)).toBeNull();
    const v = navyBodyFat('mujer', 165, 75, 33, 100)!;
    expect(v).toBeGreaterThan(25);
    expect(v).toBeLessThan(35);
  });

  it('US Navy rechaza medidas incoherentes', () => {
    expect(navyBodyFat('hombre', 175, 35, 40)).toBeNull();
  });

  it('RFM', () => {
    expect(rfmBodyFat('hombre', 175, 95)).toBeCloseTo(27.158, 2);
    expect(rfmBodyFat('mujer', 175, 95)).toBeCloseTo(39.158, 2);
  });

  it('CUN-BAE (cálculo manual ≈ 26.3 %)', () => {
    expect(cunBaeBodyFat('hombre', 30, 27.755)).toBeCloseTo(26.31, 1);
  });

  it('selecciona el mejor método disponible y marca estimaciones', () => {
    const base = { sex: 'hombre' as const, age: 30, heightCm: 178, weightKg: 85 };
    expect(estimateBodyFat({ ...base }).method).toBe('cun_bae');
    expect(estimateBodyFat({ ...base, waistCm: 90 }).method).toBe('rfm');
    const navy = estimateBodyFat({ ...base, waistCm: 90, neckCm: 38 });
    expect(navy.method).toBe('navy');
    expect(navy.isMeasured).toBe(false);
    const dexa = estimateBodyFat({ ...base, waistCm: 90, neckCm: 38, measured: { value: 23, method: 'dexa' } });
    expect(dexa.method).toBe('dexa');
    expect(dexa.isMeasured).toBe(true);
    expect(dexa.value).toBe(23);
    const visual = estimateBodyFat({ ...base, measured: { value: 23, method: 'visual' } });
    expect(visual.isMeasured).toBe(false);
  });

  it('peso al % objetivo conservando masa magra', () => {
    expect(weightAtBodyFat(68, 20)).toBeCloseTo(85, 5);
  });

  it('snapshot: grasa a perder y progreso', () => {
    const s = compositionSnapshot({ sex: 'hombre', age: 30, heightCm: 178, targetBodyFat: 20 }, { weight: 95, measured: { value: 30, method: 'dexa' } });
    expect(s.fatMass).toBeCloseTo(28.5, 1);
    expect(s.leanMass).toBeCloseTo(66.5, 1);
    expect(s.goalWeight).toBeCloseTo(83.1, 1);
    expect(s.fatToLose).toBeCloseTo(11.9, 1);
    const later = compositionSnapshot({ sex: 'hombre', age: 30, heightCm: 178, targetBodyFat: 20 }, { weight: 90, measured: { value: 25, method: 'dexa' } }, 30);
    expect(later.progressPct).toBe(50);
  });

  it('GET usa Mifflin con estimaciones y Katch con mediciones', () => {
    const bfEst = estimateBodyFat({ sex: 'hombre', age: 30, heightCm: 175, weightKg: 85, waistCm: 95, neckCm: 39 });
    const t = estimateTdee({ sex: 'hombre', age: 30, heightCm: 175, weightKg: 85, bf: bfEst, activity: 'ligero', strengthSessionsPerWeek: 4 });
    expect(t.bmrMethod).toBe('mifflin');
    expect(t.pal).toBeCloseTo(1.42, 2);
    expect(t.tdee).toBe(Math.round(1798.75 * 1.42));
    const bfM = estimateBodyFat({ sex: 'hombre', age: 30, heightCm: 175, weightKg: 85, measured: { value: 25, method: 'dexa' } });
    const t2 = estimateTdee({ sex: 'hombre', age: 30, heightCm: 175, weightKg: 85, bf: bfM, activity: 'ligero', strengthSessionsPerWeek: 0 });
    expect(t2.bmrMethod).toBe('katch');
    expect(t2.bmr).toBe(Math.round(370 + 21.6 * 63.75));
  });
});

describe('Simulador de transformación', () => {
  const input = { sex: 'hombre' as const, weightKg: 95, bfPct: 30, targetBfPct: 20, tdee: 2700, experience: 'principiante' as const, resistanceTraining: true, minCalories: 1500 };

  it('alcanza el objetivo y respeta el orden de escenarios', () => {
    const all = simulateAll(input);
    expect(all.conservador.reached).toBe(true);
    expect(all.agresivo.weeksToGoal!).toBeLessThan(all.moderado.weeksToGoal!);
    expect(all.moderado.weeksToGoal!).toBeLessThan(all.conservador.weeksToGoal!);
    expect(all.agresivo.weeks[all.agresivo.weeks.length - 1].bf).toBeLessThanOrEqual(20);
  });

  it('la pérdida no es lineal: el GET disminuye con el tiempo', () => {
    const r = simulate({ ...input, scenario: 'moderado' });
    const first = r.weeks[1].tdee;
    const last = r.weeks[r.weeks.length - 1].tdee;
    expect(last).toBeLessThan(first);
    // la pérdida absoluta del segundo trimestre es menor que la del primero
    const q1 = r.weeks[0].weight - r.weeks[12].weight;
    const q2 = r.weeks[12].weight - r.weeks[24].weight;
    expect(q2).toBeLessThanOrEqual(q1);
    // con ingesta fija dentro de un bloque, el déficit real se reduce semana a semana
    expect(r.weeks[3].tdee - r.weeks[3].intake).toBeLessThan(r.weeks[1].tdee - r.weeks[1].intake);
  });

  it('respeta el mínimo calórico', () => {
    const r = simulate({ ...input, tdee: 1700, scenario: 'agresivo' });
    expect(r.initialIntake).toBeGreaterThanOrEqual(1500);
  });

  it('con entrenamiento de fuerza se pierde menos masa magra', () => {
    const withRT = simulate({ ...input, scenario: 'moderado' });
    const without = simulate({ ...input, scenario: 'moderado', resistanceTraining: false });
    expect(withRT.leanChange).toBeGreaterThan(without.leanChange);
    // la mayor parte del peso perdido debe ser grasa
    expect(withRT.fatLost / withRT.weightLost).toBeGreaterThan(0.85);
  });

  it('escenario recomendado según % de grasa', () => {
    expect(recommendedScenario('hombre', 32, 20)).toBe('agresivo');
    expect(recommendedScenario('hombre', 26, 20)).toBe('moderado');
    expect(recommendedScenario('hombre', 22, 20)).toBe('conservador');
    expect(recommendedScenario('mujer', 32, 25)).toBe('moderado');
  });
});

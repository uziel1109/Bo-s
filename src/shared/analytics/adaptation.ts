// Motor de adaptación: analiza varias semanas de datos y PROPONE ajustes justificados.
// Nunca modifica el plan por sí mismo: cada propuesta requiere confirmación del usuario.
import { breakDaysBetween } from '../nutrition/phases';
import type { Adjustment, Claim, Muscle } from '../types';
import type { AppData, EngineState } from '../engine';
import { isCompleteDay, weeklyAverages, weightRate } from './trend';
import { addDays, daysBetween, mean, round, weekStart, dateRange } from '../utils';
import { calorieFloor } from '../safety/screening';
import { bestE1rm, deloadAdvice, exerciseHistory, muscleWeekStats } from '../training/progression';
import { MUSCLE_LABEL } from '../training/exercises';
import { SCENARIOS } from '../body/projection';
import { stepsTarget } from '../cardio/cardio';

export type AdjustmentDraft = Omit<Adjustment, 'id' | 'created_at' | 'status' | 'resolved_at'>;

export interface AdaptationResult {
  claims: Claim[];
  proposals: AdjustmentDraft[];
  metrics: {
    ratePctPerWeek: number | null;
    rateKgPerWeek: number | null;
    waistChange3w: number | null;
    logCoverage: number; // 0–1 en 21 días
    avgIntake: number | null;
    avgProtein: number | null;
    kcalAdherence: number | null; // ingesta media / objetivo
    strengthTrend: { improved: number; declined: number; total: number };
    daysOnPlan: number;
  };
}

export function strengthTrend(data: AppData, today: string): { improved: number; declined: number; total: number } {
  const from = addDays(today, -28);
  const done = data.sessions.filter((s) => s.completed && s.date <= today);
  const ids = new Set(done.filter((s) => s.date >= from).flatMap((s) => s.exercises.map((e) => e.exerciseId)));
  let improved = 0;
  let declined = 0;
  let total = 0;
  for (const id of ids) {
    const h = exerciseHistory(done, id);
    const recent = h.filter((x) => x.date >= from);
    const before = h.filter((x) => x.date < from).slice(-2);
    const seq = [...before, ...recent];
    if (seq.length < 2) continue;
    total++;
    const first = bestE1rm(seq[0].log.sets);
    const last = mean(seq.slice(-2).map((x) => bestE1rm(x.log.sets)));
    if (last > first * 1.02) improved++;
    else if (last < first * 0.95) declined++;
  }
  return { improved, declined, total };
}

export function analyzeAdaptation(data: AppData, st: EngineState, today: string): AdaptationResult {
  const claims: Claim[] = [];
  const proposals: AdjustmentDraft[] = [];
  const p = data.profile;
  const t = st.targets;
  const from21 = addDays(today, -20);
  const days21 = dateRange(from21, today);
  const complete = days21.map((d) => st.intake.get(d)).filter(isCompleteDay);
  const logCoverage = complete.length / days21.length;
  const avgIntake = complete.length ? Math.round(mean(complete.map((d) => d!.kcal))) : null;
  const avgProtein = complete.length ? round(mean(complete.map((d) => d!.protein)), 0) : null;
  const kcalAdherence = avgIntake != null ? round(avgIntake / t.kcal, 2) : null;
  const rate = weightRate(data.bodyLogs, today, 21);
  const weeks = weeklyAverages(data.bodyLogs.filter((l) => l.date <= today));
  const waistWeeks = weeks.filter((w) => w.avgWaist != null && w.weekStart >= weekStart(addDays(today, -27)));
  const waistChange3w = waistWeeks.length >= 2 ? round((waistWeeks[waistWeeks.length - 1].avgWaist as number) - (waistWeeks[0].avgWaist as number), 1) : null;
  const strength = strengthTrend(data, today);
  const planStart = data.plan?.created_at?.slice(0, 10) ?? data.profile.createdAt?.slice(0, 10) ?? today;
  const daysOnPlan = Math.max(0, daysBetween(planStart, today));
  const pending = new Set(data.adjustments.filter((a) => a.status === 'pendiente').map((a) => a.kind));
  const recentResolved = (kind: Adjustment['kind']) => data.adjustments.some((a) => a.kind === kind && a.status !== 'pendiente' && a.resolved_at && daysBetween(a.resolved_at.slice(0, 10), today) < 14);
  const scenarioRate = t.weeklyRatePct || SCENARIOS[p.scenario]?.weeklyRatePct || 0.75;
  const floor = calorieFloor(p.sex);
  const metrics = { ratePctPerWeek: rate?.pctPerWeek ?? null, rateKgPerWeek: rate?.kgPerWeek ?? null, waistChange3w, logCoverage: round(logCoverage, 2), avgIntake, avgProtein, kcalAdherence, strengthTrend: strength, daysOnPlan };

  // Fases especiales: durante la fase de mantenimiento o cerca de un descanso de dieta el peso sube por agua y
  // glucógeno, así que no se proponen recortes de calorías.
  const maintenanceOn = !!data.phases?.maintenance && data.phases.maintenance.start <= today;
  const recentBreak = breakDaysBetween(data.phases?.dietBreak, addDays(today, -20), today) > 0;
  if (maintenanceOn) claims.push({ kind: 'dato', text: 'Estás en la fase de mantenimiento: no se proponen recortes de calorías. Vigila que tu tendencia de peso se mantenga en el rango indicado.' });
  else if (recentBreak) claims.push({ kind: 'dato', text: 'Hubo un descanso de dieta en las últimas 3 semanas: el peso incluye agua y glucógeno recuperados, así que no se evalúa el estancamiento hasta que pasen 3 semanas.' });

  // ── Datos y meta alcanzada
  if (st.composition.bf.value <= p.targetBodyFat && !maintenanceOn) {
    claims.push({ kind: 'estimacion', text: `Tu % de grasa estimado (${st.composition.bf.value} %) ya está en tu objetivo de ${p.targetBodyFat} %. Confírmalo con una medición más precisa si es posible.` });
    if (t.deficit > 0 && !pending.has('calorias'))
      proposals.push({ kind: 'calorias', title: 'Pasar a calorías de mantenimiento', justification: ['Alcanzaste tu % de grasa objetivo (estimado).', 'Mantener el déficit ya no es necesario; el mantenimiento favorece rendimiento y ganancia muscular.'], payload: { kcalDelta: t.deficit, newKcal: t.tdee } });
  }

  if (!rate) {
    claims.push({ kind: 'dato', text: 'Aún no hay suficientes pesajes en las últimas 3 semanas (mínimo 4) para calcular tu ritmo real.' });
    claims.push({ kind: 'recomendacion', text: 'Pésate cada mañana, después de ir al baño y antes de comer o beber. La tendencia semanal es lo que cuenta.' });
  } else {
    claims.push({ kind: 'dato', text: `Ritmo de las últimas 3 semanas: ${rate.kgPerWeek > 0 ? '+' : ''}${rate.kgPerWeek} kg/semana (${rate.pctPerWeek > 0 ? '+' : ''}${rate.pctPerWeek} % del peso), con ${rate.n} pesajes.` });
  }
  if (waistChange3w != null) claims.push({ kind: 'dato', text: `Cambio de cintura en ~3 semanas: ${waistChange3w > 0 ? '+' : ''}${waistChange3w} cm.` });
  claims.push({ kind: 'dato', text: `Días con comida registrada completa en las últimas 3 semanas: ${complete.length} de 21.` });

  const enoughTime = daysOnPlan >= 21;
  const lowLogging = logCoverage < 0.7;
  const overEating = kcalAdherence != null && kcalAdherence > 1.1;

  if (lowLogging) claims.push({ kind: 'recomendacion', text: 'Registra tu comida al menos el 70 % de los días: sin ese dato no es posible distinguir un estancamiento real de un problema de registro, así que no se proponen cambios de calorías.' });
  if (overEating) claims.push({ kind: 'dato', text: `Tu ingesta media registrada (${avgIntake} kcal) supera tu objetivo (${t.kcal} kcal) en ${Math.round((kcalAdherence! - 1) * 100)} %.` });
  if (overEating) claims.push({ kind: 'recomendacion', text: 'Antes de reducir calorías conviene acercarse al objetivo actual. Revisa comidas fuera de casa, aceites y bebidas.' });

  // ── Estancamiento real
  if (rate && enoughTime && !lowLogging && !overEating && !maintenanceOn && !recentBreak && st.composition.bf.value > p.targetBodyFat) {
    const stalled = rate.pctPerWeek > -0.15 && (waistChange3w == null || waistChange3w > -0.5);
    const recomposition = rate.pctPerWeek > -0.15 && waistChange3w != null && waistChange3w <= -1;
    const tooFast = rate.pctPerWeek < -Math.max(1.0, scenarioRate * 1.5) && daysOnPlan >= 14;
    if (recomposition) {
      claims.push({ kind: 'hipotesis', text: 'El peso está estable pero la cintura baja: probable recomposición (pierdes grasa y ganas músculo). No se recomienda cambiar calorías.' });
    } else if (stalled && !pending.has('calorias') && !recentResolved('calorias')) {
      const delta = Math.max(100, Math.min(200, Math.round((t.kcal * 0.05) / 10) * 10));
      if (t.kcal - delta >= floor) {
        proposals.push({
          kind: 'calorias',
          title: `Reducir ${delta} kcal/día`,
          justification: [
            `Pérdida < 0.15 %/semana durante 3 semanas (${rate.pctPerWeek} %/sem).`,
            waistChange3w == null ? 'Sin datos de cintura que indiquen recomposición.' : `La cintura no bajó de forma relevante (${waistChange3w} cm).`,
            `Registro suficiente (${Math.round(logCoverage * 100)} % de días) e ingesta cercana al objetivo (${Math.round((kcalAdherence ?? 1) * 100)} %).`,
            'Reducción pequeña (~5 %) priorizando carbohidratos y grasas; la proteína no cambia.',
          ],
          payload: { kcalDelta: -delta, newKcal: t.kcal - delta },
        });
      } else if (!pending.has('actividad')) {
        proposals.push({
          kind: 'actividad',
          title: 'Aumentar 1 500 pasos diarios',
          justification: [`Estancamiento de 3 semanas (${rate.pctPerWeek} %/sem).`, `Tus calorías ya están en el mínimo sin supervisión (${floor} kcal), así que se aumenta el gasto en lugar de bajar la ingesta.`],
          payload: { stepsDelta: 1500 },
        });
      }
    } else if (tooFast && !pending.has('calorias') && !recentResolved('calorias')) {
      const delta = strength.declined >= 2 ? 200 : 120;
      proposals.push({
        kind: 'calorias',
        title: `Aumentar ${delta} kcal/día`,
        justification: [
          `Pérdida de ${rate.pctPerWeek} %/semana: más rápida que el rango seguro para conservar músculo.`,
          strength.declined >= 2 ? `${strength.declined} ejercicios con caída de fuerza: señal de déficit excesivo o fatiga.` : 'Una pérdida más lenta protege el músculo y el rendimiento.',
        ],
        payload: { kcalDelta: delta, newKcal: t.kcal + delta },
      });
    } else if (!stalled) {
      claims.push({ kind: 'estimacion', text: `Tu ritmo (${rate.pctPerWeek} %/sem) está dentro de lo esperado para el escenario ${SCENARIOS[p.scenario]?.label ?? ''}. No se requieren cambios.` });
    }
  } else if (rate && !enoughTime) {
    claims.push({ kind: 'recomendacion', text: `Llevas ${daysOnPlan} días con el plan actual. Se evalúan cambios de calorías después de 3 semanas para no reaccionar a fluctuaciones de agua.` });
  }

  // ── Proteína
  if (avgProtein != null && complete.length >= 5) {
    if (avgProtein < t.protein * 0.85) claims.push({ kind: 'recomendacion', text: `Tu proteína promedio (${avgProtein} g) está por debajo de tu meta (${t.protein} g). Es el factor nutricional más importante para conservar músculo en déficit.` });
    else claims.push({ kind: 'dato', text: `Proteína promedio de ${avgProtein} g/día: cumples tu meta de ${t.protein} g.` });
  }

  // ── Fuerza
  if (strength.total >= 2) {
    claims.push({ kind: 'dato', text: `Fuerza (4 semanas): ${strength.improved} ejercicios mejoran, ${strength.declined} bajan, de ${strength.total} con datos suficientes.` });
    if (strength.declined >= Math.max(2, strength.total / 2)) claims.push({ kind: 'hipotesis', text: 'Una caída de fuerza generalizada en déficit sugiere fatiga, poco sueño o un déficit demasiado grande. No necesariamente indica pérdida de músculo.' });
  }

  // ── Volumen por músculo prioritario
  if (data.routine && data.sessions.some((s) => s.completed)) {
    const w1 = muscleWeekStats(data.sessions, addDays(today, -7), today);
    const w2 = muscleWeekStats(data.sessions, today, today);
    for (const m of p.priorityMuscles as Muscle[]) {
      const avg = ((w1[m]?.effectiveSets ?? 0) + (w2[m]?.effectiveSets ?? 0)) / 2;
      if (avg < 8 && !pending.has('volumen') && !recentResolved('volumen')) {
        proposals.push({
          kind: 'volumen',
          title: `Añadir 2 series semanales de ${MUSCLE_LABEL[m]}`,
          justification: [`${MUSCLE_LABEL[m]} es un músculo prioritario y promedió ${round(avg, 1)} series efectivas/semana.`, 'Para hipertrofia se recomiendan ~10–20 series semanales por músculo (Schoenfeld 2017).'],
          payload: { muscle: m, addSets: 2 },
        });
        break;
      }
    }
  }

  // ── Descarga
  const lastDeload = data.adjustments.filter((a) => a.kind === 'recuperacion' && a.status === 'aceptado').map((a) => a.resolved_at?.slice(0, 10) ?? '').sort().pop();
  const deload = deloadAdvice(data.sessions, data.recoveryLogs, today, lastDeload ?? null);
  if (deload.recommended && !pending.has('recuperacion'))
    proposals.push({ kind: 'recuperacion', title: 'Semana de descarga', justification: [...deload.reasons, 'Reducir 40–50 % las series manteniendo cargas similares permite disipar fatiga sin perder adaptaciones.'], payload: { deload: true } });

  // ── Pasos
  const steps = stepsTarget(data.stepsLogs, today);
  if (steps.baseline != null) claims.push({ kind: 'dato', text: `Pasos promedio (7 días): ${steps.baseline.toLocaleString('es-MX')}.` });

  return { claims, proposals, metrics };
}

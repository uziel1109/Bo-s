// Asistente local basado en reglas: responde con TUS datos, etiquetando cada afirmación como
// dato, estimación, hipótesis o recomendación. Funciona sin conexión y sin IA externa.
import type { AppData, EngineState } from '../engine';
import type { Claim, Muscle } from '../types';
import { analyzeAdaptation } from '../analytics/adaptation';
import { addDays, round, today as todayFn } from '../utils';
import { muscleWeekStats, deloadAdvice } from '../training/progression';
import { MUSCLE_LABEL } from '../training/exercises';
import { weeklySetTarget } from '../training/generator';
import { stepsTarget } from '../cardio/cardio';
import { SCENARIOS } from '../body/projection';
import { realPace } from '../body/realPace';

export interface AssistantQuestion {
  key: string;
  question: string;
}

export const QUESTIONS: AssistantQuestion[] = [
  { key: 'ritmo', question: '¿Estoy perdiendo grasa al ritmo adecuado?' },
  { key: 'musculo', question: '¿Estoy perdiendo músculo?' },
  { key: 'calorias', question: '¿Debo modificar mis calorías?' },
  { key: 'proteina', question: '¿Necesito aumentar proteína?' },
  { key: 'entreno', question: '¿Estoy entrenando suficiente?' },
  { key: 'recuperacion', question: '¿Estoy recuperándome correctamente?' },
  { key: 'grupo', question: '¿Qué grupo muscular necesita más trabajo?' },
  { key: 'estancado', question: '¿Por qué estoy estancado?' },
  { key: 'falta', question: '¿Cuánto falta para alcanzar mi objetivo de grasa?' },
];

export function answer(key: string, data: AppData, st: EngineState): Claim[] {
  const t = st.today;
  const a = analyzeAdaptation(data, st, t);
  const m = a.metrics;
  const p = data.profile;
  const out: Claim[] = [];
  const sc = SCENARIOS[p.scenario];
  switch (key) {
    case 'ritmo': {
      if (m.ratePctPerWeek == null) {
        out.push({ kind: 'dato', text: 'No hay suficientes pesajes en las últimas 3 semanas para medir tu ritmo (se necesitan al menos 4).' });
        out.push({ kind: 'recomendacion', text: 'Pésate a diario en condiciones iguales; con 1–2 semanas de datos tendrás una respuesta fiable.' });
        break;
      }
      out.push({ kind: 'dato', text: `Ritmo actual: ${m.rateKgPerWeek} kg/semana (${m.ratePctPerWeek} % de tu peso).` });
      out.push({ kind: 'dato', text: `Objetivo del escenario ${sc.label}: ≈ −${sc.weeklyRatePct} %/semana. Rango saludable general: −0.5 a −1 %/semana.` });
      const r = -m.ratePctPerWeek;
      if (r >= 0.4 && r <= 1.1) out.push({ kind: 'estimacion', text: 'Vas a un ritmo adecuado.' });
      else if (r > 1.1) out.push({ kind: 'estimacion', text: 'Vas más rápido de lo recomendable; aumenta el riesgo de perder músculo y rendimiento.' });
      else if (r > 0) out.push({ kind: 'estimacion', text: 'Vas más lento que el objetivo.' });
      else out.push({ kind: 'estimacion', text: 'Tu peso de tendencia no está bajando.' });
      if (m.waistChange3w != null) out.push({ kind: 'dato', text: `Cintura en ~3 semanas: ${m.waistChange3w} cm. ${m.waistChange3w < 0 ? 'Indica pérdida de grasa abdominal.' : ''}` });
      out.push(...a.claims.filter((c) => c.kind === 'hipotesis'));
      break;
    }
    case 'musculo': {
      out.push({ kind: 'estimacion', text: `Masa libre de grasa estimada: ${st.composition.leanMass} kg (inicial: ${st.initialComposition.leanMass} kg). Con fórmulas antropométricas el error es de varios kg, así que se interpreta junto con la fuerza.` });
      const s = m.strengthTrend;
      if (s.total >= 2) {
        out.push({ kind: 'dato', text: `En 4 semanas: ${s.improved} ejercicios mejoran, ${s.declined} empeoran (de ${s.total}).` });
        if (s.declined <= s.improved) out.push({ kind: 'hipotesis', text: 'Mantener o subir la fuerza en déficit es la mejor señal práctica de que conservas músculo.' });
        else out.push({ kind: 'hipotesis', text: 'La caída de fuerza puede deberse a fatiga o a un déficit grande; no prueba pérdida muscular, pero es una señal de alerta.' });
      } else out.push({ kind: 'dato', text: 'Aún no hay suficientes sesiones registradas para evaluar la evolución de fuerza.' });
      if (m.avgProtein != null) out.push({ kind: 'dato', text: `Proteína promedio: ${m.avgProtein} g/día (meta ${st.targets.protein} g).` });
      if (m.ratePctPerWeek != null && m.ratePctPerWeek < -1.1) out.push({ kind: 'recomendacion', text: 'Reduce el ritmo de pérdida: por encima de ~1 %/semana aumenta la pérdida de masa magra.' });
      break;
    }
    case 'calorias': {
      const cal = a.proposals.find((x) => x.kind === 'calorias' || x.kind === 'actividad');
      if (cal) {
        out.push({ kind: 'recomendacion', text: `Sí: ${cal.title}.` });
        cal.justification.forEach((j) => out.push({ kind: 'dato', text: j }));
        out.push({ kind: 'recomendacion', text: 'Puedes aceptar o rechazar la propuesta en la sección Inteligencia artificial → Ajustes propuestos.' });
      } else {
        out.push({ kind: 'recomendacion', text: 'No por ahora.' });
        out.push(...a.claims.filter((c) => c.kind !== 'dato' || /Ritmo|registrada/.test(c.text)));
      }
      break;
    }
    case 'proteina': {
      out.push({ kind: 'dato', text: `Tu meta es ${st.targets.protein} g/día (${st.targets.proteinPerKg} g/kg de peso actual), calculada sobre tu peso objetivo para el % de grasa meta.` });
      if (m.avgProtein == null) out.push({ kind: 'dato', text: 'No hay suficientes días registrados para comparar.' });
      else if (m.avgProtein < st.targets.protein * 0.9) out.push({ kind: 'recomendacion', text: `Sí: tu promedio es ${m.avgProtein} g. Agrega una porción de proteína magra (p. ej., 150 g de pechuga ≈ 46 g) o reparte mejor entre comidas.` });
      else out.push({ kind: 'estimacion', text: `No: tu promedio (${m.avgProtein} g) ya cubre la meta. Más proteína no aporta beneficio adicional relevante.` });
      break;
    }
    case 'entreno': {
      const w = muscleWeekStats(data.sessions, t, t);
      const tgt = weeklySetTarget(p.experience);
      const done = data.sessions.filter((s) => s.completed && s.date >= addDays(t, -6)).length;
      out.push({ kind: 'dato', text: `Sesiones de fuerza en los últimos 7 días: ${done} (plan: ${data.routine?.daysPerWeek ?? '—'}).` });
      const low = (Object.keys(MUSCLE_LABEL) as Muscle[]).filter((mm) => (w[mm]?.effectiveSets ?? 0) < tgt * 0.6 && !['antebrazo', 'lumbares', 'aductores'].includes(mm));
      if (!data.sessions.some((s) => s.completed)) out.push({ kind: 'recomendacion', text: 'Registra tus sesiones para evaluar volumen y progresión.' });
      else if (low.length) out.push({ kind: 'estimacion', text: `Esta semana van por debajo de ~${Math.round(tgt * 0.6)} series efectivas: ${low.map((x) => MUSCLE_LABEL[x]).join(', ')}.` });
      else out.push({ kind: 'estimacion', text: 'El volumen semanal está en rango para todos los grupos principales.' });
      const steps = stepsTarget(data.stepsLogs, t);
      if (steps.baseline != null) out.push({ kind: 'dato', text: `Pasos promedio: ${steps.baseline.toLocaleString('es-MX')} (meta ${steps.target.toLocaleString('es-MX')}).` });
      break;
    }
    case 'recuperacion': {
      const d = deloadAdvice(data.sessions, data.recoveryLogs, t);
      const rec = data.recoveryLogs.filter((r) => r.date >= addDays(t, -6));
      if (!rec.length) out.push({ kind: 'dato', text: 'No has registrado sueño ni energía esta semana (se registran en Progreso → Recuperación o en el Dashboard).' });
      else {
        const avg = (k: 'sleep_hours' | 'energy' | 'soreness') => {
          const xs = rec.map((r) => r[k]).filter((x): x is number => typeof x === 'number');
          return xs.length ? round(xs.reduce((s, x) => s + x, 0) / xs.length, 1) : null;
        };
        out.push({ kind: 'dato', text: `Sueño promedio: ${avg('sleep_hours') ?? '—'} h · Energía: ${avg('energy') ?? '—'}/5 · Dolor muscular: ${avg('soreness') ?? '—'}/5.` });
        if ((avg('sleep_hours') ?? 8) < 7) out.push({ kind: 'recomendacion', text: 'Dormir < 7 h en déficit se asocia con mayor pérdida de masa magra y más hambre. Prioriza 7–9 h.' });
      }
      if (d.recommended) out.push({ kind: 'recomendacion', text: `Considera una semana de descarga: ${d.reasons.join(' ')}` });
      else out.push({ kind: 'estimacion', text: 'No hay señales suficientes que justifiquen una descarga.' });
      break;
    }
    case 'grupo': {
      const w1 = muscleWeekStats(data.sessions, addDays(t, -7), t);
      const w2 = muscleWeekStats(data.sessions, t, t);
      const list = (Object.keys(MUSCLE_LABEL) as Muscle[])
        .filter((mm) => !['antebrazo', 'lumbares', 'aductores'].includes(mm))
        .map((mm) => ({ mm, v: ((w1[mm]?.effectiveSets ?? 0) + (w2[mm]?.effectiveSets ?? 0)) / 2, prio: p.priorityMuscles.includes(mm) }))
        .sort((x, y) => x.v - y.v - (y.prio ? 2 : 0) + (x.prio ? 2 : 0));
      if (!data.sessions.some((s) => s.completed)) {
        out.push({ kind: 'dato', text: 'Sin sesiones registradas todavía.' });
        if (p.priorityMuscles.length) out.push({ kind: 'recomendacion', text: `Tus prioridades declaradas: ${p.priorityMuscles.map((x) => MUSCLE_LABEL[x]).join(', ')}. La rutina ya les asigna 1 serie extra por ejercicio.` });
        break;
      }
      const top = list.slice(0, 3);
      out.push({ kind: 'dato', text: `Menor volumen efectivo (promedio 2 semanas): ${top.map((x) => `${MUSCLE_LABEL[x.mm]} (${round(x.v, 1)} series)`).join(', ')}.` });
      out.push({ kind: 'recomendacion', text: `Si alguno es prioritario para ti, añade 2–4 series semanales y revisa en 3–4 semanas.` });
      break;
    }
    case 'estancado': {
      if (m.ratePctPerWeek == null) {
        out.push({ kind: 'dato', text: 'Faltan pesajes para afirmar que hay estancamiento.' });
        break;
      }
      if (m.ratePctPerWeek <= -0.15) {
        out.push({ kind: 'dato', text: `No hay estancamiento: pierdes ${-m.ratePctPerWeek} %/semana.` });
        out.push({ kind: 'hipotesis', text: 'Las fluctuaciones diarias de 0.5–1.5 kg son normales (agua, sal, glucógeno, digestión, ciclo menstrual).' });
        break;
      }
      out.push({ kind: 'dato', text: `Tu ritmo es ${m.ratePctPerWeek} %/semana en 3 semanas.` });
      if (m.logCoverage < 0.7) out.push({ kind: 'hipotesis', text: `Registro incompleto (${Math.round(m.logCoverage * 100)} % de días): la causa más frecuente de estancamiento aparente es una ingesta mayor a la registrada.` });
      if (m.kcalAdherence != null && m.kcalAdherence > 1.05) out.push({ kind: 'hipotesis', text: `Tu ingesta registrada está ${Math.round((m.kcalAdherence - 1) * 100)} % sobre el objetivo.` });
      if (m.waistChange3w != null && m.waistChange3w <= -1) out.push({ kind: 'hipotesis', text: 'La cintura baja: puede ser recomposición o retención de agua que enmascara la pérdida de grasa.' });
      out.push({ kind: 'hipotesis', text: 'El gasto energético disminuye conforme bajas de peso; tu mantenimiento actual es menor que al inicio.' });
      const cal = a.proposals.find((x) => x.kind === 'calorias' || x.kind === 'actividad');
      if (cal) out.push({ kind: 'recomendacion', text: `Propuesta: ${cal.title} (pendiente de tu confirmación).` });
      break;
    }
    case 'falta': {
      const pr = st.projections[p.scenario];
      out.push({ kind: 'estimacion', text: `% de grasa estimado: ${st.composition.bf.value} % (±${st.composition.bf.error}) por ${st.composition.bf.label}. Objetivo: ${p.targetBodyFat} %.` });
      out.push({ kind: 'estimacion', text: `Grasa a perder ≈ ${st.composition.fatToLose} kg; peso aproximado al llegar: ${st.composition.goalWeight} kg si conservas tu masa magra.` });
      if (pr.reached && pr.weeksToGoal != null) {
        const eta = addDays(t, pr.weeksToGoal * 7);
        out.push({ kind: 'estimacion', text: `Escenario ${pr.scenario.label}: ≈${pr.weeksToGoal} semanas (alrededor del ${new Date(eta + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}).` });
      } else out.push({ kind: 'estimacion', text: 'Con el escenario actual no se alcanza el objetivo en 2 años de proyección; revisa el simulador.' });
      const real = realPace(data.bodyLogs, t, st.trendWeight ?? st.currentWeight, st.composition.goalWeight);
      if (real.status === 'ok') out.push({ kind: 'estimacion', text: `A tu ritmo real: ≈${real.weeksToGoal} semanas. ${real.message}` });
      else out.push({ kind: 'dato', text: `Ritmo real: ${real.message}` });
      out.push({ kind: 'hipotesis', text: 'Es una proyección: la adherencia, el sueño y la variación individual cambian la fecha real.' });
      break;
    }
    default:
      out.push({ kind: 'dato', text: 'Pregunta no reconocida.' });
  }
  return out;
}

/** Intenta asociar una pregunta libre a una de las preguntas conocidas. */
export function matchQuestion(text: string): string | null {
  const s = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const rules: [RegExp, string][] = [
    [/estanc|no bajo|no pierdo|no baja/, 'estancado'],
    [/cuanto falta|cuando lleg|fecha|20 ?%/, 'falta'],
    [/musculo|masa magra|perdiendo mus/, 'musculo'],
    [/calori|deficit|comer mas|comer menos/, 'calorias'],
    [/protein/, 'proteina'],
    [/recuper|descans|sueno|fatiga|descarga/, 'recuperacion'],
    [/grupo|que musculo|rezagad/, 'grupo'],
    [/entren|volumen|series|suficiente/, 'entreno'],
    [/ritmo|rapido|lento|perdiendo grasa/, 'ritmo'],
  ];
  for (const [re, k] of rules) if (re.test(s)) return k;
  return null;
}

export interface DailyCoach {
  today: Claim[];
  good: Claim[];
  improve: Claim[];
  attention: Claim[];
  adjustments: Claim[];
}

export function dailyCoach(data: AppData, st: EngineState): DailyCoach {
  const t = st.today ?? todayFn();
  const p = data.profile;
  const dow = new Date(t + 'T12:00:00').getDay();
  const day = data.routine?.days.find((d) => d.weekday === dow);
  const sessionDone = data.sessions.some((s) => s.date === t && s.completed);
  const intake = st.intake.get(t);
  const water = data.waterLogs.filter((w) => w.date === t).reduce((a, w) => a + w.ml, 0);
  const weighedToday = data.bodyLogs.some((l) => l.date === t && l.weight);
  const coach: DailyCoach = { today: [], good: [], improve: [], attention: [], adjustments: [] };

  if (!weighedToday) coach.today.push({ kind: 'recomendacion', text: 'Registra tu peso en ayunas.' });
  if (day && !sessionDone) coach.today.push({ kind: 'recomendacion', text: `Entrenamiento: ${day.name} (${day.exercises.length} ejercicios, ~${day.estMinutes} min).` });
  else if (day && sessionDone) coach.good.push({ kind: 'dato', text: `Completaste tu sesión de hoy (${day.name}).` });
  else coach.today.push({ kind: 'recomendacion', text: 'Hoy no hay pesas: buen día para caminar o hacer cardio suave.' });
  const remaining = st.targets.kcal - (intake?.kcal ?? 0);
  const remP = st.targets.protein - (intake?.protein ?? 0);
  coach.today.push({ kind: 'dato', text: `Te quedan ${Math.max(0, Math.round(remaining))} kcal y ${Math.max(0, Math.round(remP))} g de proteína para hoy.` });
  if (water < st.hydration.totalMl) coach.today.push({ kind: 'recomendacion', text: `Hidratación: llevas ${water} ml de ~${st.hydration.totalMl} ml orientativos.` });
  const steps = stepsTarget(data.stepsLogs, t);
  coach.today.push({ kind: 'recomendacion', text: `Meta de pasos: ${steps.target.toLocaleString('es-MX')}.` });

  const a = analyzeAdaptation(data, st, t);
  const m = a.metrics;
  if (m.ratePctPerWeek != null && m.ratePctPerWeek <= -0.4 && m.ratePctPerWeek >= -1.1) coach.good.push({ kind: 'dato', text: `Ritmo de pérdida adecuado (${m.ratePctPerWeek} %/sem).` });
  if (m.waistChange3w != null && m.waistChange3w < 0) coach.good.push({ kind: 'dato', text: `Tu cintura bajó ${-m.waistChange3w} cm en ~3 semanas.` });
  if (m.avgProtein != null && m.avgProtein >= st.targets.protein * 0.9) coach.good.push({ kind: 'dato', text: 'Cumples tu meta de proteína.' });
  if (m.strengthTrend.improved > m.strengthTrend.declined && m.strengthTrend.total >= 2) coach.good.push({ kind: 'dato', text: `Tu fuerza mejora en ${m.strengthTrend.improved} ejercicios.` });
  if (m.logCoverage >= 0.8) coach.good.push({ kind: 'dato', text: 'Registro de comida constante.' });

  if (m.logCoverage < 0.7) coach.improve.push({ kind: 'recomendacion', text: `Registrar la comida más días (${Math.round(m.logCoverage * 100)} % en 3 semanas).` });
  if (m.avgProtein != null && m.avgProtein < st.targets.protein * 0.9) coach.improve.push({ kind: 'recomendacion', text: `Subir proteína: promedio ${m.avgProtein} g vs meta ${st.targets.protein} g.` });
  if (steps.baseline != null && steps.baseline < steps.target - 1500) coach.improve.push({ kind: 'recomendacion', text: 'Aumentar la actividad diaria (pasos).' });
  const recentRec = data.recoveryLogs.filter((r) => r.date >= addDays(t, -6) && r.sleep_hours);
  if (recentRec.length >= 3 && recentRec.reduce((s, r) => s + (r.sleep_hours ?? 0), 0) / recentRec.length < 7) coach.improve.push({ kind: 'recomendacion', text: 'Dormir al menos 7 horas.' });

  for (const f of st.flags.filter((f) => f.level === 'urgente' || f.level === 'medico')) coach.attention.push({ kind: 'dato', text: `${f.title}: ${f.detail}` });
  if (m.ratePctPerWeek != null && m.ratePctPerWeek < -1.2) coach.attention.push({ kind: 'estimacion', text: 'Estás perdiendo peso demasiado rápido.' });
  if (st.composition.bf.isMeasured === false) coach.attention.push({ kind: 'estimacion', text: `Tu % de grasa (${st.composition.bf.value} %) es una estimación por ${st.composition.bf.label} (±${st.composition.bf.error}).` });

  for (const pr of a.proposals) coach.adjustments.push({ kind: 'recomendacion', text: `${pr.title} — pendiente de tu confirmación.` });
  const pend = data.adjustments.filter((x) => x.status === 'pendiente');
  for (const x of pend) if (!a.proposals.some((pp) => pp.title === x.title)) coach.adjustments.push({ kind: 'recomendacion', text: `${x.title} — pendiente de tu confirmación.` });
  if (!coach.adjustments.length) coach.adjustments.push({ kind: 'dato', text: 'Sin ajustes pendientes: mantén el plan actual.' });
  if (!coach.good.length) coach.good.push({ kind: 'dato', text: 'Cada registro cuenta: con más datos verás aquí tus avances.' });
  if (!coach.improve.length) coach.improve.push({ kind: 'dato', text: 'Nada crítico que mejorar con los datos actuales.' });
  if (!coach.attention.length) coach.attention.push({ kind: 'dato', text: 'Sin alertas.' });
  void p;
  return coach;
}

/** Resumen de datos (sin fotos ni identificadores) que se envía a la IA externa si el usuario la activa. */
export function aiContextSummary(data: AppData, st: EngineState): string {
  const p = data.profile;
  const a = analyzeAdaptation(data, st, st.today);
  const lines = [
    `Edad: ${p.age}; sexo: ${p.sex}; estatura: ${p.heightCm} cm; experiencia: ${p.experience}.`,
    `Peso actual: ${st.currentWeight} kg (tendencia ${st.trendWeight ?? '—'} kg); peso inicial: ${st.initialWeight} kg.`,
    `% grasa ${st.composition.bf.isMeasured ? 'medido' : 'ESTIMADO'}: ${st.composition.bf.value} % (±${st.composition.bf.error}, ${st.composition.bf.label}); objetivo ${p.targetBodyFat} %.`,
    `Masa libre de grasa estimada: ${st.composition.leanMass} kg; cintura: ${st.latestMeasures.waist ?? '—'} cm.`,
    `Gasto estimado: ${st.tdee.tdee} kcal (${st.tdee.method}).`,
    `Plan activo: ${st.targets.kcal} kcal, P ${st.targets.protein} g, C ${st.targets.carbs} g, G ${st.targets.fat} g; escenario ${p.scenario}.`,
    `Ritmo 3 semanas: ${a.metrics.ratePctPerWeek ?? '—'} %/sem; cambio cintura: ${a.metrics.waistChange3w ?? '—'} cm; cobertura de registro: ${Math.round(a.metrics.logCoverage * 100)} %; ingesta media: ${a.metrics.avgIntake ?? '—'} kcal; proteína media: ${a.metrics.avgProtein ?? '—'} g.`,
    `Fuerza 4 semanas: ${a.metrics.strengthTrend.improved} mejoran / ${a.metrics.strengthTrend.declined} bajan de ${a.metrics.strengthTrend.total}.`,
    `Rutina: ${data.routine ? `${data.routine.splitLabel}, ${data.routine.daysPerWeek} días` : 'sin rutina'}.`,
    `Banderas de salud: ${st.flags.map((f) => `${f.title} [${f.level}]`).join('; ') || 'ninguna'}.`,
    `Lesiones/limitaciones: ${p.injuries.join(', ') || 'ninguna'}.`,
  ];
  return lines.join('\n');
}

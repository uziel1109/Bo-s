import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Brain, CalendarClock, CheckCircle2, Droplets, Dumbbell, Flame, Footprints, Lightbulb, Moon, Ruler, Scale, Sparkles, Target, UtensilsCrossed } from 'lucide-react';
import { useApp, withBonus } from '../store';
import { Alert, Card, Claims, fmt } from '../components/ui';
import { WeightTrendChart, SimpleLine } from '../components/charts';
import { BodyLogModal, RecoveryModal, StepsInput } from '../components/QuickLogs';
import { ActivityRings, BodyProgress, JourneyBar, MetricTile, QuickTile } from '../components/visual';
import { MuscleMap } from '../components/MuscleMap';
import { weightTrend } from '@shared/analytics/trend';
import { dailyCoach } from '@shared/assistant/assistant';
import { addDays, DAY_NAMES, formatDateLong, uid } from '@shared/utils';
import { stepsTarget, weeklyCardioSummary } from '@shared/cardio/cardio';
import { strengthTrend } from '@shared/analytics/adaptation';
import { getExercise } from '@shared/training/exercises';
import type { Muscle } from '@shared/types';
import { navigate } from '../App';
import { api } from '../api';

export function Dashboard() {
  const { data, state: st, profile, today, reload, toast, settings } = useApp();
  const [modal, setModal] = useState<'peso' | 'recuperacion' | null>(null);
  const intake = st.intake.get(today);
  const t = st.targets;
  const water = data.waterLogs.filter((w) => w.date === today).reduce((a, w) => a + w.ml, 0);
  const trend = useMemo(() => weightTrend(data.bodyLogs).filter((x) => x.date >= addDays(today, -90)), [data.bodyLogs, today]);
  const coach = useMemo(() => dailyCoach(data, st), [data, st]);
  const dow = new Date(today + 'T12:00:00').getDay();
  const todayDay = data.routine?.days.find((d) => d.weekday === dow);
  const nextDay = data.routine ? [1, 2, 3, 4, 5, 6, 7].map((i) => data.routine!.days.find((x) => x.weekday === (dow + i) % 7)).find(Boolean) : null;
  const doneToday = data.sessions.some((s) => s.date === today && s.completed);
  const steps = withBonus(stepsTarget(data.stepsLogs, today), settings.steps_bonus);
  const stepsToday = data.stepsLogs.find((s) => s.date === today)?.steps ?? 0;
  const cardio = weeklyCardioSummary(data.cardioLogs, today);
  const strength = strengthTrend(data, today);
  const comp = st.composition;
  const weightDelta = st.currentWeight - st.initialWeight;
  const waistLogs = data.bodyLogs.filter((l) => l.waist);
  const waistDelta = waistLogs.length >= 2 ? (waistLogs[waistLogs.length - 1].waist as number) - (waistLogs[0].waist as number) : null;
  const urgent = st.flags.filter((f) => f.level === 'urgente');
  const proj = st.projections[profile.scenario];
  const eta = proj.reached && proj.weeksToGoal != null ? new Date(addDays(today, proj.weeksToGoal * 7) + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : null;
  const todayMuscles = useMemo(() => {
    const prim = new Set<Muscle>();
    const sec = new Set<Muscle>();
    for (const e of todayDay?.exercises ?? []) {
      const ex = getExercise(e.exerciseId);
      if (!ex) continue;
      prim.add(ex.primary);
      ex.secondary.forEach((m) => sec.add(m));
    }
    return { prim: [...prim], sec: [...sec].filter((m) => !prim.has(m)) };
  }, [todayDay]);

  const addWater = async (ml: number) => {
    const now = new Date();
    await api.upsert('water_logs', { id: uid('w_'), date: today, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, ml, context: 'general' });
    await reload();
    toast(`+${ml} ml registrados.`);
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="page">
      {urgent.map((f) => (
        <div className="mb16" key={f.id}>
          <Alert kind="danger">
            <b>{f.title}.</b> {f.detail}
          </Alert>
        </div>
      ))}

      {/* Tarjeta principal: progreso hacia el objetivo */}
      <section className="hero" style={{ ['--h1' as string]: 'var(--m-lime)', ['--h2' as string]: 'var(--m-cyan)' }}>
        <div className="hero-dash">
          <BodyProgress pct={comp.progressPct} size={120} />
          <div>
            <div className="muted small cap-first">{formatDateLong(today)}</div>
            <h1 style={{ fontSize: 30, marginTop: 2 }}>
              {greet}
              {profile.name ? `, ${profile.name}` : ''}
            </h1>
            <div className="row" style={{ gap: 28, marginTop: 16, alignItems: 'flex-end' }}>
              <div data-testid="dash-bf">
                <div className="tiny muted">{comp.bf.isMeasured ? '% de grasa (medido)' : '% de grasa (estimado)'}</div>
                <div className="big-number mono">
                  {fmt(comp.bf.value, 1)}
                  <span className="unit">%</span>
                </div>
              </div>
              <div>
                <div className="tiny muted">Objetivo</div>
                <div className="big-number mono" style={{ color: 'var(--m-lime)' }}>
                  {profile.targetBodyFat}
                  <span className="unit">%</span>
                </div>
              </div>
              <div>
                <div className="tiny muted">Avance</div>
                <div className="big-number mono">
                  {comp.progressPct}
                  <span className="unit">%</span>
                </div>
              </div>
            </div>
            <JourneyBar start={st.initialComposition.bf.value} current={comp.bf.value} goal={profile.targetBodyFat} />
            <div className="row mt16">
              {eta ? (
                <span className="eta-pill">
                  <CalendarClock size={16} /> Meta estimada: ~{proj.weeksToGoal} semanas · {eta}
                </span>
              ) : (
                <span className="eta-pill">
                  <Target size={16} /> ¡Estás en tu objetivo!
                </span>
              )}
              <span className="small muted">
                ≈ {fmt(comp.fatToLose, 1)} kg de grasa por perder · ±{comp.bf.error} pts ({comp.bf.label})
              </span>
            </div>
          </div>
          <div className="quick-grid hero-quick">
            <QuickTile icon={Scale} label="Peso" sub="Registrar hoy" color="var(--m-cyan)" onClick={() => setModal('peso')} testId="dash-log-weight" />
            <QuickTile icon={UtensilsCrossed} label="Comida" sub="Agregar alimento" color="var(--m-orange)" onClick={() => navigate('nutricion')} testId="dash-go-nutrition" />
            <QuickTile icon={Droplets} label="+250 ml" sub="Un vaso de agua" color="var(--m-blue)" onClick={() => addWater(250)} testId="dash-water" />
            <QuickTile icon={Moon} label="Recuperación" sub="Sueño y energía" color="var(--m-violet)" onClick={() => setModal('recuperacion')} />
          </div>
        </div>
      </section>

      {/* Métricas corporales */}
      <div className="grid g4 mb16">
        <MetricTile
          testId="dash-weight"
          icon={Scale}
          color="var(--m-cyan)"
          label="Peso actual"
          value={fmt(st.currentWeight, 1)}
          unit="kg"
          foot={
            <>
              <span className={weightDelta <= 0 ? 'delta-down' : 'delta-up'}>
                {weightDelta > 0 ? '+' : ''}
                {fmt(weightDelta, 1)} kg
              </span>{' '}
              desde el inicio · tendencia {fmt(st.trendWeight, 1)}
            </>
          }
        />
        <MetricTile icon={Dumbbell} color="var(--m-lime)" label="Masa libre de grasa (est.)" value={fmt(comp.leanMass, 1)} unit="kg" foot={`Masa grasa ≈ ${fmt(comp.fatMass, 1)} kg`} />
        <MetricTile
          icon={Ruler}
          color="var(--m-amber)"
          label="Cintura"
          value={fmt(st.latestMeasures.waist, 1)}
          unit="cm"
          foot={waistDelta != null ? <span className={waistDelta <= 0 ? 'delta-down' : 'delta-up'}>{waistDelta > 0 ? '+' : ''}{fmt(waistDelta, 1)} cm desde el inicio</span> : 'Mídela cada lunes'}
        />
        <MetricTile icon={Flame} color="var(--m-orange)" label="Gasto diario estimado" value={fmt(st.tdee.tdee)} unit="kcal" foot={st.observed.tdee ? 'Ajustado con tus datos reales' : 'Por fórmula · se ajustará con tus datos'} />
      </div>

      <div className="grid g3 mb16">
        {/* Anillos del día */}
        <Card title="Tu día" icon={<Sparkles />} hint={`${fmt(Math.max(0, t.kcal - (intake?.kcal ?? 0)))} kcal restantes`}>
          <ActivityRings
            size={190}
            rings={[
              { label: 'Calorías', value: intake?.kcal ?? 0, max: t.kcal, color: 'var(--m-orange)', display: fmt(intake?.kcal ?? 0), unit: `/ ${fmt(t.kcal)}`, testId: 'dash-kcal' },
              { label: 'Proteína', value: intake?.protein ?? 0, max: t.protein, color: 'var(--m-pink)', display: fmt(intake?.protein ?? 0), unit: `/ ${t.protein} g` },
              { label: 'Agua', value: water, max: st.hydration.totalMl, color: 'var(--m-blue)', display: fmt(water), unit: `/ ${fmt(st.hydration.totalMl)} ml` },
              { label: 'Pasos', value: stepsToday, max: steps.target, color: 'var(--m-lime)', display: fmt(stepsToday), unit: `/ ${fmt(steps.target)}` },
            ]}
          />
          <div className="row between small mt16">
            <span className="muted">
              Carbos <b style={{ color: 'var(--text)' }}>{fmt(intake?.carbs ?? 0)}</b>/{t.carbs} g · Grasas <b style={{ color: 'var(--text)' }}>{fmt(intake?.fat ?? 0)}</b>/{t.fat} g
            </span>
          </div>
        </Card>

        {/* Entrenamiento */}
        <Card title="Entrenamiento" icon={<Dumbbell />} actions={<button className="btn sm" onClick={() => navigate('entrenamiento')}>Abrir</button>}>
          <div className="workout-today">
            {todayDay ? <MuscleMap primary={todayMuscles.prim} secondary={todayMuscles.sec} size={74} /> : <Moon size={40} color="var(--m-violet)" />}
            <div className="grow">
              <div className="tiny muted">Hoy</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{todayDay ? todayDay.name : 'Descanso de pesas'}</div>
              {todayDay ? (
                <div className="small" style={{ marginTop: 4 }}>
                  {doneToday ? (
                    <span className="row" style={{ gap: 6, color: 'var(--ok)' }}>
                      <CheckCircle2 size={16} /> Completado
                    </span>
                  ) : (
                    <span className="muted">
                      {todayDay.exercises.length} ejercicios · ~{todayDay.estMinutes} min
                    </span>
                  )}
                </div>
              ) : (
                <div className="small muted">Camina o haz cardio suave</div>
              )}
              {todayDay && !doneToday && (
                <button className="btn primary sm mt8" onClick={() => navigate('entrenamiento')}>
                  <Dumbbell /> Empezar
                </button>
              )}
            </div>
          </div>
          <div className="col mt16" style={{ gap: 10 }}>
            {nextDay && (
              <div className="small muted">
                Próxima: <b style={{ color: 'var(--text)' }}>{nextDay.name}</b> · {DAY_NAMES[nextDay.weekday]}
              </div>
            )}
            <div className="row small" style={{ gap: 14 }}>
              <span className="row" style={{ gap: 6 }}>
                <Activity size={14} color="var(--m-lime)" />
                {strength.total ? (
                  <>
                    <b className="delta-down">{strength.improved}↑</b> <b className="delta-up">{strength.declined}↓</b> fuerza
                  </>
                ) : (
                  <span className="muted">Fuerza: sin datos aún</span>
                )}
              </span>
              <span className="row" style={{ gap: 6 }}>
                <Footprints size={14} color="var(--m-pink)" /> {cardio.minutes} min de cardio
              </span>
            </div>
            <StepsInput />
          </div>
        </Card>

        {/* Qué hacer hoy */}
        <Card title="Qué hacer hoy" icon={<Brain />} actions={<button className="btn sm" onClick={() => navigate('ia')}>Asistente</button>}>
          <Claims items={coach.today} />
        </Card>
      </div>

      <div className="grid g2 mb16">
        <Card title="Peso y tendencia" hint="90 días · puntos = registros, línea = tendencia">
          <WeightTrendChart data={trend} goal={comp.goalWeight} />
        </Card>
        <Card title="Cintura" hint="Confirma si el peso perdido es grasa">
          <SimpleLine data={data.bodyLogs.filter((l) => l.waist).map((l) => ({ date: l.date, waist: l.waist }))} dataKey="waist" name="Cintura" unit="cm" height={240} color="var(--s3)" />
        </Card>
      </div>

      <div className="grid g4">
        <div className="card coach-card" style={{ ['--cc' as string]: 'var(--m-green)' }}>
          <div className="card-head">
            <div className="title">
              <CheckCircle2 /> Lo estás haciendo bien
            </div>
          </div>
          <Claims items={coach.good} />
        </div>
        <div className="card coach-card" style={{ ['--cc' as string]: 'var(--m-amber)' }}>
          <div className="card-head">
            <div className="title">
              <Lightbulb /> Qué mejorar
            </div>
          </div>
          <Claims items={coach.improve} />
        </div>
        <div className="card coach-card" style={{ ['--cc' as string]: 'var(--m-red)' }}>
          <div className="card-head">
            <div className="title">
              <AlertTriangle /> Necesita atención
            </div>
          </div>
          <Claims items={coach.attention} />
        </div>
        <div className="card coach-card" style={{ ['--cc' as string]: 'var(--m-violet)' }}>
          <div className="card-head">
            <div className="title">
              <Brain /> Ajustes recomendados
            </div>
            <button className="btn sm" onClick={() => navigate('ia')}>
              Revisar
            </button>
          </div>
          <Claims items={coach.adjustments} />
        </div>
      </div>

      {modal === 'peso' && <BodyLogModal onClose={() => setModal(null)} />}
      {modal === 'recuperacion' && <RecoveryModal onClose={() => setModal(null)} />}
    </div>
  );
}

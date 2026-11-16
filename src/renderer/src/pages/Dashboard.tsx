import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Brain, CheckCircle2, Droplets, Dumbbell, Footprints, Lightbulb, Moon, Plus, Scale, Sparkles, Target, TrendingDown } from 'lucide-react';
import { useApp } from '../store';
import { Alert, Card, Claims, fmt, MacroBar, Ring, Stat, Bar } from '../components/ui';
import { WeightTrendChart, SimpleLine } from '../components/charts';
import { BodyLogModal, RecoveryModal, StepsInput } from '../components/QuickLogs';
import { weightTrend } from '@shared/analytics/trend';
import { dailyCoach } from '@shared/assistant/assistant';
import { addDays, DAY_NAMES, formatDateLong, uid } from '@shared/utils';
import { stepsTarget, weeklyCardioSummary } from '@shared/cardio/cardio';
import { strengthTrend } from '@shared/analytics/adaptation';
import { navigate } from '../App';
import { api } from '../api';
import { withBonus } from '../store';

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
  const nextDay = data.routine ? [1, 2, 3, 4, 5, 6, 7].map((i) => ({ i, d: data.routine!.days.find((x) => x.weekday === (dow + i) % 7) })).find((x) => x.d) : null;
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

  const addWater = async (ml: number) => {
    const now = new Date();
    await api.upsert('water_logs', { id: uid('w_'), date: today, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, ml, context: 'general' });
    await reload();
    toast(`+${ml} ml registrados.`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="muted small cap-first">
            {formatDateLong(today)}
          </div>
          <h1>{profile.name ? `Hola, ${profile.name}` : 'Tu panel'}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setModal('recuperacion')}>
            <Moon /> Recuperación
          </button>
          <button className="btn" onClick={() => addWater(250)} data-testid="dash-water">
            <Droplets /> +250 ml
          </button>
          <button className="btn primary" onClick={() => setModal('peso')} data-testid="dash-log-weight">
            <Scale /> Registrar peso
          </button>
        </div>
      </div>

      {urgent.map((f) => (
        <div className="mb16" key={f.id}>
          <Alert kind="danger">
            <b>{f.title}.</b> {f.detail}
          </Alert>
        </div>
      ))}

      {/* Resumen corporal */}
      <div className="grid g5 mb16">
        <Card tight>
          <Stat
            testId="dash-weight"
            icon={<Scale size={14} />}
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
        </Card>
        <Card tight>
          <Stat
            testId="dash-bf"
            icon={<Activity size={14} />}
            label={comp.bf.isMeasured ? '% de grasa (medido)' : '% de grasa (estimado)'}
            value={fmt(comp.bf.value, 1)}
            unit="%"
            foot={`±${comp.bf.error} · ${comp.bf.label}`}
          />
        </Card>
        <Card tight>
          <Stat icon={<Dumbbell size={14} />} label="Masa libre de grasa (est.)" value={fmt(comp.leanMass, 1)} unit="kg" foot={`Masa grasa ≈ ${fmt(comp.fatMass, 1)} kg`} />
        </Card>
        <Card tight>
          <Stat
            icon={<TrendingDown size={14} />}
            label="Cintura"
            value={fmt(st.latestMeasures.waist, 1)}
            unit="cm"
            foot={waistDelta != null ? <span className={waistDelta <= 0 ? 'delta-down' : 'delta-up'}>{waistDelta > 0 ? '+' : ''}{fmt(waistDelta, 1)} cm desde el inicio</span> : 'Regístrala semanalmente'}
          />
        </Card>
        <Card tight>
          <div className="row nowrap" style={{ gap: 14 }}>
            <Ring value={comp.progressPct} max={100} size={78} stroke={8}>
              <b className="mono">{comp.progressPct}%</b>
            </Ring>
            <Stat icon={<Target size={14} />} label="Objetivo" value={`${profile.targetBodyFat}`} unit="% grasa" foot={`≈ ${fmt(comp.fatToLose, 1)} kg de grasa`} />
          </div>
        </Card>
      </div>

      <div className="grid g3 mb16">
        {/* Nutrición */}
        <Card title="Nutrición de hoy" icon={<Sparkles />} actions={<button className="btn sm" onClick={() => navigate('nutricion')} data-testid="dash-go-nutrition"><Plus /> Registrar</button>}>
          <div className="col" style={{ gap: 16 }}>
            <div className="row" style={{ justifyContent: 'center' }}>
            <Ring value={intake?.kcal ?? 0} max={t.kcal} size={118}>
              <div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700 }} data-testid="dash-kcal">
                  {fmt(intake?.kcal ?? 0)}
                </div>
                <div className="tiny muted">de {fmt(t.kcal)} kcal</div>
              </div>
            </Ring>
            </div>
            <div className="col grow" style={{ gap: 10 }}>
              <MacroBar label="Proteína" color="var(--protein)" value={intake?.protein ?? 0} target={t.protein} />
              <MacroBar label="Carbos" color="var(--carbs)" value={intake?.carbs ?? 0} target={t.carbs} />
              <MacroBar label="Grasas" color="var(--fat)" value={intake?.fat ?? 0} target={t.fat} />
              <MacroBar label="Agua" color="var(--water)" value={water} target={st.hydration.totalMl} unit="ml" />
            </div>
          </div>
        </Card>

        {/* Entrenamiento */}
        <Card title="Entrenamiento" icon={<Dumbbell />} actions={<button className="btn sm" onClick={() => navigate('entrenamiento')}>Abrir</button>}>
          <div className="col" style={{ gap: 12 }}>
            <div className="list-item">
              {doneToday ? <CheckCircle2 color="var(--ok)" /> : <Dumbbell color="var(--accent)" />}
              <div className="grow">
                <div className="small muted">Hoy</div>
                <b>{todayDay ? todayDay.name : 'Descanso de pesas'}</b>
                {todayDay && <div className="tiny muted">{doneToday ? 'Completado' : `${todayDay.exercises.length} ejercicios · ~${todayDay.estMinutes} min`}</div>}
              </div>
            </div>
            {nextDay?.d && (
              <div className="small muted">
                Próxima sesión: <b style={{ color: 'var(--text)' }}>{nextDay.d.name}</b> ({DAY_NAMES[nextDay.d.weekday]})
              </div>
            )}
            <div className="small">
              Fuerza (4 semanas):{' '}
              {strength.total ? (
                <>
                  <b className="delta-down">{strength.improved} ↑</b> · <b className="delta-up">{strength.declined} ↓</b> de {strength.total} ejercicios
                </>
              ) : (
                <span className="muted">registra sesiones para ver tu evolución</span>
              )}
            </div>
            <div>
              <div className="row between small">
                <span className="row" style={{ gap: 6 }}>
                  <Footprints size={14} /> Pasos
                </span>
                <span className="mono">
                  {fmt(stepsToday)} / {fmt(steps.target)}
                </span>
              </div>
              <div className="mt8">
                <Bar value={stepsToday} max={steps.target} color="var(--s3)" />
              </div>
            </div>
            <div className="small muted">
              Cardio esta semana: <b style={{ color: 'var(--text)' }}>{cardio.minutes} min</b> en {cardio.sessions} sesiones
            </div>
            <StepsInput />
          </div>
        </Card>

        {/* Asistente */}
        <Card title="Qué hacer hoy" icon={<Brain />} actions={<button className="btn sm" onClick={() => navigate('ia')}>Asistente</button>}>
          <Claims items={coach.today} />
        </Card>
      </div>

      <div className="grid g2 mb16">
        <Card title="Peso y tendencia (90 días)" hint="Puntos = registros · línea = tendencia suavizada">
          <WeightTrendChart data={trend} goal={comp.goalWeight} />
        </Card>
        <Card title="Cintura" hint="La cintura confirma si el peso perdido es grasa">
          <SimpleLine data={data.bodyLogs.filter((l) => l.waist).map((l) => ({ date: l.date, waist: l.waist }))} dataKey="waist" name="Cintura" unit="cm" height={240} color="var(--s3)" />
        </Card>
      </div>

      <div className="grid g4">
        <Card title="Lo estás haciendo bien" icon={<CheckCircle2 />}>
          <Claims items={coach.good} />
        </Card>
        <Card title="Qué mejorar" icon={<Lightbulb />}>
          <Claims items={coach.improve} />
        </Card>
        <Card title="Necesita atención" icon={<AlertTriangle />}>
          <Claims items={coach.attention} />
        </Card>
        <Card title="Ajustes recomendados" icon={<Brain />} actions={<button className="btn sm" onClick={() => navigate('ia')}>Revisar</button>}>
          <Claims items={coach.adjustments} />
        </Card>
      </div>

      {modal === 'peso' && <BodyLogModal onClose={() => setModal(null)} />}
      {modal === 'recuperacion' && <RecoveryModal onClose={() => setModal(null)} />}
    </div>
  );
}

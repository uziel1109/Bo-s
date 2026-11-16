// Interfaz del motor de hipertrofia: mesociclo, retroalimentación por músculo, técnicas avanzadas,
// progreso por músculo y calibración de RIR.
import { useMemo, useState, type ReactNode } from 'react';
import { Activity, CalendarRange, Flame, Gauge, Info, Play, Ruler, Target, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { useApp } from '../store';
import { Alert, Card, ConfirmButton, Empty, Field, fmt, Modal, NumInput, Seg } from './ui';
import { IconTile } from './visual';
import { api } from '../api';
import { MUSCLE_LABEL, getExercise, STRETCH_LABEL, stretchOf } from '@shared/training/exercises';
import { carryFrom, circumferenceTrend, mesoRoutine, mesoVolume, mesoWeek, muscleProgress, PUMP_LABEL, rirBias, rirForWeek, RIR_TEST_EXERCISES, SORENESS_LABEL, TECHNIQUES, type Mesocycle, type MuscleFeedback, type RirTest, type Technique } from '@shared/training/hypertrophy';
import type { Routine } from '@shared/training/generator';
import type { Muscle } from '@shared/types';
import { addDays, formatDateShort, uid, weekStart } from '@shared/utils';

// ───────────────────────── Estado del mesociclo

export function useMeso() {
  const { data, settings, muscleFeedback, today, state: st } = useApp();
  const meso = (settings.mesocycle as Mesocycle | undefined) ?? null;
  return useMemo(() => {
    if (!meso || !data.routine) return { meso, active: false as const, week: null, vol: null, routine: data.routine };
    const week = mesoWeek(meso, today);
    if (week.finished || today < meso.start) return { meso, active: false as const, week, vol: null, routine: data.routine };
    const deficit = st.targets.deficit > 0;
    const vol = mesoVolume(data.routine, meso, muscleFeedback, data.sessions, today, deficit);
    return { meso, active: true as const, week, vol, routine: mesoRoutine(data.routine, meso, vol, today) as Routine };
  }, [meso, data.routine, muscleFeedback, data.sessions, today, st.targets.deficit]);
}

// ───────────────────────── Pestaña Mesociclo

export function MesocycleView() {
  const { data, today, setSetting, toast, settings, muscleFeedback } = useApp();
  const m = useMeso();
  const [weeks, setWeeks] = useState(4);
  const [tech, setTech] = useState(true);
  const [startNext, setStartNext] = useState(today > weekStart(today) ? 'proximo' : 'hoy');
  if (!data.routine) return <Empty>Primero genera tu rutina en “Mi rutina”.</Empty>;

  const start = async (carry?: Partial<Record<Muscle, number>>) => {
    const s = startNext === 'hoy' ? weekStart(today) : addDays(weekStart(today), 7);
    const meso: Mesocycle = { id: uid('meso_'), start: s, weeks, techniques: tech, createdAt: new Date().toISOString(), carry };
    const hist = ((settings.meso_history as Mesocycle[] | undefined) ?? []).concat(m.meso ? [{ ...m.meso, endedAt: m.meso.endedAt ?? today }] : []);
    await setSetting('meso_history', hist.slice(-12));
    await setSetting('mesocycle', meso);
    toast(`Mesociclo de ${weeks} semanas ${startNext === 'hoy' ? 'iniciado' : `programado para el ${formatDateShort(s)}`}.`);
  };

  const setup = (title: string, carry?: Partial<Record<Muscle, number>>) => (
    <Card title={title} icon={<IconTile icon={CalendarRange} color="var(--m-lime)" size={28} />}>
      <p className="small muted">
        Un bloque de {weeks} semanas en el que te acercas poco a poco al fallo y el volumen de cada músculo se ajusta con tu retroalimentación, seguido de 1 semana de descarga.
      </p>
      <div className="grid g3 mt12">
        <Field label="Semanas de trabajo">
          <Seg value={String(weeks)} onChange={(v) => setWeeks(Number(v))} options={[3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n}` }))} />
        </Field>
        <Field label="Técnicas avanzadas" help="Myo-reps, descendentes y parciales en la última serie de aislamientos, desde la semana 2.">
          <Seg value={tech ? 'si' : 'no'} onChange={(v) => setTech(v === 'si')} options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} />
        </Field>
        <Field label="Empezar">
          <Seg value={startNext} onChange={setStartNext} options={[{ value: 'hoy', label: 'Esta semana' }, { value: 'proximo', label: 'El lunes' }]} />
        </Field>
      </div>
      <div className="week-strip mt12">
        {Array.from({ length: weeks + 1 }, (_, i) => (
          <div key={i} className="week-day">
            <div className="tiny muted">{i < weeks ? `Semana ${i + 1}` : 'Descarga'}</div>
            <div className="mono" style={{ fontWeight: 750 }}>RIR {i < weeks ? `${rirForWeek(i + 1, weeks, false)}–${rirForWeek(i + 1, weeks, true)}` : '3+'}</div>
            <div className="tiny muted">{i < weeks ? (i === 0 ? 'volumen base' : 'según tu respuesta') : '½ series'}</div>
          </div>
        ))}
      </div>
      <button className="btn primary mt16" onClick={() => start(carry)} data-testid="meso-start">
        <Play size={14} /> Empezar mesociclo
      </button>
    </Card>
  );

  if (!m.meso) return <div className="col" style={{ gap: 16 }}>{setup('Mesociclo de hipertrofia')}<RirCalibration /></div>;
  const wk = m.week ?? mesoWeek(m.meso, today);
  const pending = today < m.meso.start;
  if (wk.finished && !pending) {
    const finalVol = mesoVolume(data.routine, m.meso, muscleFeedback, data.sessions, addDays(m.meso.start, m.meso.weeks * 7), true);
    return (
      <div className="col" style={{ gap: 16 }}>
        <Alert kind="ok">¡Terminaste tu mesociclo! El siguiente arranca con lo que aprendiste: la mitad de las series que sumaste a cada músculo.</Alert>
        {setup('Siguiente mesociclo', carryFrom(finalVol))}
        <RirCalibration />
      </div>
    );
  }
  const muscles = m.vol ? (Object.keys(m.vol.base) as Muscle[]).sort((a, b) => (m.vol!.target[b] ?? 0) - (m.vol!.target[a] ?? 0)) : [];
  return (
    <div className="col" style={{ gap: 16 }}>
      <Card
        title={pending ? `Mesociclo programado: empieza el ${formatDateShort(m.meso.start)}` : wk.deload ? 'Semana de descarga' : `Semana ${wk.week} de ${m.meso.weeks}`}
        icon={<IconTile icon={CalendarRange} color="var(--m-lime)" size={28} />}
        actions={
          <ConfirmButton className="btn sm ghost" confirmText="¿Terminar el bloque?" onConfirm={() => setSetting('mesocycle', { ...m.meso!, endedAt: today })}>
            Terminar bloque
          </ConfirmButton>
        }
      >
        <div className="week-strip" data-testid="meso-weeks">
          {Array.from({ length: m.meso.weeks + 1 }, (_, i) => {
            const cur = !pending && wk.week === i + 1;
            return (
              <div key={i} className={`week-day ${cur ? 'today' : ''}`} style={{ opacity: !pending && i + 1 < wk.week ? 0.55 : 1 }}>
                <div className="tiny muted">{i < m.meso!.weeks ? `Semana ${i + 1}` : 'Descarga'}</div>
                <div className="mono" style={{ fontWeight: 750 }}>RIR {i < m.meso!.weeks ? rirForWeek(i + 1, m.meso!.weeks, false) : '3+'}</div>
                <div className="tiny muted">{formatDateShort(addDays(m.meso!.start, i * 7))}</div>
              </div>
            );
          })}
        </div>
        <p className="small mt12">
          {wk.deload
            ? 'Descarga: la mitad de las series, mismos pesos y lejos del fallo. Deja que la fatiga baje para que el siguiente bloque rinda más.'
            : `Esta semana: compuestos a RIR ${rirForWeek(wk.week, m.meso.weeks, true)} y aislamientos a RIR ${rirForWeek(wk.week, m.meso.weeks, false)}. Después de cada músculo, califícalo en la sesión (3 toques): con eso se ajusta la siguiente semana.`}
        </p>
      </Card>

      {m.vol && (
        <Card title="Volumen por músculo" hint="Series directas por semana" icon={<IconTile icon={Activity} color="var(--m-violet)" size={28} />}>
          <div className="col" style={{ gap: 8 }} data-testid="meso-volume">
            {muscles.map((mu) => {
              const t = m.vol!.target[mu] ?? 0;
              const d = m.vol!.delta[mu] ?? 0;
              const last = [...m.vol!.log].reverse().find((l) => l.muscle === mu);
              return (
                <div key={mu} className="vol-row">
                  <div className="vol-name">{MUSCLE_LABEL[mu]}</div>
                  <div className="vol-bar">
                    <span style={{ width: `${Math.min(100, (t / 22) * 100)}%` }} />
                    <i style={{ left: `${(10 / 22) * 100}%` }} title="10 series" />
                    <i style={{ left: `${(20 / 22) * 100}%` }} title="20 series" />
                  </div>
                  <div className="mono vol-num">
                    {t}
                    {d !== 0 && <span className={d > 0 ? 'delta-down' : 'delta-up'}> {d > 0 ? `+${d}` : d}</span>}
                  </div>
                  <div className="tiny muted vol-why">{last ? last.reason : 'Sin cambios aún'}</div>
                </div>
              );
            })}
          </div>
          <p className="tiny muted mt8">Las marcas indican 10 y 20 series: el rango con más evidencia para hipertrofia. En déficit el tope es 20.</p>
        </Card>
      )}
      <RirCalibration />
    </div>
  );
}

// ───────────────────────── Retroalimentación por músculo

export function MuscleFeedbackCard({ sessionId, date, muscle, compact }: { sessionId: string; date: string; muscle: Muscle; compact?: boolean }) {
  const { muscleFeedback, reload } = useApp();
  const id = `${sessionId}_${muscle}`;
  const cur = muscleFeedback.find((f) => f.id === id);
  const [draft, setDraft] = useState<Partial<MuscleFeedback>>(cur ?? {});
  const save = async (patch: Partial<MuscleFeedback>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (next.pump != null && next.soreness != null) {
      await api.upsert('muscle_feedback', { id, date, session_id: sessionId, muscle, pump: next.pump, soreness: next.soreness, joint: next.joint ?? 0 });
      await reload();
    }
  };
  const row = (label: string, opts: string[], key: 'pump' | 'soreness' | 'joint', vals: number[]) => (
    <div className="fb-row">
      <span className="tiny muted">{label}</span>
      <div className="seg">
        {opts.map((o, i) => (
          <button key={o} type="button" className={draft[key] === vals[i] ? 'on' : ''} onClick={() => save({ [key]: vals[i] } as Partial<MuscleFeedback>)} data-testid={`fb-${muscle}-${key}-${vals[i]}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className={`fb-card ${compact ? 'compact' : ''} ${cur ? 'done' : ''}`} data-testid={`fb-${muscle}`}>
      <div className="small" style={{ fontWeight: 700 }}>
        {MUSCLE_LABEL[muscle]}: ¿cómo te fue? {cur && <span className="badge ok">Guardado</span>}
      </div>
      {row('Bombeo', PUMP_LABEL, 'pump', [0, 1, 2])}
      {row('Al llegar, ¿te dolía de la vez pasada?', SORENESS_LABEL, 'soreness', [0, 1, 2, 3])}
      {row('Molestia en articulaciones', ['No', 'Sí'], 'joint', [0, 1])}
    </div>
  );
}

// ───────────────────────── Técnicas avanzadas

export function TechniqueToggle({ technique, active, extraReps, onToggle, onExtra }: { technique: Technique; active: boolean; extraReps: number | null | undefined; onToggle: () => void; onExtra: (n: number | null) => void }) {
  const [info, setInfo] = useState(false);
  const t = TECHNIQUES[technique];
  return (
    <div className="tech-toggle">
      <button type="button" className={`chip ${active ? 'on' : ''}`} onClick={onToggle} data-testid="technique-toggle">
        <Zap size={13} /> {t.name}
      </button>
      {active && (
        <div style={{ width: 120 }}>
          <NumInput value={extraReps} onChange={onExtra} suffix="reps +" testId="technique-extra" />
        </div>
      )}
      <button type="button" className="btn ghost icon sm" onClick={() => setInfo(true)} title="Cómo se hace">
        <Info size={14} />
      </button>
      {info && <TechniqueModal technique={technique} onClose={() => setInfo(false)} />}
    </div>
  );
}

export function TechniqueModal({ technique, onClose }: { technique: Technique; onClose: () => void }) {
  const t = TECHNIQUES[technique];
  return (
    <Modal title={t.name} onClose={onClose}>
      <TechniqueDiagram technique={technique} />
      <ol className="small rec-list mt12">
        {t.how.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ol>
      <p className="small muted mt8">{t.why}</p>
      <p className="tiny muted mt8">Solo en la última serie. Cuenta como una serie extra en tu volumen semanal.</p>
    </Modal>
  );
}

/** Ilustración: barras = repeticiones; huecos = pausas; altura = peso o rango de movimiento. */
function TechniqueDiagram({ technique }: { technique: Technique }) {
  const bars: { h: number; gap?: boolean; label?: string }[] =
    technique === 'myo'
      ? [...Array(12).fill({ h: 1 }), { h: 0, gap: true, label: '15 s' }, ...Array(4).fill({ h: 1 }), { h: 0, gap: true, label: '15 s' }, ...Array(4).fill({ h: 1 }), { h: 0, gap: true, label: '15 s' }, ...Array(3).fill({ h: 1 })]
      : technique === 'drop'
        ? [...Array(10).fill({ h: 1 }), ...Array(6).fill({ h: 0.72 }), ...Array(4).fill({ h: 0.5 })]
        : [...Array(10).fill({ h: 1 }), ...Array(6).fill({ h: 0.45 })];
  return (
    <div className="tech-diagram" aria-hidden>
      {bars.map((b, i) =>
        b.gap ? (
          <span key={i} className="tech-gap">
            {b.label}
          </span>
        ) : (
          <span key={i} className="tech-bar" style={{ height: `${b.h * 100}%`, animationDelay: `${i * 0.08}s` }} />
        ),
      )}
      <div className="tiny muted tech-legend">{technique === 'drop' ? 'Altura = peso' : technique === 'parciales' ? 'Altura = rango de movimiento' : 'Cada barra = 1 repetición'}</div>
    </div>
  );
}

// ───────────────────────── Progreso por músculo

export function MuscleProgressPanel() {
  const { data, today, profile } = useApp();
  const prog = useMemo(() => muscleProgress(data.sessions, today, profile.equipment, profile.injuries, profile.excludedExercises), [data.sessions, today, profile]);
  const circ = useMemo(() => circumferenceTrend(data.bodyLogs, today), [data.bodyLogs, today]);
  return (
    <div className="grid g2">
      <Card title="Fuerza por músculo" hint="Últimas 6 semanas" icon={<IconTile icon={TrendingUp} color="var(--m-lime)" size={28} />}>
        {!prog.length && <Empty>Registra algunas sesiones para ver la tendencia de cada músculo.</Empty>}
        <div className="col" style={{ gap: 6 }} data-testid="muscle-progress">
          {prog.map((p) => (
            <div key={p.muscle} className="mp-row">
              <div className="row between">
                <b className="small">
                  {MUSCLE_LABEL[p.muscle]} {p.stalled && <span className="badge warn">Estancado</span>}
                </b>
                <span className={`mono small ${p.strengthPct == null ? 'muted' : p.strengthPct > 0.5 ? 'delta-down' : 'delta-up'}`}>
                  {p.strengthPct == null ? '—' : `${p.strengthPct > 0 ? '+' : ''}${fmt(p.strengthPct, 1)} %`}
                  {p.strengthPct != null && (p.strengthPct > 0.5 ? <TrendingUp size={13} style={{ verticalAlign: -2, marginLeft: 3 }} /> : <TrendingDown size={13} style={{ verticalAlign: -2, marginLeft: 3 }} />)}
                </span>
              </div>
              {p.suggestion && <div className="tiny muted">{p.suggestion}</div>}
            </div>
          ))}
        </div>
        <p className="tiny muted mt8">Cambio del 1RM estimado de sus ejercicios. En déficit, mantener la fuerza ya es buena señal.</p>
      </Card>
      <Card title="Perímetros" hint="Últimas 8 semanas" icon={<IconTile icon={Ruler} color="var(--m-amber)" size={28} />}>
        {!circ.length ? (
          <Empty>Mide brazo, pecho, muslo y pantorrilla cada 2–4 semanas (Mi cuerpo → Medidas) para ver si crecen mientras baja la cintura.</Empty>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {circ.map((c) => (
              <div key={c.key} className="row between small">
                <span>{c.label}</span>
                <span className="mono">
                  {fmt(c.first, 1)} → <b>{fmt(c.last, 1)} cm</b> <span className={c.diff >= 0 ? 'delta-down' : 'delta-up'}>({c.diff > 0 ? '+' : ''}{fmt(c.diff, 1)})</span>
                </span>
              </div>
            ))}
            <p className="tiny muted">Si la cintura baja y estos perímetros se mantienen o suben, estás ganando o conservando músculo.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ───────────────────────── Calibración de RIR

export function RirCalibration() {
  const { settings, setSetting, today, toast } = useApp();
  const tests = (settings.rir_tests as RirTest[] | undefined) ?? [];
  const bias = rirBias(tests);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [t, setT] = useState<Partial<RirTest>>({ exerciseId: RIR_TEST_EXERCISES[0], guessedRir: 2 });
  const save = async () => {
    if (!t.repsAtGuess || !t.totalReps || t.totalReps < t.repsAtGuess) return toast('Revisa las repeticiones.', 'error');
    await setSetting('rir_tests', [...tests, { ...t, date: today } as RirTest].slice(-10));
    setOpen(false);
    setStep(0);
    toast('Prueba guardada.');
  };
  return (
    <Card title="Calibra tu RIR" icon={<IconTile icon={Gauge} color="var(--m-cyan)" size={28} />} actions={<button className="btn sm" onClick={() => setOpen(true)} data-testid="rir-test-open"><Target size={14} /> Hacer la prueba</button>}>
      {bias ? (
        <p className="small" data-testid="rir-bias">
          {bias.message} <span className="tiny muted">({bias.n} prueba{bias.n > 1 ? 's' : ''})</span>
        </p>
      ) : (
        <p className="small muted">Casi todos creemos estar más cerca del fallo de lo que estamos. Una serie al fallo en una máquina te enseña a medir tu RIR, y sin RIR preciso la progresión no funciona.</p>
      )}
      {open && (
        <Modal title="Prueba de RIR" onClose={() => setOpen(false)}>
          {step === 0 && (
            <div className="col" style={{ gap: 12 }}>
              <p className="small">Elige una máquina o polea (seguro llegar al fallo) y un peso que puedas mover unas 12–15 veces. Calienta antes.</p>
              <Field label="Ejercicio">
                <select className="input" value={t.exerciseId} onChange={(e) => setT({ ...t, exerciseId: e.target.value })}>
                  {RIR_TEST_EXERCISES.map((id) => (
                    <option key={id} value={id}>
                      {getExercise(id)?.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Peso">
                <NumInput value={t.weight} onChange={(v) => setT({ ...t, weight: v ?? 0 })} suffix="kg" />
              </Field>
              <button className="btn primary" onClick={() => setStep(1)}>
                Listo
              </button>
            </div>
          )}
          {step === 1 && (
            <div className="col" style={{ gap: 12 }}>
              <p className="small">
                Haz repeticiones y <b>detente un momento cuando sientas que te quedan 2</b>. ¿Cuántas llevabas?
              </p>
              <NumInput value={t.repsAtGuess} onChange={(v) => setT({ ...t, repsAtGuess: v ?? 0, guessedRir: 2 })} suffix="reps" testId="rir-at-guess" />
              <button className="btn primary" disabled={!t.repsAtGuess} onClick={() => setStep(2)}>
                Siguiente
              </button>
            </div>
          )}
          {step === 2 && (
            <div className="col" style={{ gap: 12 }}>
              <p className="small">
                Ahora <b>sigue hasta que no salga ni una repetición más con buena técnica</b>. ¿Cuántas hiciste en total?
              </p>
              <NumInput value={t.totalReps} onChange={(v) => setT({ ...t, totalReps: v ?? 0 })} suffix="reps" testId="rir-total" />
              {t.totalReps != null && t.repsAtGuess != null && t.totalReps >= t.repsAtGuess && (
                <Alert kind="info">
                  Te quedaban <b>{t.totalReps - t.repsAtGuess}</b> repeticiones cuando creías que eran 2.
                </Alert>
              )}
              <button className="btn primary" onClick={save} data-testid="rir-save">
                Guardar resultado
              </button>
            </div>
          )}
        </Modal>
      )}
    </Card>
  );
}

/** Etiqueta pequeña de estiramiento para listas de ejercicios. */
export function StretchBadge({ id }: { id: string }): ReactNode {
  const s = stretchOf(id);
  if (s === 1) return null;
  return (
    <span className={`badge ${s === 2 ? 'ok' : ''}`} title={STRETCH_LABEL[s]}>
      {s === 2 ? <Flame size={11} /> : null} {s === 2 ? 'Gran estiramiento' : 'Acortado'}
    </span>
  );
}

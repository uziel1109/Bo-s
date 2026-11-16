import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Info, Play, Plus, RefreshCw, Repeat, Search, Timer, Trash2, Trophy } from 'lucide-react';
import { useApp } from '../store';
import { Alert, Card, Claims, Empty, Field, fmt, Modal, NumInput, PageHead, Seg, Stat, Tabs } from '../components/ui';
import { SimpleBars, SimpleLine } from '../components/charts';
import { MuscleMap } from '../components/MuscleMap';
import { EXERCISES, EQUIPMENT_LABEL, getExercise, isAvailable, MUSCLE_LABEL, REGION_LABEL, type Exercise } from '@shared/training/exercises';
import { generateRoutine, weeklySetTarget, type Routine, type RoutineDay } from '@shared/training/generator';
import { bestE1rm, deloadAdvice, exerciseHistory, muscleWeekStats, progressionAdvice, sessionVolume, type ProgressionAdvice } from '@shared/training/progression';
import type { ExerciseLog, Muscle, SetLog, WorkoutSession } from '@shared/types';
import { DAY_NAMES, formatDateShort, round, uid } from '@shared/utils';
import { api } from '../api';

type Tab = 'sesion' | 'rutina' | 'progresion' | 'musculos' | 'ejercicios' | 'historial';

export function Training() {
  const [tab, setTab] = useState<Tab>('sesion');
  return (
    <div className="page">
      <PageHead title="Entrenamiento" sub="Rutina personalizada, registro de sesiones y sobrecarga progresiva." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'sesion', label: 'Sesión de hoy' },
          { value: 'rutina', label: 'Mi rutina' },
          { value: 'progresion', label: 'Progresión' },
          { value: 'musculos', label: 'Por músculo' },
          { value: 'ejercicios', label: 'Ejercicios' },
          { value: 'historial', label: 'Historial' },
        ]}
      />
      {tab === 'sesion' && <SessionLogger />}
      {tab === 'rutina' && <RoutineView />}
      {tab === 'progresion' && <ProgressionView />}
      {tab === 'musculos' && <MuscleView />}
      {tab === 'ejercicios' && <Library />}
      {tab === 'historial' && <History />}
    </div>
  );
}

// ───────────────────────── Sesión

const ACTION_LABEL: Record<ProgressionAdvice['action'], { t: string; cls: string }> = {
  subir_peso: { t: 'Subir peso', cls: 'ok' },
  subir_reps: { t: 'Sumar repeticiones', cls: 'info' },
  mantener: { t: 'Mantener', cls: '' },
  reducir_carga: { t: 'Reducir carga', cls: 'warn' },
  revisar_dolor: { t: 'Revisar dolor', cls: 'danger' },
  sin_datos: { t: 'Sin datos', cls: '' },
};

function buildLogs(day: RoutineDay, sessions: WorkoutSession[], deload: boolean): ExerciseLog[] {
  return day.exercises.map((e) => {
    const hist = exerciseHistory(sessions, e.exerciseId).map((h) => h.log);
    const adv = progressionAdvice(hist);
    const last = hist[hist.length - 1];
    const w = adv?.suggestedWeight ?? last?.sets.find((s) => s.done)?.weight ?? 0;
    const sets = deload ? Math.max(1, Math.ceil(e.sets / 2)) : e.sets;
    return {
      exerciseId: e.exerciseId,
      name: e.name,
      targetSets: sets,
      repMin: e.repMin,
      repMax: e.repMax,
      targetRir: e.rir,
      sets: Array.from({ length: sets }, () => ({ weight: w, reps: 0, rir: null, done: false })),
    };
  });
}

function SessionLogger() {
  const { data, today, reload, toast } = useApp();
  const routine = data.routine;
  const dow = new Date(today + 'T12:00:00').getDay();
  const existing = data.sessions.find((s) => s.date === today && !s.completed) ?? null;
  const doneToday = data.sessions.filter((s) => s.date === today && s.completed);
  const defaultDay = routine?.days.find((d) => d.weekday === dow) ?? null;
  const [dayKey, setDayKey] = useState<string | null>(existing?.day_key ?? defaultDay?.key ?? routine?.days[0]?.key ?? null);
  const [session, setSession] = useState<WorkoutSession | null>(existing);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [, force] = useState(0);
  const [info, setInfo] = useState<Exercise | null>(null);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const deloadAccepted = data.adjustments.find((a) => a.kind === 'recuperacion' && a.status === 'aceptado' && a.resolved_at && (Date.now() - new Date(a.resolved_at).getTime()) / 86400000 < 7);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => {
      force((x) => x + 1);
      if (Date.now() >= rest.until) {
        setRest(null);
        try {
          new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play();
        } catch {
          /* sin audio */
        }
      }
    }, 250);
    return () => clearInterval(t);
  }, [rest]);

  if (!routine) return <Empty>No tienes una rutina activa. Genérala en “Mi rutina”.</Empty>;

  const start = () => {
    const day = routine.days.find((d) => d.key === dayKey);
    if (!day) return;
    startRef.current = Date.now();
    setSession({ id: uid('s_'), date: today, routine_id: routine.id ?? null, day_key: day.key, day_name: day.name, exercises: buildLogs(day, data.sessions, !!deloadAccepted), completed: 0, notes: null });
  };

  const persist = async (s: WorkoutSession) => {
    setSession(s);
    await api.upsert('workout_sessions', s);
  };

  const updateSet = (ei: number, si: number, patch: Partial<SetLog>) => {
    if (!session) return;
    const s = structuredClone(session);
    s.exercises[ei].sets[si] = { ...s.exercises[ei].sets[si], ...patch };
    persist(s);
  };

  const finish = async () => {
    if (!session) return;
    const done = session.exercises.some((e) => e.sets.some((x) => x.done));
    if (!done) return toast('Marca al menos una serie como completada.', 'error');
    const dur = session.duration_min ?? Math.round((Date.now() - startRef.current) / 60000);
    await api.upsert('workout_sessions', { ...session, completed: 1, duration_min: dur || null });
    await reload();
    setSession(null);
    toast('¡Sesión guardada!');
  };

  if (!session)
    return (
      <div className="col" style={{ gap: 16 }}>
        {doneToday.length > 0 && <Alert kind="ok">Ya completaste hoy: {doneToday.map((s) => s.day_name).join(', ')}.</Alert>}
        {deloadAccepted && <Alert kind="info">Semana de descarga activa: las series se reducen a la mitad manteniendo cargas similares.</Alert>}
        <Card title="Iniciar sesión">
          <div className="row">
            <select className="input" style={{ maxWidth: 380 }} value={dayKey ?? ''} onChange={(e) => setDayKey(e.target.value)} data-testid="session-day">
              {routine.days.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name} — {DAY_NAMES[d.weekday]} {d.weekday === dow ? '(hoy)' : ''}
                </option>
              ))}
            </select>
            <button className="btn primary" onClick={start} data-testid="session-start">
              <Play /> Comenzar
            </button>
          </div>
          {!defaultDay && <p className="small muted mt8">Hoy no está programado un entrenamiento de fuerza; puedes adelantar o recuperar una sesión.</p>}
        </Card>
        {dayKey && <DayPreview day={routine.days.find((d) => d.key === dayKey)!} />}
      </div>
    );

  const restLeft = rest ? Math.max(0, Math.ceil((rest.until - Date.now()) / 1000)) : 0;
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row between">
        <div>
          <h2>{session.day_name}</h2>
          <div className="small muted">Registra peso, repeticiones y RIR (repeticiones que te quedaron en reserva).</div>
        </div>
        <div className="row">
          {rest && (
            <span className="badge accent" style={{ height: 32, fontSize: 14 }}>
              <Timer size={14} /> Descanso {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
            </span>
          )}
          {rest && (
            <button className="btn sm" onClick={() => setRest(null)}>
              Saltar
            </button>
          )}
          <button
            className="btn"
            onClick={async () => {
              if (!confirm('¿Descartar esta sesión?')) return;
              await api.remove('workout_sessions', session.id);
              setSession(null);
              await reload();
            }}
          >
            Descartar
          </button>
          <button className="btn primary" onClick={finish} data-testid="session-finish">
            <Check /> Finalizar sesión
          </button>
        </div>
      </div>
      {session.exercises.map((e, ei) => {
        const ex = getExercise(e.exerciseId);
        const hist = exerciseHistory(data.sessions, e.exerciseId).map((h) => h.log);
        const adv = progressionAdvice(hist);
        const last = hist[hist.length - 1];
        const rd = data.routine?.days.find((d) => d.key === session.day_key)?.exercises.find((x) => x.exerciseId === e.exerciseId);
        return (
          <div className="ex-card" key={ei} data-testid={`ex-${ei}`}>
            <div className="row between mb8">
              <div>
                <b>{e.name}</b>
                <div className="tiny muted">
                  {e.targetSets} × {e.repMin}–{e.repMax} · RIR {e.targetRir} · descanso {rd ? Math.round(rd.restSec / 60 * 10) / 10 : 2} min
                  {last && ` · última vez: ${last.sets.filter((s) => s.done).map((s) => `${s.weight}×${s.reps}`).join(', ')}`}
                </div>
              </div>
              <div className="row">
                {adv && <span className={`badge ${ACTION_LABEL[adv.action].cls}`} title={adv.reason}>{ACTION_LABEL[adv.action].t}</span>}
                <button className="btn ghost icon sm" title="Cambiar por alternativa" onClick={() => setSwapIdx(ei)}>
                  <Repeat />
                </button>
                {ex && (
                  <button className="btn ghost icon sm" onClick={() => setInfo(ex)} title="Técnica">
                    <Info />
                  </button>
                )}
              </div>
            </div>
            {adv && <div className="small muted mb8">{adv.reason}</div>}
            {rd?.caution && <Alert kind="warn">{rd.caution}</Alert>}
            <div className="set-grid tiny muted" style={{ marginBottom: 6 }}>
              <div>Serie</div>
              <div className="right">Peso (kg)</div>
              <div className="right">Reps</div>
              <div className="right">RIR</div>
              <div>Molestia</div>
              <div />
            </div>
            {e.sets.map((s, si) => (
              <div className="set-grid" key={si} style={{ marginBottom: 6 }}>
                <div className="muted">{si + 1}</div>
                <input className="input mono" type="number" step="0.5" value={s.weight || ''} onChange={(ev) => updateSet(ei, si, { weight: Number(ev.target.value) })} data-testid={`w-${ei}-${si}`} />
                <input className="input mono" type="number" value={s.reps || ''} onChange={(ev) => updateSet(ei, si, { reps: Number(ev.target.value) })} data-testid={`r-${ei}-${si}`} />
                <select className="input" value={s.rir ?? ''} onChange={(ev) => updateSet(ei, si, { rir: ev.target.value === '' ? null : Number(ev.target.value) })}>
                  <option value="">—</option>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <label className="row small" style={{ gap: 4 }}>
                  <input type="checkbox" checked={!!s.pain} onChange={(ev) => updateSet(ei, si, { pain: ev.target.checked })} /> Sí
                </label>
                <button
                  className={`set-done ${s.done ? 'on' : ''}`}
                  data-testid={`done-${ei}-${si}`}
                  onClick={() => {
                    if (!s.done && (!s.reps || s.reps <= 0)) return toast('Indica las repeticiones realizadas.', 'error');
                    updateSet(ei, si, { done: !s.done, rest_s: rd?.restSec ?? 120 });
                    if (!s.done) setRest({ until: Date.now() + (rd?.restSec ?? 120) * 1000, total: rd?.restSec ?? 120 });
                  }}
                >
                  <Check size={16} />
                </button>
              </div>
            ))}
            <div className="row mt8">
              <button
                className="btn sm ghost"
                onClick={() => {
                  const s = structuredClone(session);
                  const lastSet = s.exercises[ei].sets[s.exercises[ei].sets.length - 1];
                  s.exercises[ei].sets.push({ weight: lastSet?.weight ?? 0, reps: 0, rir: null, done: false });
                  persist(s);
                }}
              >
                <Plus /> Serie
              </button>
              <input
                className="input"
                style={{ maxWidth: 420, height: 30 }}
                placeholder="Notas o molestias (p. ej., dolor en hombro derecho)"
                value={e.notes ?? ''}
                onChange={(ev) => {
                  const s = structuredClone(session);
                  s.exercises[ei].notes = ev.target.value;
                  s.exercises[ei].pain = /dolor|molest/i.test(ev.target.value) ? ev.target.value : s.exercises[ei].sets.some((x) => x.pain) ? 'molestia' : null;
                  persist(s);
                }}
              />
            </div>
          </div>
        );
      })}
      <Card title="Cierre de sesión">
        <div className="grid g3">
          <Field label="Esfuerzo global de la sesión (RPE 1–10)">
            <NumInput value={session.session_rpe} onChange={(v) => persist({ ...session, session_rpe: v })} min={1} max={10} />
          </Field>
          <Field label="Duración (min)" help="Se calcula sola si la dejas vacía.">
            <NumInput value={session.duration_min} onChange={(v) => persist({ ...session, duration_min: v })} />
          </Field>
          <Field label="Observaciones">
            <input className="input" value={session.notes ?? ''} onChange={(e) => persist({ ...session, notes: e.target.value })} />
          </Field>
        </div>
      </Card>
      {info && <ExerciseModal ex={info} onClose={() => setInfo(null)} />}
      {swapIdx != null && (
        <SwapModal
          current={session.exercises[swapIdx].exerciseId}
          onClose={() => setSwapIdx(null)}
          onPick={(ex) => {
            const s = structuredClone(session);
            s.exercises[swapIdx] = { ...s.exercises[swapIdx], exerciseId: ex.id, name: ex.name, sets: s.exercises[swapIdx].sets.map((x) => ({ ...x, weight: 0, done: false, reps: 0 })) };
            persist(s);
            setSwapIdx(null);
          }}
        />
      )}
    </div>
  );
}

function DayPreview({ day }: { day: RoutineDay }) {
  const [info, setInfo] = useState<Exercise | null>(null);
  return (
    <Card title={`${day.name} · ${day.focus}`} hint={`~${day.estMinutes} min`}>
      <table className="table">
        <thead>
          <tr>
            <th>Ejercicio</th>
            <th className="right">Series</th>
            <th className="right">Reps</th>
            <th className="right">RIR</th>
            <th className="right">Descanso</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {day.exercises.map((e) => (
            <tr key={e.exerciseId}>
              <td>
                {e.name}
                {e.caution && <div className="tiny" style={{ color: 'var(--warn)' }}>{e.caution}</div>}
              </td>
              <td className="right">{e.sets}</td>
              <td className="right">
                {e.repMin}–{e.repMax}
              </td>
              <td className="right">{e.rir}</td>
              <td className="right">{Math.round(e.restSec / 6) / 10} min</td>
              <td className="right">
                <button className="btn ghost icon sm" onClick={() => setInfo(getExercise(e.exerciseId) ?? null)}>
                  <Info />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {info && <ExerciseModal ex={info} onClose={() => setInfo(null)} />}
    </Card>
  );
}

function SwapModal({ current, onClose, onPick }: { current: string; onClose: () => void; onPick: (ex: Exercise) => void }) {
  const { profile } = useApp();
  const ex = getExercise(current);
  const alts = EXERCISES.filter((e) => e.id !== current && (ex?.alternatives.includes(e.id) || e.primary === ex?.primary) && isAvailable(e, profile.equipment, profile.injuries, profile.excludedExercises));
  return (
    <Modal title="Ejercicios alternativos" onClose={onClose}>
      <div className="col">
        {alts.map((a) => (
          <div className="list-item" key={a.id}>
            <div className="grow">
              <b>{a.name}</b>
              <div className="tiny muted">
                {MUSCLE_LABEL[a.primary]} · {a.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ')} {ex?.alternatives.includes(a.id) && '· equivalente recomendado'}
              </div>
            </div>
            <button className="btn sm" onClick={() => onPick(a)}>
              Usar
            </button>
          </div>
        ))}
        {!alts.length && <Empty>No hay alternativas compatibles con tu equipo y limitaciones.</Empty>}
      </div>
    </Modal>
  );
}

export function ExerciseModal({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  return (
    <Modal title={ex.name} onClose={onClose} wide>
      <div className="grid g3">
        <div>
          <MuscleMap primary={[ex.primary]} secondary={ex.secondary} />
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            Diagrama de músculos implicados (no muestra la técnica).
          </p>
        </div>
        <div className="span2 col" style={{ gap: 14 }}>
          <div className="row">
            <span className="badge accent">{MUSCLE_LABEL[ex.primary]}</span>
            {ex.secondary.map((m) => (
              <span key={m} className="badge">
                {MUSCLE_LABEL[m]}
              </span>
            ))}
            <span className="badge info">{ex.compound ? 'Compuesto' : 'Aislamiento'}</span>
          </div>
          <div className="small muted">Equipo: {ex.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ')}{ex.stress.length ? ` · Exige: ${ex.stress.map((r) => REGION_LABEL[r]).join(', ')}` : ''}</div>
          <div>
            <h3 className="mb8">Ejecución</h3>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {ex.instructions.map((s, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <div className="grid g2">
            <div>
              <h3 className="mb8">Técnica correcta</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {ex.technique.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb8">Errores frecuentes</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {ex.mistakes.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <h3 className="mb8">Alternativas equivalentes</h3>
            <div className="chips">
              {ex.alternatives.map((a) => (
                <span key={a} className="chip">
                  {getExercise(a)?.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────── Rutina

function RoutineView() {
  const { data, profile, reload, toast, routineId } = useApp();
  const r = data.routine;
  const [preview, setPreview] = useState<Routine | null>(null);
  const tgt = weeklySetTarget(profile.experience);

  const save = async (routine: Routine, replace: boolean) => {
    const id = replace || !routineId ? uid('r_') : routineId;
    await api.upsert('routines', { id, created_at: new Date().toISOString(), active: 1, data: { ...routine, id: undefined } });
    await api.setActive('routines', id);
    await reload();
  };

  const editSets = async (dayKey: string, exId: string, delta: number) => {
    if (!r) return;
    const copy = structuredClone(r);
    const ex = copy.days.find((d) => d.key === dayKey)!.exercises.find((e) => e.exerciseId === exId)!;
    ex.sets = Math.max(1, Math.min(8, ex.sets + delta));
    await save(copy, false);
  };

  if (!r)
    return (
      <Empty>
        <button className="btn primary" onClick={() => save(generateRoutine(profile), true)}>
          Generar rutina
        </button>
      </Empty>
    );

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="grid g4">
        <Card tight>
          <Stat label="División" value={r.splitLabel} />
        </Card>
        <Card tight>
          <Stat label="Días por semana" value={r.daysPerWeek} />
        </Card>
        <Card tight>
          <Stat label="Series objetivo / músculo" value={`~${tgt}`} foot="Rango basado en evidencia: 10–20" />
        </Card>
        <Card tight>
          <div className="col">
            <button className="btn" onClick={() => setPreview(generateRoutine(profile))} data-testid="regen-routine">
              <RefreshCw /> Regenerar con mi perfil
            </button>
            <span className="tiny muted">Verás la propuesta antes de reemplazar tu rutina.</span>
          </div>
        </Card>
      </div>
      <Card title="Justificación">
        <Claims items={r.rationale.map((t) => ({ kind: 'recomendacion' as const, text: t }))} />
      </Card>
      <div className="grid g2">
        {r.days.map((d) => (
          <Card key={d.key} title={`${DAY_NAMES[d.weekday]} · ${d.name}`} hint={`~${d.estMinutes} min`}>
            <p className="small muted mb8">{d.focus}</p>
            <table className="table">
              <tbody>
                {d.exercises.map((e) => (
                  <tr key={e.exerciseId}>
                    <td>
                      {e.name}
                      <div className="tiny muted">
                        {e.repMin}–{e.repMax} reps · RIR {e.rir} · {Math.round(e.restSec / 6) / 10} min
                      </div>
                    </td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn ghost sm" onClick={() => editSets(d.key, e.exerciseId, -1)}>
                        −
                      </button>
                      <b className="mono">{e.sets}</b> series
                      <button className="btn ghost sm" onClick={() => editSets(d.key, e.exerciseId, 1)}>
                        +
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
      <Card title="Series semanales planificadas por músculo" hint="Principal = 1 serie · secundario = 0.5">
        <SimpleBars
          layout="vertical"
          height={Math.max(220, Object.keys(r.weeklySets).length * 26)}
          data={(Object.entries(r.weeklySets) as [Muscle, number][]).sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ m: MUSCLE_LABEL[m], v: round(v, 1) }))}
          x="m"
          y="v"
          name="Series"
        />
      </Card>
      {preview && (
        <Modal
          title={`Nueva propuesta: ${preview.splitLabel}, ${preview.daysPerWeek} días`}
          onClose={() => setPreview(null)}
          wide
          footer={
            <>
              <button className="btn" onClick={() => setPreview(null)}>
                Conservar la actual
              </button>
              <button
                className="btn primary"
                onClick={async () => {
                  await save(preview, true);
                  setPreview(null);
                  toast('Rutina actualizada.');
                }}
              >
                Reemplazar mi rutina
              </button>
            </>
          }
        >
          <Claims items={preview.rationale.map((t) => ({ kind: 'recomendacion' as const, text: t }))} />
          <div className="grid g2 mt16">
            {preview.days.map((d) => (
              <div key={d.key} className="ex-card">
                <b>
                  {DAY_NAMES[d.weekday]} · {d.name}
                </b>
                <ul className="small" style={{ paddingLeft: 18 }}>
                  {d.exercises.map((e) => (
                    <li key={e.exerciseId}>
                      {e.name} — {e.sets}×{e.repMin}–{e.repMax}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ───────────────────────── Progresión

function ProgressionView() {
  const { data, today } = useApp();
  const ids = [...new Set(data.sessions.filter((s) => s.completed).flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
  const [sel, setSel] = useState<string | null>(ids[0] ?? null);
  const deload = deloadAdvice(data.sessions, data.recoveryLogs, today);
  if (!ids.length) return <Empty>Completa sesiones para ver tu progresión y las recomendaciones de carga.</Empty>;
  const hist = sel ? exerciseHistory(data.sessions, sel) : [];
  const series = hist.map((h) => ({ date: h.date, e1rm: round(bestE1rm(h.log.sets), 1), top: Math.max(...h.log.sets.filter((s) => s.done).map((s) => s.weight), 0) }));
  return (
    <div className="col" style={{ gap: 16 }}>
      {deload.recommended ? (
        <Alert kind="warn">
          <b>Semana de descarga recomendada.</b> {deload.reasons.join(' ')} Puedes aceptarla en Inteligencia artificial → Ajustes propuestos.
        </Alert>
      ) : (
        <Alert kind="ok">Sin señales de fatiga acumulada que justifiquen una descarga ({deload.weeksSinceDeload} semanas desde el inicio o la última descarga).</Alert>
      )}
      <Card title="Recomendación por ejercicio (próxima sesión)">
        <table className="table">
          <thead>
            <tr>
              <th>Ejercicio</th>
              <th>Acción</th>
              <th className="right">Peso sugerido</th>
              <th className="right">Reps</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const h = exerciseHistory(data.sessions, id).map((x) => x.log);
              const a = progressionAdvice(h);
              if (!a) return null;
              return (
                <tr key={id} className="click" onClick={() => setSel(id)}>
                  <td>{getExercise(id)?.name ?? h[0]?.name}</td>
                  <td>
                    <span className={`badge ${ACTION_LABEL[a.action].cls}`}>{ACTION_LABEL[a.action].t}</span>
                  </td>
                  <td className="right">{a.suggestedWeight != null ? `${a.suggestedWeight} kg` : '—'}</td>
                  <td className="right">{a.suggestedReps}</td>
                  <td className="small muted">{a.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title={`Evolución de fuerza: ${sel ? getExercise(sel)?.name ?? sel : ''}`} hint="1RM estimado (Epley con RIR)" actions={
        <select className="input" style={{ width: 280 }} value={sel ?? ''} onChange={(e) => setSel(e.target.value)}>
          {ids.map((id) => (
            <option key={id} value={id}>
              {getExercise(id)?.name ?? id}
            </option>
          ))}
        </select>
      }>
        <SimpleLine data={series} dataKey="e1rm" name="1RM estimado" unit="kg" height={240} />
      </Card>
    </div>
  );
}

// ───────────────────────── Por músculo

function MuscleView() {
  const { data, today, profile } = useApp();
  const st = useMemo(() => muscleWeekStats(data.sessions, today, today), [data.sessions, today]);
  const tgt = weeklySetTarget(profile.experience);
  const muscles = (Object.keys(MUSCLE_LABEL) as Muscle[]).filter((m) => !['antebrazo', 'lumbares', 'aductores'].includes(m));
  return (
    <div className="col" style={{ gap: 16 }}>
      <Card title="Semana actual por grupo muscular" hint={`Objetivo orientativo ≈ ${tgt} series efectivas`}>
        <table className="table">
          <thead>
            <tr>
              <th>Músculo</th>
              <th className="right">Series</th>
              <th className="right">Series efectivas</th>
              <th className="right">Frecuencia</th>
              <th>Último entrenamiento</th>
              <th className="right">Recuperación (est.)</th>
            </tr>
          </thead>
          <tbody>
            {muscles.map((m) => {
              const s = st[m];
              return (
                <tr key={m}>
                  <td>
                    {MUSCLE_LABEL[m]} {profile.priorityMuscles.includes(m) && <span className="badge accent">Prioridad</span>}
                  </td>
                  <td className="right">{fmt(s?.sets ?? 0, 1)}</td>
                  <td className="right">
                    <b style={{ color: (s?.effectiveSets ?? 0) >= tgt * 0.8 ? 'var(--ok)' : undefined }}>{fmt(s?.effectiveSets ?? 0, 1)}</b>
                  </td>
                  <td className="right">{s?.frequency ?? 0}×</td>
                  <td>{s?.lastTrained ? formatDateShort(s.lastTrained) : '—'}</td>
                  <td className="right">{s?.lastTrained ? `${s.recoveryPct}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="tiny muted mt8">Serie efectiva: completada a RIR ≤ 4. Recuperación estimada con 48–72 h según el volumen; es una aproximación, no una medición.</p>
      </Card>
    </div>
  );
}

// ───────────────────────── Biblioteca

function Library() {
  const { profile } = useApp();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'todos'>('todos');
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [sel, setSel] = useState<Exercise | null>(null);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = EXERCISES.filter((e) => (muscle === 'todos' || e.primary === muscle) && (!q || norm(e.name).includes(norm(q))) && (!onlyAvail || isAvailable(e, profile.equipment, profile.injuries, profile.excludedExercises)));
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row">
        <div className="input-wrap" style={{ width: 280 }}>
          <input className="input" placeholder="Buscar ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="suffix">
            <Search size={14} />
          </span>
        </div>
        <select className="input" style={{ width: 220 }} value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle | 'todos')}>
          <option value="todos">Todos los músculos</option>
          {(Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABEL[m]}
            </option>
          ))}
        </select>
        <label className="row small">
          <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} /> Solo disponibles con mi equipo y limitaciones
        </label>
      </div>
      <div className="grid g3">
        {list.map((e) => (
          <button key={e.id} className="card flat" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => setSel(e)}>
            <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
              <MuscleMap primary={[e.primary]} secondary={e.secondary} size={70} />
              <div className="col" style={{ gap: 4 }}>
                <b>{e.name}</b>
                <span className="small muted">{MUSCLE_LABEL[e.primary]}</span>
                <span className="tiny muted">{e.equipment.map((x) => EQUIPMENT_LABEL[x]).join(', ')}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {!list.length && <Empty>Sin ejercicios con esos filtros.</Empty>}
      {sel && <ExerciseModal ex={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

// ───────────────────────── Historial

function History() {
  const { data, reload } = useApp();
  const sessions = data.sessions.filter((s) => s.completed).sort((a, b) => b.date.localeCompare(a.date));
  const [open, setOpen] = useState<WorkoutSession | null>(null);
  if (!sessions.length) return <Empty>Aún no hay sesiones completadas.</Empty>;
  return (
    <Card>
      <table className="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Sesión</th>
            <th className="right">Series</th>
            <th className="right">Volumen (kg)</th>
            <th className="right">Duración</th>
            <th className="right">RPE</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="click" onClick={() => setOpen(s)}>
              <td>{formatDateShort(s.date)}</td>
              <td>{s.day_name}</td>
              <td className="right">{s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0)}</td>
              <td className="right">{fmt(sessionVolume(s))}</td>
              <td className="right">{s.duration_min ? `${s.duration_min} min` : '—'}</td>
              <td className="right">{s.session_rpe ?? '—'}</td>
              <td className="right">
                <button
                  className="btn ghost icon sm"
                  onClick={async (ev) => {
                    ev.stopPropagation();
                    if (!confirm('¿Eliminar esta sesión?')) return;
                    await api.remove('workout_sessions', s.id);
                    await reload();
                  }}
                >
                  <Trash2 />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && (
        <Modal title={`${open.day_name} · ${formatDateShort(open.date)}`} onClose={() => setOpen(null)}>
          {open.exercises.map((e, i) => (
            <div key={i} className="mb16">
              <b>{e.name}</b>
              <div className="small">
                {e.sets
                  .filter((x) => x.done)
                  .map((x) => `${x.weight} kg × ${x.reps}${x.rir != null ? ` @RIR ${x.rir}` : ''}${x.pain ? ' (molestia)' : ''}`)
                  .join(' · ') || 'sin series'}
              </div>
              <div className="tiny muted">
                <Trophy size={11} /> 1RM est.: {fmt(bestE1rm(e.sets), 1)} kg {e.notes ? `· ${e.notes}` : ''}
              </div>
            </div>
          ))}
          {open.notes && <p className="small muted">{open.notes}</p>}
        </Modal>
      )}
    </Card>
  );
}

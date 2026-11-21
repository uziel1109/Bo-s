// Fases de la dieta: mantenimiento al llegar a la meta, descansos de dieta, días de recarga y eventos sociales.
import { useMemo, useState } from 'react';
import { CalendarHeart, Coffee, Flag, PartyPopper, Plus, Trash2, Wheat } from 'lucide-react';
import { useApp } from '../store';
import { Alert, Card, Chips, Claims, ConfirmButton, DetailsHint, Field, fmt, NumInput, Seg } from './ui';
import { IconTile } from './visual';
import { DAY_KIND_LABEL, dayPlanFor, etaWithBreaks, maintenanceKcalOn, maintenanceWeeks, nearGoal, nextDietBreak, weekPlan, type DayKind, type DietEvent, type MaintenancePhase, type PhaseSettings } from '@shared/nutrition/phases';
import { calorieFloor } from '@shared/safety/screening';
import { addDays, DAY_SHORT, formatDateShort, parseISODate, round, uid, weekStart } from '@shared/utils';

export const KIND_COLOR: Record<DayKind, string> = {
  deficit: 'var(--m-slate)',
  descanso_dieta: 'var(--m-cyan)',
  recarga: 'var(--m-amber)',
  evento: 'var(--m-pink)',
  ahorro: 'var(--m-violet)',
  mantenimiento: 'var(--m-lime)',
};

export function usePhaseCtx() {
  const { state: st, profile } = useApp();
  return { tdee: st.tdee.tdee, floor: calorieFloor(profile.sex), legWeekdays: st.legWeekdays };
}

/** Objetivo de una fecha concreta con las fases aplicadas. */
export function useDayTargets(date: string) {
  const { state: st, data } = useApp();
  const ctx = usePhaseCtx();
  return useMemo(() => dayPlanFor(date, st.targets, data.phases, ctx), [date, st.targets, data.phases, ctx.tdee, ctx.floor, ctx.legWeekdays.join()]);
}

export function DayKindBadge({ kind, label }: { kind: DayKind; label?: string }) {
  if (kind === 'deficit') return null;
  return (
    <span className="badge" style={{ background: `color-mix(in srgb, ${KIND_COLOR[kind]} 22%, transparent)`, color: KIND_COLOR[kind], fontWeight: 650 }} data-testid="day-kind">
      {label ?? DAY_KIND_LABEL[kind]}
    </span>
  );
}

export function PhasesPanel() {
  const { state: st, data, today, profile, setSetting, toast, settings } = useApp();
  const ctx = usePhaseCtx();
  const ps: PhaseSettings = (settings.phases as PhaseSettings) ?? {};
  const save = async (next: PhaseSettings, msg: string) => {
    await setSetting('phases', next);
    toast(msg);
  };
  const week = weekPlan(weekStart(today), st.targets, ps, ctx);
  const avg = Math.round(week.reduce((a, d) => a + d.kcal, 0) / 7);
  const comp = st.composition;
  const near = nearGoal(comp.bf.value, profile.targetBodyFat, st.trendWeight ?? st.currentWeight, comp.goalWeight);

  return (
    <div className="col" style={{ gap: 16 }}>
      <Card title="Tu semana" icon={<IconTile icon={CalendarHeart} color="var(--m-orange)" size={28} />} hint={`Promedio ${fmt(avg)} kcal/día · plan base ${fmt(st.targets.kcal)} kcal`}>
        <div className="week-strip" data-testid="phase-week">
          {week.map((d) => (
            <div key={d.date} className={`week-day ${d.date === today ? 'today' : ''}`} style={{ borderColor: d.kind === 'deficit' ? undefined : KIND_COLOR[d.kind] }}>
              <div className="tiny muted">{DAY_SHORT[parseISODate(d.date).getDay()]} {d.date.slice(8)}</div>
              <div className="mono" style={{ fontWeight: 750, fontSize: 17 }}>{fmt(d.kcal)}</div>
              <div className="tiny" style={{ color: KIND_COLOR[d.kind], fontWeight: 600 }}>{d.kind === 'deficit' ? 'Normal' : d.label}</div>
            </div>
          ))}
        </div>
        {week.find((d) => d.date === today)?.notes.map((n) => (
          <p key={n} className="small muted mt8">{n}</p>
        ))}
      </Card>

      <MaintenanceCard ps={ps} near={near} save={save} />

      <div className="grid g2">
        <DietBreakCard ps={ps} save={save} />
        <RefeedCard ps={ps} save={save} />
      </div>

      <EventsCard ps={ps} save={save} />

      <DetailsHint what="evidencia científica" />
      <Card title="Qué dice la evidencia" className="tech">
        <Claims
          items={[
            { kind: 'dato', text: 'El cambio de peso depende del promedio semanal de calorías, no de un día aislado. Por eso un evento se puede compensar repartiendo el ahorro en los días previos.' },
            { kind: 'estimacion', text: 'Descansos de dieta de 1–2 semanas: un ensayo (MATADOR, Byrne 2018) encontró más pérdida de grasa por semana de déficit; otros (Peos 2021) no encontraron diferencia en grasa, pero sí menos hambre. Úsalos como herramienta de adherencia.' },
            { kind: 'hipotesis', text: 'Las recargas de carbohidratos pueden mejorar el rendimiento del día de pierna y la sensación de energía; la evidencia sobre sus efectos hormonales es débil.' },
            { kind: 'recomendacion', text: 'Al terminar la dieta, sube a mantenimiento de forma controlada y juzga por la tendencia de peso de 2–3 semanas: los primeros 1–2 kg suelen ser agua y glucógeno, no grasa.' },
          ]}
        />
      </Card>
    </div>
  );
}

type Saver = (next: PhaseSettings, msg: string) => Promise<void>;

function MaintenanceCard({ ps, near, save }: { ps: PhaseSettings; near: boolean; save: Saver }) {
  const { state: st, today } = useApp();
  const [mode, setMode] = useState<'gradual' | 'directo'>('gradual');
  const [to, setTo] = useState<number | null>(Math.round(st.tdee.tdee / 10) * 10);
  const m = ps.maintenance;
  const active = m && m.start <= today;
  const draft: MaintenancePhase = { start: today, fromKcal: st.targets.kcal, toKcal: Math.max(st.targets.kcal, to ?? st.targets.kcal), mode, goalWeight: st.composition.goalWeight };
  const shown = m ?? draft;
  const weeks = maintenanceWeeks(shown);
  const steps = Array.from({ length: weeks }, (_, i) => ({ week: i + 1, kcal: maintenanceKcalOn(shown, addDays(shown.start, i * 7)) }));
  return (
    <Card title="Fase de mantenimiento (al llegar a tu meta)" icon={<IconTile icon={Flag} color="var(--m-lime)" size={28} />}>
      {active ? (
        <Alert kind="ok">
          Fase activa desde el {formatDateShort(m!.start)}. Hoy: <b>{fmt(maintenanceKcalOn(m!, today))} kcal</b>. Mantén la tendencia de peso entre {round(m!.goalWeight * 0.985, 1)} y {round(m!.goalWeight * 1.015, 1)} kg; si en 3 semanas sube más de eso, baja 100–150 kcal.
        </Alert>
      ) : near ? (
        <Alert kind="ok">Estás muy cerca de tu meta. Cuando la alcances, sube calorías de forma controlada para no recuperar grasa.</Alert>
      ) : (
        <p className="small muted">Se activa cuando estés a 1 punto de tu % de grasa objetivo o a 1 kg de tu peso meta ({fmt(st.composition.goalWeight, 1)} kg). Puedes ver el plan desde ahora.</p>
      )}
      {!active && (
        <div className="grid g3 mt12">
          <Field label="Ritmo">
            <Seg value={mode} onChange={setMode} options={[{ value: 'gradual', label: 'Gradual (≈125 kcal/sem)' }, { value: 'directo', label: 'Directo (2 semanas)' }]} />
          </Field>
          <Field label="Mantenimiento estimado" help="Tu gasto actual estimado; se afina con tu tendencia de peso.">
            <NumInput value={to} onChange={setTo} suffix="kcal" step={10} testId="maint-to" />
          </Field>
        </div>
      )}
      <div className="week-strip mt12">
        {steps.map((s) => (
          <div key={s.week} className="week-day">
            <div className="tiny muted">Semana {s.week}</div>
            <div className="mono" style={{ fontWeight: 750 }}>{fmt(s.kcal)}</div>
            <div className="tiny muted">kcal/día</div>
          </div>
        ))}
      </div>
      <div className="row mt12">
        {active ? (
          <ConfirmButton className="btn" confirmText="¿Terminar la fase?" onConfirm={() => save({ ...ps, maintenance: null }, 'Fase de mantenimiento terminada.')}>
            Terminar fase
          </ConfirmButton>
        ) : (
          <ConfirmButton className={`btn ${near ? 'primary' : ''}`} testId="maint-start" confirmText="¿Iniciar hoy?" onConfirm={() => save({ ...ps, maintenance: draft }, 'Fase de mantenimiento iniciada.')}>
            {near ? 'Iniciar fase de mantenimiento' : 'Iniciar de todos modos'}
          </ConfirmButton>
        )}
      </div>
    </Card>
  );
}

function DietBreakCard({ ps, save }: { ps: PhaseSettings; save: Saver }) {
  const { state: st, today, profile } = useApp();
  const c = ps.dietBreak ?? { enabled: false, everyWeeks: 10, lengthDays: 14 as const, anchor: today };
  const set = (patch: Partial<typeof c>, msg: string) => save({ ...ps, dietBreak: { ...c, ...patch } }, msg);
  const next = nextDietBreak(c, today);
  const proj = st.projections[profile.scenario];
  const eta = proj.reached && proj.weeksToGoal != null ? addDays(today, proj.weeksToGoal * 7) : null;
  const withB = eta && c.enabled ? etaWithBreaks(c, today, eta) : null;
  return (
    <Card title="Descansos de dieta" icon={<IconTile icon={Coffee} color="var(--m-cyan)" size={28} />}>
      <p className="small muted">1–2 semanas en calorías de mantenimiento cada cierto número de semanas de déficit. Bajan el hambre y el cansancio de la dieta.</p>
      <div className="col mt12" style={{ gap: 10 }}>
        <Seg value={c.enabled ? 'si' : 'no'} onChange={(v) => set({ enabled: v === 'si', anchor: v === 'si' && !c.enabled ? today : c.anchor }, v === 'si' ? 'Descansos de dieta activados.' : 'Descansos de dieta desactivados.')} options={[{ value: 'no', label: 'Desactivado' }, { value: 'si', label: 'Activado' }]} />
        <Field label="Cada">
          <Seg value={String(c.everyWeeks)} onChange={(v) => set({ everyWeeks: Number(v) }, 'Frecuencia actualizada.')} options={[6, 8, 10, 12].map((n) => ({ value: String(n), label: `${n} sem` }))} />
        </Field>
        <Field label="Duración">
          <Seg value={String(c.lengthDays)} onChange={(v) => set({ lengthDays: Number(v) as 7 | 14 }, 'Duración actualizada.')} options={[{ value: '7', label: '1 semana' }, { value: '14', label: '2 semanas' }]} />
        </Field>
      </div>
      {c.enabled && next && (
        <p className="small mt12" data-testid="next-break">
          Próximo descanso: <b>{formatDateShort(next.start)} – {formatDateShort(next.end)}</b> a ≈{fmt(Math.round(st.tdee.tdee / 10) * 10)} kcal.
          {withB && withB.extraDays > 0 && <> Tu fecha estimada se recorre {Math.round(withB.extraDays / 7)} semana{withB.extraDays > 7 ? 's' : ''} ({formatDateShort(withB.eta)}).</>}
        </p>
      )}
    </Card>
  );
}

function RefeedCard({ ps, save }: { ps: PhaseSettings; save: Saver }) {
  const { state: st } = useApp();
  const c = ps.refeed ?? { enabled: false, mode: 'dias_pierna' as const, weekdays: [6], compensate: true };
  const set = (patch: Partial<typeof c>, msg: string) => save({ ...ps, refeed: { ...c, ...patch } }, msg);
  const days = c.mode === 'dias_pierna' ? st.legWeekdays : c.weekdays;
  const extra = Math.max(0, Math.round(st.tdee.tdee / 10) * 10 - st.targets.kcal);
  return (
    <Card title="Días de recarga" icon={<IconTile icon={Wheat} color="var(--m-amber)" size={28} />}>
      <p className="small muted">Carbohidratos hasta mantenimiento (+{fmt(extra)} kcal) en días de entrenamiento pesado. Grasa y proteína no cambian.</p>
      <div className="col mt12" style={{ gap: 10 }}>
        <Seg value={c.enabled ? 'si' : 'no'} onChange={(v) => set({ enabled: v === 'si' }, v === 'si' ? 'Recargas activadas.' : 'Recargas desactivadas.')} options={[{ value: 'no', label: 'Desactivado' }, { value: 'si', label: 'Activado' }]} />
        <Field label="Qué días">
          <Seg value={c.mode} onChange={(v) => set({ mode: v }, 'Días actualizados.')} options={[{ value: 'dias_pierna', label: 'Mis días de pierna' }, { value: 'dias_fijos', label: 'Elegir días' }]} />
        </Field>
        {c.mode === 'dias_fijos' ? (
          <Chips value={c.weekdays} onChange={(v) => set({ weekdays: v.slice(0, 3) }, 'Días actualizados.')} options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: DAY_SHORT[d] }))} />
        ) : (
          <p className="small">{days.length ? `Detectados en tu rutina: ${days.map((d) => DAY_SHORT[d]).join(', ')}.` : 'Tu rutina no tiene días de pierna dedicados; elige los días manualmente.'}</p>
        )}
        <Field label="Compensar en los demás días" help="Mantiene el mismo promedio semanal, así la fecha estimada no cambia.">
          <Seg value={c.compensate ? 'si' : 'no'} onChange={(v) => set({ compensate: v === 'si' }, 'Preferencia guardada.')} options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} />
        </Field>
      </div>
      {c.enabled && !c.compensate && days.length > 0 && <p className="tiny muted mt8">Sin compensar, tu déficit semanal baja ≈{fmt(extra * days.length)} kcal (≈{round((extra * days.length) / 7700, 2)} kg menos por semana).</p>}
    </Card>
  );
}

function EventsCard({ ps, save }: { ps: PhaseSettings; save: Saver }) {
  const { today, state: st, profile } = useApp();
  const [name, setName] = useState('');
  const [date, setDate] = useState(addDays(today, 5));
  const [extra, setExtra] = useState<number | null>(700);
  const [bank, setBank] = useState<number | null>(4);
  const events = (ps.events ?? []).filter((e) => e.date >= addDays(today, -1)).sort((a, b) => a.date.localeCompare(b.date));
  const ctx = usePhaseCtx();
  const add = async () => {
    if (!name.trim() || !date || !extra) return;
    const e: DietEvent = { id: uid('ev_'), name: name.trim(), date, extraKcal: Math.min(2000, Math.max(100, extra)), bankDays: Math.max(0, Math.min(6, bank ?? 0)) };
    await save({ ...ps, events: [...(ps.events ?? []).filter((x) => x.date >= addDays(today, -30)), e] }, `Evento "${e.name}" agregado.`);
    setName('');
  };
  return (
    <Card title="Eventos sociales" icon={<IconTile icon={PartyPopper} color="var(--m-pink)" size={28} />} hint="Bodas, fiestas, carnes asadas…">
      <p className="small muted">Marca el evento y cuántas calorías extra quieres ese día. La app ahorra un poco en los días previos (máx. 300 kcal/día y nunca por debajo de {fmt(calorieFloor(profile.sex))} kcal) para que el promedio semanal no cambie.</p>
      <div className="grid g4 mt12">
        <Field label="Evento">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Boda de Ana" data-testid="event-name" />
        </Field>
        <Field label="Fecha">
          <input type="date" className="input" value={date} min={today} onChange={(e) => setDate(e.target.value)} data-testid="event-date" />
        </Field>
        <Field label="Calorías extra ese día">
          <NumInput value={extra} onChange={setExtra} suffix="kcal" step={50} testId="event-extra" />
        </Field>
        <Field label="Días de ahorro previos">
          <NumInput value={bank} onChange={setBank} min={0} max={6} step={1} suffix="días" />
        </Field>
      </div>
      <button className="btn primary mt12" onClick={add} disabled={!name.trim()} data-testid="event-add">
        <Plus /> Agregar evento
      </button>
      {events.length > 0 && (
        <div className="col mt16" style={{ gap: 8 }}>
          {events.map((e) => {
            const plan = dayPlanFor(e.date, st.targets, ps, ctx);
            return (
              <div key={e.id} className="row between list-row" data-testid="event-row">
                <div>
                  <b>{e.name}</b> · {formatDateShort(e.date)}
                  <div className="tiny muted">
                    {fmt(plan.kcal)} kcal ese día · {plan.notes.slice(0, 1).join(' ')}
                  </div>
                </div>
                <button className="btn sm ghost" onClick={() => save({ ...ps, events: (ps.events ?? []).filter((x) => x.id !== e.id) }, 'Evento eliminado.')} title="Eliminar">
                  <Trash2 />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

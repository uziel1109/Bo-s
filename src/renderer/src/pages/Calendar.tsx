import { useMemo, useState } from 'react';
import { BellRing, CalendarPlus, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Hero } from '../components/visual';
import { useApp } from '../store';
import { Card, fmt } from '../components/ui';
import { DayKindBadge, KIND_COLOR, usePhaseCtx } from '../components/PhasesPanel';
import { dayPlanFor } from '@shared/nutrition/phases';
import { generateDayTasks, type DayTask } from '@shared/calendar';
import { addDays, formatDateLong, toISODate, uid, weekStart } from '@shared/utils';
import { api } from '../api';
import { buildIcs, icsEventCount, parseTime, type IcsOptions } from '@shared/calendarIcs';

const TYPE_COLOR: Record<string, string> = { entreno: 'var(--accent)', comida: 'var(--protein)', suplemento: 'var(--fat)', hidratacion: 'var(--water)', cardio: 'var(--s3)', descanso: 'var(--muted)', medicion: 'var(--carbs)', revision: 'var(--info)', personal: 'var(--text-2)' };

export function CalendarPage() {
  const { data, profile, today, stack, calendarTasks, reload, state: st } = useApp();
  const phaseCtx = usePhaseCtx();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [sel, setSel] = useState(today);
  const [newTask, setNewTask] = useState('');
  const deload = data.adjustments.find((a) => a.kind === 'recuperacion' && a.status === 'aceptado');
  const deloadStart = deload?.resolved_at ? weekStart(deload.resolved_at.slice(0, 10)) : null;

  const days = useMemo(() => {
    const first = `${month}-01`;
    const start = weekStart(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const tasksFor = (d: string): (DayTask & { done: boolean; customId?: string })[] => {
    const gen = generateDayTasks(d, profile, data.routine, stack, deloadStart);
    const stored = calendarTasks.filter((t) => t.date === d);
    const auto = gen.map((t) => {
      // Algunas tareas se completan solas con los registros reales.
      const autoDone =
        (t.key === 'peso' && data.bodyLogs.some((l) => l.date === d && l.weight)) ||
        (t.key === 'entreno' && data.sessions.some((s) => s.date === d && s.completed)) ||
        (t.key.startsWith('comida_') && data.foodLogs.some((f) => f.date === d && f.meal === t.key.slice(7))) ||
        (t.key.startsWith('sup_') && false);
      return { ...t, done: autoDone || !!stored.find((s) => s.task_key === t.key && s.done) };
    });
    const custom = stored.filter((s) => s.custom).map((s) => ({ key: s.task_key, type: 'personal' as const, title: s.title, done: !!s.done, customId: s.id }));
    return [...auto, ...custom];
  };

  const toggle = async (d: string, t: DayTask & { done: boolean; customId?: string }) => {
    const existing = calendarTasks.find((x) => x.date === d && x.task_key === t.key);
    await api.upsert('calendar_tasks', { id: existing?.id ?? t.customId ?? uid('ct_'), date: d, task_key: t.key, title: t.title, type: t.type, done: t.done ? 0 : 1, custom: t.customId ? 1 : 0 });
    await reload();
  };

  const selTasks = tasksFor(sel);
  const [y, m] = month.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <Hero module="calendario" title="Calendario" sub="Tu planificación diaria. Lo que no completes no genera penalizaciones ni cambios automáticos." />
      <div className="grid g3">
        <Card
          className="span2"
          title={<span className="cap-first">{monthName}</span>}
          actions={
            <>
              <button className="btn sm" onClick={() => setMonth(toISODate(new Date(y, m - 2, 1)).slice(0, 7))}>
                <ChevronLeft />
              </button>
              <button className="btn sm" onClick={() => { setMonth(today.slice(0, 7)); setSel(today); }}>
                Hoy
              </button>
              <button className="btn sm" onClick={() => setMonth(toISODate(new Date(y, m, 1)).slice(0, 7))}>
                <ChevronRight />
              </button>
            </>
          }
        >
          <div className="cal">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="cal-h">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const ts = d <= addDays(today, 31) ? tasksFor(d) : [];
              const done = ts.filter((t) => t.done).length;
              const train = data.routine?.days.find((x) => x.weekday === new Date(d + 'T12:00:00').getDay());
              return (
                <div key={d} className={`cal-d ${d.slice(0, 7) !== month ? 'out' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''}`} onClick={() => setSel(d)}>
                  <div className="row between">
                    <span className="num">{Number(d.slice(8))}</span>
                    {d <= today && ts.length > 0 && <span className="tiny muted">{done}/{ts.length}</span>}
                  </div>
                  {train && <span className="tiny" style={{ color: 'var(--accent)' }}>● {train.name}</span>}
                  {!train && <span className="tiny muted">Descanso</span>}
                  {(() => {
                    const k = dayPlanFor(d, st.targets, data.phases, phaseCtx);
                    return k.kind !== 'deficit' ? <span className="tiny" style={{ color: KIND_COLOR[k.kind], fontWeight: 650 }}>◆ {k.kind === 'evento' ? k.label.replace('Evento: ', '') : k.label}</span> : null;
                  })()}
                </div>
              );
            })}
          </div>
        </Card>
        <Card title={<span className="cap-first">{formatDateLong(sel)}</span>}>
          {(() => {
            const k = dayPlanFor(sel, st.targets, data.phases, phaseCtx);
            return (
              <div className="mb12 small">
                <DayKindBadge kind={k.kind} label={k.label} /> Objetivo: <b>{fmt(k.kcal)} kcal</b>
                {k.notes[0] && <div className="tiny muted mt4">{k.notes[0]}</div>}
              </div>
            );
          })()}
          <div className="col" style={{ gap: 2 }}>
            {selTasks.map((t) => (
              <div key={t.key} className={`check ${t.done ? 'done' : ''}`} onClick={() => toggle(sel, t)} data-testid={`task-${t.key}`}>
                <div className="box">{t.done && <Check size={13} />}</div>
                <div className="grow">
                  <div className="t">
                    <span className="dot" style={{ background: TYPE_COLOR[t.type], marginRight: 7 }} />
                    {t.title}
                  </div>
                  {(t.detail || t.time) && <div className="tiny muted">{[t.time, t.detail].filter(Boolean).join(' · ')}</div>}
                </div>
                {t.customId && (
                  <button
                    className="btn ghost icon sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await api.remove('calendar_tasks', t.customId!);
                      await reload();
                    }}
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="row nowrap mt16">
            <input className="input" placeholder="Agregar actividad personal…" value={newTask} onChange={(e) => setNewTask(e.target.value)} />
            <button
              className="btn"
              disabled={!newTask.trim()}
              onClick={async () => {
                const id = uid('ct_');
                await api.upsert('calendar_tasks', { id, date: sel, task_key: id, title: newTask.trim(), type: 'personal', done: 0, custom: 1 });
                setNewTask('');
                await reload();
              }}
            >
              <Plus />
            </button>
          </div>
          <p className="tiny muted mt8">Pesaje, comidas y entrenamiento se marcan solos cuando los registras.</p>
        </Card>
        <ReminderExport />
      </div>
    </div>
  );
}

function ReminderExport() {
  const { profile, data, toast } = useApp();
  const [o, setO] = useState<IcsOptions>(() => ({ training: true, trainingTime: parseTime(profile.trainingSchedule), weighIn: true, weighInTime: '07:00', measures: true, review: true, photos: true, meals: false, alarmMinutes: 15 }));
  const ics = buildIcs(profile, data.routine, o);
  const n = icsEventCount(ics);
  const opt = (k: keyof IcsOptions, label: string, extra?: React.ReactNode) => (
    <label className="row small" style={{ gap: 8 }}>
      <input type="checkbox" checked={o[k] as boolean} onChange={(e) => setO({ ...o, [k]: e.target.checked })} /> {label} {extra}
    </label>
  );
  return (
    <Card className="span3" title="Recordatorios en el calendario de tu iPad" icon={<BellRing />} hint={`${n} recordatorios recurrentes`}>
      <div className="grid g2">
        <div className="col" style={{ gap: 10 }}>
          {opt('training', 'Entrenamientos', <input type="time" className="input" style={{ width: 120, height: 32 }} value={o.trainingTime} onChange={(e) => setO({ ...o, trainingTime: e.target.value })} />)}
          {opt('weighIn', 'Pesaje diario en ayunas', <input type="time" className="input" style={{ width: 120, height: 32 }} value={o.weighInTime} onChange={(e) => setO({ ...o, weighInTime: e.target.value })} />)}
          {opt('measures', 'Medidas cada lunes')}
          {opt('review', 'Revisión semanal (domingo 19:00)')}
          {opt('photos', 'Fotos de progreso (primer domingo del mes)')}
          {opt('meals', 'Cada comida, a sus horarios')}
          <label className="row small" style={{ gap: 8 }}>
            Avisar
            <select className="input" style={{ width: 150, height: 32 }} value={o.alarmMinutes} onChange={(e) => setO({ ...o, alarmMinutes: Number(e.target.value) })}>
              <option value={0}>a la hora</option>
              <option value={10}>10 min antes</option>
              <option value={15}>15 min antes</option>
              <option value={30}>30 min antes</option>
              <option value={60}>1 hora antes</option>
            </select>
            <span className="tiny muted">(entrenos y revisión; el pesaje avisa a la hora)</span>
          </label>
        </div>
        <div className="col" style={{ gap: 10 }}>
          <p className="small">
            Una app web no puede enviar notificaciones por sí sola, pero el Calendario de tu iPad sí. Esto crea un archivo con tus recordatorios recurrentes:
          </p>
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Toca <b>Agregar a mi calendario</b>.</li>
            <li>Abre el archivo descargado (en Safari, el ícono de descargas ↓) y toca <b>Agregar todo</b>.</li>
            <li>Elige el calendario donde guardarlos. Los avisos usarán las notificaciones del Calendario.</li>
          </ol>
          <p className="tiny muted">Si cambias tu rutina u horarios, vuelve a exportar; puedes borrar los anteriores desde el Calendario.</p>
          <button
            className="btn primary"
            style={{ alignSelf: 'flex-start' }}
            disabled={!n}
            data-testid="ics-export"
            onClick={async () => {
              try {
                const r = await api.saveFile('bodyos-recordatorios.ics', ics, 'text/calendar');
                if (r) toast('Archivo de recordatorios listo: ábrelo para agregarlos a tu calendario.');
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e), 'error');
              }
            }}
          >
            <CalendarPlus /> Agregar a mi calendario
          </button>
        </div>
      </div>
    </Card>
  );
}

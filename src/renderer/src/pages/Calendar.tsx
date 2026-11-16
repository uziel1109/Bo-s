import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Hero } from '../components/visual';
import { useApp } from '../store';
import { Card } from '../components/ui';
import { generateDayTasks, type DayTask } from '@shared/calendar';
import { addDays, formatDateLong, toISODate, uid, weekStart } from '@shared/utils';
import { api } from '../api';

const TYPE_COLOR: Record<string, string> = { entreno: 'var(--accent)', comida: 'var(--protein)', suplemento: 'var(--fat)', hidratacion: 'var(--water)', cardio: 'var(--s3)', descanso: 'var(--muted)', medicion: 'var(--carbs)', revision: 'var(--info)', personal: 'var(--text-2)' };

export function CalendarPage() {
  const { data, profile, today, stack, calendarTasks, reload } = useApp();
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
                </div>
              );
            })}
          </div>
        </Card>
        <Card title={<span className="cap-first">{formatDateLong(sel)}</span>}>
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
      </div>
    </div>
  );
}

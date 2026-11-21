// Celebración de hitos (pantalla especial al lograr uno) y línea de tiempo de hitos en Progreso.
import { useEffect, useMemo, useState } from 'react';
import { Award, Dumbbell, Flame, Flag, Ruler, Scale, Trophy } from 'lucide-react';
import { useApp } from '../store';
import { Card, Empty } from './ui';
import { computeMilestones, nextMilestones, pendingMilestones, type Milestone, type MilestoneKind } from '@shared/analytics/milestones';
import { formatDateShort } from '@shared/utils';
import { restDoneAlert } from '../lib/gym';

const KEY = 'milestones_seen';

export const KIND_STYLE: Record<MilestoneKind, { icon: typeof Award; color: string }> = {
  peso: { icon: Scale, color: 'var(--m-cyan)' },
  cintura: { icon: Ruler, color: 'var(--m-amber)' },
  grasa: { icon: Flame, color: 'var(--m-orange)' },
  meta: { icon: Flag, color: 'var(--m-lime)' },
  fuerza: { icon: Dumbbell, color: 'var(--m-violet)' },
  constancia: { icon: Award, color: 'var(--m-pink)' },
  entrenos: { icon: Trophy, color: 'var(--m-green)' },
};

export function useMilestones() {
  const { data, today } = useApp();
  return useMemo(() => computeMilestones(data, today), [data, today]);
}

/** Muestra la celebración de los hitos nuevos. La primera vez marca como vistos los que ya existían. */
export function MilestoneCelebration() {
  const { settings, setSetting } = useApp();
  const all = useMilestones();
  const seen = settings[KEY] as string[] | undefined;
  const pending = pendingMilestones(all, seen);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (seen === undefined) void setSetting(KEY, all.map((m) => m.id));
  }, [seen === undefined]);

  useEffect(() => {
    if (pending.length) restDoneAlert();
  }, [pending[0]?.id]);

  if (!pending.length || hidden) return null;
  const many = pending.length > 3;
  const m = pending[0];
  const markSeen = async (ids: string[]) => {
    setHidden(true);
    await setSetting(KEY, [...new Set([...(seen ?? []), ...ids])]);
    setHidden(false);
  };
  const S = KIND_STYLE[m.kind];
  return (
    <div className="celebrate-back" data-testid="milestone-celebration">
      <div className="confetti" aria-hidden>
        {Array.from({ length: 36 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 97) % 100}%`, animationDelay: `${(i % 9) * 0.12}s`, background: ['#c8f53c', '#3fd8e8', '#ff8a4c', '#a78bfa', '#ff5fa2', '#ffc53d'][i % 6] }} />
        ))}
      </div>
      <div className="celebrate-card" style={{ ['--cc' as string]: S.color }}>
        <div className="celebrate-icon">
          <S.icon size={40} />
        </div>
        {many ? (
          <>
            <h2>¡{pending.length} logros nuevos!</h2>
            <div className="col mt12" style={{ gap: 8, textAlign: 'left' }}>
              {pending.slice(0, 6).map((x) => (
                <div key={x.id} className="small">
                  • <b>{x.title.replace(/^¡|!$/g, '')}</b> <span className="muted">· {formatDateShort(x.date)}</span>
                </div>
              ))}
              {pending.length > 6 && <div className="tiny muted">y {pending.length - 6} más en Progreso → Hitos.</div>}
            </div>
          </>
        ) : (
          <>
            <h2>{m.title}</h2>
            <p className="muted">{m.detail}</p>
            {pending.length > 1 && <p className="tiny muted">Tienes {pending.length - 1} logro{pending.length > 2 ? 's' : ''} más.</p>}
          </>
        )}
        <button className="btn primary mt16" style={{ minWidth: 180, height: 46, fontSize: 16 }} onClick={() => markSeen(many ? pending.map((x) => x.id) : [m.id])} data-testid="milestone-ok">
          {many || pending.length === 1 ? '¡Vamos!' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

/** Línea de tiempo de hitos logrados y los siguientes. */
export function MilestonesView() {
  const { state: st, data, profile } = useApp();
  const all = useMilestones();
  const trend = data.bodyLogs.filter((l) => l.weight).sort((a, b) => a.date.localeCompare(b.date));
  const start = trend[0]?.weight ?? profile.weightKg;
  const next = nextMilestones(all, st.trendWeight, start, st.composition.bf.value, profile.targetBodyFat);
  const list = [...all].reverse();
  return (
    <div className="col" style={{ gap: 16 }}>
      {next.length > 0 && (
        <Card title="Lo que sigue">
          <div className="plan-tiles">
            {next.map((n) => (
              <div key={n.title} className="plan-tile" style={{ ['--pc' as string]: 'var(--m-lime)' }}>
                <div className="plan-tile-title">Próximo hito</div>
                <div className="plan-tile-value" style={{ fontSize: 18 }}>{n.title}</div>
                <div className="tiny muted">{n.left}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title={`Tus hitos (${all.length})`}>
        {!list.length && <Empty>Aquí aparecerán tus logros: kilos y centímetros menos, puntos de grasa, récords de fuerza y constancia.</Empty>}
        <div className="col" data-testid="milestone-list">
          {list.map((m: Milestone) => {
            const S = KIND_STYLE[m.kind];
            return (
              <div key={m.id} className="milestone-row">
                <span className="milestone-icon" style={{ ['--cc' as string]: S.color }}>
                  <S.icon size={18} />
                </span>
                <div className="grow">
                  <b>{m.title.replace(/^¡|!$/g, '')}</b>
                  <div className="tiny muted">{m.detail}</div>
                </div>
                <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
                  {formatDateShort(m.date)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

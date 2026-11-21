// Retos de la semana en el Dashboard: se eligen el lunes y no cambian durante la semana.
import { useEffect, useMemo } from 'react';
import { CheckCircle2, Flag, Trophy } from 'lucide-react';
import { useApp } from '../store';
import { Bar, Card } from './ui';
import { IconTile } from './visual';
import { challengeProgress, challengeStreak, pickChallenges, type Challenge } from '@shared/analytics/challenges';
import { addDays, weekStart } from '@shared/utils';

const KEY = 'weekly_challenges';

export function ChallengesCard() {
  const { data, state: st, today, settings, setSetting } = useApp();
  const ws = weekStart(today);
  const stored = (settings[KEY] as Record<string, Challenge[]> | undefined) ?? {};
  const current = useMemo(() => stored[ws] ?? pickChallenges(data, st, ws), [stored[ws], data, st, ws]);

  // Guarda los retos de la semana la primera vez que se ven (así no cambian aunque cambien tus datos).
  useEffect(() => {
    if (stored[ws] || !current.length) return;
    const keep = Object.fromEntries(Object.entries(stored).filter(([k]) => k >= addDays(ws, -7 * 26)));
    void setSetting(KEY, { ...keep, [ws]: current });
  }, [ws, current.length, !!stored[ws]]);

  const progress = challengeProgress(data, st, ws, current, today);
  const streak = challengeStreak(data, st, stored, today);
  const done = progress.filter((p) => p.done).length;
  if (!progress.length) return null;
  return (
    <Card
      title="Retos de la semana"
      icon={<IconTile icon={Flag} color="var(--m-pink)" size={28} />}
      hint={`${done} de ${progress.length} cumplidos${streak ? ` · racha de ${streak} semana${streak > 1 ? 's' : ''}` : ''}`}
    >
      <div data-testid="challenges">
        {progress.map((p) => (
          <div key={p.key} className="challenge" data-testid={`challenge-${p.key}`}>
            <div className="row between">
              <span className="small" style={{ fontWeight: 650 }}>
                {p.done ? <CheckCircle2 size={15} color="var(--m-green)" style={{ verticalAlign: -3, marginRight: 4 }} /> : null}
                {p.title}
              </span>
              <span className="mono small">
                {p.value}/{p.goal}
              </span>
            </div>
            <Bar value={p.value} max={p.goal} color={p.done ? 'var(--m-green)' : 'var(--m-pink)'} />
            <span className="tiny muted">
              La semana pasada: {p.lastWeek}
              {!p.done && !p.possible ? ' · ya no alcanza esta semana, ¡la próxima!' : ''}
            </span>
          </div>
        ))}
      </div>
      {done === progress.length && (
        <p className="small mt8" style={{ color: 'var(--m-green)' }}>
          <Trophy size={14} style={{ verticalAlign: -2 }} /> ¡Semana completa!
        </p>
      )}
    </Card>
  );
}

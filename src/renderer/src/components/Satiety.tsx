// Calificación de saciedad después de cada comida y análisis de qué te llena más.
import { useMemo } from 'react';
import { Gauge, Star } from 'lucide-react';
import { useApp } from '../store';
import { Card, fmt } from './ui';
import { IconTile } from './visual';
import { api } from '../api';
import { FULLNESS_LABEL, MIN_RATINGS, satietyInsights } from '@shared/analytics/satiety';
import { MEAL_LABEL } from '@shared/nutrition/targets';
import type { MealSlot } from '@shared/types';
import { addDays } from '@shared/utils';

export function SatietyRating({ date, slot }: { date: string; slot: MealSlot }) {
  const { mealRatings, reload } = useApp();
  const cur = mealRatings.find((r) => r.date === date && r.meal === slot)?.fullness ?? 0;
  const set = async (v: number) => {
    const id = `${date}_${slot}`;
    if (v === cur) await api.remove('meal_ratings', id);
    else await api.upsert('meal_ratings', { id, date, meal: slot, fullness: v });
    await reload();
  };
  return (
    <div className="row satiety" style={{ gap: 6 }}>
      <span className="tiny muted">¿Qué tan lleno quedaste?</span>
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} type="button" className={`sat-dot ${v <= cur ? 'on' : ''}`} onClick={() => set(v)} title={FULLNESS_LABEL[v]} data-testid={`sat-${slot}-${v}`}>
          {v}
        </button>
      ))}
      {cur > 0 && <span className="tiny" style={{ color: 'var(--m-green)' }}>{FULLNESS_LABEL[cur]}</span>}
    </div>
  );
}

export function SatietyCard() {
  const { mealRatings, data, today, profile, saveProfile, toast } = useApp();
  const ins = useMemo(() => satietyInsights(mealRatings, data.foodLogs, addDays(today, -90)), [mealRatings, data.foodLogs, today]);
  if (!ins.rated) return null;
  const prefer = async (ids: string[]) => {
    const add = ids.filter((id) => !profile.preferredFoods.includes(id));
    if (!add.length) return toast('Ya están en tus alimentos preferidos.');
    await saveProfile({ ...profile, preferredFoods: [...profile.preferredFoods, ...add] });
    toast(`${add.length} alimento${add.length > 1 ? 's' : ''} agregado${add.length > 1 ? 's' : ''} a tus preferidos: el próximo plan los usará más.`);
  };
  const bestIds = ins.best.map((b) => b.foodId).filter((x): x is string => !!x);
  return (
    <Card title="Lo que más te llena" icon={<IconTile icon={Gauge} color="var(--m-green)" size={28} />} hint={`${ins.rated} comidas calificadas · promedio ${fmt(ins.overall, 1)} de 5`}>
      {ins.rated < MIN_RATINGS && <p className="small muted">Califica cómo quedaste después de cada comida (los botones 1–5 de cada comida). Con {MIN_RATINGS} o más aparecerán tus patrones.</p>}
      {ins.claims.map((c) => (
        <p key={c} className="small mt4">
          • {c}
        </p>
      ))}
      {ins.best.length > 0 && (
        <>
          <div className="small mt12" style={{ fontWeight: 650 }}>Te sacian más</div>
          <div className="chips mt4" data-testid="sat-best">
            {ins.best.map((b) => (
              <span key={b.key} className="chip on" title={`${b.n} comidas`}>
                {b.name} · {b.avg}
              </span>
            ))}
          </div>
          {bestIds.length > 0 && (
            <button className="btn sm mt8" onClick={() => prefer(bestIds)}>
              <Star size={14} /> Priorizarlos en mi plan
            </button>
          )}
        </>
      )}
      {ins.worst.length > 0 && (
        <>
          <div className="small mt12" style={{ fontWeight: 650 }}>Te dejan con hambre</div>
          <div className="chips mt4">
            {ins.worst.map((b) => (
              <span key={b.key} className="chip" title={`${b.n} comidas`}>
                {b.name} · {b.avg}
              </span>
            ))}
          </div>
        </>
      )}
      {ins.bySlot.length > 1 && (
        <div className="tiny muted mt12">
          Por comida: {ins.bySlot.map((s) => `${MEAL_LABEL[s.slot]} ${s.avg}`).join(' · ')}
        </div>
      )}
      <p className="tiny muted mt8">Hipótesis basada en tus propios datos: indica asociación, no causa.</p>
    </Card>
  );
}

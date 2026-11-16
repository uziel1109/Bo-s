// Preparación de comidas del domingo: qué cocinar en lote, cuánto, en qué orden y cómo repartir.
import { useMemo, useState } from 'react';
import { Check, ChefHat, Clock, Package, Snowflake } from 'lucide-react';
import { useApp } from '../store';
import { Alert, Card, Empty, Seg } from './ui';
import { IconTile } from './visual';
import { buildMealPrep } from '@shared/nutrition/mealPrep';
import { formatGrams } from '@shared/nutrition/shopping';

export function MealPrepView({ onPlan }: { onPlan: () => void }) {
  const { mealPlan, foods } = useApp();
  const n = mealPlan?.days.length ?? 0;
  const [count, setCount] = useState(Math.min(4, Math.max(1, n)));
  const [start, setStart] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const days = useMemo(() => Array.from({ length: Math.min(count, n) }, (_, i) => (start + i) % Math.max(1, n)), [count, start, n]);
  const prep = useMemo(() => (mealPlan ? buildMealPrep(mealPlan, foods, days) : null), [mealPlan, foods, days]);

  if (!mealPlan || !prep)
    return (
      <Card>
        <Empty>
          <p className="mb16">Primero genera tu plan de comidas; con él se arma la preparación en lote.</p>
          <button className="btn primary" onClick={onPlan}>
            Ir al plan de comidas
          </button>
        </Empty>
      </Card>
    );

  const toggle = (i: number) => setDone((s) => {
    const x = new Set(s);
    if (x.has(i)) x.delete(i);
    else x.add(i);
    return x;
  });

  return (
    <div className="col" style={{ gap: 16 }}>
      <Card title="¿Qué días vas a preparar?" icon={<IconTile icon={ChefHat} color="var(--m-orange)" size={28} />}>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="tiny muted mb4">Empezar en</div>
            <Seg value={String(start)} onChange={(v) => setStart(Number(v))} options={mealPlan.days.map((_, i) => ({ value: String(i), label: `Día ${i + 1}` }))} />
          </div>
          <div>
            <div className="tiny muted mb4">Cuántos días</div>
            <Seg value={String(count)} onChange={(v) => setCount(Number(v))} options={[2, 3, 4, 5, 7].filter((x) => x <= Math.max(2, n)).map((x) => ({ value: String(x), label: `${x}` }))} />
          </div>
        </div>
        <div className="row mt12" style={{ gap: 20 }} data-testid="prep-summary">
          <span className="row" style={{ gap: 6 }}>
            <Clock size={16} /> ≈{Math.round(prep.totalMinutes / 5) * 5} min en total ({prep.activeMinutes} min de atención)
          </span>
          <span className="row" style={{ gap: 6 }}>
            <Package size={16} /> {prep.containers.length} recipientes
          </span>
        </div>
      </Card>

      {prep.warnings.map((w) => (
        <Alert key={w} kind="warn">
          {w}
        </Alert>
      ))}

      {prep.batches.length === 0 ? (
        <Card>
          <Empty>Tu plan de esos días no tiene alimentos que convenga cocinar en lote.</Empty>
        </Card>
      ) : (
        <div className="grid g2">
          <Card title="Qué cocinar" hint="Cantidades totales">
            <table className="table" data-testid="prep-batches">
              <thead>
                <tr>
                  <th>Alimento</th>
                  <th className="right">Crudo/seco</th>
                  <th className="right">Cocido</th>
                </tr>
              </thead>
              <tbody>
                {prep.batches.map((b) => (
                  <tr key={b.foodId}>
                    <td>
                      {b.buyName}
                      <div className="tiny muted">{b.info.method}</div>
                    </td>
                    <td className="right mono">{b.rawGrams ? formatGrams(b.rawGrams) : '≈ igual'}</td>
                    <td className="right mono">{formatGrams(b.cookedGrams)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Paso a paso" hint="Lo más tardado primero">
            <div className="col" style={{ gap: 2 }}>
              {prep.steps.map((s, i) => (
                <div key={i} className={`check ${done.has(i) ? 'done' : ''}`} onClick={() => toggle(i)}>
                  <div className="box">{done.has(i) && <Check size={13} />}</div>
                  <div className="grow t small">{s}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {prep.containers.length > 0 && (
        <Card title="Recipientes" hint="Pesa cada uno con báscula; lo fresco se agrega al momento">
          <div className="grid g3">
            {prep.containers.map((c, i) => (
              <div key={i} className="list-row" style={{ display: 'block' }} data-testid="prep-container">
                <div className="row between">
                  <b className="small">{c.title}</b>
                  {c.freeze && (
                    <span className="badge info" title="Congélalo y pásalo al refrigerador la noche anterior">
                      <Snowflake size={11} /> Congelar
                    </span>
                  )}
                </div>
                <div className="small mt4">{c.cooked.map((x) => `${x.grams} g ${x.name.toLowerCase()}`).join(' · ')}</div>
                {c.fresh.length > 0 && <div className="tiny muted mt4">Al momento: {c.fresh.map((x) => `${x.name.toLowerCase()} ${x.grams} g`).join(' · ')}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// "Mis platillos": historial de comidas analizadas con IA (con su foto), para revisarlas y volver a registrarlas.
import { useState } from 'react';
import { Camera, Check, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import type { MealSlot } from '@shared/types';
import { dishLogRows, searchDishes, type Dish } from '@shared/nutrition/dishes';
import { MEAL_LABEL } from '@shared/nutrition/targets';
import { formatDateLong, uid } from '@shared/utils';
import { api, usePhotoUrl } from '../api';
import { useApp } from '../store';
import { Card, Empty, fmt, Modal, Seg } from './ui';

export function DishPhoto({ file, className = 'dish-photo', alt = 'Foto del platillo' }: { file: string | null; className?: string; alt?: string }) {
  const url = usePhotoUrl(file ?? '');
  const [broken, setBroken] = useState(false);
  if (!file || broken || !url)
    return (
      <div className={`${className} empty`}>
        <UtensilsCrossed size={22} />
      </div>
    );
  return <img className={className} src={url} alt={alt} onError={() => setBroken(true)} />;
}

export function DishesView() {
  const { dishes } = useApp();
  const [q, setQ] = useState('');
  const [logFor, setLogFor] = useState<Dish | null>(null);
  const [open, setOpen] = useState<Dish | null>(null);
  const list = searchDishes(dishes, q);

  if (!dishes.length)
    return (
      <Card>
        <Empty>
          <Camera size={28} />
          <p className="mt8">
            Aquí se guardan los platillos que analizas con IA (foto o respuesta pegada de Claude), con su foto y sus macros. Analiza uno desde <b>Registro diario → Analizar con IA</b>.
          </p>
        </Empty>
      </Card>
    );

  return (
    <div className="col" style={{ gap: 14 }} data-testid="dishes">
      <div className="row between">
        <div className="row nowrap search-box" style={{ maxWidth: 360, flex: 1 }}>
          <Search size={16} />
          <input className="input" placeholder="Buscar platillo o ingrediente" value={q} onChange={(e) => setQ(e.target.value)} data-testid="dish-search" />
        </div>
        <span className="tiny muted">
          {dishes.length} platillo{dishes.length === 1 ? '' : 's'} guardado{dishes.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="dish-grid">
        {list.map((d) => (
          <div key={d.id} className="dish-card" data-testid="dish-card">
            <button type="button" className="dish-photo-btn" onClick={() => setOpen(d)} aria-label={`Ver ${d.name}`}>
              <DishPhoto file={d.photo_file} />
            </button>
            <div className="dish-body">
              <div className="dish-name">{d.name}</div>
              <div className="tiny muted cap-first">
                {MEAL_LABEL[d.meal]} · {formatDateLong(d.date)}
              </div>
              <div className="small mono mt8">
                <b>{fmt(d.totals.kcal)}</b> kcal · P {fmt(d.totals.protein)} · C {fmt(d.totals.carbs)} · G {fmt(d.totals.fat)}
              </div>
              <div className="row mt8" style={{ gap: 6 }}>
                <button className="btn sm primary" onClick={() => setLogFor(d)} data-testid="dish-log">
                  <Check size={14} /> Registrar de nuevo
                </button>
                <button className="btn sm ghost" onClick={() => setOpen(d)}>
                  Ver
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!list.length && <p className="small muted">Ningún platillo coincide con “{q}”.</p>}
      {logFor && <LogDishModal dish={logFor} onClose={() => setLogFor(null)} />}
      {open && <DishDetail dish={open} onClose={() => setOpen(null)} onLog={() => (setLogFor(open), setOpen(null))} />}
    </div>
  );
}

function DishDetail({ dish, onClose, onLog }: { dish: Dish; onClose: () => void; onLog: () => void }) {
  const { reload, toast } = useApp();
  const [showRaw, setShowRaw] = useState(false);
  const remove = async () => {
    if (!confirm(`¿Borrar "${dish.name}" de Mis platillos? Lo que ya registraste en tu diario no se borra.`)) return;
    if (dish.photo_id) await api.remove('photos', dish.photo_id);
    await api.remove('dishes', dish.id);
    await reload();
    toast('Platillo borrado.');
    onClose();
  };
  return (
    <Modal title={dish.name} onClose={onClose} wide>
      <div className="col" style={{ gap: 14 }} data-testid="dish-detail">
        {dish.photo_file && <DishPhoto file={dish.photo_file} className="dish-photo big" />}
        <div className="tiny muted cap-first">
          {MEAL_LABEL[dish.meal]} · {formatDateLong(dish.date)} · {dish.source === 'api' ? 'Análisis directo' : 'Con tu app de Claude'}
        </div>
        <div className="food-rows">
          {dish.items.map((it, i) => (
            <div key={i} className="food-row">
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="food-name">{it.name}</div>
                <div className="tiny muted mono">
                  P {fmt(it.macros.protein, 1)} · C {fmt(it.macros.carbs, 1)} · G {fmt(it.macros.fat, 1)}
                </div>
              </div>
              <div className="right">
                <div className="mono" style={{ fontWeight: 700 }}>{it.grams} g</div>
                <div className="tiny muted mono">{fmt(it.macros.kcal)} kcal</div>
              </div>
            </div>
          ))}
        </div>
        <div className="small">
          Total: <b className="mono">{fmt(dish.totals.kcal)} kcal</b> · P {fmt(dish.totals.protein)} g · C {fmt(dish.totals.carbs)} g · G {fmt(dish.totals.fat)} g
        </div>
        {dish.raw && (
          <div>
            <button className="btn sm ghost" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? 'Ocultar' : 'Ver'} la respuesta que pegaste
            </button>
            {showRaw && <pre className="dish-raw">{dish.raw}</pre>}
          </div>
        )}
        <div className="row between">
          <button className="btn sm ghost danger" onClick={remove} data-testid="dish-delete">
            <Trash2 size={14} /> Borrar
          </button>
          <button className="btn primary" onClick={onLog}>
            <Check /> Registrar de nuevo
          </button>
        </div>
      </div>
    </Modal>
  );
}

const PORTIONS = ['0.5', '1', '1.5', '2'] as const;

/** Elegir un platillo guardado para registrarlo en una comida del día. */
export function DishPickerModal({ date, slot, onClose }: { date: string; slot: MealSlot; onClose: () => void }) {
  const { dishes } = useApp();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Dish | null>(null);
  if (pick) return <LogDishModal dish={pick} date={date} meal={slot} onClose={onClose} />;
  return (
    <Modal title={`Mis platillos → ${MEAL_LABEL[slot]}`} onClose={onClose} wide>
      <div className="col" style={{ gap: 12 }}>
        <div className="row nowrap search-box">
          <Search size={16} />
          <input className="input" autoFocus placeholder="Buscar platillo o ingrediente" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="col" style={{ gap: 8 }}>
          {searchDishes(dishes, q).map((d) => (
            <button key={d.id} type="button" className="dish-pick" onClick={() => setPick(d)} data-testid="dish-pick-item">
              <DishPhoto file={d.photo_file} className="dish-thumb" />
              <span className="grow" style={{ textAlign: 'left' }}>
                <b>{d.name}</b>
                <span className="tiny muted" style={{ display: 'block' }}>
                  {MEAL_LABEL[d.meal]} · {formatDateLong(d.date)}
                </span>
              </span>
              <span className="mono small">{fmt(d.totals.kcal)} kcal</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function LogDishModal({ dish, onClose, date: initialDate, meal: initialMeal }: { dish: Dish; onClose: () => void; date?: string; meal?: MealSlot }) {
  const { today, reload, toast } = useApp();
  const [date, setDate] = useState(initialDate ?? today);
  const [meal, setMeal] = useState<MealSlot>(initialMeal ?? dish.meal);
  const [portions, setPortions] = useState<(typeof PORTIONS)[number]>('1');
  const k = Number(portions);
  const save = async () => {
    await api.bulkUpsert('food_logs', dishLogRows(dish, date, meal, k, () => uid('f_')));
    await reload();
    toast(`${dish.name} registrado en ${MEAL_LABEL[meal]}.`);
    onClose();
  };
  return (
    <Modal title={`Registrar: ${dish.name}`} onClose={onClose}>
      <div className="col" style={{ gap: 14 }}>
        <div className="row">
          <input type="date" className="input" style={{ width: 170 }} value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <select className="input" style={{ width: 200 }} value={meal} onChange={(e) => setMeal(e.target.value as MealSlot)} data-testid="dish-log-meal">
            {(Object.keys(MEAL_LABEL) as MealSlot[]).map((s) => (
              <option key={s} value={s}>
                {MEAL_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <span className="field-label">Porciones</span>
          <Seg value={portions} onChange={(v) => setPortions(v)} options={PORTIONS.map((p) => ({ value: p, label: p === '0.5' ? '½' : p === '1.5' ? '1½' : p }))} />
        </div>
        <div className="small">
          <b className="mono">{fmt(dish.totals.kcal * k)} kcal</b> · P {fmt(dish.totals.protein * k)} g · C {fmt(dish.totals.carbs * k)} g · G {fmt(dish.totals.fat * k)} g
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={save} data-testid="dish-log-save">
            <Check /> Registrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

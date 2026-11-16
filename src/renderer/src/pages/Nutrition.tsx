import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Barcode, Camera, Copy, Pencil, Plus, RefreshCw, Save, Search, Star, Trash2, Utensils } from 'lucide-react';
import { Hero } from '../components/visual';
import { useApp } from '../store';
import { Alert, Ring, Card, Claims, Field, fmt, MacroBar, Modal, NumInput, Seg, Stat, Tabs, Empty } from '../components/ui';
import { IntakeArea } from '../components/charts';
import type { Food, FoodCategory, FoodLog, Macros, MealSlot } from '@shared/types';
import { MEAL_LABEL, mealSlots, distributeMacros } from '@shared/nutrition/targets';
import { filterFoodsForProfile, foodTags, macrosFor, searchFoods, substitutes, sumMacros, validateFood, atwaterCheck } from '@shared/nutrition/foods';
import { generateMealPlan, type MealPlan, type PlanItem } from '@shared/nutrition/mealPlanner';
import { addDays, dateRange, formatDateLong, uid } from '@shared/utils';
import { api } from '../api';
import { FoodPhotoModal } from '../components/FoodPhoto';
import { DayKindBadge, PhasesPanel, useDayTargets } from '../components/PhasesPanel';
import { IconTile } from '../components/visual';
import { ChefHat } from 'lucide-react';
import { Apple, Beef, Check, Coffee, Cookie, Croissant, Egg, Moon, Package, Pill, Share2, ShoppingCart, Soup, Wheat } from 'lucide-react';
import { recipeFit, recipePerServing, recipeToMeal, replaceMeal } from '@shared/nutrition/recipeUse';
import { MealPrepView } from '../components/MealPrep';
import { SatietyCard, SatietyRating } from '../components/Satiety';
import type { PlannedMeal } from '@shared/nutrition/mealPlanner';
import { buildShoppingList, SECTION_ORDER, shoppingListText, type Section, type ShoppingList } from '@shared/nutrition/shopping';

const MEAL_ICON: Record<MealSlot, { icon: typeof Coffee; color: string }> = {
  desayuno: { icon: Coffee, color: 'var(--m-amber)' },
  colacion1: { icon: Apple, color: 'var(--m-green)' },
  comida: { icon: Soup, color: 'var(--m-orange)' },
  colacion2: { icon: Apple, color: 'var(--m-green)' },
  cena: { icon: Moon, color: 'var(--m-violet)' },
  extra: { icon: Cookie, color: 'var(--m-slate)' },
};

/** Anillo de un macronutriente con su valor y objetivo. */
function MacroRing({ label, value, target, unit, color, big }: { label: string; value: number; target: number; unit: string; color: string; big?: boolean }) {
  const size = big ? 128 : 92;
  const pct = target > 0 ? Math.round((value / target) * 100) : 0;
  return (
    <div className="macro-ring">
      <Ring value={value} max={target} size={size} stroke={big ? 12 : 9} color={color}>
        <div>
          <div className="mono" style={{ fontWeight: 750, fontSize: big ? 24 : 17 }}>
            {fmt(value)}
          </div>
          <div className="tiny muted">{pct}%</div>
        </div>
      </Ring>
      <div className="small" style={{ fontWeight: 600, marginTop: 6 }}>
        {label}
      </div>
      <div className="tiny muted">
        de {fmt(target)} {unit}
      </div>
    </div>
  );
}

type Tab = 'hoy' | 'plan' | 'super' | 'prep' | 'fases' | 'alimentos' | 'recetas' | 'objetivos';

export function Nutrition() {
  const [tab, setTab] = useState<Tab>('hoy');
  return (
    <div className="page">
      <Hero module="nutricion" title="Nutrición" sub="Registro diario, plan de comidas, base de datos de alimentos y objetivos." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'hoy', label: 'Registro diario' },
          { value: 'plan', label: 'Plan de comidas' },
          { value: 'super', label: 'Lista del súper' },
          { value: 'prep', label: 'Preparación' },
          { value: 'fases', label: 'Fases y eventos' },
          { value: 'alimentos', label: 'Alimentos' },
          { value: 'recetas', label: 'Recetas y frecuentes' },
          { value: 'objetivos', label: 'Objetivos' },
        ]}
      />
      {tab === 'hoy' && <DailyLog />}
      {tab === 'plan' && <MealPlanView onShopping={() => setTab('super')} />}
      {tab === 'super' && <ShoppingView onPlan={() => setTab('plan')} />}
      {tab === 'prep' && <MealPrepView onPlan={() => setTab('plan')} />}
      {tab === 'fases' && <PhasesPanel />}
      {tab === 'alimentos' && <FoodDB />}
      {tab === 'recetas' && <Recipes />}
      {tab === 'objetivos' && <Targets />}
    </div>
  );
}

// ───────────────────────── Registro diario

function DailyLog() {
  const { data, state: st, today, reload, toast, profile, favorites } = useApp();
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const [photoSlot, setPhotoSlot] = useState<MealSlot | null>(null);
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const logs = data.foodLogs.filter((l) => l.date === date);
  const totals = sumMacros(logs);
  const dayPlan = useDayTargets(date);
  const t = dayPlan.targets;
  const slots: MealSlot[] = [...mealSlots(profile.mealsPerDay), 'extra'];
  const last14 = dateRange(addDays(today, -13), today).map((d) => ({ date: d, kcal: st.intake.get(d)?.kcal ?? null }));

  const copyFromYesterday = async (slot: MealSlot) => {
    const y = data.foodLogs.filter((l) => l.date === addDays(date, -1) && l.meal === slot);
    if (!y.length) return toast('No hay registros de esa comida el día anterior.', 'error');
    await api.bulkUpsert('food_logs', y.map((l) => ({ ...l, id: uid('f_'), date, created_at: new Date().toISOString() })));
    await reload();
    toast(`${y.length} alimentos copiados.`);
  };
  const saveFavorite = async (slot: MealSlot) => {
    const items = logs.filter((l) => l.meal === slot);
    if (!items.length) return;
    const name = prompt('Nombre de la comida frecuente:', `${MEAL_LABEL[slot]} habitual`);
    if (!name) return;
    await api.upsert('favorites', { id: uid('fav_'), name, items: items.map((l) => ({ foodId: l.food_id, name: l.name, grams: l.grams, kcal: l.kcal, protein: l.protein, carbs: l.carbs, fat: l.fat, fiber: l.fiber })), created_at: new Date().toISOString() });
    await reload();
    toast('Comida frecuente guardada.');
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row between">
        <div className="row">
          <button className="btn sm" onClick={() => setDate(addDays(date, -1))}>
            ←
          </button>
          <input type="date" className="input" style={{ width: 170 }} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          <button className="btn sm" onClick={() => setDate(addDays(date, 1))} disabled={date >= today}>
            →
          </button>
          <span className="muted cap-first">
            {formatDateLong(date)}
          </span>
          <DayKindBadge kind={dayPlan.kind} label={dayPlan.label} />
        </div>
      </div>
      {dayPlan.notes.length > 0 && <Alert kind="info">{dayPlan.notes.join(' ')}</Alert>}
      <div className="grid g3">
        <Card className="span3" title="Totales del día" hint={`${fmt(Math.max(0, t.kcal - totals.kcal))} kcal y ${fmt(Math.max(0, t.protein - totals.protein))} g de proteína restantes`}>
          <div className="macro-rings" data-testid="nut-remaining">
            <MacroRing label="Calorías" value={totals.kcal} target={t.kcal} unit="kcal" color="var(--m-orange)" big />
            <MacroRing label="Proteína" value={totals.protein} target={t.protein} unit="g" color="var(--m-pink)" />
            <MacroRing label="Carbos" value={totals.carbs} target={t.carbs} unit="g" color="var(--m-amber)" />
            <MacroRing label="Grasas" value={totals.fat} target={t.fat} unit="g" color="var(--m-violet)" />
            <MacroRing label="Fibra" value={totals.fiber} target={t.fiber} unit="g" color="var(--m-green)" />
          </div>
        </Card>
        <Card className="span3" title="Últimos 14 días">
          <IntakeArea data={last14} target={t.kcal} height={170} />
        </Card>
      </div>
      {slots.map((slot) => {
        const items = logs.filter((l) => l.meal === slot);
        const m = sumMacros(items);
        return (
          <Card
            key={slot}
            title={MEAL_LABEL[slot]}
            icon={<IconTile icon={MEAL_ICON[slot].icon} color={MEAL_ICON[slot].color} size={30} />}
            hint={items.length ? `${fmt(m.kcal)} kcal · P ${fmt(m.protein)} · C ${fmt(m.carbs)} · G ${fmt(m.fat)}` : undefined}
            actions={
              <>
                {items.length > 0 && (
                  <button className="btn sm ghost" onClick={() => saveFavorite(slot)} title="Guardar como comida frecuente">
                    <Star />
                  </button>
                )}
                <button className="btn sm ghost" onClick={() => setPhotoSlot(slot)} title="Foto del plato (IA)" data-testid={`photo-${slot}`}>
                  <Camera />
                </button>
                <button className="btn sm ghost" onClick={() => copyFromYesterday(slot)} title="Copiar del día anterior">
                  <Copy />
                </button>
                <button className="btn sm" onClick={() => setAdding(slot)} data-testid={`add-food-${slot}`}>
                  <Plus /> Agregar
                </button>
              </>
            }
          >
            {items.length === 0 ? (
              <p className="muted small">Sin alimentos registrados.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Alimento</th>
                    <th className="right">Cantidad</th>
                    <th className="right">kcal</th>
                    <th className="right">Prot.</th>
                    <th className="right">Carb.</th>
                    <th className="right">Grasa</th>
                    <th className="right">Fibra</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td className="right">{fmt(l.grams)} g</td>
                      <td className="right">{fmt(l.kcal)}</td>
                      <td className="right">{fmt(l.protein, 1)}</td>
                      <td className="right">{fmt(l.carbs, 1)}</td>
                      <td className="right">{fmt(l.fat, 1)}</td>
                      <td className="right">{fmt(l.fiber, 1)}</td>
                      <td className="right" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn ghost icon sm" onClick={() => setEditing(l)}>
                          <Pencil />
                        </button>
                        <button
                          className="btn ghost icon sm"
                          onClick={async () => {
                            await api.remove('food_logs', l.id);
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
            )}
            {items.length > 0 && slot !== 'extra' && <div className="mt8"><SatietyRating date={date} slot={slot} /></div>}
          </Card>
        );
      })}
      <SatietyCard />
      {favorites.length > 0 && <p className="small muted">Tienes {favorites.length} comidas frecuentes guardadas: agrégalas desde el botón “Agregar”.</p>}
      {adding && (
        <AddFoodModal
          date={date}
          slot={adding}
          onClose={() => setAdding(null)}
          onPhoto={() => {
            setPhotoSlot(adding);
            setAdding(null);
          }}
        />
      )}
      {photoSlot && <FoodPhotoModal date={date} slot={photoSlot} onClose={() => setPhotoSlot(null)} />}
      {editing && <EditLogModal log={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditLogModal({ log, onClose }: { log: FoodLog; onClose: () => void }) {
  const { foods, reload } = useApp();
  const food = foods.find((f) => f.id === log.food_id);
  const [g, setG] = useState<number | null>(log.grams);
  const preview = food && g ? macrosFor(food, g) : null;
  return (
    <Modal
      title={`Editar: ${log.name}`}
      onClose={onClose}
      footer={
        <button
          className="btn primary"
          onClick={async () => {
            if (!g || g <= 0) return;
            const scaled = preview ?? { kcal: (log.kcal * g) / log.grams, protein: (log.protein * g) / log.grams, carbs: (log.carbs * g) / log.grams, fat: (log.fat * g) / log.grams, fiber: (log.fiber * g) / log.grams };
            await api.upsert('food_logs', { ...log, grams: g, ...scaled });
            await reload();
            onClose();
          }}
        >
          Guardar
        </button>
      }
    >
      <Field label="Cantidad">
        <NumInput value={g} onChange={setG} suffix="g" />
      </Field>
    </Modal>
  );
}

function AddFoodModal({ date, slot, onClose, onPhoto }: { date: string; slot: MealSlot; onClose: () => void; onPhoto: () => void }) {
  const { foods, favorites, recipes, reload, toast } = useApp();
  const [mode, setMode] = useState<'buscar' | 'frecuentes' | 'recetas' | 'foto' | 'codigo'>('buscar');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number | null>(100);
  const [units, setUnits] = useState<number | null>(null);
  const results = useMemo(() => searchFoods(foods, q).slice(0, 60), [foods, q]);
  const m = sel && grams ? macrosFor(sel, grams) : null;

  const add = async (rows: Omit<FoodLog, 'id' | 'date' | 'meal'>[]) => {
    await api.bulkUpsert('food_logs', rows.map((r) => ({ ...r, id: uid('f_'), date, meal: slot, created_at: new Date().toISOString() })));
    await reload();
    toast(`${rows.length === 1 ? rows[0].name : rows.length + ' alimentos'} agregado a ${MEAL_LABEL[slot]}.`);
  };

  return (
    <Modal title={`Agregar a ${MEAL_LABEL[slot]}`} onClose={onClose} wide>
      <div className="mb16">
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { value: 'buscar', label: 'Buscar' },
            { value: 'frecuentes', label: 'Frecuentes' },
            { value: 'recetas', label: 'Recetas' },
            { value: 'codigo', label: 'Código de barras' },
            { value: 'foto', label: 'Foto (IA)' },
          ]}
        />
      </div>
      {mode === 'buscar' && (
        <div className="grid g2">
          <div className="col">
            <div className="input-wrap">
              <input className="input" autoFocus placeholder="Buscar alimento… (p. ej., pollo, tortilla, avena)" value={q} onChange={(e) => setQ(e.target.value)} data-testid="food-search" />
              <span className="suffix">
                <Search size={14} />
              </span>
            </div>
            <div className="col" style={{ maxHeight: 380, overflowY: 'auto', gap: 6 }}>
              {results.map((f) => (
                <button
                  key={f.id}
                  className="list-item"
                  style={{ cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit', borderColor: sel?.id === f.id ? 'var(--accent)' : undefined }}
                  onClick={() => {
                    setSel(f);
                    if (f.unit_grams) {
                      setUnits(1);
                      setGrams(f.unit_grams);
                    } else {
                      setUnits(null);
                      setGrams(100);
                    }
                  }}
                  data-testid={`food-option-${f.id}`}
                >
                  <div className="grow">
                    <div>{f.name}</div>
                    <div className="tiny muted">
                      {f.kcal} kcal · P {f.protein} · C {f.carbs} · G {f.fat} / 100 g {f.custom ? '· personalizado' : ''}
                    </div>
                  </div>
                </button>
              ))}
              {!results.length && <Empty>Sin resultados. Crea el alimento en la pestaña “Alimentos”.</Empty>}
            </div>
          </div>
          <div>
            {sel ? (
              <div className="col" style={{ gap: 14 }}>
                <h3>{sel.name}</h3>
                <div className="tiny muted">Fuente: {sel.source} {sel.verified ? '· verificado' : '· por verificar'}</div>
                <div className="grid g2">
                  <Field label="Cantidad">
                    <NumInput
                      value={grams}
                      onChange={(v) => {
                        setGrams(v);
                        if (sel.unit_grams && v) setUnits(Math.round((v / sel.unit_grams) * 100) / 100);
                      }}
                      suffix="g"
                      testId="food-grams"
                    />
                  </Field>
                  {sel.unit_grams && (
                    <Field label={`Unidades (${sel.unit_name} = ${sel.unit_grams} g)`}>
                      <NumInput
                        value={units}
                        step={0.5}
                        onChange={(v) => {
                          setUnits(v);
                          if (v) setGrams(Math.round(v * (sel.unit_grams ?? 0)));
                        }}
                      />
                    </Field>
                  )}
                </div>
                {m && (
                  <div className="grid g5">
                    <Stat label="kcal" value={fmt(m.kcal)} />
                    <Stat label="Prot." value={fmt(m.protein, 1)} unit="g" />
                    <Stat label="Carb." value={fmt(m.carbs, 1)} unit="g" />
                    <Stat label="Grasa" value={fmt(m.fat, 1)} unit="g" />
                    <Stat label="Fibra" value={fmt(m.fiber, 1)} unit="g" />
                  </div>
                )}
                <button
                  className="btn primary"
                  disabled={!grams || grams <= 0}
                  data-testid="food-add-confirm"
                  onClick={async () => {
                    await add([{ food_id: sel.id, name: sel.name, grams: grams!, ...macrosFor(sel, grams!) }]);
                    setSel(null);
                    setQ('');
                  }}
                >
                  <Plus /> Agregar
                </button>
              </div>
            ) : (
              <Empty>Selecciona un alimento para indicar la cantidad.</Empty>
            )}
          </div>
        </div>
      )}
      {mode === 'frecuentes' && (
        <div className="col">
          {favorites.length === 0 && <Empty>Guarda una comida como frecuente con el botón ★ en el registro diario.</Empty>}
          {favorites.map((f) => {
            const tot = sumMacros(f.items);
            return (
              <div className="list-item" key={f.id}>
                <div className="grow">
                  <b>{f.name}</b>
                  <div className="tiny muted">
                    {f.items.map((i) => `${i.name} ${i.grams} g`).join(' · ')} — {fmt(tot.kcal)} kcal, P {fmt(tot.protein)} g
                  </div>
                </div>
                <button className="btn sm" onClick={() => add(f.items.map((i) => ({ food_id: i.foodId, name: i.name, grams: i.grams, kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat, fiber: i.fiber })))}>
                  <Plus /> Agregar
                </button>
                <button
                  className="btn ghost icon sm"
                  onClick={async () => {
                    await api.remove('favorites', f.id);
                    await reload();
                  }}
                >
                  <Trash2 />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {mode === 'recetas' && (
        <div className="col">
          {recipes.length === 0 && <Empty>Crea recetas en la pestaña “Recetas y frecuentes”.</Empty>}
          {recipes.map((r) => {
            const tot = sumMacros(r.items.map((i) => {
              const f = foods.find((x) => x.id === i.foodId);
              return f ? macrosFor(f, i.grams) : {};
            }));
            const per = { kcal: tot.kcal / r.servings, protein: tot.protein / r.servings, carbs: tot.carbs / r.servings, fat: tot.fat / r.servings, fiber: tot.fiber / r.servings };
            const totalGrams = r.items.reduce((a, i) => a + i.grams, 0) / r.servings;
            return (
              <div className="list-item" key={r.id}>
                <div className="grow">
                  <b>{r.name}</b>
                  <div className="tiny muted">
                    1 porción ({fmt(totalGrams)} g): {fmt(per.kcal)} kcal · P {fmt(per.protein, 1)} · C {fmt(per.carbs, 1)} · G {fmt(per.fat, 1)}
                  </div>
                </div>
                <button className="btn sm" onClick={() => add([{ food_id: null, name: `${r.name} (1 porción)`, grams: Math.round(totalGrams), kcal: Math.round(per.kcal), protein: per.protein, carbs: per.carbs, fat: per.fat, fiber: per.fiber }])}>
                  <Plus /> 1 porción
                </button>
              </div>
            );
          })}
        </div>
      )}
      {mode === 'codigo' && <BarcodeLookup onAdded={(f, g) => add([{ food_id: f.id, name: f.name, grams: g, ...macrosFor(f, g) }])} />}
      {mode === 'foto' && (
        <div className="col" style={{ gap: 12, alignItems: 'flex-start' }}>
          <p className="small muted">Toma una foto de tu plato: la IA identifica el platillo y sus elementos, calcula los macros con tus alimentos verificados y lo compara con tu plan.</p>
          <button className="btn primary" onClick={onPhoto}>
            <Camera /> Abrir cámara
          </button>
        </div>
      )}
    </Modal>
  );
}

function BarcodeLookup({ onAdded }: { onAdded: (f: Food, grams: number) => void }) {
  const { foods, reload, toast } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Partial<Food> | null>(null);
  const [grams, setGrams] = useState<number | null>(100);
  const local = foods.find((f) => f.barcode && f.barcode === code.trim());
  const lookup = async () => {
    if (local) return setFound(local);
    setBusy(true);
    try {
      const r = await api.barcode(code.trim());
      if (!r) toast('Producto no encontrado en Open Food Facts. Créalo manualmente con su etiqueta.', 'error');
      else setFound({ name: r.name, kcal: r.kcal ?? 0, protein: r.protein ?? 0, carbs: r.carbs ?? 0, fat: r.fat ?? 0, fiber: r.fiber ?? 0, barcode: r.barcode });
    } catch (e) {
      toast(`Sin conexión o servicio no disponible: ${e instanceof Error ? e.message : e}`, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <p className="small muted">Escribe el código o usa un lector USB (escribe el número automáticamente). Primero se busca en tu base local; si no existe y hay conexión, en Open Food Facts (datos aportados por la comunidad: revísalos con la etiqueta).</p>
      <div className="row nowrap">
        <input className="input" placeholder="7501234567890" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && lookup()} autoFocus />
        <button className="btn primary" disabled={busy || code.length < 6} onClick={lookup}>
          <Barcode /> Buscar
        </button>
      </div>
      {found && (
        <FoodForm
          initial={found}
          submitLabel={found.id ? 'Usar este alimento' : 'Guardar en mi base y continuar'}
          onSubmit={async (f) => {
            const food = { ...(f as Food), id: f.id ?? uid('food_'), custom: 1, verified: f.verified ?? 0, source: f.source || 'Open Food Facts (comunidad) — revisado por el usuario', category: f.category ?? 'otro' };
            if (!f.id) {
              await api.upsert('foods', food);
              await reload();
            }
            if (grams) onAdded(food, grams);
            setFound(null);
            setCode('');
          }}
          extra={
            <Field label="Cantidad consumida">
              <NumInput value={grams} onChange={setGrams} suffix="g" />
            </Field>
          }
        />
      )}
    </div>
  );
}

// ───────────────────────── Plan de comidas

function MealPlanView({ onShopping }: { onShopping: () => void }) {
  const { foods, profile, state: st, mealPlan, reload, toast, today } = useApp();
  const [day, setDay] = useState(0);
  const [subFor, setSubFor] = useState<{ d: number; m: number; i: number; item: PlanItem } | null>(null);
  const [recipeFor, setRecipeFor] = useState<{ d: number; m: number } | null>(null);
  const pool = filterFoodsForProfile(foods, profile.allergies, profile.excludedFoods);

  const generate = async (days: number) => {
    const plan = generateMealPlan({ foods: pool, targets: st.targets, mealsPerDay: profile.mealsPerDay, days, preferred: profile.preferredFoods, budget: profile.budget, seed: Math.floor(Math.random() * 100) });
    const id = uid('mp_');
    await api.upsert('meal_plans', { id, created_at: new Date().toISOString(), active: 1, data: plan });
    await api.setActive('meal_plans', id);
    await reload();
    setDay(0);
    toast('Plan de comidas generado.');
  };

  const savePlan = async (p: MealPlan & { id: string }) => {
    const { id, ...data } = p;
    await api.upsert('meal_plans', { id, created_at: p.createdAt, active: 1, data });
    await reload();
  };

  const logMeal = async (dIdx: number, mIdx: number) => {
    const meal = mealPlan!.days[dIdx].meals[mIdx];
    await api.bulkUpsert('food_logs', meal.items.map((it) => ({ id: uid('f_'), date: today, meal: meal.slot, food_id: it.foodId, name: it.name, grams: it.grams, ...it.macros, created_at: new Date().toISOString() })));
    await reload();
    toast(`${MEAL_LABEL[meal.slot]} registrado en el día de hoy.`);
  };

  if (!mealPlan)
    return (
      <Card>
        <Empty>
          <p className="mb16">Genera un plan con alimentos accesibles en México ajustado a tus macros, alergias, exclusiones y preferencias.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => generate(7)} data-testid="gen-mealplan">
              <Utensils /> Generar plan de 7 días
            </button>
            <button className="btn" onClick={() => generate(1)}>
              Solo un día
            </button>
          </div>
        </Empty>
      </Card>
    );

  const d = mealPlan.days[Math.min(day, mealPlan.days.length - 1)];
  const outdated = Math.abs(mealPlan.targets.kcal - st.targets.kcal) > 50 || Math.abs(mealPlan.targets.protein - st.targets.protein) > 10;
  return (
    <div className="col" style={{ gap: 16 }}>
      {outdated && <Alert kind="warn">Tus objetivos cambiaron desde que se generó este plan. Genera uno nuevo para ajustarlo.</Alert>}
      <div className="row between">
        <Seg value={String(day)} onChange={(v) => setDay(Number(v))} options={mealPlan.days.map((_, i) => ({ value: String(i), label: `Día ${i + 1}` }))} />
        <div className="row">
          <button className="btn" onClick={() => generate(mealPlan.days.length)}>
            <RefreshCw /> Regenerar
          </button>
          <button className="btn primary" onClick={onShopping} data-testid="go-shopping">
            <ShoppingCart /> Lista del súper
          </button>
        </div>
      </div>
      <Card title={`Día ${d.index + 1}: totales vs objetivo`}>
        <div className="col" style={{ gap: 10 }}>
          <MacroBar label="Calorías" color="var(--s1)" value={d.totals.kcal} target={mealPlan.targets.kcal} unit="kcal" />
          <MacroBar label="Proteína" color="var(--protein)" value={d.totals.protein} target={mealPlan.targets.protein} />
          <MacroBar label="Carbos" color="var(--carbs)" value={d.totals.carbs} target={mealPlan.targets.carbs} />
          <MacroBar label="Grasas" color="var(--fat)" value={d.totals.fat} target={mealPlan.targets.fat} />
          <MacroBar label="Fibra" color="var(--fiber)" value={d.totals.fiber} target={mealPlan.targets.fiber} overOk />
        </div>
      </Card>
      <div className="grid g2">
        {d.meals.map((m, mi) => (
          <Card key={mi} title={`${MEAL_LABEL[m.slot]} · ${m.title}`} hint={`${fmt(m.totals.kcal)} kcal`} actions={
              <>
                <button className="btn sm ghost" onClick={() => setRecipeFor({ d: d.index, m: mi })} title="Cambiar por una receta" data-testid="meal-recipe">
                  <ChefHat size={14} /> Receta
                </button>
                <button className="btn sm" onClick={() => logMeal(d.index, mi)}>Registrar hoy</button>
              </>
            }>
            <table className="table">
              <thead>
                <tr>
                  <th>Alimento</th>
                  <th className="right">g</th>
                  <th className="right">kcal</th>
                  <th className="right">P</th>
                  <th className="right">C</th>
                  <th className="right">G</th>
                  <th className="right">Fibra</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {m.items.map((it, ii) => (
                  <tr key={ii}>
                    <td>
                      {it.name}
                      {it.unitHint && <div className="tiny muted">{it.unitHint}</div>}
                    </td>
                    <td className="right">{it.grams}</td>
                    <td className="right">{fmt(it.macros.kcal)}</td>
                    <td className="right">{fmt(it.macros.protein, 1)}</td>
                    <td className="right">{fmt(it.macros.carbs, 1)}</td>
                    <td className="right">{fmt(it.macros.fat, 1)}</td>
                    <td className="right">{fmt(it.macros.fiber, 1)}</td>
                    <td className="right">
                      <button className="btn ghost sm" onClick={() => setSubFor({ d: d.index, m: mi, i: ii, item: it })} title="Sustituir">
                        <RefreshCw size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="tiny muted mt8">
              Objetivo de la comida: {m.target.kcal} kcal · P {m.target.protein} · C {m.target.carbs} · G {m.target.fat}
            </div>
          </Card>
        ))}
      </div>
      {recipeFor && (
        <RecipePicker
          meal={mealPlan.days[recipeFor.d].meals[recipeFor.m]}
          onClose={() => setRecipeFor(null)}
          onPick={async (meal) => {
            const days = mealPlan.days.map((x) => (x.index === recipeFor.d ? replaceMeal(x, recipeFor.m, meal) : x));
            await savePlan({ ...mealPlan, days });
            setRecipeFor(null);
            toast('Comida cambiada por la receta.');
          }}
        />
      )}
      {mealPlan.notes.map((n, i) => (
        <Alert key={i} kind="warn">
          {n}
        </Alert>
      ))}
      <p className="small muted">Valores calculados con la base de datos de alimentos (USDA FoodData Central, referencia). Pesa los alimentos en la forma indicada (crudo/cocido).</p>
      {subFor && (
        <SubstituteModal
          item={subFor.item}
          pool={pool}
          onClose={() => setSubFor(null)}
          onPick={async (f, g) => {
            const plan = structuredClone(mealPlan);
            const meal = plan.days[subFor.d].meals[subFor.m];
            meal.items[subFor.i] = { foodId: f.id, name: f.name, grams: g, macros: macrosFor(f, g) };
            meal.totals = sumMacros(meal.items.map((x) => x.macros));
            plan.days[subFor.d].totals = sumMacros(plan.days[subFor.d].meals.map((x) => x.totals));
            await savePlan(plan);
            setSubFor(null);
            toast('Alimento sustituido.');
          }}
        />
      )}
    </div>
  );
}

function SubstituteModal({ item, pool, onClose, onPick }: { item: PlanItem; pool: Food[]; onClose: () => void; onPick: (f: Food, g: number) => void }) {
  const original = pool.find((f) => f.id === item.foodId);
  const subs = original ? substitutes(original, item.grams, pool, 10) : [];
  return (
    <Modal title={`Sustituir ${item.name} (${item.grams} g)`} onClose={onClose}>
      <p className="small muted mb16">Equivalencias que igualan el macronutriente principal. Se muestra la diferencia en los demás.</p>
      <table className="table">
        <thead>
          <tr>
            <th>Alimento</th>
            <th className="right">Cantidad</th>
            <th className="right">Δ kcal</th>
            <th className="right">Δ P</th>
            <th className="right">Δ C</th>
            <th className="right">Δ G</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.food.id}>
              <td>{s.food.name}</td>
              <td className="right">{s.grams} g</td>
              <td className="right">{s.diff.kcal > 0 ? '+' : ''}{s.diff.kcal}</td>
              <td className="right">{s.diff.protein > 0 ? '+' : ''}{s.diff.protein}</td>
              <td className="right">{s.diff.carbs > 0 ? '+' : ''}{s.diff.carbs}</td>
              <td className="right">{s.diff.fat > 0 ? '+' : ''}{s.diff.fat}</td>
              <td className="right">
                <button className="btn sm" onClick={() => onPick(s.food, s.grams)}>
                  Elegir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!subs.length && <Empty>No hay sustitutos compatibles.</Empty>}
    </Modal>
  );
}

// ───────────────────────── Base de alimentos

const CATS: { value: FoodCategory; label: string }[] = [
  { value: 'proteina', label: 'Proteína' },
  { value: 'lacteo', label: 'Lácteo' },
  { value: 'leguminosa', label: 'Leguminosa' },
  { value: 'cereal', label: 'Cereal' },
  { value: 'tuberculo', label: 'Tubérculo' },
  { value: 'fruta', label: 'Fruta' },
  { value: 'verdura', label: 'Verdura' },
  { value: 'grasa', label: 'Grasa' },
  { value: 'otro', label: 'Otro' },
];

function FoodForm({ initial, onSubmit, submitLabel = 'Guardar', extra }: { initial: Partial<Food>; onSubmit: (f: Partial<Food>) => void; submitLabel?: string; extra?: ReactNode }) {
  const [f, setF] = useState<Partial<Food>>({ category: 'otro', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, ...initial });
  const errs = validateFood(f);
  const at = atwaterCheck({ kcal: f.kcal ?? 0, protein: f.protein ?? 0, carbs: f.carbs ?? 0, fat: f.fat ?? 0, tags: f.tags, source: f.source, verified: f.verified });
  const tags = f.tags ? (JSON.parse(f.tags) as string[]) : [];
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="grid g2">
        <Field label="Nombre">
          <input className="input" value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="ff-name" />
        </Field>
        <Field label="Categoría">
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as FoodCategory })}>
            {CATS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="field-label">Valores por 100 g</div>
      <div className="grid g5">
        <Field label="kcal">
          <NumInput value={f.kcal} onChange={(v) => setF({ ...f, kcal: v ?? 0 })} testId="ff-kcal" />
        </Field>
        <Field label="Proteína (g)">
          <NumInput value={f.protein} onChange={(v) => setF({ ...f, protein: v ?? 0 })} testId="ff-protein" />
        </Field>
        <Field label="Carbohidratos (g)">
          <NumInput value={f.carbs} onChange={(v) => setF({ ...f, carbs: v ?? 0 })} testId="ff-carbs" />
        </Field>
        <Field label="Grasa (g)">
          <NumInput value={f.fat} onChange={(v) => setF({ ...f, fat: v ?? 0 })} testId="ff-fat" />
        </Field>
        <Field label="Fibra (g)">
          <NumInput value={f.fiber} onChange={(v) => setF({ ...f, fiber: v ?? 0 })} />
        </Field>
      </div>
      <div className="grid g3">
        <Field label="Unidad (opcional)">
          <input className="input" value={f.unit_name ?? ''} onChange={(e) => setF({ ...f, unit_name: e.target.value || null })} placeholder="pieza, taza, scoop" />
        </Field>
        <Field label="Gramos por unidad">
          <NumInput value={f.unit_grams} onChange={(v) => setF({ ...f, unit_grams: v })} />
        </Field>
        <Field label="Fuente de los datos">
          <input className="input" value={f.source ?? ''} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="Etiqueta del producto, SMAE…" />
        </Field>
      </div>
      <div className="grid g3">
        <Field label="Código de barras">
          <input className="input" value={f.barcode ?? ''} onChange={(e) => setF({ ...f, barcode: e.target.value.replace(/\D/g, '') || null })} />
        </Field>
        <Field label="Precio por kg (opcional)">
          <NumInput value={f.price_per_kg} onChange={(v) => setF({ ...f, price_per_kg: v })} />
        </Field>
        <Field label="Contiene">
          <select className="input" value="" onChange={(e) => e.target.value && setF({ ...f, tags: JSON.stringify([...new Set([...tags, e.target.value])]) })}>
            <option value="">Agregar alérgeno…</option>
            {['lacteos', 'gluten', 'huevo', 'pescado', 'mariscos', 'cacahuate', 'frutos_secos', 'soya', 'cerdo', 'res'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="chips">
            {tags.map((t) => (
              <button key={t} className="chip on" onClick={() => setF({ ...f, tags: JSON.stringify(tags.filter((x) => x !== t)) })}>
                {t} ✕
              </button>
            ))}
          </div>
        </Field>
      </div>
      <label className="row small">
        <input type="checkbox" checked={!!f.verified} onChange={(e) => setF({ ...f, verified: e.target.checked ? 1 : 0 })} /> Verifiqué estos valores con la etiqueta o una fuente confiable
      </label>
      {extra}
      {!at.ok && <Alert kind="warn">Las kcal declaradas difieren {at.diffPct}% de lo calculado con 4/4/9 kcal por gramo ({at.computed} kcal). Revisa los valores.</Alert>}
      {errs.length > 0 && <Alert kind="danger">{errs.join(' ')}</Alert>}
      <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={errs.length > 0} onClick={() => onSubmit(f)} data-testid="ff-save">
        <Save /> {submitLabel}
      </button>
    </div>
  );
}

function FoodDB() {
  const { foods, reload, toast } = useApp();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Food> | null>(null);
  const [onlyCustom, setOnlyCustom] = useState(false);
  const list = searchFoods(foods, q).filter((f) => !onlyCustom || f.custom);
  return (
    <div className="col" style={{ gap: 16 }}>
      <Alert kind="info">
        Los alimentos base están verificados contra la base oficial <b>USDA FoodData Central (SR Legacy)</b>: cada uno indica su número FDC, que puedes consultar en fdc.nal.usda.gov. Son valores por 100 g de alimentos genéricos; los productos de marca pueden variar, así que puedes editar cualquiera o crear los tuyos a partir de la etiqueta.
      </Alert>
      <div className="row between">
        <div className="row">
          <input className="input" style={{ width: 300 }} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="row small">
            <input type="checkbox" checked={onlyCustom} onChange={(e) => setOnlyCustom(e.target.checked)} /> Solo personalizados
          </label>
        </div>
        <button className="btn primary" onClick={() => setEdit({})} data-testid="new-food">
          <Plus /> Nuevo alimento
        </button>
      </div>
      <Card>
        <div className="scroll" style={{ maxHeight: 560 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Alimento</th>
                <th>Categoría</th>
                <th className="right">kcal</th>
                <th className="right">Prot.</th>
                <th className="right">Carb.</th>
                <th className="right">Grasa</th>
                <th className="right">Fibra</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id} className="click" onClick={() => setEdit(f)}>
                  <td>
                    {f.name}
                    <div className="tiny muted">{f.source}</div>
                  </td>
                  <td>{CATS.find((c) => c.value === f.category)?.label}</td>
                  <td className="right">{f.kcal}</td>
                  <td className="right">{f.protein}</td>
                  <td className="right">{f.carbs}</td>
                  <td className="right">{f.fat}</td>
                  <td className="right">{f.fiber}</td>
                  <td>
                    {f.verified ? <span className="badge ok">Verificado</span> : <span className="badge warn">Por verificar</span>} {f.custom ? <span className="badge">Propio</span> : null}
                    {foodTags(f).includes('economico') && <span className="badge info" style={{ marginLeft: 4 }}>Económico</span>}
                  </td>
                  <td className="right">
                    <Pencil size={14} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && (
        <Modal title={edit.id ? `Editar: ${edit.name}` : 'Nuevo alimento'} onClose={() => setEdit(null)} wide>
          <FoodForm
            initial={edit}
            onSubmit={async (f) => {
              await api.upsert('foods', { ...f, id: f.id ?? uid('food_'), custom: f.id ? (f.custom ?? 0) : 1, verified: f.verified ?? 0, source: f.source || 'Personalizado por el usuario' });
              await reload();
              setEdit(null);
              toast('Alimento guardado.');
            }}
          />
          {edit.id && edit.custom ? (
            <button
              className="btn danger mt16"
              onClick={async () => {
                if (!confirm('¿Eliminar este alimento? Los registros existentes se conservan.')) return;
                await api.remove('foods', edit.id!);
                await reload();
                setEdit(null);
              }}
            >
              <Trash2 /> Eliminar
            </button>
          ) : null}
        </Modal>
      )}
    </div>
  );
}

// ───────────────────────── Recetas

function Recipes() {
  const { recipes, favorites, foods, reload, toast } = useApp();
  const [edit, setEdit] = useState<{ id?: string; name: string; servings: number; items: { foodId: string; grams: number }[]; notes: string | null } | null>(null);
  const [q, setQ] = useState('');
  const tot = (items: { foodId: string; grams: number }[]): Macros =>
    sumMacros(
      items.map((i) => {
        const f = foods.find((x) => x.id === i.foodId);
        return f ? macrosFor(f, i.grams) : {};
      }),
    );
  return (
    <div className="grid g2">
      <Card title="Recetas" actions={<button className="btn primary sm" onClick={() => setEdit({ name: '', servings: 1, items: [], notes: null })}><Plus /> Nueva receta</button>}>
        <div className="col">
          {recipes.length === 0 && <Empty>Crea recetas con tus ingredientes para registrarlas por porción.</Empty>}
          {recipes.length > 0 && <p className="tiny muted">Puedes usarlas en tu plan con el botón "Receta" de cada comida.</p>}
          {recipes.map((r) => {
            const t = tot(r.items);
            return (
              <div className="list-item" key={r.id}>
                <div className="grow">
                  <b>{r.name}</b> {r.id.startsWith('rec_seed_') && <span className="badge info">Incluida</span>}
                  <div className="tiny muted">
                    {r.servings} porciones · por porción: {fmt(t.kcal / r.servings)} kcal · P {fmt(t.protein / r.servings, 1)} g · C {fmt(t.carbs / r.servings, 1)} g · G {fmt(t.fat / r.servings, 1)} g
                  </div>
                  {r.notes && (
                    <details className="tiny mt4">
                      <summary className="muted" style={{ cursor: 'pointer' }}>Ingredientes y preparación</summary>
                      <div className="mt4">{r.items.map((i) => `${foods.find((f) => f.id === i.foodId)?.name ?? i.foodId}: ${i.grams} g`).join(' · ')}</div>
                      <div className="mt4" style={{ whiteSpace: 'pre-line' }}>{r.notes}</div>
                    </details>
                  )}
                </div>
                <button className="btn ghost icon sm" onClick={() => setEdit({ ...r })}>
                  <Pencil />
                </button>
                <button
                  className="btn ghost icon sm"
                  onClick={async () => {
                    await api.remove('recipes', r.id);
                    await reload();
                  }}
                >
                  <Trash2 />
                </button>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Comidas frecuentes">
        <div className="col">
          {favorites.length === 0 && <Empty>Guarda comidas desde el registro diario con el botón ★.</Empty>}
          {favorites.map((f) => (
            <div className="list-item" key={f.id}>
              <div className="grow">
                <b>{f.name}</b>
                <div className="tiny muted">{f.items.map((i) => `${i.name} ${i.grams} g`).join(' · ')}</div>
              </div>
              <button
                className="btn ghost icon sm"
                onClick={async () => {
                  await api.remove('favorites', f.id);
                  await reload();
                }}
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      </Card>
      {edit && (
        <Modal
          title={edit.id ? 'Editar receta' : 'Nueva receta'}
          onClose={() => setEdit(null)}
          wide
          footer={
            <button
              className="btn primary"
              disabled={!edit.name.trim() || !edit.items.length || edit.servings <= 0}
              onClick={async () => {
                await api.upsert('recipes', { ...edit, id: edit.id ?? uid('rec_'), created_at: new Date().toISOString() });
                await reload();
                setEdit(null);
                toast('Receta guardada.');
              }}
            >
              Guardar receta
            </button>
          }
        >
          <div className="grid g2 mb16">
            <Field label="Nombre">
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Porciones que rinde">
              <NumInput value={edit.servings} onChange={(v) => setEdit({ ...edit, servings: v ?? 1 })} />
            </Field>
          </div>
          <div className="row nowrap mb8">
            <input className="input" placeholder="Buscar ingrediente…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {q && (
            <div className="chips mb16">
              {searchFoods(foods, q)
                .slice(0, 12)
                .map((f) => (
                  <button key={f.id} className="chip" onClick={() => { setEdit({ ...edit, items: [...edit.items, { foodId: f.id, grams: f.unit_grams ?? 100 }] }); setQ(''); }}>
                    + {f.name}
                  </button>
                ))}
            </div>
          )}
          <table className="table">
            <tbody>
              {edit.items.map((it, i) => (
                <tr key={i}>
                  <td>{foods.find((f) => f.id === it.foodId)?.name ?? it.foodId}</td>
                  <td style={{ width: 140 }}>
                    <NumInput value={it.grams} onChange={(v) => setEdit({ ...edit, items: edit.items.map((x, j) => (j === i ? { ...x, grams: v ?? 0 } : x)) })} suffix="g" />
                  </td>
                  <td className="right">
                    <button className="btn ghost icon sm" onClick={() => setEdit({ ...edit, items: edit.items.filter((_, j) => j !== i) })}>
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {edit.items.length > 0 &&
            (() => {
              const t = tot(edit.items);
              return (
                <p className="small mt8">
                  Total: {fmt(t.kcal)} kcal · por porción: <b>{fmt(t.kcal / edit.servings)} kcal</b>, P {fmt(t.protein / edit.servings, 1)} g, C {fmt(t.carbs / edit.servings, 1)} g, G {fmt(t.fat / edit.servings, 1)} g
                </p>
              );
            })()}
        </Modal>
      )}
    </div>
  );
}

// ───────────────────────── Objetivos

function Targets() {
  const { state: st, profile, data, activatePlan, toast } = useApp();
  const t = st.targets;
  const rec = st.recommendedTargets;
  const per = distributeMacros(t, mealSlots(profile.mealsPerDay));
  const differs = Math.abs(rec.kcal - t.kcal) >= 50 || Math.abs(rec.protein - t.protein) >= 10;
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="grid g5">
        <Card tight>
          <Stat label="Calorías" value={fmt(t.kcal)} unit="kcal" foot={`Déficit ${fmt(t.deficit)} kcal (${t.deficitPct}%)`} testId="target-kcal" />
        </Card>
        <Card tight>
          <Stat label="Proteína" value={fmt(t.protein)} unit="g" foot={`${t.proteinPerKg} g/kg de peso`} />
        </Card>
        <Card tight>
          <Stat label="Carbohidratos" value={fmt(t.carbs)} unit="g" />
        </Card>
        <Card tight>
          <Stat label="Grasas" value={fmt(t.fat)} unit="g" />
        </Card>
        <Card tight>
          <Stat label="Fibra" value={fmt(t.fiber)} unit="g" foot="14 g / 1 000 kcal" />
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Por qué estos números">
          <Claims
            items={[
              { kind: 'estimacion', text: `Gasto energético utilizado: ${fmt(t.tdee)} kcal (${t.method}).` },
              ...t.rationale.map((r) => ({ kind: 'recomendacion' as const, text: r })),
              { kind: 'recomendacion', text: 'Proteína: 2 g por kg de tu peso objetivo (≈2.3–2.6 g/kg de masa libre de grasa), para preservar músculo en déficit.' },
              { kind: 'recomendacion', text: 'Grasa: ≈25 % de las calorías (mínimo 0.6 g/kg) para salud hormonal; el resto, carbohidratos para rendir en el entrenamiento.' },
            ]}
          />
          <p className="small muted mt16">Plan activo desde {data.plan ? new Date(data.plan.created_at).toLocaleDateString('es-MX') : '—'}. Los cambios se proponen en Inteligencia artificial y solo se aplican con tu confirmación.</p>
        </Card>
        <Card title="Distribución por comida">
          <table className="table">
            <thead>
              <tr>
                <th>Comida</th>
                <th className="right">kcal</th>
                <th className="right">Proteína</th>
                <th className="right">Carbos</th>
                <th className="right">Grasas</th>
              </tr>
            </thead>
            <tbody>
              {per.map((p) => (
                <tr key={p.slot}>
                  <td>{MEAL_LABEL[p.slot]}</td>
                  <td className="right">{p.kcal}</td>
                  <td className="right">{p.protein} g</td>
                  <td className="right">{p.carbs} g</td>
                  <td className="right">{p.fat} g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      {differs && (
        <Card title="Recálculo con tus datos actuales">
          <p className="mb16">
            Con tu peso, composición y gasto actuales, el cálculo recomendado sería <b>{fmt(rec.kcal)} kcal</b>, P {rec.protein} g, C {rec.carbs} g, G {rec.fat} g (actual: {fmt(t.kcal)} kcal).
          </p>
          <button
            className="btn"
            onClick={async () => {
              if (!confirm('¿Actualizar tu plan principal con el recálculo?')) return;
              await activatePlan({ scenario: profile.scenario, targets: rec, reason: 'Recálculo manual con datos actuales.' });
              toast('Plan actualizado.');
            }}
          >
            Aplicar recálculo
          </button>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────── Lista del súper

const SECTION_STYLE: Record<Section, { icon: typeof Apple; color: string }> = {
  'Frutas y verduras': { icon: Apple, color: 'var(--m-green)' },
  'Carnes, pescados y mariscos': { icon: Beef, color: 'var(--m-red)' },
  'Huevo y lácteos': { icon: Egg, color: 'var(--m-amber)' },
  'Tortillería y panadería': { icon: Croissant, color: 'var(--m-orange)' },
  'Abarrotes y granos': { icon: Wheat, color: 'var(--m-violet)' },
  Suplementos: { icon: Pill, color: 'var(--m-pink)' },
  Otros: { icon: Package, color: 'var(--m-slate)' },
};

function ShoppingView({ onPlan }: { onPlan: () => void }) {
  const { mealPlan, foods, settings, setSetting, toast } = useApp();
  const saved = (settings.shopping_list as ShoppingList | undefined) ?? null;
  const [list, setList] = useState<ShoppingList | null>(saved);
  const [days, setDays] = useState<number[]>(() => mealPlan?.days.map((d) => d.index) ?? []);
  const [repeat, setRepeat] = useState<'1' | '2' | '4'>('1');
  const [extra, setExtra] = useState({ name: '', qty: '' });
  useEffect(() => setList(saved), [saved]);

  const persist = (l: ShoppingList | null) => {
    setList(l);
    setSetting('shopping_list', l);
  };
  const create = () => {
    if (!mealPlan) return;
    if (!days.length) return toast('Elige al menos un día del plan.', 'error');
    if (list?.items.some((i) => i.checked) && !confirm('Ya tienes una lista con artículos marcados. ¿Reemplazarla?')) return;
    persist(buildShoppingList(mealPlan, foods, days, Number(repeat)));
    toast('Lista del súper creada.');
  };
  const toggle = (key: string) => list && persist({ ...list, items: list.items.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)) });
  const share = async () => {
    if (!list) return;
    const text = shoppingListText(list);
    try {
      if (navigator.share) await navigator.share({ title: 'Lista del súper', text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Lista copiada: pégala en Notas o WhatsApp.');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        await navigator.clipboard?.writeText(text).catch(() => {});
        toast('Lista copiada al portapapeles.');
      }
    }
  };

  if (!mealPlan && !list)
    return (
      <Card>
        <Empty>
          <p className="mb16">La lista se arma a partir de tu plan de comidas. Primero genera un plan.</p>
          <button className="btn primary" onClick={onPlan}>
            <Utensils /> Ir al plan de comidas
          </button>
        </Empty>
      </Card>
    );

  const done = list?.items.filter((i) => i.checked).length ?? 0;
  const total = list?.items.length ?? 0;
  const outdated = list && mealPlan && list.planCreatedAt && list.planCreatedAt !== mealPlan.createdAt;
  return (
    <div className="col" style={{ gap: 16 }}>
      {mealPlan && (
        <Card title="Armar la lista" icon={<ShoppingCart />} hint="Cantidades para comprar: lo que se come cocido aparece en crudo o seco">
          <div className="col" style={{ gap: 12 }}>
            <div>
              <div className="field-label mb8">Días del plan a comprar</div>
              <div className="chips">
                {mealPlan.days.map((d) => (
                  <button key={d.index} className={`chip ${days.includes(d.index) ? 'on' : ''}`} onClick={() => setDays(days.includes(d.index) ? days.filter((x) => x !== d.index) : [...days, d.index].sort())}>
                    Día {d.index + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className="row between">
              <div className="row">
                <span className="field-label">Repetir</span>
                <Seg value={repeat} onChange={setRepeat} options={[{ value: '1', label: '×1' }, { value: '2', label: '×2' }, { value: '4', label: '×4' }]} />
                <span className="tiny muted">{mealPlan.days.length === 1 ? 'Tu plan es de 1 día: usa ×… para varios días.' : 'Útil para comprar para 2 semanas o para más personas.'}</span>
              </div>
              <button className="btn primary" onClick={create} data-testid="shopping-create">
                <ShoppingCart /> {list ? 'Actualizar lista' : 'Crear lista'}
              </button>
            </div>
          </div>
        </Card>
      )}
      {outdated && <Alert kind="warn">Tu plan de comidas cambió desde que creaste esta lista. Actualízala para que coincida.</Alert>}
      {list && (
        <>
          <div className="card shopping-progress">
            <div className="row between">
              <div>
                <div className="tiny muted">En el carrito</div>
                <div className="big-number mono" style={{ fontSize: 40 }} data-testid="shopping-progress">
                  {done}
                  <span className="unit">/ {total}</span>
                </div>
              </div>
              <div className="row">
                <button className="btn" onClick={share}>
                  <Share2 /> Compartir
                </button>
                <button className="btn" disabled={!done} onClick={() => persist({ ...list, items: list.items.map((i) => ({ ...i, checked: false })) })}>
                  Desmarcar todo
                </button>
                <button className="btn" disabled={!done} onClick={() => confirm('¿Quitar de la lista los artículos marcados?') && persist({ ...list, items: list.items.filter((i) => !i.checked) })}>
                  <Trash2 /> Quitar marcados
                </button>
              </div>
            </div>
            <div className="journey-track" style={{ marginTop: 14 }}>
              <div className="journey-fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="grid g2">
            {SECTION_ORDER.map((sec) => {
              const its = list.items.filter((i) => i.section === sec);
              if (!its.length) return null;
              const st = SECTION_STYLE[sec];
              return (
                <Card key={sec} title={sec} icon={<IconTile icon={st.icon} color={st.color} size={30} />} hint={`${its.filter((i) => i.checked).length}/${its.length}`}>
                  <div className="col" style={{ gap: 4 }}>
                    {its.map((i) => (
                      <button key={i.key} className={`shop-item ${i.checked ? 'done' : ''}`} onClick={() => toggle(i.key)} data-testid={`shop-${i.key}`} style={{ ['--sc' as string]: st.color }}>
                        <span className="shop-box">{i.checked && <Check size={16} />}</span>
                        <span className="grow">
                          <span className="shop-name">{i.name}</span>
                          {i.detail && <span className="tiny muted" style={{ display: 'block' }}>{i.detail}</span>}
                        </span>
                        <span className="shop-qty mono">{i.qty}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
          <Card title="Agregar algo más">
            <div className="row nowrap">
              <input className="input" placeholder="Artículo (p. ej., limones, papel de cocina)" value={extra.name} onChange={(e) => setExtra({ ...extra, name: e.target.value })} />
              <input className="input" style={{ maxWidth: 160 }} placeholder="Cantidad" value={extra.qty} onChange={(e) => setExtra({ ...extra, qty: e.target.value })} />
              <button
                className="btn primary"
                disabled={!extra.name.trim()}
                onClick={() => {
                  persist({ ...list, items: [...list.items, { key: `extra_${uid()}`, name: extra.name.trim(), qty: extra.qty.trim() || '—', grams: 0, section: 'Otros', checked: false, custom: true }] });
                  setExtra({ name: '', qty: '' });
                }}
              >
                <Plus />
              </button>
            </div>
            <p className="tiny muted mt8">
              Las cantidades de carne, granos y leguminosas se convirtieron a peso crudo o seco con factores calculados a partir de USDA FoodData Central. Son aproximadas: redondea según los empaques de tu tienda.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

// ───────────────────────── Cambiar una comida del plan por una receta

function RecipePicker({ meal, onClose, onPick }: { meal: PlannedMeal; onClose: () => void; onPick: (m: PlannedMeal) => void }) {
  const { recipes, foods } = useApp();
  const ranked = useMemo(
    () =>
      recipes
        .map((r) => {
          const per = recipePerServing(r, foods);
          return { r, per, fit: recipeFit(per, meal.target) };
        })
        .sort((a, b) => a.fit.error - b.fit.error),
    [recipes, foods, meal.target],
  );
  return (
    <Modal title={`Cambiar ${MEAL_LABEL[meal.slot].toLowerCase()} por una receta`} onClose={onClose} wide>
      <p className="small muted mb12">
        Objetivo de esta comida: {fmt(meal.target.kcal)} kcal · P {fmt(meal.target.protein)} g. Las porciones se ajustan solas; las mejores opciones aparecen primero.
      </p>
      {ranked.length === 0 && <Empty>No tienes recetas. Créalas en "Recetas y frecuentes".</Empty>}
      <div className="col" style={{ gap: 8 }}>
        {ranked.map(({ r, per, fit }, i) => (
          <div key={r.id} className="row between list-row" data-testid="recipe-option">
            <div className="grow">
              <b>{r.name}</b> {i < 3 && fit.error < 0.6 && <span className="badge ok">Buen ajuste</span>}
              <div className="tiny muted">
                {fit.portions.toLocaleString('es-MX')} porción{fit.portions === 1 ? '' : 'es'} → {fmt(fit.macros.kcal)} kcal · P {fmt(fit.macros.protein)} · C {fmt(fit.macros.carbs)} · G {fmt(fit.macros.fat)} <span className="muted">(1 porción: {fmt(per.kcal)} kcal)</span>
              </div>
            </div>
            <button className="btn sm primary" onClick={() => onPick(recipeToMeal(r, foods, meal.slot, meal.target, fit.portions))}>
              Usar
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

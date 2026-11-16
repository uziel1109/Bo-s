// Registro de comida por fotografía con IA: foto → platillo y elementos → macros con alimentos verificados
// → comparación con el plan → agregar (o reemplazar) en el registro diario.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { Food, MealSlot } from '@shared/types';
import { compareWithPlan, itemMacros, parsePhotoAnalysis, type DetectedItem, type PhotoAnalysis } from '@shared/nutrition/photoAnalysis';
import { sumMacros } from '@shared/nutrition/foods';
import { MEAL_LABEL } from '@shared/nutrition/targets';
import { daysBetween, uid } from '@shared/utils';
import type { MealPlan } from '@shared/nutrition/mealPlanner';
import { Alert, fmt, Modal, NumInput } from './ui';
import { api } from '../api';
import { fileToJpegBase64 } from '../lib/image';
import { useApp } from '../store';
import { navigate } from '../App';

/** Comida del plan que corresponde a un día y horario. */
export function plannedMeal(plan: (MealPlan & { id: string }) | null, slot: MealSlot, date: string) {
  if (!plan?.days.length) return null;
  const idx = ((daysBetween(plan.createdAt.slice(0, 10), date) % plan.days.length) + plan.days.length) % plan.days.length;
  return plan.days[idx]?.meals.find((m) => m.slot === slot) ?? null;
}

const CONF: Record<DetectedItem['confidence'], string> = { alta: 'ok', media: 'warn', baja: 'danger' };

export function FoodPhotoModal({ date, slot: initialSlot, onClose }: { date: string; slot: MealSlot; onClose: () => void }) {
  const { foods, data, mealPlan, reload, toast } = useApp();
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [cfg, setCfg] = useState<{ enabled: boolean; hasKey: boolean } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PhotoAnalysis | null>(null);
  const [items, setItems] = useState<DetectedItem[]>([]);
  const [replace, setReplace] = useState(true);
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    api.aiConfig().then(setCfg).catch(() => setCfg({ enabled: false, hasKey: false }));
  }, []);

  const planned = plannedMeal(mealPlan, slot, date);
  const existing = data.foodLogs.filter((l) => l.date === date && l.meal === slot);
  const totals = useMemo(() => sumMacros(items.map((i) => itemMacros(i, foods) ?? {})), [items, foods]);
  const comparison = useMemo(() => (planned ? compareWithPlan(items, planned.items) : null), [items, planned]);

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      const img = await fileToJpegBase64(f);
      setPreview(img.previewUrl);
      setPhoto(img.base64);
      setResult(null);
      setItems([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const analyze = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      const hint = planned ? planned.items.map((i) => `${i.name} ${i.grams} g`).join(', ') : undefined;
      const text = await api.aiAnalyzeFood(photo, 'image/jpeg', foods.map((f) => ({ id: f.id, name: f.name })), hint);
      const r = parsePhotoAnalysis(text, foods);
      setResult(r);
      setItems(r.items);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const rows = items
      .map((it) => {
        const m = itemMacros(it, foods);
        if (!m) return null;
        const f = it.foodId ? foods.find((x) => x.id === it.foodId) : null;
        return { id: uid('f_'), date, meal: slot, food_id: f?.id ?? null, name: f ? f.name : `${it.name} (estimado por IA)`, grams: it.grams, ...m, created_at: new Date().toISOString() };
      })
      .filter(Boolean) as Record<string, unknown>[];
    if (!rows.length) return toast('No hay elementos con valores nutricionales para registrar.', 'error');
    if (replace && existing.length) for (const l of existing) await api.remove('food_logs', l.id);
    await api.bulkUpsert('food_logs', rows);
    await reload();
    toast(`${result?.dish ?? 'Platillo'} registrado en ${MEAL_LABEL[slot]}${replace && existing.length ? ' (reemplazó lo anterior)' : ''}.`);
    onClose();
  };

  const setItem = (i: number, patch: Partial<DetectedItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const missingValues = items.some((i) => !itemMacros(i, foods));

  return (
    <Modal title="Foto de tu comida" onClose={onClose} wide>
      {cfg && (!cfg.enabled || !cfg.hasKey) ? (
        <div className="col" style={{ gap: 12 }}>
          <Alert kind="info">
            El análisis de fotos usa la integración opcional de IA (Claude), que está desactivada. Actívala con tu clave en <b>Inteligencia artificial → Configuración de IA</b>. La foto solo se envía cuando tocas “Analizar”.
          </Alert>
          <button
            className="btn primary"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              onClose();
              navigate('ia');
            }}
          >
            Configurar IA
          </button>
        </div>
      ) : (
        <div className="col" style={{ gap: 16 }}>
          <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} data-testid="photo-camera-input" />
          <input ref={libRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} data-testid="photo-library-input" />
          <div className="row between">
            <div className="row">
              <span className="field-label">Comida</span>
              <select className="input" style={{ width: 200 }} value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
                {(Object.keys(MEAL_LABEL) as MealSlot[]).map((s) => (
                  <option key={s} value={s}>
                    {MEAL_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <button className="btn primary" onClick={() => camRef.current?.click()}>
                <Camera /> Tomar foto
              </button>
              <button className="btn" onClick={() => libRef.current?.click()}>
                <ImagePlus /> Elegir de la galería
              </button>
            </div>
          </div>

          {preview && (
            <div className="photo-analyze">
              <img src={preview} alt="Tu plato" />
              <div className="col" style={{ gap: 10 }}>
                {!result && (
                  <>
                    <p className="small muted">La foto se envía a la IA solo al tocar Analizar. No se guarda en BODY OS.</p>
                    <button className="btn primary" onClick={analyze} disabled={busy} data-testid="photo-analyze">
                      {busy ? <Loader2 className="spin" /> : <Sparkles />} {busy ? 'Analizando…' : 'Analizar platillo'}
                    </button>
                  </>
                )}
                {result && (
                  <>
                    <div>
                      <div className="tiny muted">Platillo detectado</div>
                      <div style={{ fontSize: 22, fontWeight: 720 }} data-testid="photo-dish">
                        {result.dish}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 18 }}>
                      <span>
                        <b className="mono" style={{ fontSize: 20 }} data-testid="photo-kcal">
                          {fmt(totals.kcal)}
                        </b>{' '}
                        <span className="muted small">kcal</span>
                      </span>
                      <span className="small">
                        P <b>{fmt(totals.protein)}</b> · C <b>{fmt(totals.carbs)}</b> · G <b>{fmt(totals.fat)}</b> g
                      </span>
                    </div>
                    {result.note && <p className="small muted">{result.note}</p>}
                  </>
                )}
              </div>
            </div>
          )}

          {result && (
            <>
              {result.warnings.map((w, i) => (
                <Alert key={i} kind="warn">
                  {w}
                </Alert>
              ))}
              <div className="col" style={{ gap: 8 }}>
                {items.map((it, i) => {
                  const m = itemMacros(it, foods);
                  return (
                    <div key={i} className="detect-row">
                      <div className="grow" style={{ minWidth: 200 }}>
                        <div className="row nowrap" style={{ gap: 8 }}>
                          <b>{it.name}</b>
                          <span className={`badge ${CONF[it.confidence]}`}>{it.confidence}</span>
                        </div>
                        <select className="input mt8" value={it.foodId ?? ''} onChange={(e) => setItem(i, { foodId: e.target.value || null, source: e.target.value ? 'base' : 'estimado_ia' })}>
                          <option value="">{it.per100 ? 'Valores estimados por la IA (no está en tu base)' : '— Elige un alimento de tu base —'}</option>
                          {foods.map((f: Food) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                        <div className="tiny muted mt8">{it.foodId ? 'Macros calculados con tu base verificada (USDA o tu etiqueta).' : it.per100 ? `Estimado por IA: ${it.per100.kcal} kcal/100 g` : 'Sin valores: asigna un alimento.'}</div>
                      </div>
                      <div style={{ width: 130 }}>
                        <NumInput value={it.grams} onChange={(v) => setItem(i, { grams: Math.max(0, v ?? 0) })} suffix="g" />
                      </div>
                      <div className="mono small right" style={{ width: 120 }}>
                        {m ? (
                          <>
                            <b>{fmt(m.kcal)}</b> kcal
                            <div className="tiny muted">P {fmt(m.protein)} · C {fmt(m.carbs)} · G {fmt(m.fat)}</div>
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                      <button className="btn ghost icon sm" onClick={() => setItems(items.filter((_, j) => j !== i))} title="Quitar">
                        <Trash2 />
                      </button>
                    </div>
                  );
                })}
                <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setItems([...items, { name: 'Elemento agregado', grams: 100, foodId: null, per100: null, confidence: 'media', source: 'base' }])}>
                  <Plus /> Agregar elemento que no detectó
                </button>
              </div>

              {planned && comparison && (
                <div className="plan-compare">
                  <div className="field-label mb8">Comparación con tu plan ({planned.title})</div>
                  <div className="chips">
                    {comparison.matched.map((m) => (
                      <span key={m.foodId} className="chip on">
                        <Check size={13} /> {m.name.split(',')[0]} · {m.detected} g de {m.planned} g
                      </span>
                    ))}
                    {comparison.missing.map((m) => (
                      <span key={m.foodId} className="chip">
                        <X size={13} /> {m.name.split(',')[0]} (no está en el plato)
                      </span>
                    ))}
                  </div>
                  <p className="small mt8">
                    Plan: {fmt(planned.totals.kcal)} kcal · P {fmt(planned.totals.protein)} g — Plato: <b>{fmt(totals.kcal)} kcal · P {fmt(totals.protein)} g</b>
                    {comparison.missing.length || comparison.extra.length ? ' · Se registrará lo que comiste, no lo del plan.' : ' · Coincide con tu plan.'}
                  </p>
                </div>
              )}

              {existing.length > 0 && (
                <label className="row small">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} data-testid="photo-replace" /> Reemplazar lo ya registrado en {MEAL_LABEL[slot]} ({existing.length} alimento{existing.length > 1 ? 's' : ''}, {fmt(sumMacros(existing).kcal)} kcal)
                </label>
              )}
              <Alert kind="info">Los gramos se estiman a simple vista (error típico de ±20–30 %). Si pesas tu porción y corriges los gramos, el cálculo es exacto con los valores verificados.</Alert>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn primary" onClick={save} disabled={!items.length || missingValues} data-testid="photo-save">
                  <Check /> Agregar al registro de {MEAL_LABEL[slot]}
                </button>
              </div>
              {missingValues && <p className="tiny muted right">Asigna un alimento a los elementos sin valores o quítalos.</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

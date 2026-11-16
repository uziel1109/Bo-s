// Preparación de comidas en lote ("meal prep"): a partir del plan de comidas calcula qué cocinar,
// cuánto en crudo/seco, en qué orden, y cómo repartir en recipientes por día y comida.
//
// Seguridad alimentaria (USDA FSIS): los alimentos cocidos se conservan 3–4 días en refrigeración (≤ 4 °C);
// lo que se coma después debe congelarse y descongelarse en el refrigerador.
import type { Food } from '../types';
import type { MealPlan } from './mealPlanner';
import { COOKED_TO_RAW, formatGrams } from './shopping';
import { MEAL_LABEL } from './targets';

export interface CookInfo {
  method: string;
  minutes: number; // tiempo de cocción (activo + pasivo)
  activeMin: number; // tiempo de atención
  order: number; // los más largos primero
  tip: string;
}

/** Cómo se cocina cada alimento que conviene preparar en lote. */
export const COOK: Record<string, CookInfo> = {
  frijol_negro_cocido: { method: 'Olla de presión 35–40 min (o 2 h en olla normal) después de remojar la noche anterior', minutes: 45, activeMin: 5, order: 1, tip: 'Cocina con cebolla, ajo y sal; guárdalos con su caldo.' },
  frijol_pinto_cocido: { method: 'Olla de presión 35–40 min (o 2 h en olla normal) después de remojar', minutes: 45, activeMin: 5, order: 1, tip: 'Guárdalos con su caldo para que no se sequen.' },
  garbanzo_cocido: { method: 'Olla de presión 40 min después de remojar 12 h', minutes: 45, activeMin: 5, order: 1, tip: '' },
  lenteja_cocida: { method: 'Olla normal 20–25 min (no requieren remojo)', minutes: 25, activeMin: 5, order: 3, tip: '' },
  arroz_blanco_cocido: { method: 'Olla o arrocera: 1 taza de arroz por 2 de agua, 18–20 min tapado', minutes: 25, activeMin: 5, order: 3, tip: 'Enfríalo extendido antes de guardarlo (reduce el riesgo de B. cereus).' },
  arroz_integral_cocido: { method: 'Olla: 1 taza por 2½ de agua, 40–45 min', minutes: 45, activeMin: 5, order: 2, tip: 'Enfríalo extendido antes de guardarlo.' },
  pasta_cocida: { method: 'Agua hirviendo con sal, 1 min menos del tiempo del paquete', minutes: 15, activeMin: 5, order: 4, tip: 'Mézclala con unas gotas de aceite para que no se pegue.' },
  quinoa_cocida: { method: 'Enjuaga y cocina 1 taza por 2 de agua, 15 min', minutes: 20, activeMin: 5, order: 4, tip: '' },
  papa_cocida: { method: 'Hervida en cubos 12–15 min u horneada 35 min a 200 °C', minutes: 30, activeMin: 5, order: 3, tip: '' },
  camote_horneado: { method: 'Horno a 200 °C, 40–45 min (o en cubos 25 min)', minutes: 40, activeMin: 5, order: 2, tip: 'Hornéalo junto con el pollo para ahorrar tiempo.' },
  pollo_pechuga_cocida: { method: 'Horno a 200 °C, 20–25 min (temperatura interna 74 °C), o a la plancha', minutes: 30, activeMin: 10, order: 2, tip: 'Sazona por partes con distintos condimentos (limón-pimienta, adobo, fajita) para no aburrirte.' },
  pollo_muslo_cocido: { method: 'Horno a 200 °C, 30–35 min (74 °C internos)', minutes: 35, activeMin: 10, order: 2, tip: '' },
  pavo_pechuga_cocida: { method: 'Horno a 190 °C, 25–30 min (74 °C internos)', minutes: 30, activeMin: 10, order: 2, tip: '' },
  res_molida_90_cocida: { method: 'Sartén a fuego medio-alto 10–12 min; escurre la grasa', minutes: 15, activeMin: 12, order: 4, tip: 'Prepárala como picadillo o con salsa para que no se seque al recalentar.' },
  res_bistec_magro_cocido: { method: 'Plancha muy caliente 3–4 min por lado', minutes: 15, activeMin: 15, order: 5, tip: 'Mejor córtalo en tiras después de cocinar.' },
  cerdo_lomo_cocido: { method: 'Horno a 200 °C, 25–30 min (63 °C internos + 3 min de reposo)', minutes: 35, activeMin: 10, order: 2, tip: '' },
  tilapia_cocida: { method: 'Horno a 200 °C, 12–15 min', minutes: 15, activeMin: 5, order: 5, tip: 'El pescado aguanta menos: prepáralo para 2 días como máximo.' },
  salmon_cocido: { method: 'Horno a 200 °C, 12–15 min', minutes: 15, activeMin: 5, order: 5, tip: 'Prepáralo para 2 días como máximo.' },
  camaron_cocido: { method: 'Sartén 3–4 min hasta que estén rosados', minutes: 6, activeMin: 6, order: 6, tip: 'Prepáralo para 2 días como máximo.' },
  brocoli_cocido: { method: 'Al vapor 4–5 min (que quede firme)', minutes: 8, activeMin: 3, order: 6, tip: 'Quedará más suave al recalentar: cocínalo poco.' },
  calabacita_cocida: { method: 'Salteada o al vapor 5 min', minutes: 8, activeMin: 5, order: 6, tip: '' },
  ejote_cocido: { method: 'Al vapor 6–7 min', minutes: 8, activeMin: 3, order: 6, tip: '' },
  chayote_cocido: { method: 'Hervido en cubos 12–15 min', minutes: 15, activeMin: 3, order: 5, tip: '' },
  nopal_cocido: { method: 'Asados en plancha o hervidos con sal 10 min y enjuagados', minutes: 12, activeMin: 5, order: 5, tip: '' },
  elote_cocido: { method: 'Hervido 10–15 min (o desgranado de lata)', minutes: 15, activeMin: 2, order: 5, tip: '' },
  chicharo_cocido: { method: 'Hervido 5 min', minutes: 6, activeMin: 2, order: 6, tip: '' },
  huevo_entero: { method: 'Huevos cocidos: 10–11 min en agua hirviendo y luego agua fría', minutes: 15, activeMin: 2, order: 5, tip: 'Solo si tu plan los usa cocidos; revueltos, mejor al momento.' },
};

/** Pescado y mariscos: máximo 2 días en refrigeración para mejor calidad. */
const SHORT_LIFE = new Set(['tilapia_cocida', 'salmon_cocido', 'camaron_cocido']);

export interface PrepBatch {
  foodId: string;
  name: string;
  cookedGrams: number;
  buyName: string;
  rawGrams: number | null; // null si se cocina el mismo peso (aprox.)
  info: CookInfo;
  shortLife: boolean;
}

export interface PrepContainer {
  dayIndex: number;
  dayNumber: number; // 1..n en la ventana de preparación
  slot: string;
  title: string;
  cooked: { name: string; grams: number }[];
  fresh: { name: string; grams: number }[];
  freeze: boolean;
}

export interface MealPrepPlan {
  days: number[];
  batches: PrepBatch[];
  containers: PrepContainer[];
  totalMinutes: number; // estimado en paralelo
  activeMinutes: number;
  steps: string[];
  warnings: string[];
}

/**
 * @param days índices de días del plan a preparar (en orden de consumo).
 */
export function buildMealPrep(plan: MealPlan, foods: Food[], days: number[]): MealPrepPlan {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const acc = new Map<string, number>();
  const containers: PrepContainer[] = [];
  const order = days.filter((d) => plan.days.some((x) => x.index === d));
  order.forEach((di, n) => {
    const day = plan.days.find((x) => x.index === di)!;
    for (const m of day.meals) {
      const cooked: PrepContainer['cooked'] = [];
      const fresh: PrepContainer['fresh'] = [];
      for (const it of m.items) {
        const name = byId.get(it.foodId)?.name ?? it.name;
        if (COOK[it.foodId] && it.foodId !== 'huevo_entero') {
          acc.set(it.foodId, (acc.get(it.foodId) ?? 0) + it.grams);
          cooked.push({ name, grams: Math.round(it.grams) });
        } else fresh.push({ name, grams: Math.round(it.grams) });
      }
      if (cooked.length) containers.push({ dayIndex: di, dayNumber: n + 1, slot: m.slot, title: `Día ${n + 1} · ${MEAL_LABEL[m.slot]}`, cooked, fresh, freeze: n + 1 > 4 || (n + 1 > 2 && m.items.some((i) => SHORT_LIFE.has(i.foodId))) });
    }
  });
  const batches: PrepBatch[] = [...acc.entries()]
    .map(([foodId, g]) => {
      const conv = COOKED_TO_RAW[foodId];
      return { foodId, name: byId.get(foodId)?.name ?? foodId, cookedGrams: Math.round(g), buyName: conv?.buyName ?? byId.get(foodId)?.name ?? foodId, rawGrams: conv ? Math.round(g * conv.factor) : null, info: COOK[foodId], shortLife: SHORT_LIFE.has(foodId) };
    })
    .sort((a, b) => a.info.order - b.info.order || b.info.minutes - a.info.minutes);

  // Tiempo: los pasivos largos corren en paralelo; los activos se suman.
  const activeMinutes = batches.reduce((a, b) => a + b.info.activeMin, 0) + Math.ceil(containers.length * 1.5);
  const longest = batches.reduce((a, b) => Math.max(a, b.info.minutes), 0);
  const totalMinutes = Math.max(longest + 10, activeMinutes);

  const steps: string[] = [];
  const legumes = batches.filter((b) => b.info.order === 1);
  if (legumes.length) steps.push(`La noche anterior: remoja ${legumes.map((b) => `${formatGrams(b.rawGrams ?? b.cookedGrams)} de ${b.buyName.toLowerCase()}`).join(' y ')} en agua.`);
  batches.forEach((b) => steps.push(`${b.name}: ${b.rawGrams ? `${formatGrams(b.rawGrams)} en crudo/seco → ` : ''}${formatGrams(b.cookedGrams)} cocido. ${b.info.method}.${b.info.tip ? ' ' + b.info.tip : ''}`));
  steps.push('Deja enfriar todo destapado máximo 2 horas a temperatura ambiente antes de refrigerar.');
  steps.push(`Reparte en ${containers.length} recipientes con báscula (lista de abajo). Lo fresco (tortillas, fruta, lácteos, aguacate, verduras crudas) se agrega al momento.`);

  const warnings: string[] = [];
  if (order.length > 4) warnings.push(`Preparas ${order.length} días: congela los recipientes del día 5 en adelante (los cocidos duran 3–4 días en refrigeración).`);
  if (batches.some((b) => b.shortLife) && order.length > 2) warnings.push('El pescado y los mariscos cocidos conviene comerlos en los primeros 2 días o congelarlos.');
  return { days: order, batches, containers, totalMinutes, activeMinutes, steps, warnings };
}

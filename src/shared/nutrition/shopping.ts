// Lista del supermercado a partir del plan de comidas.
//
// El plan expresa los alimentos tal como se comen (muchos cocinados), pero se compran crudos o secos.
// Los factores crudo/cocido se calcularon con USDA FoodData Central SR Legacy comparando la proteína por
// 100 g del registro cocido y del crudo (la proteína se conserva casi por completo al cocinar, el agua no):
//   g crudos = g cocidos × (proteína cocido / proteína crudo).
// Para verduras y tubérculos el cambio de peso es pequeño y se usa 1:1 (aproximado).
import type { Food, FoodCategory } from '../types';
import type { MealPlan } from './mealPlanner';

export interface CookedToRaw {
  buyId: string; // id del alimento que se compra (para agrupar)
  buyName: string;
  factor: number; // g a comprar por g cocido
  fdc: [cooked: number, raw: number];
}

export const COOKED_TO_RAW: Record<string, CookedToRaw> = {
  pollo_pechuga_cocida: { buyId: 'pollo_pechuga_cruda', buyName: 'Pechuga de pollo sin piel', factor: 1.38, fdc: [171477, 171077] },
  pollo_muslo_cocido: { buyId: 'pollo_muslo_crudo', buyName: 'Muslo de pollo sin piel', factor: 1.26, fdc: [172388, 173627] },
  res_molida_90_cocida: { buyId: 'res_molida_90_cruda', buyName: 'Carne molida de res 90/10', factor: 1.42, fdc: [171794, 174030] },
  res_bistec_magro_cocido: { buyId: 'res_bistec_crudo', buyName: 'Bistec de res magro (sirloin)', factor: 1.33, fdc: [174054, 174055] },
  cerdo_lomo_cocido: { buyId: 'cerdo_lomo_crudo', buyName: 'Lomo de cerdo', factor: 1.25, fdc: [168250, 168249] },
  pavo_pechuga_cocida: { buyId: 'pavo_pechuga_cruda', buyName: 'Pechuga de pavo', factor: 1.27, fdc: [171496, 171098] },
  tilapia_cocida: { buyId: 'tilapia_cruda', buyName: 'Filete de tilapia/mojarra', factor: 1.3, fdc: [175177, 175176] },
  salmon_cocido: { buyId: 'salmon_crudo', buyName: 'Salmón', factor: 1.08, fdc: [175168, 175167] },
  camaron_cocido: { buyId: 'camaron_crudo', buyName: 'Camarón limpio', factor: 1.19, fdc: [175180, 175179] },
  frijol_negro_cocido: { buyId: 'frijol_negro_seco', buyName: 'Frijol negro (seco)', factor: 0.41, fdc: [173735, 173734] },
  frijol_pinto_cocido: { buyId: 'frijol_pinto_seco', buyName: 'Frijol pinto (seco)', factor: 0.42, fdc: [175200, 175199] },
  lenteja_cocida: { buyId: 'lenteja_seca', buyName: 'Lentejas (secas)', factor: 0.37, fdc: [172421, 172420] },
  garbanzo_cocido: { buyId: 'garbanzo_seco', buyName: 'Garbanzos (secos)', factor: 0.43, fdc: [173757, 173756] },
  arroz_blanco_cocido: { buyId: 'arroz_blanco_crudo', buyName: 'Arroz blanco', factor: 0.38, fdc: [168878, 168877] },
  arroz_integral_cocido: { buyId: 'arroz_integral_crudo', buyName: 'Arroz integral', factor: 0.36, fdc: [169704, 169703] },
  pasta_cocida: { buyId: 'pasta_seca', buyName: 'Pasta (seca)', factor: 0.45, fdc: [169737, 169736] },
  quinoa_cocida: { buyId: 'quinoa_cruda', buyName: 'Quinoa', factor: 0.31, fdc: [168917, 168874] },
};

export type Section = 'Frutas y verduras' | 'Carnes, pescados y mariscos' | 'Huevo y lácteos' | 'Tortillería y panadería' | 'Abarrotes y granos' | 'Suplementos' | 'Otros';

export const SECTION_ORDER: Section[] = ['Frutas y verduras', 'Carnes, pescados y mariscos', 'Huevo y lácteos', 'Tortillería y panadería', 'Abarrotes y granos', 'Suplementos', 'Otros'];

export function sectionFor(f: Pick<Food, 'id' | 'category'>): Section {
  if (['huevo_entero', 'clara_huevo', 'mantequilla'].includes(f.id)) return 'Huevo y lácteos';
  if (['tortilla_maiz', 'pan_integral', 'pan_blanco'].includes(f.id)) return 'Tortillería y panadería';
  if (f.id === 'proteina_whey') return 'Suplementos';
  if (f.id === 'aguacate') return 'Frutas y verduras';
  if (f.id === 'tofu_firme') return 'Huevo y lácteos';
  const map: Record<FoodCategory, Section> = {
    proteina: 'Carnes, pescados y mariscos',
    lacteo: 'Huevo y lácteos',
    leguminosa: 'Abarrotes y granos',
    cereal: 'Abarrotes y granos',
    tuberculo: 'Frutas y verduras',
    fruta: 'Frutas y verduras',
    verdura: 'Frutas y verduras',
    grasa: 'Abarrotes y granos',
    otro: 'Otros',
  };
  return map[f.category] ?? 'Otros';
}

export interface ShoppingItem {
  key: string;
  name: string;
  section: Section;
  grams: number; // cantidad a comprar (cruda/seca)
  qty: string; // texto legible: "1.2 kg", "12 piezas"
  detail?: string;
  checked: boolean;
  custom?: boolean;
}

export interface ShoppingList {
  createdAt: string;
  planCreatedAt: string | null;
  days: number[]; // índices de días del plan incluidos
  repeat: number;
  items: ShoppingItem[];
}

const ceilTo = (v: number, step: number) => Math.ceil(v / step) * step;

export function formatGrams(g: number): string {
  if (g >= 1000) return `${(ceilTo(g, 100) / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} kg`;
  return `${ceilTo(g, g < 100 ? 10 : 50)} g`;
}

/** Texto de cantidad práctico para comprar. */
export function purchaseQty(key: string, grams: number, food?: Food): { qty: string; detail?: string } {
  if (key === 'huevo_entero') {
    const n = Math.ceil(grams / 50);
    return { qty: `${n} piezas`, detail: n >= 12 ? `≈ ${Math.ceil(n / 12)} docena${n > 12 ? 's' : ''}` : undefined };
  }
  if (key === 'tortilla_maiz') {
    return { qty: formatGrams(grams), detail: `≈ ${Math.ceil(grams / 30)} tortillas` };
  }
  if (key === 'atun_agua') {
    // Lata típica: ~140 g con líquido, ~100 g drenado (verifica en la etiqueta)
    const n = Math.ceil(grams / 100);
    return { qty: `${n} lata${n > 1 ? 's' : ''}`, detail: '≈ 100 g drenado por lata; revisa la etiqueta' };
  }
  if (key === 'leche_descremada' || key === 'leche_entera') {
    const l = grams / 1030;
    return { qty: `${Math.max(1, Math.ceil(l))} L`, detail: `${Math.round(l * 10) / 10} L en el plan` };
  }
  if (key === 'aceite_oliva' || key === 'aceite_vegetal') return { qty: `${ceilTo(grams / 0.92, 10)} ml`, detail: 'probablemente ya lo tienes' };
  if (food?.unit_grams && food.unit_name && /pieza/.test(food.unit_name)) {
    const n = Math.ceil(grams / food.unit_grams);
    return { qty: `${n} pieza${n > 1 ? 's' : ''}`, detail: formatGrams(grams) };
  }
  return { qty: formatGrams(grams) };
}

/**
 * Suma los alimentos de los días elegidos del plan, convierte cocidos a crudos/secos,
 * agrupa las claras con los huevos y redondea a cantidades de compra.
 */
export function buildShoppingList(plan: MealPlan, foods: Food[], days: number[], repeat = 1): ShoppingList {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const acc = new Map<string, { name: string; section: Section; grams: number; notes: Set<string> }>();
  const add = (key: string, name: string, section: Section, g: number, note?: string) => {
    const cur = acc.get(key) ?? { name, section, grams: 0, notes: new Set<string>() };
    cur.grams += g;
    if (note) cur.notes.add(note);
    acc.set(key, cur);
  };
  for (const d of plan.days.filter((x) => days.includes(x.index))) {
    for (const m of d.meals)
      for (const it of m.items) {
        const g = it.grams * repeat;
        const f = byId.get(it.foodId);
        const conv = COOKED_TO_RAW[it.foodId];
        if (conv) {
          const sec = f ? sectionFor(f) : 'Otros';
          add(conv.buyId, conv.buyName, sec, g * conv.factor, 'crudo/seco');
        } else if (it.foodId === 'clara_huevo') {
          // 1 clara ≈ 33 g → se compran huevos enteros
          add('huevo_entero', 'Huevo', 'Huevo y lácteos', (g / 33) * 50, 'incluye huevos para las claras');
        } else if (it.foodId === 'pollo_pechuga_cruda') add('pollo_pechuga_cruda', 'Pechuga de pollo sin piel', 'Carnes, pescados y mariscos', g, 'crudo/seco');
        else if (it.foodId === 'res_molida_90_cruda') add('res_molida_90_cruda', 'Carne molida de res 90/10', 'Carnes, pescados y mariscos', g, 'crudo/seco');
        else if (it.foodId === 'arroz_blanco_crudo') add('arroz_blanco_crudo', 'Arroz blanco', 'Abarrotes y granos', g, 'crudo/seco');
        else if (it.foodId === 'huevo_entero') add('huevo_entero', 'Huevo', 'Huevo y lácteos', g);
        else add(it.foodId, f ? cleanName(f.name) : it.name, f ? sectionFor(f) : 'Otros', g);
      }
  }
  const items: ShoppingItem[] = [...acc.entries()].map(([key, v]) => {
    const { qty, detail } = purchaseQty(key, v.grams, byId.get(key));
    const notes = [...v.notes].filter((n) => n !== 'crudo/seco');
    return {
      key,
      name: v.name,
      section: v.section,
      grams: Math.round(v.grams),
      qty,
      detail: [detail, ...notes, v.notes.has('crudo/seco') ? 'peso en crudo/seco' : undefined].filter(Boolean).join(' · ') || undefined,
      checked: false,
    };
  });
  items.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.name.localeCompare(b.name, 'es'));
  return { createdAt: new Date().toISOString(), planCreatedAt: plan.createdAt, days, repeat, items };
}

/** Quita detalles de preparación del nombre para la lista (", cocido", ", crudo"…). */
function cleanName(name: string): string {
  return name
    .replace(/,\s*(crud[oa]s?|cocid[oa]s?|asad[oa]s?|hervid[oa]s?[^,]*|horneado|drenad[oa]s?|sin grasa|\(sin grasa\))/gi, '')
    .replace(/\s*—.*$/, '')
    .trim();
}

/** Texto plano para compartir (WhatsApp, Notas…). */
export function shoppingListText(list: ShoppingList): string {
  const lines: string[] = ['Lista del súper — BODY OS', ''];
  for (const s of SECTION_ORDER) {
    const its = list.items.filter((i) => i.section === s);
    if (!its.length) continue;
    lines.push(`${s}:`);
    for (const i of its) lines.push(`${i.checked ? '☑' : '☐'} ${i.name} — ${i.qty}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

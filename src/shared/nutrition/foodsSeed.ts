// Base de datos nutricional inicial (valores por 100 g de porción comestible).
//
// FUENTE: valores de referencia transcritos y redondeados de USDA FoodData Central (conjunto "SR Legacy"),
// eligiendo la forma de preparación indicada en el nombre (crudo/cocido). No son valores de etiqueta de
// marcas mexicanas: las marcas, variedades y métodos de cocción cambian los valores reales.
// Todos los alimentos son editables y se marcan como "por verificar" hasta que el usuario los confirme
// con la etiqueta o con su fuente preferida (p. ej., el Sistema Mexicano de Alimentos Equivalentes).
//
// Se omiten deliberadamente productos cuyo valor depende mucho de la marca (queso panela, jamón,
// tortilla de harina, tostadas, etc.): agrégalos como alimentos personalizados desde su etiqueta.
import type { Food, FoodCategory } from '../types';

export const SEED_SOURCE = 'USDA FoodData Central (SR Legacy), valores de referencia redondeados';

type Row = [string, string, FoodCategory, number, number, number, number, number, string | null, number | null, string[]];

// id, nombre, categoría, kcal, proteína, carbohidratos, grasa, fibra, unidad, gramos por unidad, etiquetas
const ROWS: Row[] = [
  // Proteínas animales
  ['pollo_pechuga_cruda', 'Pechuga de pollo sin piel, cruda', 'proteina', 120, 22.5, 0, 2.6, 0, null, null, ['economico', 'pollo']],
  ['pollo_pechuga_cocida', 'Pechuga de pollo sin piel, asada/cocida', 'proteina', 165, 31.0, 0, 3.6, 0, null, null, ['economico', 'pollo']],
  ['pollo_muslo_cocido', 'Muslo de pollo sin piel, cocido', 'proteina', 209, 25.9, 0, 10.9, 0, null, null, ['economico', 'pollo']],
  ['res_molida_90_cruda', 'Carne molida de res 90/10, cruda', 'proteina', 176, 20.0, 0, 10.0, 0, null, null, ['res']],
  ['res_molida_90_cocida', 'Carne molida de res 90/10, cocida', 'proteina', 217, 26.1, 0, 11.7, 0, null, null, ['res']],
  ['res_bistec_magro_cocido', 'Bistec de res magro (sirloin), asado', 'proteina', 185, 29.0, 0, 7.0, 0, null, null, ['res']],
  ['cerdo_lomo_cocido', 'Lomo de cerdo magro, asado', 'proteina', 143, 26.2, 0, 3.5, 0, null, null, ['cerdo']],
  ['pavo_pechuga_cocida', 'Pechuga de pavo sin piel, asada', 'proteina', 147, 30.1, 0, 2.1, 0, null, null, []],
  ['atun_agua', 'Atún en agua, drenado', 'proteina', 116, 25.5, 0, 0.8, 0, 'lata drenada', 100, ['economico', 'pescado']],
  ['sardina_aceite', 'Sardinas en aceite, drenadas', 'proteina', 208, 24.6, 0, 11.5, 0, null, null, ['economico', 'pescado']],
  ['tilapia_cocida', 'Tilapia/mojarra, cocida', 'proteina', 128, 26.2, 0, 2.7, 0, null, null, ['pescado']],
  ['salmon_cocido', 'Salmón del Atlántico (cultivo), cocido', 'proteina', 206, 22.1, 0, 12.4, 0, null, null, ['pescado']],
  ['camaron_cocido', 'Camarón, cocido', 'proteina', 99, 24.0, 0.2, 0.3, 0, null, null, ['mariscos']],
  ['huevo_entero', 'Huevo entero', 'proteina', 143, 12.6, 0.7, 9.5, 0, 'pieza', 50, ['economico', 'huevo']],
  ['clara_huevo', 'Clara de huevo', 'proteina', 52, 10.9, 0.7, 0.2, 0, 'clara', 33, ['economico', 'huevo']],
  ['tofu_firme', 'Tofu firme', 'proteina', 144, 17.3, 2.8, 8.7, 2.3, null, null, ['soya']],
  ['proteina_whey', 'Proteína de suero (whey) en polvo — GENÉRICA, usa tu etiqueta', 'proteina', 400, 80, 8, 6, 0, 'scoop', 30, ['lacteos']],
  // Lácteos
  ['yogur_griego_0', 'Yogur griego natural sin grasa', 'lacteo', 59, 10.2, 3.6, 0.4, 0, null, null, ['lacteos']],
  ['leche_descremada', 'Leche descremada', 'lacteo', 34, 3.4, 5.0, 0.1, 0, 'taza', 245, ['lacteos']],
  ['leche_entera', 'Leche entera', 'lacteo', 61, 3.2, 4.8, 3.3, 0, 'taza', 244, ['lacteos']],
  ['cottage_2', 'Queso cottage 2 %', 'lacteo', 81, 10.5, 4.8, 2.3, 0, null, null, ['lacteos']],
  ['queso_fresco', 'Queso fresco', 'lacteo', 299, 18.1, 3.0, 23.8, 0, null, null, ['lacteos']],
  ['ricotta_semi', 'Ricotta / requesón semidescremado', 'lacteo', 138, 11.4, 5.1, 7.9, 0, null, null, ['lacteos']],
  // Leguminosas
  ['frijol_negro_cocido', 'Frijol negro, cocido (sin grasa)', 'leguminosa', 132, 8.9, 23.7, 0.5, 8.7, 'taza', 172, ['economico']],
  ['frijol_pinto_cocido', 'Frijol pinto, cocido (sin grasa)', 'leguminosa', 143, 9.0, 26.2, 0.7, 9.0, 'taza', 171, ['economico']],
  ['lenteja_cocida', 'Lentejas, cocidas', 'leguminosa', 116, 9.0, 20.1, 0.4, 7.9, 'taza', 198, ['economico']],
  ['garbanzo_cocido', 'Garbanzos, cocidos', 'leguminosa', 164, 8.9, 27.4, 2.6, 7.6, 'taza', 164, ['economico']],
  ['chicharo_cocido', 'Chícharos, cocidos', 'leguminosa', 84, 5.4, 15.6, 0.2, 5.5, null, null, []],
  // Cereales
  ['tortilla_maiz', 'Tortilla de maíz', 'cereal', 218, 5.7, 44.6, 2.9, 6.3, 'pieza', 30, ['economico']],
  ['arroz_blanco_cocido', 'Arroz blanco, cocido', 'cereal', 130, 2.7, 28.2, 0.3, 0.4, 'taza', 158, ['economico']],
  ['arroz_blanco_crudo', 'Arroz blanco, crudo', 'cereal', 365, 7.1, 80.0, 0.7, 1.3, null, null, ['economico']],
  ['arroz_integral_cocido', 'Arroz integral, cocido', 'cereal', 123, 2.7, 25.6, 1.0, 1.6, 'taza', 195, []],
  ['avena', 'Avena en hojuelas, cruda', 'cereal', 379, 13.2, 67.7, 6.5, 10.1, 'taza', 81, ['economico', 'gluten_trazas']],
  ['pan_integral', 'Pan de trigo integral', 'cereal', 252, 12.5, 42.7, 3.5, 6.0, 'rebanada', 32, ['gluten']],
  ['pan_blanco', 'Pan blanco de caja', 'cereal', 266, 7.6, 50.6, 3.3, 2.4, 'rebanada', 25, ['gluten']],
  ['pasta_cocida', 'Pasta de trigo, cocida', 'cereal', 158, 5.8, 30.9, 0.9, 1.8, 'taza', 140, ['gluten']],
  ['quinoa_cocida', 'Quinoa, cocida', 'cereal', 120, 4.4, 21.3, 1.9, 2.8, 'taza', 185, []],
  ['elote_cocido', 'Elote amarillo, cocido', 'cereal', 96, 3.4, 21.0, 1.5, 2.4, null, null, ['economico']],
  // Tubérculos
  ['papa_cocida', 'Papa, hervida sin cáscara', 'tuberculo', 86, 1.7, 20.0, 0.1, 1.8, null, null, ['economico']],
  ['camote_horneado', 'Camote, horneado', 'tuberculo', 90, 2.0, 20.7, 0.2, 3.3, null, null, ['economico']],
  // Frutas
  ['platano', 'Plátano', 'fruta', 89, 1.1, 22.8, 0.3, 2.6, 'pieza mediana', 118, ['economico']],
  ['manzana', 'Manzana con cáscara', 'fruta', 52, 0.3, 13.8, 0.2, 2.4, 'pieza mediana', 182, []],
  ['papaya', 'Papaya', 'fruta', 43, 0.5, 10.8, 0.3, 1.7, 'taza', 145, ['economico']],
  ['naranja', 'Naranja', 'fruta', 47, 0.9, 11.8, 0.1, 2.4, 'pieza', 131, ['economico']],
  ['fresa', 'Fresa', 'fruta', 32, 0.7, 7.7, 0.3, 2.0, 'taza', 152, []],
  ['mango', 'Mango', 'fruta', 60, 0.8, 15.0, 0.4, 1.6, 'taza', 165, []],
  ['sandia', 'Sandía', 'fruta', 30, 0.6, 7.6, 0.2, 0.4, 'taza', 152, []],
  ['pina', 'Piña', 'fruta', 50, 0.5, 13.1, 0.1, 1.4, 'taza', 165, []],
  ['melon', 'Melón', 'fruta', 34, 0.8, 8.2, 0.2, 0.9, 'taza', 160, []],
  ['guayaba', 'Guayaba', 'fruta', 68, 2.6, 14.3, 1.0, 5.4, 'pieza', 55, ['economico']],
  ['uva', 'Uvas', 'fruta', 69, 0.7, 18.1, 0.2, 0.9, 'taza', 151, []],
  ['pera', 'Pera', 'fruta', 57, 0.4, 15.2, 0.1, 3.1, 'pieza', 178, []],
  ['kiwi', 'Kiwi', 'fruta', 61, 1.1, 14.7, 0.5, 3.0, 'pieza', 69, []],
  // Verduras
  ['brocoli_cocido', 'Brócoli, cocido', 'verdura', 35, 2.4, 7.2, 0.4, 3.3, 'taza', 156, []],
  ['calabacita_cocida', 'Calabacita, cocida', 'verdura', 15, 1.1, 2.7, 0.4, 1.0, 'taza', 180, ['economico']],
  ['nopal_cocido', 'Nopales, cocidos', 'verdura', 15, 1.4, 3.3, 0.1, 2.0, 'taza', 149, ['economico']],
  ['jitomate', 'Jitomate', 'verdura', 18, 0.9, 3.9, 0.2, 1.2, 'pieza', 123, ['economico']],
  ['lechuga_romana', 'Lechuga romana', 'verdura', 17, 1.2, 3.3, 0.3, 2.1, 'taza', 47, ['economico']],
  ['espinaca', 'Espinaca cruda', 'verdura', 23, 2.9, 3.6, 0.4, 2.2, 'taza', 30, []],
  ['zanahoria', 'Zanahoria cruda', 'verdura', 41, 0.9, 9.6, 0.2, 2.8, 'pieza', 61, ['economico']],
  ['cebolla', 'Cebolla', 'verdura', 40, 1.1, 9.3, 0.1, 1.7, null, null, ['economico']],
  ['pepino', 'Pepino con cáscara', 'verdura', 15, 0.7, 3.6, 0.1, 0.5, 'pieza', 300, ['economico']],
  ['chayote_cocido', 'Chayote, cocido', 'verdura', 24, 0.6, 5.1, 0.5, 2.8, null, null, ['economico']],
  ['ejote_cocido', 'Ejotes, cocidos', 'verdura', 35, 1.9, 7.9, 0.3, 3.2, 'taza', 125, []],
  ['champinon', 'Champiñones crudos', 'verdura', 22, 3.1, 3.3, 0.3, 1.0, 'taza', 70, []],
  ['pimiento_rojo', 'Pimiento morrón rojo', 'verdura', 31, 1.0, 6.0, 0.3, 2.1, 'pieza', 119, []],
  ['jicama', 'Jícama', 'verdura', 38, 0.7, 8.8, 0.1, 4.9, 'taza', 130, ['economico']],
  // Grasas
  ['aguacate', 'Aguacate Hass', 'grasa', 167, 2.0, 8.6, 15.4, 6.8, 'pieza (sin hueso ni cáscara)', 136, []],
  ['aceite_oliva', 'Aceite de oliva', 'grasa', 884, 0, 0, 100, 0, 'cucharada', 13.5, []],
  ['aceite_vegetal', 'Aceite vegetal (canola)', 'grasa', 884, 0, 0, 100, 0, 'cucharada', 14, ['economico']],
  ['cacahuate', 'Cacahuate tostado sin sal', 'grasa', 585, 23.7, 21.5, 49.7, 8.0, null, null, ['cacahuate', 'economico']],
  ['crema_cacahuate', 'Crema de cacahuate natural', 'grasa', 588, 25.1, 20.0, 50.4, 6.0, 'cucharada', 16, ['cacahuate']],
  ['almendra', 'Almendras', 'grasa', 579, 21.2, 21.6, 49.9, 12.5, null, null, ['frutos_secos']],
  ['nuez', 'Nuez de Castilla', 'grasa', 654, 15.2, 13.7, 65.2, 6.7, null, null, ['frutos_secos']],
  ['pepita', 'Pepitas de calabaza, secas', 'grasa', 559, 30.2, 10.7, 49.1, 6.0, null, null, []],
  ['chia', 'Semillas de chía', 'grasa', 486, 16.5, 42.1, 30.7, 34.4, 'cucharada', 12, []],
  ['mantequilla', 'Mantequilla', 'grasa', 717, 0.9, 0.1, 81.1, 0, 'cucharadita', 5, ['lacteos']],
  // Otros
  ['miel', 'Miel de abeja', 'otro', 304, 0.3, 82.4, 0, 0.2, 'cucharada', 21, []],
  ['azucar', 'Azúcar', 'otro', 387, 0, 100, 0, 0, 'cucharadita', 4, []],
];

export function seedFoods(): Food[] {
  return ROWS.map(([id, name, category, kcal, protein, carbs, fat, fiber, unit_name, unit_grams, tags]) => ({
    id,
    name,
    category,
    kcal,
    protein,
    carbs,
    fat,
    fiber,
    unit_name,
    unit_grams,
    source: SEED_SOURCE,
    verified: 0,
    custom: 0,
    barcode: null,
    tags: JSON.stringify(tags),
    price_per_kg: null,
  }));
}

/** Etiquetas de alérgenos/restricciones utilizadas por el filtro de alimentos. */
export const ALLERGEN_TAGS: { key: string; label: string }[] = [
  { key: 'lacteos', label: 'Lácteos / lactosa' },
  { key: 'gluten', label: 'Gluten' },
  { key: 'huevo', label: 'Huevo' },
  { key: 'pescado', label: 'Pescado' },
  { key: 'mariscos', label: 'Mariscos' },
  { key: 'cacahuate', label: 'Cacahuate' },
  { key: 'frutos_secos', label: 'Frutos secos' },
  { key: 'soya', label: 'Soya' },
  { key: 'cerdo', label: 'Cerdo' },
  { key: 'res', label: 'Res' },
];

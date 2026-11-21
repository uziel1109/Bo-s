// Productos de marca agregados a petición del usuario. Se guardan aparte de la base USDA porque sus valores
// vienen de la etiqueta del fabricante (no de USDA) y cambian entre sabores o presentaciones.
// Se marcan como "sin verificar": confírmalos con la etiqueta de tu envase y edítalos si difieren.
import type { Food } from '../types';

export const BRAND_FOODS: Food[] = [
  {
    id: 'xgear_zero_carbs',
    name: 'Proteína X-Gear Zero Carbs (aislado, sabor chocolate)',
    category: 'proteina',
    // Porción de 40 g (4 medidas): 150 kcal, 34 g proteína, < 1 g grasa, 0 g carbohidratos → por 100 g:
    kcal: 375,
    protein: 85,
    carbs: 0,
    fat: 2.5,
    fiber: 0,
    unit_name: 'medida',
    unit_grams: 10,
    source: 'Etiqueta X-Gear Zero Carbs sabor chocolate (40 g = 150 kcal, 34 g proteína, <1 g grasa, 0 g carbohidratos; vainilla: 153 kcal y 34 g). Datos publicados por terceros: confírmalos con tu envase.',
    verified: 0,
    custom: 0,
    barcode: null,
    tags: JSON.stringify(['lacteos', 'soya']),
    price_per_kg: null,
  },
];

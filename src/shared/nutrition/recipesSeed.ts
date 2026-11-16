// Recetas mexicanas "fit" incluidas de inicio. Los ingredientes usan los alimentos verificados de la base
// (USDA FoodData Central), así que los macros por porción se calculan con los mismos datos que el resto de la app.
// Cantidades en gramos tal como se comen (cocidos cuando el alimento es "cocido").
// Son editables y se pueden borrar: se insertan una sola vez por versión.

export interface SeedRecipe {
  id: string;
  name: string;
  servings: number;
  items: { foodId: string; grams: number }[];
  notes: string;
}

export const SEED_RECIPES_VERSION = 1;

const r = (id: string, name: string, servings: number, items: [string, number][], steps: string[]): SeedRecipe => ({
  id: `rec_seed_${id}`,
  name,
  servings,
  items: items.map(([foodId, grams]) => ({ foodId, grams })),
  notes: steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
});

export const SEED_RECIPES: SeedRecipe[] = [
  r('chilaquiles', 'Chilaquiles horneados con pollo', 2, [['tostada_maiz', 60], ['salsa_verde', 250], ['pollo_pechuga_cocida', 200], ['queso_fresco', 40], ['crema', 30], ['cebolla', 40]], [
    'Usa tostadas horneadas en lugar de totopos fritos (o hornea tortillas en triángulos a 200 °C, 10–12 min).',
    'Calienta la salsa verde y agrega el pollo deshebrado.',
    'Baña las tostadas justo antes de servir para que no se aguaden.',
    'Termina con cebolla, queso fresco desmoronado y crema.',
  ]),
  r('tinga', 'Tinga de pollo en tostadas', 3, [['pollo_pechuga_cocida', 360], ['jitomate', 300], ['cebolla', 120], ['salsa_roja', 60], ['aceite_vegetal', 10], ['tostada_maiz', 72], ['lechuga_romana', 90], ['crema', 45]], [
    'Acitrona la cebolla en rodajas con el aceite.',
    'Licúa el jitomate con chipotle al gusto (o salsa roja) y agrégalo; cocina 5 min.',
    'Incorpora el pollo deshebrado y deja reducir.',
    'Sirve 2 tostadas por porción con lechuga y una cucharada de crema.',
  ]),
  r('enchiladas_suizas', 'Enchiladas suizas ligeras', 2, [['tortilla_maiz', 180], ['pollo_pechuga_cocida', 200], ['salsa_verde', 300], ['yogur_griego_0', 100], ['queso_mozzarella', 50]], [
    'Licúa la salsa verde con el yogur griego (sustituye a la crema).',
    'Calienta las tortillas en comal (sin freír), rellena con pollo y enrolla.',
    'Cubre con la salsa y el queso; gratina 8–10 min a 200 °C.',
  ]),
  r('pozole', 'Pozole rojo de pollo', 4, [['pollo_pechuga_cocida', 480], ['elote_cocido', 400], ['salsa_roja', 80], ['cebolla', 60], ['lechuga_romana', 120], ['limon', 40], ['tostada_maiz', 48], ['ajo', 6]], [
    'Cuece el pollo con ajo y cebolla; reserva el caldo y deshebra.',
    'Agrega al caldo el maíz pozolero escurrido y la salsa de chile guajillo (o salsa roja); hierve 15 min.',
    'Sirve con lechuga, cebolla, limón y una tostada.',
    'Nota: el maíz pozolero se calcula con "elote cocido", el dato verificado más cercano disponible.',
  ]),
  r('ceviche', 'Ceviche de pescado con tostadas', 3, [['tilapia_cocida', 450], ['jitomate', 200], ['cebolla', 100], ['pepino', 150], ['cilantro', 15], ['limon', 120], ['aguacate', 100], ['tostada_maiz', 72]], [
    'Corta el pescado en cubos y cúbrelo con jugo de limón 20–30 min en refrigeración hasta que se vea blanco.',
    'Escurre y mezcla con jitomate, cebolla, pepino y cilantro picados.',
    'Sirve sobre 2 tostadas por porción con aguacate.',
    'Usa pescado muy fresco de proveedor confiable.',
  ]),
  r('molletes_claras', 'Molletes con claras y pico de gallo', 1, [['pan_integral', 70], ['frijoles_refritos', 80], ['clara_huevo', 200], ['queso_mozzarella', 25], ['jitomate', 80], ['cebolla', 20], ['cilantro', 5], ['jalapeno', 10]], [
    'Tuesta el pan, unta los frijoles y agrega el queso; gratina.',
    'Revuelve las claras en sartén antiadherente y colócalas encima.',
    'Sirve con pico de gallo (jitomate, cebolla, cilantro y jalapeño).',
  ]),
  r('tacos_bistec', 'Tacos de bistec con nopales', 2, [['tortilla_maiz', 180], ['res_bistec_magro_cocido', 260], ['nopal_cocido', 150], ['cebolla', 60], ['cilantro', 10], ['salsa_verde', 80], ['limon', 30]], [
    'Asa el bistec y los nopales en plancha caliente con poca grasa.',
    'Pica la carne y sirve en tortillas (3 por porción) con cebolla, cilantro, salsa y limón.',
  ]),
  r('sopa_lentejas', 'Sopa de lentejas con queso fresco', 4, [['lenteja_cocida', 800], ['jitomate', 200], ['zanahoria', 120], ['cebolla', 80], ['ajo', 6], ['aceite_oliva', 10], ['queso_fresco', 80]], [
    'Sofríe cebolla, ajo y zanahoria en el aceite.',
    'Agrega el jitomate licuado, las lentejas cocidas y agua o caldo; hierve 15 min.',
    'Sirve con queso fresco en cubos.',
  ]),
  r('huevos_rancheros', 'Huevos rancheros ligeros', 1, [['huevo_entero', 100], ['clara_huevo', 100], ['tortilla_maiz', 60], ['salsa_roja', 100], ['frijol_negro_cocido', 100], ['queso_fresco', 20]], [
    'Calienta las tortillas en comal, sin freír.',
    'Cocina los huevos y las claras en sartén antiadherente.',
    'Sirve sobre las tortillas con salsa ranchera caliente, frijoles y queso.',
  ]),
  r('picadillo', 'Picadillo de res con verduras', 4, [['res_molida_90_cocida', 400], ['papa_cocida', 300], ['zanahoria', 150], ['calabacita_cocida', 200], ['jitomate', 200], ['cebolla', 80], ['aceite_vegetal', 10]], [
    'Dora la carne molida (90/10) y escurre la grasa.',
    'Agrega cebolla, jitomate licuado y las verduras en cubos.',
    'Cocina tapado 15 min hasta que la papa esté suave.',
  ]),
  r('bowl_pollo', 'Bowl de pollo, arroz y frijoles', 1, [['pollo_pechuga_cocida', 150], ['arroz_blanco_cocido', 150], ['frijol_negro_cocido', 100], ['elote_cocido', 50], ['jitomate', 80], ['lechuga_romana', 60], ['aguacate', 40], ['salsa_roja', 40]], [
    'Sirve en un tazón la base de lechuga, arroz y frijoles.',
    'Agrega el pollo en tiras, elote, jitomate y aguacate.',
    'Termina con salsa. Ideal para preparar en lote.',
  ]),
  r('tacos_pescado', 'Tacos de pescado con crema de chipotle', 2, [['tilapia_cocida', 300], ['tortilla_maiz', 180], ['lechuga_romana', 100], ['yogur_griego_0', 80], ['salsa_roja', 40], ['limon', 30]], [
    'Sazona el pescado y ásalo o hornéalo (no capeado).',
    'Mezcla el yogur con chipotle o salsa roja para la "crema".',
    'Arma 3 tacos por porción con lechuga, pescado, crema y limón.',
  ]),
  r('calabacitas_pollo', 'Calabacitas a la mexicana con pollo', 2, [['pollo_pechuga_cocida', 280], ['calabacita_cocida', 400], ['elote_cocido', 100], ['jitomate', 150], ['cebolla', 60], ['queso_fresco', 50], ['aceite_oliva', 10]], [
    'Sofríe cebolla y jitomate en el aceite.',
    'Agrega calabacitas en cubos y elote; cocina tapado 8 min.',
    'Incorpora el pollo en cubos y el queso al final.',
  ]),
  r('nopales_huevo', 'Nopales con huevo', 1, [['nopal_cocido', 200], ['huevo_entero', 100], ['clara_huevo', 100], ['jitomate', 80], ['cebolla', 30], ['tortilla_maiz', 60]], [
    'Asa los nopales en tiras hasta que suelten la baba.',
    'Agrega jitomate y cebolla, luego el huevo y las claras batidos; revuelve.',
    'Sirve con 2 tortillas.',
  ]),
  r('bistec_mexicana', 'Bistec a la mexicana con arroz', 2, [['res_bistec_magro_cocido', 300], ['jitomate', 250], ['cebolla', 100], ['jalapeno', 30], ['aceite_vegetal', 10], ['arroz_blanco_cocido', 300]], [
    'Corta el bistec en tiras y séllalo en el aceite.',
    'Agrega cebolla, jitomate y chile en tiras; cocina 10 min.',
    'Sirve con arroz.',
  ]),
  r('ensalada_atun', 'Ensalada de atún con galletas', 2, [['atun_agua', 280], ['yogur_griego_0', 100], ['jitomate', 150], ['cebolla', 50], ['pepino', 150], ['elote_cocido', 80], ['limon', 30], ['galletas_saladas', 40]], [
    'Escurre el atún y mézclalo con el yogur (en lugar de mayonesa) y limón.',
    'Agrega las verduras picadas y el elote.',
    'Sirve con galletas saladas.',
  ]),
  r('avena_horneada', 'Avena horneada con plátano y proteína', 2, [['avena', 120], ['proteina_whey', 60], ['platano', 200], ['leche_descremada', 300], ['clara_huevo', 100], ['nuez', 20]], [
    'Machaca el plátano y mézclalo con leche, claras y proteína.',
    'Agrega la avena y canela; vierte en un molde.',
    'Hornea 25–30 min a 180 °C y termina con nuez picada.',
  ]),
  r('licuado', 'Licuado de proteína con avena y plátano', 1, [['leche_descremada', 300], ['proteina_whey', 30], ['platano', 120], ['avena', 40], ['crema_cacahuate', 15]], ['Licúa todo con hielo.']),
  r('enfrijoladas', 'Enfrijoladas con pollo', 2, [['tortilla_maiz', 180], ['frijol_negro_cocido', 300], ['pollo_pechuga_cocida', 200], ['queso_fresco', 40], ['crema', 30], ['cebolla', 40]], [
    'Licúa los frijoles con un poco de su caldo hasta tener una salsa espesa.',
    'Pasa las tortillas calientes por la salsa, rellena con pollo y dobla.',
    'Cubre con más salsa, cebolla, queso y crema.',
  ]),
  r('albondigas', 'Albóndigas en caldillo de jitomate', 4, [['res_molida_90_cocida', 480], ['clara_huevo', 60], ['arroz_blanco_cocido', 80], ['jitomate', 400], ['salsa_roja', 100], ['cebolla', 80], ['calabacita_cocida', 200]], [
    'Mezcla la carne con claras, arroz y sal; forma albóndigas.',
    'Licúa jitomate, cebolla y chipotle (o salsa roja) y hierve con agua.',
    'Cuece las albóndigas en el caldillo 20 min; agrega la calabacita al final.',
  ]),
  r('fajitas', 'Fajitas de pollo con pimiento', 2, [['pollo_pechuga_cocida', 300], ['pimiento_rojo', 200], ['cebolla', 150], ['aceite_vegetal', 10], ['tortilla_maiz', 120], ['aguacate', 60]], [
    'Corta pollo, pimiento y cebolla en tiras.',
    'Saltea a fuego alto con el aceite y especias (comino, ajo, chile en polvo).',
    'Sirve con tortillas y aguacate.',
  ]),
  r('sopa_tortilla', 'Sopa de tortilla con pollo', 3, [['tortilla_maiz', 90], ['jitomate', 400], ['cebolla', 60], ['ajo', 6], ['pollo_pechuga_cocida', 240], ['aguacate', 90], ['queso_fresco', 60], ['crema', 30]], [
    'Hornea las tortillas en tiras a 200 °C hasta que estén crujientes.',
    'Licúa jitomate, cebolla y ajo; hierve con caldo de pollo 10 min.',
    'Sirve con pollo deshebrado, tiras de tortilla, aguacate, queso y crema.',
  ]),
  r('camarones_diabla', 'Camarones a la diabla con arroz', 2, [['camaron_cocido', 300], ['salsa_roja', 150], ['jitomate', 150], ['aceite_vegetal', 10], ['arroz_blanco_cocido', 300]], [
    'Licúa jitomate con chiles secos (o salsa roja picante).',
    'Saltea los camarones en el aceite, agrega la salsa y cocina 3–4 min.',
    'Sirve con arroz.',
  ]),
  r('yogur_fruta', 'Yogur griego con fresas, avena y almendra', 1, [['yogur_griego_0', 250], ['fresa', 150], ['avena', 30], ['miel', 10], ['almendra', 15]], ['Sirve el yogur con la fruta picada, la avena, la almendra y la miel.']),
];

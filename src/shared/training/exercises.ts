// Biblioteca de ejercicios. Cada ejercicio incluye músculos, equipo, instrucciones, técnica, errores
// frecuentes, alternativas y zonas articulares que pueden verse comprometidas (para filtrar por lesiones).
import type { BodyRegion, Equipment, Experience, Muscle } from '../types';

export type Pattern =
  | 'empuje_horizontal'
  | 'empuje_vertical'
  | 'traccion_horizontal'
  | 'traccion_vertical'
  | 'sentadilla'
  | 'bisagra'
  | 'zancada'
  | 'aislamiento'
  | 'core'
  | 'gemelos';

export interface Exercise {
  id: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  pattern: Pattern;
  compound: boolean;
  equipment: Equipment[]; // requiere TODOS
  stress: BodyRegion[]; // articulaciones exigidas
  level: Experience;
  instructions: string[];
  technique: string[];
  mistakes: string[];
  alternatives: string[];
  loadStep: number; // incremento sugerido en kg
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  pecho: 'Pecho',
  dorsales: 'Dorsales',
  espalda_alta: 'Espalda alta / trapecio',
  hombro_anterior: 'Deltoides anterior',
  hombro_lateral: 'Deltoides lateral',
  hombro_posterior: 'Deltoides posterior',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebrazo: 'Antebrazo',
  cuadriceps: 'Cuádriceps',
  isquiotibiales: 'Isquiotibiales',
  gluteos: 'Glúteos',
  aductores: 'Aductores',
  pantorrillas: 'Pantorrillas',
  abdomen: 'Abdomen',
  lumbares: 'Lumbares',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barra: 'Barra olímpica y discos',
  mancuernas: 'Mancuernas',
  maquinas: 'Máquinas guiadas',
  poleas: 'Poleas / cables',
  banco: 'Banco ajustable',
  barra_dominadas: 'Barra de dominadas',
  peso_corporal: 'Peso corporal',
  bandas: 'Bandas elásticas',
  kettlebell: 'Kettlebell',
  rack: 'Rack / jaula de sentadillas',
};

export const REGION_LABEL: Record<BodyRegion, string> = {
  hombro: 'Hombro',
  codo: 'Codo',
  muneca: 'Muñeca',
  lumbar: 'Zona lumbar',
  cadera: 'Cadera',
  rodilla: 'Rodilla',
  tobillo: 'Tobillo',
  cuello: 'Cuello',
};

const E = (e: Exercise) => e;

export const EXERCISES: Exercise[] = [
  // ───── Pecho
  E({
    id: 'press_banca', name: 'Press de banca con barra', primary: 'pecho', secondary: ['triceps', 'hombro_anterior'], pattern: 'empuje_horizontal', compound: true,
    equipment: ['barra', 'banco', 'rack'], stress: ['hombro', 'codo', 'muneca'], level: 'principiante', loadStep: 2.5,
    instructions: ['Acuéstate con los ojos bajo la barra y los pies firmes en el suelo.', 'Agarra la barra algo más ancho que los hombros, retrae y deprime las escápulas.', 'Baja controlado hasta el esternón medio/bajo con los codos a ~45–70° del torso.', 'Empuja hacia arriba y ligeramente hacia atrás hasta extender los codos.'],
    technique: ['Mantén un arco torácico moderado y glúteos en el banco.', 'Muñecas apiladas sobre los codos.', 'Toca el pecho sin rebotar.'],
    mistakes: ['Abrir los codos a 90° (estresa el hombro).', 'Rebotar la barra en el pecho.', 'Levantar los glúteos del banco.', 'Entrenar al fallo sin asistente.'],
    alternatives: ['press_mancuernas', 'press_maquina_pecho', 'lagartijas'],
  }),
  E({
    id: 'press_mancuernas', name: 'Press de pecho con mancuernas', primary: 'pecho', secondary: ['triceps', 'hombro_anterior'], pattern: 'empuje_horizontal', compound: true,
    equipment: ['mancuernas', 'banco'], stress: ['hombro', 'codo'], level: 'principiante', loadStep: 2,
    instructions: ['Siéntate con las mancuernas sobre los muslos y recuéstate llevándolas al pecho.', 'Con escápulas retraídas, baja las mancuernas a los lados del pecho.', 'Empuja hasta casi juntarlas sobre el pecho.'],
    technique: ['Recorrido completo y controlado (2–3 s de bajada).', 'Antebrazos verticales.'],
    mistakes: ['Bajar demasiado profundo con dolor de hombro.', 'Chocar las mancuernas arriba perdiendo tensión.'],
    alternatives: ['press_banca', 'press_maquina_pecho', 'lagartijas'],
  }),
  E({
    id: 'press_inclinado_mancuernas', name: 'Press inclinado con mancuernas', primary: 'pecho', secondary: ['hombro_anterior', 'triceps'], pattern: 'empuje_horizontal', compound: true,
    equipment: ['mancuernas', 'banco'], stress: ['hombro', 'codo'], level: 'principiante', loadStep: 2,
    instructions: ['Ajusta el banco a 30°.', 'Baja las mancuernas a la parte alta del pecho.', 'Empuja hacia arriba sin perder la retracción escapular.'],
    technique: ['Inclinación baja (15–30°) para enfatizar la porción clavicular.', 'Codos ligeramente por debajo de la línea de los hombros.'],
    mistakes: ['Banco demasiado inclinado (se vuelve press de hombro).', 'Arquear en exceso la zona lumbar.'],
    alternatives: ['press_inclinado_barra', 'press_maquina_pecho', 'lagartijas'],
  }),
  E({
    id: 'press_inclinado_barra', name: 'Press inclinado con barra', primary: 'pecho', secondary: ['hombro_anterior', 'triceps'], pattern: 'empuje_horizontal', compound: true,
    equipment: ['barra', 'banco', 'rack'], stress: ['hombro', 'codo', 'muneca'], level: 'intermedio', loadStep: 2.5,
    instructions: ['Banco a 30°; agarre algo más ancho que hombros.', 'Baja a la parte alta del pecho.', 'Empuja hasta extender.'],
    technique: ['Escápulas retraídas.', 'Trayectoria ligeramente diagonal.'],
    mistakes: ['Rebotar.', 'Perder la posición de los pies.'],
    alternatives: ['press_inclinado_mancuernas', 'press_maquina_pecho'],
  }),
  E({
    id: 'press_maquina_pecho', name: 'Press de pecho en máquina', primary: 'pecho', secondary: ['triceps', 'hombro_anterior'], pattern: 'empuje_horizontal', compound: true,
    equipment: ['maquinas'], stress: ['hombro'], level: 'principiante', loadStep: 5,
    instructions: ['Ajusta el asiento para que las asas queden a la altura del pecho medio.', 'Empuja sin bloquear agresivamente los codos.', 'Regresa controlando hasta sentir estiramiento.'],
    technique: ['Espalda pegada al respaldo.', 'Ideal para acercarse al fallo con seguridad.'],
    mistakes: ['Asiento mal ajustado.', 'Recorrido parcial.'],
    alternatives: ['press_mancuernas', 'press_banca'],
  }),
  E({
    id: 'aperturas_polea', name: 'Aperturas en polea (cruce de cables)', primary: 'pecho', secondary: ['hombro_anterior'], pattern: 'aislamiento', compound: false,
    equipment: ['poleas'], stress: ['hombro'], level: 'principiante', loadStep: 2.5,
    instructions: ['Poleas a la altura del pecho o un poco arriba.', 'Da un paso al frente, codos ligeramente flexionados.', 'Junta las manos frente al pecho en arco.'],
    technique: ['Codos fijos en ligera flexión.', 'Controla el estiramiento.'],
    mistakes: ['Convertirlo en un press flexionando los codos.', 'Usar demasiado peso.'],
    alternatives: ['aperturas_mancuernas', 'pec_deck'],
  }),
  E({
    id: 'aperturas_mancuernas', name: 'Aperturas con mancuernas', primary: 'pecho', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['mancuernas', 'banco'], stress: ['hombro'], level: 'principiante', loadStep: 1,
    instructions: ['Recostado, mancuernas sobre el pecho, codos semiflexionados.', 'Abre en arco hasta sentir estiramiento.', 'Regresa juntando en arco.'],
    technique: ['Rango cómodo para el hombro.'], mistakes: ['Bajar demasiado con peso alto.'], alternatives: ['aperturas_polea', 'pec_deck'],
  }),
  E({
    id: 'pec_deck', name: 'Pec deck (aperturas en máquina)', primary: 'pecho', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['maquinas'], stress: ['hombro'], level: 'principiante', loadStep: 5,
    instructions: ['Ajusta el asiento con las asas a la altura del pecho.', 'Junta los brazos al frente.', 'Regresa controlado.'],
    technique: ['Pecho alto, escápulas atrás.'], mistakes: ['Recorrido corto.'], alternatives: ['aperturas_polea', 'aperturas_mancuernas'],
  }),
  E({
    id: 'lagartijas', name: 'Lagartijas (flexiones)', primary: 'pecho', secondary: ['triceps', 'hombro_anterior', 'abdomen'], pattern: 'empuje_horizontal', compound: true,
    equipment: ['peso_corporal'], stress: ['hombro', 'muneca'], level: 'principiante', loadStep: 0,
    instructions: ['Manos algo más anchas que los hombros, cuerpo en línea recta.', 'Baja el pecho hasta casi tocar el suelo.', 'Empuja manteniendo el abdomen firme.'],
    technique: ['Progresa elevando los pies, usando chaleco o pausas.', 'Codos a ~45°.'],
    mistakes: ['Cadera caída.', 'Cabeza adelantada.'], alternatives: ['press_mancuernas', 'press_maquina_pecho'],
  }),
  E({
    id: 'fondos', name: 'Fondos en paralelas', primary: 'pecho', secondary: ['triceps', 'hombro_anterior'], pattern: 'empuje_vertical', compound: true,
    equipment: ['peso_corporal'], stress: ['hombro', 'codo'], level: 'intermedio', loadStep: 2.5,
    instructions: ['Sujétate en las paralelas con brazos extendidos.', 'Inclina el torso ligeramente y baja hasta ~90° de codo.', 'Empuja hasta extender.'],
    technique: ['No bajes más allá de lo que tu hombro tolere.'], mistakes: ['Hundir los hombros hacia las orejas.'], alternatives: ['press_mancuernas', 'lagartijas'],
  }),
  // ───── Espalda
  E({
    id: 'dominadas', name: 'Dominadas', primary: 'dorsales', secondary: ['biceps', 'espalda_alta', 'antebrazo'], pattern: 'traccion_vertical', compound: true,
    equipment: ['barra_dominadas'], stress: ['hombro', 'codo'], level: 'intermedio', loadStep: 2.5,
    instructions: ['Cuélgate con agarre prono algo más ancho que hombros.', 'Lleva el pecho hacia la barra bajando los codos.', 'Baja controlado hasta extender los brazos.'],
    technique: ['Inicia deprimiendo las escápulas.', 'Usa banda de asistencia si no completas 5 repeticiones.'],
    mistakes: ['Balancearse (kipping).', 'Medias repeticiones.'], alternatives: ['jalon_pecho', 'dominadas_asistidas'],
  }),
  E({
    id: 'dominadas_asistidas', name: 'Dominadas asistidas (banda o máquina)', primary: 'dorsales', secondary: ['biceps', 'espalda_alta'], pattern: 'traccion_vertical', compound: true,
    equipment: ['barra_dominadas', 'bandas'], stress: ['hombro', 'codo'], level: 'principiante', loadStep: 0,
    instructions: ['Coloca la banda en la barra y apoya rodillas o pies.', 'Tira hasta que la barbilla supere la barra.', 'Baja controlado.'],
    technique: ['Reduce la asistencia progresivamente.'], mistakes: ['Usar demasiada asistencia sin progresar.'], alternatives: ['jalon_pecho', 'dominadas'],
  }),
  E({
    id: 'jalon_pecho', name: 'Jalón al pecho en polea', primary: 'dorsales', secondary: ['biceps', 'espalda_alta'], pattern: 'traccion_vertical', compound: true,
    equipment: ['poleas'], stress: ['hombro', 'codo'], level: 'principiante', loadStep: 5,
    instructions: ['Ajusta el soporte de muslos.', 'Agarra la barra algo más ancho que hombros.', 'Tira hacia la parte alta del pecho llevando los codos hacia abajo y atrás.', 'Regresa controlado hasta estirar.'],
    technique: ['Torso ligeramente inclinado atrás (~10–15°).', 'Pecho alto.'],
    mistakes: ['Tirar detrás de la nuca.', 'Balancear el torso.'], alternatives: ['dominadas', 'dominadas_asistidas', 'jalon_banda'],
  }),
  E({
    id: 'jalon_banda', name: 'Jalón con banda elástica', primary: 'dorsales', secondary: ['biceps'], pattern: 'traccion_vertical', compound: true,
    equipment: ['bandas'], stress: ['hombro'], level: 'principiante', loadStep: 0,
    instructions: ['Ancla la banda arriba.', 'De rodillas, tira llevando codos hacia las costillas.', 'Regresa controlado.'],
    technique: ['Pausa de 1 s abajo.'], mistakes: ['Encoger los hombros.'], alternatives: ['jalon_pecho'],
  }),
  E({
    id: 'remo_barra', name: 'Remo con barra', primary: 'espalda_alta', secondary: ['dorsales', 'biceps', 'hombro_posterior', 'lumbares'], pattern: 'traccion_horizontal', compound: true,
    equipment: ['barra'], stress: ['lumbar'], level: 'intermedio', loadStep: 2.5,
    instructions: ['Bisagra de cadera a ~45° con espalda neutra.', 'Tira la barra hacia el abdomen bajo.', 'Baja controlado sin perder la posición.'],
    technique: ['Columna neutra todo el tiempo.', 'Rodillas ligeramente flexionadas.'],
    mistakes: ['Redondear la espalda.', 'Usar impulso de cadera.'], alternatives: ['remo_mancuerna', 'remo_polea', 'remo_maquina'],
  }),
  E({
    id: 'remo_mancuerna', name: 'Remo a una mano con mancuerna', primary: 'dorsales', secondary: ['espalda_alta', 'biceps', 'hombro_posterior'], pattern: 'traccion_horizontal', compound: true,
    equipment: ['mancuernas', 'banco'], stress: [], level: 'principiante', loadStep: 2,
    instructions: ['Apoya mano y rodilla en el banco, espalda neutra.', 'Tira la mancuerna hacia la cadera.', 'Baja estirando completamente.'],
    technique: ['Codo cerca del cuerpo.', 'No gires el torso.'], mistakes: ['Tirar con el bíceps y no con el codo.'], alternatives: ['remo_polea', 'remo_maquina', 'remo_barra'],
  }),
  E({
    id: 'remo_polea', name: 'Remo sentado en polea', primary: 'espalda_alta', secondary: ['dorsales', 'biceps', 'hombro_posterior'], pattern: 'traccion_horizontal', compound: true,
    equipment: ['poleas'], stress: [], level: 'principiante', loadStep: 5,
    instructions: ['Siéntate con rodillas ligeramente flexionadas.', 'Tira el agarre hacia el abdomen juntando escápulas.', 'Regresa estirando sin redondear.'],
    technique: ['Torso estable.'], mistakes: ['Balancear el torso.'], alternatives: ['remo_mancuerna', 'remo_maquina'],
  }),
  E({
    id: 'remo_maquina', name: 'Remo en máquina con apoyo de pecho', primary: 'espalda_alta', secondary: ['dorsales', 'biceps', 'hombro_posterior'], pattern: 'traccion_horizontal', compound: true,
    equipment: ['maquinas'], stress: [], level: 'principiante', loadStep: 5,
    instructions: ['Apoya el pecho en el respaldo.', 'Tira llevando codos atrás.', 'Regresa controlado.'],
    technique: ['Excelente opción con molestias lumbares.'], mistakes: ['Despegar el pecho del apoyo.'], alternatives: ['remo_polea', 'remo_mancuerna'],
  }),
  E({
    id: 'remo_banda', name: 'Remo con banda elástica', primary: 'espalda_alta', secondary: ['dorsales', 'biceps'], pattern: 'traccion_horizontal', compound: true,
    equipment: ['bandas'], stress: [], level: 'principiante', loadStep: 0,
    instructions: ['Ancla la banda a la altura del pecho.', 'Tira hacia el abdomen juntando escápulas.', 'Regresa lento.'],
    technique: ['Pausa de 1 s en la contracción.'], mistakes: ['Encoger hombros.'], alternatives: ['remo_mancuerna'],
  }),
  E({
    id: 'face_pull', name: 'Face pull en polea', primary: 'hombro_posterior', secondary: ['espalda_alta'], pattern: 'aislamiento', compound: false,
    equipment: ['poleas'], stress: [], level: 'principiante', loadStep: 2.5,
    instructions: ['Polea a la altura de la cara con cuerda.', 'Tira hacia la frente separando las manos.', 'Rota externamente al final.'],
    technique: ['Codos altos.'], mistakes: ['Usar demasiado peso y tirar con la espalda baja.'], alternatives: ['pajaros', 'face_pull_banda'],
  }),
  E({
    id: 'face_pull_banda', name: 'Face pull con banda', primary: 'hombro_posterior', secondary: ['espalda_alta'], pattern: 'aislamiento', compound: false,
    equipment: ['bandas'], stress: [], level: 'principiante', loadStep: 0,
    instructions: ['Ancla la banda a la altura de la cara.', 'Tira hacia la frente separando las manos.'], technique: ['Controla el regreso.'], mistakes: ['Arquear la espalda.'], alternatives: ['face_pull', 'pajaros'],
  }),
  E({
    id: 'pajaros', name: 'Elevaciones posteriores (pájaros) con mancuernas', primary: 'hombro_posterior', secondary: ['espalda_alta'], pattern: 'aislamiento', compound: false,
    equipment: ['mancuernas'], stress: [], level: 'principiante', loadStep: 1,
    instructions: ['Inclina el torso al frente con espalda neutra.', 'Eleva las mancuernas lateralmente con codos semiflexionados.', 'Baja lento.'],
    technique: ['Piensa en llevar las manos hacia afuera, no hacia arriba.'], mistakes: ['Impulso con el torso.'], alternatives: ['face_pull', 'reverse_pec_deck'],
  }),
  E({
    id: 'reverse_pec_deck', name: 'Aperturas inversas en máquina', primary: 'hombro_posterior', secondary: ['espalda_alta'], pattern: 'aislamiento', compound: false,
    equipment: ['maquinas'], stress: [], level: 'principiante', loadStep: 5,
    instructions: ['Pecho contra el respaldo.', 'Abre los brazos hacia atrás.', 'Regresa lento.'], technique: ['Codos ligeramente flexionados.'], mistakes: ['Juntar escápulas en exceso.'], alternatives: ['pajaros', 'face_pull'],
  }),
  // ───── Hombro
  E({
    id: 'press_militar', name: 'Press militar con barra de pie', primary: 'hombro_anterior', secondary: ['triceps', 'hombro_lateral', 'abdomen'], pattern: 'empuje_vertical', compound: true,
    equipment: ['barra', 'rack'], stress: ['hombro', 'lumbar', 'codo'], level: 'intermedio', loadStep: 2.5,
    instructions: ['Barra sobre las clavículas, agarre a la anchura de hombros.', 'Aprieta glúteos y abdomen.', 'Empuja vertical pasando la cabeza hacia atrás y luego adelante.'],
    technique: ['Costillas abajo, sin hiperextender la zona lumbar.'], mistakes: ['Arquear la espalda baja.', 'Empujar hacia el frente.'], alternatives: ['press_hombro_mancuernas', 'press_hombro_maquina'],
  }),
  E({
    id: 'press_hombro_mancuernas', name: 'Press de hombro sentado con mancuernas', primary: 'hombro_anterior', secondary: ['triceps', 'hombro_lateral'], pattern: 'empuje_vertical', compound: true,
    equipment: ['mancuernas', 'banco'], stress: ['hombro', 'codo'], level: 'principiante', loadStep: 2,
    instructions: ['Banco a ~80°, mancuernas a la altura de las orejas.', 'Empuja hacia arriba sin chocar.', 'Baja controlado.'],
    technique: ['Codos ligeramente adelantados (plano escapular).'], mistakes: ['Arquear la espalda.'], alternatives: ['press_hombro_maquina', 'press_militar'],
  }),
  E({
    id: 'press_hombro_maquina', name: 'Press de hombro en máquina', primary: 'hombro_anterior', secondary: ['triceps', 'hombro_lateral'], pattern: 'empuje_vertical', compound: true,
    equipment: ['maquinas'], stress: ['hombro'], level: 'principiante', loadStep: 5,
    instructions: ['Ajusta el asiento con las asas a la altura de los hombros.', 'Empuja hacia arriba.', 'Regresa controlado.'], technique: ['Espalda apoyada.'], mistakes: ['Recorrido parcial.'], alternatives: ['press_hombro_mancuernas'],
  }),
  E({
    id: 'elevaciones_laterales', name: 'Elevaciones laterales con mancuernas', primary: 'hombro_lateral', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['mancuernas'], stress: ['hombro'], level: 'principiante', loadStep: 1,
    instructions: ['De pie, mancuernas a los lados.', 'Eleva lateralmente hasta la altura de los hombros.', 'Baja en 2–3 s.'],
    technique: ['Ligera inclinación al frente; lleva los codos hacia afuera.'], mistakes: ['Balancear el cuerpo.', 'Subir por encima de los hombros con dolor.'], alternatives: ['elevaciones_laterales_polea', 'elevaciones_laterales_banda'],
  }),
  E({
    id: 'elevaciones_laterales_polea', name: 'Elevación lateral en polea', primary: 'hombro_lateral', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['poleas'], stress: ['hombro'], level: 'principiante', loadStep: 2.5,
    instructions: ['Polea baja, agarra con la mano contraria.', 'Eleva lateralmente.', 'Baja controlado.'], technique: ['Tensión constante.'], mistakes: ['Girar el torso.'], alternatives: ['elevaciones_laterales'],
  }),
  E({
    id: 'elevaciones_laterales_banda', name: 'Elevaciones laterales con banda', primary: 'hombro_lateral', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['bandas'], stress: ['hombro'], level: 'principiante', loadStep: 0,
    instructions: ['Pisa la banda.', 'Eleva lateralmente.'], technique: ['Pausa arriba.'], mistakes: ['Encoger los hombros.'], alternatives: ['elevaciones_laterales'],
  }),
  // ───── Brazos
  E({
    id: 'curl_barra', name: 'Curl de bíceps con barra', primary: 'biceps', secondary: ['antebrazo'], pattern: 'aislamiento', compound: false,
    equipment: ['barra'], stress: ['codo', 'muneca'], level: 'principiante', loadStep: 2.5,
    instructions: ['De pie, agarre supino a la anchura de hombros.', 'Flexiona los codos sin moverlos hacia adelante.', 'Baja hasta extender.'],
    technique: ['Codos pegados.'], mistakes: ['Balanceo con la espalda.'], alternatives: ['curl_mancuernas', 'curl_polea'],
  }),
  E({
    id: 'curl_mancuernas', name: 'Curl alterno con mancuernas', primary: 'biceps', secondary: ['antebrazo'], pattern: 'aislamiento', compound: false,
    equipment: ['mancuernas'], stress: ['codo'], level: 'principiante', loadStep: 1,
    instructions: ['De pie o sentado con mancuernas a los lados.', 'Flexiona supinando la muñeca.', 'Baja controlado.'], technique: ['Recorrido completo.'], mistakes: ['Impulso con el hombro.'], alternatives: ['curl_barra', 'curl_martillo', 'curl_banda'],
  }),
  E({
    id: 'curl_martillo', name: 'Curl martillo', primary: 'biceps', secondary: ['antebrazo'], pattern: 'aislamiento', compound: false,
    equipment: ['mancuernas'], stress: ['codo'], level: 'principiante', loadStep: 1,
    instructions: ['Agarre neutro (palmas enfrentadas).', 'Flexiona los codos.', 'Baja lento.'], technique: ['Trabaja braquial y braquiorradial.'], mistakes: ['Balanceo.'], alternatives: ['curl_mancuernas'],
  }),
  E({
    id: 'curl_polea', name: 'Curl en polea', primary: 'biceps', secondary: ['antebrazo'], pattern: 'aislamiento', compound: false,
    equipment: ['poleas'], stress: ['codo'], level: 'principiante', loadStep: 2.5,
    instructions: ['Polea baja con barra o cuerda.', 'Flexiona los codos.', 'Regresa controlado.'], technique: ['Tensión constante.'], mistakes: ['Inclinarse atrás.'], alternatives: ['curl_mancuernas'],
  }),
  E({
    id: 'curl_banda', name: 'Curl con banda', primary: 'biceps', secondary: ['antebrazo'], pattern: 'aislamiento', compound: false,
    equipment: ['bandas'], stress: ['codo'], level: 'principiante', loadStep: 0,
    instructions: ['Pisa la banda y flexiona los codos.'], technique: ['Pausa arriba.'], mistakes: ['Mover los codos.'], alternatives: ['curl_mancuernas'],
  }),
  E({
    id: 'triceps_polea', name: 'Extensión de tríceps en polea (pushdown)', primary: 'triceps', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['poleas'], stress: ['codo'], level: 'principiante', loadStep: 2.5,
    instructions: ['Polea alta con cuerda o barra.', 'Codos pegados, extiende hacia abajo.', 'Regresa hasta ~90°.'], technique: ['Codos fijos.'], mistakes: ['Inclinarse y empujar con el cuerpo.'], alternatives: ['triceps_frances', 'triceps_banda'],
  }),
  E({
    id: 'triceps_frances', name: 'Extensión de tríceps sobre la cabeza con mancuerna', primary: 'triceps', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['mancuernas'], stress: ['codo', 'hombro'], level: 'principiante', loadStep: 1,
    instructions: ['Sostén una mancuerna con ambas manos sobre la cabeza.', 'Baja detrás de la cabeza flexionando codos.', 'Extiende.'], technique: ['Enfatiza la cabeza larga en estiramiento.'], mistakes: ['Abrir demasiado los codos.'], alternatives: ['triceps_polea', 'press_cerrado'],
  }),
  E({
    id: 'triceps_banda', name: 'Extensión de tríceps con banda', primary: 'triceps', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['bandas'], stress: ['codo'], level: 'principiante', loadStep: 0,
    instructions: ['Ancla la banda arriba y extiende los codos hacia abajo.'], technique: ['Codos fijos.'], mistakes: ['Mover hombros.'], alternatives: ['triceps_polea'],
  }),
  E({
    id: 'press_cerrado', name: 'Press de banca agarre cerrado', primary: 'triceps', secondary: ['pecho', 'hombro_anterior'], pattern: 'empuje_horizontal', compound: true,
    equipment: ['barra', 'banco', 'rack'], stress: ['codo', 'muneca', 'hombro'], level: 'intermedio', loadStep: 2.5,
    instructions: ['Agarre a la anchura de hombros.', 'Baja con codos cerca del torso.', 'Empuja.'], technique: ['No cierres demasiado el agarre.'], mistakes: ['Agarre muy estrecho (muñecas).'], alternatives: ['triceps_frances', 'fondos'],
  }),
  // ───── Piernas
  E({
    id: 'sentadilla', name: 'Sentadilla trasera con barra', primary: 'cuadriceps', secondary: ['gluteos', 'aductores', 'lumbares'], pattern: 'sentadilla', compound: true,
    equipment: ['barra', 'rack'], stress: ['rodilla', 'lumbar', 'cadera'], level: 'principiante', loadStep: 5,
    instructions: ['Barra sobre los trapecios, pies a la anchura de hombros o algo más.', 'Inspira, bloquea el abdomen y baja flexionando cadera y rodillas.', 'Desciende hasta donde mantengas la espalda neutra (idealmente muslo paralelo o más).', 'Sube empujando el suelo.'],
    technique: ['Rodillas en dirección de las puntas de los pies.', 'Peso en todo el pie.', 'Usa los seguros del rack.'],
    mistakes: ['Rodillas hacia adentro.', 'Despegar talones.', 'Redondear la espalda baja al fondo.'], alternatives: ['sentadilla_goblet', 'prensa', 'hack_squat'],
  }),
  E({
    id: 'sentadilla_goblet', name: 'Sentadilla goblet', primary: 'cuadriceps', secondary: ['gluteos', 'aductores', 'abdomen'], pattern: 'sentadilla', compound: true,
    equipment: ['mancuernas'], stress: ['rodilla'], level: 'principiante', loadStep: 2,
    instructions: ['Sostén una mancuerna vertical frente al pecho.', 'Baja entre las piernas con torso erguido.', 'Sube empujando el suelo.'], technique: ['Excelente para aprender el patrón.'], mistakes: ['Talones despegados.'], alternatives: ['sentadilla', 'prensa'],
  }),
  E({
    id: 'prensa', name: 'Prensa de piernas', primary: 'cuadriceps', secondary: ['gluteos', 'aductores'], pattern: 'sentadilla', compound: true,
    equipment: ['maquinas'], stress: ['rodilla'], level: 'principiante', loadStep: 10,
    instructions: ['Espalda y glúteos pegados al respaldo, pies a la anchura de hombros.', 'Baja controlado hasta ~90° de rodilla o lo que permita sin despegar la pelvis.', 'Empuja sin bloquear las rodillas.'],
    technique: ['Pies más abajo = más cuádriceps; más arriba = más glúteo.'], mistakes: ['Despegar la zona lumbar al fondo.', 'Bloquear las rodillas.'], alternatives: ['hack_squat', 'sentadilla_goblet'],
  }),
  E({
    id: 'hack_squat', name: 'Sentadilla hack en máquina', primary: 'cuadriceps', secondary: ['gluteos'], pattern: 'sentadilla', compound: true,
    equipment: ['maquinas'], stress: ['rodilla'], level: 'intermedio', loadStep: 5,
    instructions: ['Espalda contra el respaldo.', 'Baja profundo controlado.', 'Empuja.'], technique: ['Rango completo.'], mistakes: ['Despegar talones.'], alternatives: ['prensa'],
  }),
  E({
    id: 'extension_cuadriceps', name: 'Extensión de cuádriceps', primary: 'cuadriceps', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['maquinas'], stress: ['rodilla'], level: 'principiante', loadStep: 5,
    instructions: ['Rodilla alineada con el eje de la máquina.', 'Extiende las piernas.', 'Baja en 2–3 s.'], technique: ['Pausa arriba.'], mistakes: ['Impulso.'], alternatives: ['sentadilla_bulgara', 'sentadilla_goblet'],
  }),
  E({
    id: 'sentadilla_bulgara', name: 'Sentadilla búlgara', primary: 'cuadriceps', secondary: ['gluteos', 'aductores'], pattern: 'zancada', compound: true,
    equipment: ['mancuernas', 'banco'], stress: ['rodilla', 'cadera'], level: 'intermedio', loadStep: 2,
    instructions: ['Pie trasero apoyado en un banco.', 'Baja la rodilla trasera hacia el suelo.', 'Sube empujando con la pierna delantera.'], technique: ['Torso ligeramente inclinado para más glúteo.'], mistakes: ['Pie delantero demasiado cerca.'], alternatives: ['zancadas', 'sentadilla_goblet'],
  }),
  E({
    id: 'zancadas', name: 'Zancadas caminando', primary: 'cuadriceps', secondary: ['gluteos', 'aductores'], pattern: 'zancada', compound: true,
    equipment: ['mancuernas'], stress: ['rodilla'], level: 'principiante', loadStep: 2,
    instructions: ['Da un paso largo y baja hasta que ambas rodillas estén a ~90°.', 'Empuja con la pierna delantera y avanza.'], technique: ['Torso estable.'], mistakes: ['Rodilla colapsando hacia adentro.'], alternatives: ['sentadilla_bulgara'],
  }),
  E({
    id: 'peso_muerto_rumano', name: 'Peso muerto rumano con barra', primary: 'isquiotibiales', secondary: ['gluteos', 'lumbares', 'antebrazo'], pattern: 'bisagra', compound: true,
    equipment: ['barra'], stress: ['lumbar'], level: 'principiante', loadStep: 5,
    instructions: ['De pie con la barra frente a los muslos.', 'Empuja la cadera hacia atrás con rodillas semiflexionadas.', 'Baja la barra pegada a las piernas hasta sentir estiramiento en isquios.', 'Regresa extendiendo la cadera.'],
    technique: ['Espalda neutra; el movimiento es de cadera, no de espalda.'], mistakes: ['Redondear la espalda.', 'Convertirlo en sentadilla.'], alternatives: ['peso_muerto_rumano_mancuernas', 'curl_femoral'],
  }),
  E({
    id: 'peso_muerto_rumano_mancuernas', name: 'Peso muerto rumano con mancuernas', primary: 'isquiotibiales', secondary: ['gluteos', 'lumbares'], pattern: 'bisagra', compound: true,
    equipment: ['mancuernas'], stress: ['lumbar'], level: 'principiante', loadStep: 2,
    instructions: ['Mancuernas frente a los muslos.', 'Bisagra de cadera hasta estirar isquios.', 'Regresa.'], technique: ['Espalda neutra.'], mistakes: ['Redondear la espalda.'], alternatives: ['peso_muerto_rumano', 'curl_femoral'],
  }),
  E({
    id: 'peso_muerto', name: 'Peso muerto convencional', primary: 'gluteos', secondary: ['isquiotibiales', 'lumbares', 'espalda_alta', 'cuadriceps', 'antebrazo'], pattern: 'bisagra', compound: true,
    equipment: ['barra'], stress: ['lumbar', 'cadera'], level: 'intermedio', loadStep: 5,
    instructions: ['Barra sobre el medio pie.', 'Agarra la barra, baja la cadera y tensa la espalda.', 'Empuja el suelo y extiende cadera y rodillas a la vez.', 'Regresa controlando.'],
    technique: ['Barra pegada al cuerpo.', 'Espalda neutra.'], mistakes: ['Tirar con la espalda redondeada.', 'Hiperextender arriba.'], alternatives: ['peso_muerto_rumano', 'hip_thrust'],
  }),
  E({
    id: 'curl_femoral', name: 'Curl femoral (tumbado o sentado)', primary: 'isquiotibiales', secondary: ['pantorrillas'], pattern: 'aislamiento', compound: false,
    equipment: ['maquinas'], stress: ['rodilla'], level: 'principiante', loadStep: 5,
    instructions: ['Ajusta el rodillo sobre los tobillos.', 'Flexiona las rodillas.', 'Regresa lento.'], technique: ['La versión sentada estira más el isquio.'], mistakes: ['Levantar la cadera.'], alternatives: ['curl_femoral_banda', 'peso_muerto_rumano_mancuernas'],
  }),
  E({
    id: 'curl_femoral_banda', name: 'Curl femoral con banda', primary: 'isquiotibiales', secondary: [], pattern: 'aislamiento', compound: false,
    equipment: ['bandas'], stress: ['rodilla'], level: 'principiante', loadStep: 0,
    instructions: ['Boca abajo con la banda en los tobillos anclada al frente.', 'Flexiona las rodillas.'], technique: ['Pausa en contracción.'], mistakes: ['Levantar la cadera.'], alternatives: ['curl_femoral'],
  }),
  E({
    id: 'hip_thrust', name: 'Hip thrust con barra', primary: 'gluteos', secondary: ['isquiotibiales'], pattern: 'bisagra', compound: true,
    equipment: ['barra', 'banco'], stress: ['cadera'], level: 'principiante', loadStep: 5,
    instructions: ['Espalda alta apoyada en el banco, barra sobre la cadera (con protector).', 'Empuja la cadera hacia arriba hasta alinear torso y muslos.', 'Baja controlado.'],
    technique: ['Barbilla al pecho, costillas abajo.', 'Pausa de 1 s arriba.'], mistakes: ['Hiperextender la zona lumbar.'], alternatives: ['puente_gluteo', 'peso_muerto_rumano'],
  }),
  E({
    id: 'puente_gluteo', name: 'Puente de glúteo', primary: 'gluteos', secondary: ['isquiotibiales'], pattern: 'bisagra', compound: true,
    equipment: ['peso_corporal'], stress: [], level: 'principiante', loadStep: 0,
    instructions: ['Acostado boca arriba, rodillas flexionadas.', 'Eleva la cadera apretando glúteos.', 'Baja controlado.'], technique: ['Progresa a una pierna o con carga.'], mistakes: ['Empujar con la zona lumbar.'], alternatives: ['hip_thrust'],
  }),
  E({
    id: 'gemelos_pie', name: 'Elevación de talones de pie', primary: 'pantorrillas', secondary: [], pattern: 'gemelos', compound: false,
    equipment: ['peso_corporal'], stress: ['tobillo'], level: 'principiante', loadStep: 0,
    instructions: ['De pie en un escalón con talones fuera.', 'Baja el talón hasta estirar.', 'Sube lo más alto posible.'], technique: ['Pausa de 1–2 s abajo (estiramiento).'], mistakes: ['Rebotar.'], alternatives: ['gemelos_maquina'],
  }),
  E({
    id: 'gemelos_maquina', name: 'Elevación de talones en máquina', primary: 'pantorrillas', secondary: [], pattern: 'gemelos', compound: false,
    equipment: ['maquinas'], stress: ['tobillo'], level: 'principiante', loadStep: 5,
    instructions: ['Hombros bajo las almohadillas.', 'Baja y sube el talón con rango completo.'], technique: ['Pausa en estiramiento.'], mistakes: ['Medio recorrido.'], alternatives: ['gemelos_pie'],
  }),
  // ───── Core
  E({
    id: 'plancha', name: 'Plancha', primary: 'abdomen', secondary: ['hombro_anterior'], pattern: 'core', compound: false,
    equipment: ['peso_corporal'], stress: [], level: 'principiante', loadStep: 0,
    instructions: ['Apoya antebrazos y puntas de pies.', 'Mantén el cuerpo alineado apretando abdomen y glúteos.'], technique: ['Registra los segundos como repeticiones.'], mistakes: ['Cadera alta o caída.'], alternatives: ['crunch_polea', 'dead_bug'],
  }),
  E({
    id: 'dead_bug', name: 'Dead bug', primary: 'abdomen', secondary: [], pattern: 'core', compound: false,
    equipment: ['peso_corporal'], stress: [], level: 'principiante', loadStep: 0,
    instructions: ['Boca arriba con brazos y rodillas a 90°.', 'Extiende brazo y pierna contrarios manteniendo la zona lumbar pegada.'], technique: ['Exhala al extender.'], mistakes: ['Arquear la espalda.'], alternatives: ['plancha'],
  }),
  E({
    id: 'crunch_polea', name: 'Crunch en polea', primary: 'abdomen', secondary: [], pattern: 'core', compound: false,
    equipment: ['poleas'], stress: [], level: 'principiante', loadStep: 2.5,
    instructions: ['De rodillas frente a la polea alta con cuerda.', 'Flexiona el tronco llevando los codos a los muslos.'], technique: ['Movimiento de columna, no de cadera.'], mistakes: ['Tirar con los brazos.'], alternatives: ['elevacion_piernas', 'plancha'],
  }),
  E({
    id: 'elevacion_piernas', name: 'Elevación de piernas colgado', primary: 'abdomen', secondary: [], pattern: 'core', compound: false,
    equipment: ['barra_dominadas'], stress: ['hombro'], level: 'intermedio', loadStep: 0,
    instructions: ['Cuélgate de la barra.', 'Eleva las rodillas o piernas enrollando la pelvis.'], technique: ['Sin balanceo.'], mistakes: ['Impulso.'], alternatives: ['crunch_polea', 'dead_bug'],
  }),
];

export const EXERCISE_MAP = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_MAP.get(id);
}

/** Un ejercicio está disponible si el usuario tiene todo su equipo, no lo excluyó y no exige una zona lesionada. */
export function isAvailable(ex: Exercise, equipment: Equipment[], injuries: string[], excluded: string[]): boolean {
  if (excluded.includes(ex.id)) return false;
  const eq = new Set<Equipment>([...equipment, 'peso_corporal']);
  if (!ex.equipment.every((e) => eq.has(e))) return false;
  if (ex.stress.some((r) => injuries.includes(r))) return false;
  return true;
}

/**
 * Carga en posición de estiramiento (músculo largo): 2 = alta, 1 = media, 0 = baja.
 * Entrenar con el músculo estirado produce igual o más hipertrofia que en posición acortada
 * (Maeo 2021, 2023; Pedrosa 2022; Wolf 2023). Se usa para elegir y sugerir ejercicios.
 */
export const STRETCH: Record<string, 0 | 1 | 2> = {
  press_banca: 1, press_mancuernas: 2, press_inclinado_mancuernas: 2, press_inclinado_barra: 1, press_maquina_pecho: 1,
  aperturas_polea: 1, aperturas_mancuernas: 2, pec_deck: 1, lagartijas: 1, fondos: 2,
  dominadas: 2, dominadas_asistidas: 2, jalon_pecho: 2, jalon_banda: 0, remo_barra: 1, remo_mancuerna: 2, remo_polea: 2, remo_maquina: 1, remo_banda: 0,
  face_pull: 1, face_pull_banda: 0, pajaros: 1, reverse_pec_deck: 1,
  press_militar: 1, press_hombro_mancuernas: 1, press_hombro_maquina: 1,
  elevaciones_laterales: 0, elevaciones_laterales_polea: 2, elevaciones_laterales_banda: 0,
  curl_barra: 1, curl_mancuernas: 1, curl_martillo: 1, curl_polea: 1, curl_banda: 0,
  triceps_polea: 0, triceps_frances: 2, triceps_banda: 0, press_cerrado: 1,
  sentadilla: 2, sentadilla_goblet: 2, prensa: 1, hack_squat: 2, extension_cuadriceps: 1, sentadilla_bulgara: 2, zancadas: 2,
  peso_muerto_rumano: 2, peso_muerto_rumano_mancuernas: 2, peso_muerto: 1, curl_femoral: 1, curl_femoral_banda: 0, hip_thrust: 0, puente_gluteo: 0,
  gemelos_pie: 2, gemelos_maquina: 2, plancha: 0, dead_bug: 0, crunch_polea: 1, elevacion_piernas: 1,
};

export const STRETCH_LABEL = ['Énfasis acortado', 'Estiramiento medio', 'Gran estiramiento'] as const;

export function stretchOf(id: string): 0 | 1 | 2 {
  return STRETCH[id] ?? 1;
}

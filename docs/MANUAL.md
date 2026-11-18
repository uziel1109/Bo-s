# Manual de usuario de BODY OS

## 0. Instalar en iPad

Abre https://uziel1109.github.io/Bo-s/ en Safari → **Compartir** → **Agregar a pantalla de inicio**. Abre la app desde su ícono. Si ya usas BODY OS en tu computadora, crea allí un respaldo, guárdalo en iCloud Drive o envíalo al iPad, y en el primer paso del asistente toca **Restaurar un respaldo**.

## 0.1 Vista sencilla o con detalles

La app abre en **vista sencilla**: muestra lo que necesitas para el día y oculta fórmulas, márgenes de error, desgloses de cálculo y evidencia científica. Para verlos, toca *Mostrar detalles técnicos* donde aparezca, o ve a Configuración → Apariencia → Nivel de detalle → *Con detalles técnicos*.

## 1. Primer inicio

Al abrir BODY OS por primera vez aparece el **asistente de configuración** (6 pasos). Los valores iniciales son provisionales: reemplázalos con tus datos.

1. **Información personal** — edad, sexo, estatura, peso, % de grasa objetivo (20 % por defecto), actividad cotidiana *sin contar el entrenamiento*.
2. **Medidas** — cintura (a la altura del ombligo), cuello y, en mujeres, cadera. Con ellas se estima tu % de grasa con la fórmula US Navy. Si tienes una medición (DEXA, BOD POD, bioimpedancia, plicometría), indícala con su método.
3. **Entrenamiento** — experiencia, días disponibles, minutos por sesión, equipo, músculos prioritarios, lesiones (se excluyen los ejercicios que cargan esas zonas) y ejercicios que no puedes hacer.
4. **Nutrición** — comidas al día y horarios, presupuesto, alergias, alimentos preferidos y excluidos.
5. **Salud** — condiciones, presión arterial, medicamentos y restricciones médicas. Determinan qué recomendaciones requieren valoración profesional.
6. **Tu plan** — revisa tu composición estimada, gasto, peso aproximado al 20 % y elige un escenario. Pulsa **Crear mi plan**.

Todo puede modificarse después en **Configuración → Perfil**.

## 2. La rutina diaria (5 minutos)

1. **Pésate** en ayunas, después de ir al baño (Dashboard → *Registrar peso*).
2. **Registra lo que comes** (Nutrición → Registro diario → *Agregar*). Puedes buscar, usar unidades (tortillas, huevos), comidas frecuentes, recetas o copiar del día anterior.
3. **Entrena** (Entrenamiento → Sesión de hoy → *Comenzar*). Registra peso, repeticiones y RIR; marca ✓ cada serie para iniciar el temporizador de descanso.
4. **Registra pasos y agua** desde el Dashboard o sus secciones.
5. Opcional: **recuperación** (sueño, energía, dolor muscular).

Una vez por semana (lunes): **mide tu cintura**. Cada 2–4 semanas: **fotos de progreso**.

**¿Olvidaste registrar algo?** En el Dashboard, debajo de la tarjeta principal, toca *Registrar un día anterior*: eliges ayer, anteayer u otra fecha y desde ahí registras comida, peso y medidas, agua, pasos, sueño, suplementos, pesas o cardio de ese día. También puedes cambiar el día en el registro de comida (botón *Ayer* o las flechas), en Hidratación, en la sesión de entrenamiento (*Fecha*), en Cardio y en las ventanas de peso y de recuperación.

## 3. Cómo leer el Dashboard

- **Resumen corporal:** peso, % de grasa (con su método y error), masa magra, cintura y avance hacia tu objetivo.
- **Nutrición de hoy:** calorías y macros consumidos frente al objetivo, y agua.
- **Entrenamiento:** sesión del día, próxima sesión, evolución de fuerza, pasos y cardio.
- **Gráficas:** peso con su **tendencia** (la línea es lo importante; el peso diario varía 0.5–1.5 kg por agua y sal) y cintura.
- **Asistente:** qué hacer hoy, qué haces bien, qué mejorar, qué necesita atención y ajustes pendientes.

Cada afirmación lleva una etiqueta:

| Etiqueta | Significado |
| --- | --- |
| **Dato** | Algo que registraste o se calcula directamente de tus registros. |
| **Estimación** | Resultado de una fórmula con un margen de error. |
| **Hipótesis** | Explicación posible que conviene verificar. |
| **Recomendación** | Acción sugerida. |

## 4. Nutrición

Nutrición tiene 5 pestañas: *Registro diario*, *Plan y súper* (plan de comidas, lista del súper y preparación), *Fases y eventos*, *Alimentos y recetas* y *Objetivos*.

- **Objetivos:** explica de dónde sale cada número y la distribución por comida.
- **Plan de comidas:** genera 1 o 7 días con alimentos accesibles en México. Pulsa **Otra** en una comida para **regenerarla completa** (otro platillo con las mismas calorías y macros, sin repetir lo que ya comes ese día; *Deshacer* la regresa); pulsa ↻ junto a un alimento para ver **sustitutos equivalentes**; **desliza un alimento hacia la izquierda** para que aparezca *Quitar* (o deslízalo hasta el fondo para quitarlo directo; *Deshacer* lo regresa durante unos segundos); o *Registrar hoy* para pasar una comida del plan a tu registro.
- **Lista del súper:** desde el plan de comidas toca *Lista del súper*, elige los días (y ×2 o ×4 si compras para más tiempo o personas) y crea la lista. Lo que comes cocido (pollo, arroz, frijol, pasta…) aparece en peso crudo o seco, que es como se compra. Toca cada artículo para marcarlo al echarlo al carrito; la lista se guarda y puedes compartirla por WhatsApp o Notas.
- **Alimentos:** los alimentos base están verificados contra USDA FoodData Central (SR Legacy); cada uno muestra su número FDC. Si compras un producto de marca, edita sus valores con la etiqueta. Puedes crear alimentos propios (se validan: kcal coherentes con 4/4/9, macros ≤ 100 g).
- **Código de barras:** escribe el número o usa un lector USB. Se busca primero en tu base; si no existe y hay internet, en Open Food Facts (revisa los valores antes de guardar).
- **Foto del plato (IA):** toca el ícono de cámara en cualquier comida (o *Foto* en el Dashboard), toma la foto y pulsa *Analizar*. La IA identifica el platillo y cada elemento y estima los gramos; las calorías y macros se calculan con tus alimentos verificados (USDA o tu etiqueta) y solo lo que no está en tu base usa valores estimados por la IA (marcado como tal). Verás qué del plan sí está en el plato y qué no; al agregar, puedes **reemplazar** lo que ya habías registrado en esa comida. Los gramos a simple vista tienen un error de ±20–30 %: si pesas la porción y corriges los gramos, el cálculo es exacto. Requiere activar la IA (Inteligencia artificial → Configuración de IA); la foto solo se envía al tocar *Analizar* y no se guarda.

- **IA gratis con tu app de Claude:** toca el ícono de cámara de una comida y elige *Con mi app de Claude (gratis)*. Escribe qué comiste (opcional si mandas foto), toca *Copiar instrucciones*, pégalas en la app de Claude junto con la foto, copia la respuesta y pégala en BODY OS → *Leer respuesta*. Verás los alimentos, gramos y macros para revisar antes de agregarlos (los que están en tu base se calculan con los valores verificados). También acepta una tabla pegada con alimento, cantidad, kcal, proteína, carbos y grasa. Usa tu suscripción de Claude: BODY OS no gasta tokens de la API. En *Inteligencia artificial*, *Copiar mis datos para Claude* copia tu resumen para hacerle preguntas en la app de Claude.
- **Mis platillos:** cada comida que analizas con IA (directa o pegando la respuesta de Claude) se guarda en la base de datos con su foto (cifrada; puedes adjuntarla también en el modo gratis), sus alimentos, gramos, macros y la respuesta que pegaste. Los alimentos que no estaban en tu base se agregan como alimentos propios *(estimado por IA)* para reutilizarlos. Los ves en *Alimentos y recetas → Mis platillos*: buscar por platillo o ingrediente, ver el detalle, *Registrar de nuevo* (con fecha, comida y ½, 1, 1½ o 2 porciones) o borrar. En el registro diario, el ícono de cubiertos agrega un platillo guardado a esa comida, y la foto aparece junto a lo registrado. Las fotos de comida no se mezclan con tus fotos de progreso.
- **Recetas:** en *Recetas y frecuentes* hay 24 recetas mexicanas fit (chilaquiles horneados, tinga, enchiladas suizas ligeras, pozole de pollo, ceviche, molletes de claras…) con ingredientes, preparación y macros por porción calculados con los alimentos verificados. En el plan, el botón *Receta* de cada comida muestra primero las que mejor encajan y ajusta las porciones (en cuartos) a las calorías de esa comida.
- **Preparación:** elige desde qué día y cuántos días vas a cocinar. Verás qué cocinar (en crudo y cocido), el paso a paso empezando por lo más tardado, el tiempo estimado y cada recipiente por día y comida. Lo cocido dura 3–4 días en refrigeración: los recipientes del día 5 en adelante se marcan para congelar (y el pescado después del día 2).
- **Fases y eventos:** muestra el objetivo de cada día de la semana. *Fase de mantenimiento*: al estar a 1 punto de tu % de grasa meta (o a 1 kg del peso meta) la app te lo sugiere; sube calorías de forma gradual (≈125 kcal/semana) o directa (2 semanas) hasta tu mantenimiento, y te da el rango de peso a cuidar. *Descansos de dieta*: 1–2 semanas en mantenimiento cada 6–12 semanas; la fecha estimada se recorre esos días. *Días de recarga*: carbohidratos a mantenimiento en tus días de pierna (o los que elijas), compensando en los demás días si quieres que el promedio semanal no cambie. *Eventos*: marca la fecha y las calorías extra; la app ahorra hasta 300 kcal/día en los días previos sin bajar del mínimo seguro. El registro diario y el Dashboard usan siempre el objetivo del día.
- **Saciedad:** después de comer, califica del 1 al 5 qué tan lleno quedaste (debajo de cada comida). Con 8 o más calificaciones verás qué alimentos te sacian más y cuáles te dejan con hambre, y si la proteína o la fibra marcan diferencia en ti. *Priorizarlos en mi plan* los agrega a tus alimentos preferidos para el próximo plan.

## 5. Entrenamiento

- **Mi rutina:** división elegida y su justificación, ejercicios por día con series/reps/RIR/descanso. Ajusta series con − / +. *Regenerar* muestra una propuesta antes de reemplazar.
- **Sesión de hoy:** junto a cada ejercicio verás la recomendación de progresión (*Subir peso*, *Sumar repeticiones*, *Mantener*, *Reducir carga*, *Revisar dolor*). Con ↻ cambias por una alternativa; con ⓘ ves la técnica.
- **Calentamiento y discos:** en los ejercicios compuestos verás las series de aproximación sugeridas (no cuentan como series de trabajo) y, en los de barra, el botón *Discos* indica qué discos poner por lado (barra de 20 kg).
- **¿Dónde entrenas hoy?** Antes de comenzar elige *Gimnasio de hotel*, *Casa con mancuernas*, *Peso corporal y bandas*, *Parque* o *Elegir equipo*. Cada ejercicio que no se pueda hacer se cambia por el más parecido para el mismo músculo (verás la lista de cambios); si no hay equivalente, se omite ese día. Con peso corporal sube el rango de repeticiones.
- **Movilidad:** antes de la sesión aparece una rutina de 5–8 minutos elegida según los ejercicios del día (tobillo y cadera antes de pierna, hombro antes de torso). *Guiada* la reproduce con temporizador, animación y aviso al cambiar de ejercicio.
- **Modo gimnasio:** durante la sesión toca *Modo gimnasio*: pantalla completa con un ejercicio a la vez, botones grandes de peso y repeticiones, *Serie hecha* y el descanso en grande con *+30 s* y *Saltar*. La pantalla no se apaga (iPadOS 16.4 o posterior) y al terminar el descanso suena un aviso. Sube el volumen y desactiva el modo silencio para oírlo.
- **Modo sin entrenamiento:** en Entrenamiento, botón *Modo sin entrenamiento* (por 1, 2 o 4 semanas, o hasta que lo quites). Tu rutina queda en pausa (no aparece en el calendario, el Dashboard ni los retos) y tus calorías bajan a lo que gastas sin pesas ni cardio; antes de activarlo ves cuánto. La proteína no cambia y nunca se baja del mínimo seguro. Si tienes un plan con calorías fijas, el descuento se va ajustando conforme tu gasto real (calculado con tu peso y lo que comes) ya refleja que no entrenas. *Volver a entrenar* reactiva todo.
- **Mesociclo (hipertrofia):** en Entrenamiento → *Mesociclo* inicia un bloque de 3 a 6 semanas más 1 de descarga. Cada semana te acercas un poco más al fallo (RIR 3 → 2 → 1 → 0; los compuestos nunca por debajo de 1). Al terminar el último ejercicio de cada músculo en la sesión, califícalo con 3 toques (bombeo, si llegaste adolorido y molestias en articulaciones). Con eso, cada músculo recibe para la siguiente semana +2, +1, 0 o −1 series (entre 6 y 20 series por semana en déficit). La pestaña muestra el volumen de cada músculo y por qué cambió. Al terminar, el siguiente bloque arranca con la mitad de lo que sumaste.
- **Ejercicios para crecer:** la rutina prefiere ejercicios que cargan el músculo estirado (etiqueta *Gran estiramiento*), y al cambiar un ejercicio esos aparecen primero. Tus músculos prioritarios llevan una serie extra y van al inicio de la sesión.
- **Técnicas avanzadas:** si las activas en el mesociclo, desde la semana 2 la última serie de los aislamientos ofrece myo-reps, serie descendente o parciales en estiramiento (ⓘ explica cómo hacerla). Anota las repeticiones extra; cuenta como una serie más.
- **Por músculo:** muestra la tendencia de fuerza de cada músculo en 6 semanas, marca los estancados con una sugerencia (cambiar a un ejercicio con más estiramiento o sumar una serie) y los cambios de brazo, pecho, muslo y pantorrilla.
- **Calibra tu RIR:** en *Mesociclo* → *Hacer la prueba*: en una máquina, detente cuando creas que te quedan 2, anota, y sigue hasta el fallo. La app te dice si sueles quedarte lejos o cerca del fallo.
- **RIR** = repeticiones que te quedaron en reserva. RIR 2 = podías hacer 2 más.
- **Progresión:** se sube el peso solo cuando completas el tope del rango en todas las series con el esfuerzo previsto. Si marcas dolor, no se progresa.
- **Por músculo:** series efectivas por semana, frecuencia y recuperación estimada.

## 6. Cardio, suplementos e hidratación

- **Cardio:** la meta de pasos sube gradualmente desde tu promedio real. Los intervalos solo se habilitan si tu capacidad y tus datos de salud lo permiten. Las kcal del reloj se guardan como referencia y **no** aumentan lo que puedes comer.
- **Suplementación:** ningún suplemento se recomienda por defecto. Cada uno indica si es útil para ti, opcional, innecesario o si requiere valoración, con dosis estudiadas, efectos, contraindicaciones e interacciones.
- **Hidratación:** objetivo orientativo, no obligatorio. Si tu médico fijó un límite, se usa ese.

## 7. Progreso

Gráficas por periodo, fotos cifradas (arrastra o selecciona; registra luz, hora, ropa y distancia), comparación lado a lado (avisa si las condiciones no coinciden), estadísticas y rachas.

- **Fotos con guía:** en Progreso → Fotos toca *Tomar con guía*. La primera vez verás una silueta para encuadrarte de cuerpo completo; las siguientes, tu foto anterior de la misma vista en transparencia para repetir pose, distancia y encuadre (ajusta la transparencia con *Guía*). Usa el temporizador de 5 o 10 s para alejarte. La foto se guarda cifrada en el dispositivo, igual que las demás. En el iPad, permite el acceso a la cámara cuando lo pida.
- **Hitos:** cuando logras algo importante (primer kilo, 5 % de tu peso, centímetros de cintura, cada punto de grasa menos, tu meta, +10/25/50 % de fuerza en un ejercicio, número de entrenamientos o días seguidos registrando) aparece una celebración. Todos quedan en Progreso → *Hitos*, con la fecha y lo que sigue. El peso usa la tendencia, así que un día de menos agua no cuenta como hito.
- **Resumen mensual:** en Progreso → *Resumen mensual* verás el cambio de peso (tendencia), cintura y % de grasa del mes, entrenamientos, días registrados y marcas personales. *Guardar imagen* crea una tarjeta lista para guardar en Fotos o compartir.
- **Retos semanales (Dashboard):** cada lunes se eligen 3 retos según lo que más te costó la semana anterior, con metas un poco por encima de lo que lograste. No cambian durante la semana; cumplir todos suma a tu racha.

## 8. Inteligencia artificial

- **Asistente:** responde con tus datos a: ritmo de pérdida, pérdida de músculo, calorías, proteína, volumen, recuperación, grupo rezagado, estancamiento y tiempo restante.
- **Revisión semanal:** los 10 apartados (peso promedio, diferencia, cintura, cumplimiento calórico y de macros, fuerza, actividad, hidratación, recuperación y recomendaciones).
- **Ajustes propuestos:** BODY OS solo propone cambios con al menos 3 semanas de datos suficientes; cada propuesta muestra su justificación y **no se aplica hasta que pulses *Aceptar***.
- **Configuración de IA (opcional):** introduce tu clave de Anthropic (se guarda cifrada), revisa exactamente qué datos se enviarían y activa la integración.

## 9. Calendario

**Recordatorios:** en Calendario → *Recordatorios en el calendario de tu iPad* elige qué recordar (entrenos, pesaje, medidas, revisión semanal, fotos, comidas) y toca *Agregar a mi calendario*. Abre el archivo descargado y toca *Agregar todo*: el Calendario te avisará con sus notificaciones. Si cambias tu rutina, vuelve a exportar.

Cada día muestra sus actividades. Pesaje, comidas y entrenamiento se marcan solos cuando los registras; las demás se marcan con un clic. No completar una actividad no genera penalizaciones ni cambios automáticos.

## 10. Respaldos, exportación y eliminación

En **Configuración → Datos y respaldos**:

- **Crear respaldo** (recomendado con contraseña de ≥ 8 caracteres): incluye base de datos y fotos.
- **Restaurar**: reemplaza todos los datos actuales.
- **Exportar** a JSON o CSV (Excel). **Importar** CSV de peso/medidas, pasos o comidas (fechas AAAA-MM-DD) o una exportación JSON.
- **Eliminar todo**: borra perfil, registros y fotos del equipo.

## 11. Preguntas frecuentes

**¿Qué diferencia hay entre "Según el plan" y "A tu ritmo real"?** La primera supone que sigues el ritmo de tu escenario; la segunda usa lo que tu peso hizo de verdad en las últimas 2–4 semanas (aparece cuando tienes al menos 2 semanas y 6 pesajes).

**¿Por qué mi % de grasa dice "estimado"?** Porque proviene de una fórmula con medidas corporales (error típico de ±4 puntos). Úsalo para ver tendencias.

**Subí 1 kg de un día para otro, ¿hago algo?** No. Es agua, sal o glucógeno. BODY OS usa la tendencia y solo evalúa cambios tras 3 semanas.

**¿Por qué no me baja las calorías si llevo 2 semanas sin bajar?** Se necesitan 3 semanas de datos, ≥ 70 % de días con comida registrada y que la cintura tampoco baje (si baja, probablemente estés en recomposición).

**¿Mis datos salen de mi computadora?** No, salvo que uses la búsqueda por código de barras (solo el número) o actives la IA externa.

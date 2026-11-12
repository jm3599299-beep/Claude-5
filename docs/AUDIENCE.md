# «¿Para quién es esta laptop?»

Sección de cada ficha, calculada **por configuración** (`src/lib/audience.ts`) a partir de las especificaciones
verificadas. No usa pruebas de rendimiento ni datos inventados.

## Perfiles
🎓 Estudiantes · 💼 Oficina y productividad · 💻 Programación y ciberseguridad · 🎮 Gaming · 🎨 Diseño gráfico y
fotografía · 🎬 Edición de video y contenido · 🧠 IA y tareas exigentes · ✈️ Movilidad y batería.

## Cómo se calcula
1. Cada perfil suma puntos de factores con peso explícito (RAM, CPU, GPU, pantalla, batería, peso, almacenamiento,
   ampliabilidad, refrigeración, NPU…). La puntuación se calcula **solo sobre los factores conocidos**.
2. Si faltan datos que pesan ≥ 20 puntos, el perfil no puede ser «Excelente»; si se conocen menos de la mitad de los
   factores, se muestra **«Datos insuficientes»**. Los datos ausentes se nombran en la tarjeta («No se han supuesto»).
3. Niveles: ≥ 80 Excelente · ≥ 60 Buena · ≥ 40 Regular · < 40 No recomendada.
4. Límites duros (realismo):
   - Gaming sin GPU dedicada: como mucho «Regular» (iGPU capaz) o «No recomendada»; macOS: como mucho «Regular»
     (catálogo de juegos reducido); diseño sin ventilador penaliza cargas sostenidas.
   - Diseño/foto con cobertura de color baja (p. ej. 45 % NTSC): como mucho «Regular».
   - Video: < 16 GB de RAM o CPU de bajo consumo → como mucho «Regular»; «Excelente» exige GPU dedicada de gama media
     o CPU de gama alta, y nunca en diseños sin ventilador.
   - IA sin GPU dedicada ni memoria unificada: como mucho «Regular».
   - Programación con < 16 GB: como mucho «Regular»; aviso de compatibilidad x86 en procesadores ARM.
5. Las clases de GPU/CPU (p. ej. «clase RTX xx60») se deducen del nombre del componente y se presentan como
   **estimación**, nunca como cifras de FPS o puntuaciones.

Pruebas: `src/lib/audience.test.ts` (datos reales del catálogo + un equipo ficticio marcado TEST).

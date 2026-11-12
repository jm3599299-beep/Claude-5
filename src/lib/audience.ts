/**
 * «¿Para quién es esta laptop?»
 *
 * Deterministic, explainable rules over a variant's VERIFIED specs.
 * - Each profile adds points from weighted factors. Unknown factors never add
 *   points: the score is computed over known factors only, and when an
 *   important factor is unknown the level is capped and the missing data is named.
 * - Hard caps prevent unrealistic advice (e.g. no "Buena" for gaming without a
 *   dedicated GPU).
 * - Hardware classes (e.g. "RTX xx60 class") are coarse estimates derived from
 *   the component name. They are NOT benchmarks and are labelled as estimates.
 */
import type { Gpu, Variant } from "./data/types";

export type Level = "excelente" | "buena" | "regular" | "no-recomendada" | "insuficiente";

export const LEVEL_LABEL: Record<Level, string> = {
  excelente: "Excelente",
  buena: "Buena",
  regular: "Regular",
  "no-recomendada": "No recomendada",
  insuficiente: "Datos insuficientes",
};

export type ProfileId = "estudiantes" | "oficina" | "programacion" | "gaming" | "diseno" | "video" | "ia" | "movilidad";

export interface ProfileResult {
  id: ProfileId;
  icon: string;
  title: string;
  level: Level;
  score: number | null;
  summary: string;
  can: string[];
  limits: string[];
  missing: string[];
}

/* ------------------------------------------------------------------ */
/* Component classes (coarse, name-based estimates)                    */
/* ------------------------------------------------------------------ */

export interface GpuClass {
  tier: number; // 0–5
  dedicated: boolean;
  label: string;
}

export function classifyGpu(v: Pick<Variant, "gpu" | "igpu" | "has_dgpu">): GpuClass | null {
  const g: Gpu | null = v.gpu ?? null;
  if (g) {
    const name = `${g.manufacturer} ${g.model}`;
    let tier = 2;
    const rtx = /RTX\s*(\d{2})(\d{2})/i.exec(name);
    const rx = /RX\s*(\d)(\d)\d{2}/i.exec(name);
    if (rtx) {
      const cls = Number(rtx[2]);
      const gen = Number(rtx[1]);
      tier = cls >= 80 ? 5 : cls >= 70 ? 4 : cls >= 60 ? 3 : cls >= 50 ? 2 : 1.5;
      if (gen <= 20) tier -= 1;
      else if (gen === 30) tier -= 0.5;
    } else if (/GTX|MX\s?\d/i.test(name)) tier = 1.5;
    else if (rx) {
      const cls = Number(rx[2]);
      tier = cls >= 8 ? 4.5 : cls >= 7 ? 4 : cls >= 6 ? 3 : 2;
    } else if (/RTX\s*(A|PRO)\b|Ada/i.test(name)) tier = 3;
    if (g.tgp_max_w != null && g.tgp_max_w <= 60 && tier >= 2) tier -= 0.5;
    return { tier, dedicated: true, label: `GPU dedicada ${name}` };
  }
  const i = v.igpu;
  if (i) {
    const name = `${i.manufacturer} ${i.model}`;
    let tier = 1;
    const apple = /Apple/i.test(i.manufacturer) ? /(\d+)\s*núcleos|(\d+)-core/i.exec(i.model) : null;
    if (apple) {
      const cores = Number(apple[1] ?? apple[2]);
      tier = cores >= 30 ? 3.5 : cores >= 16 ? 3 : cores >= 10 ? 2 : 1.5;
    } else if (/Arc\b.*\b1[34]0[TV]|Arc\b.*\b(B|8)\d{2}|Radeon\s*(8[89]0M|890|880)/i.test(name)) tier = 1.5;
    else if (/Arc|Radeon\s*7[68]0M|Adreno|Iris/i.test(name)) tier = 1.2;
    return { tier, dedicated: false, label: `gráficos integrados ${name}` };
  }
  return null;
}

export function classifyCpu(v: Pick<Variant, "cpu">): number | null {
  const c = v.cpu;
  if (!c) return null;
  const name = `${c.manufacturer} ${c.model}`;
  const cores = c.cores;
  if (/Apple/i.test(c.manufacturer)) {
    if (cores == null) return /Max|Ultra/i.test(c.model) ? 3.5 : /Pro/i.test(c.model) ? 3 : 2.5;
    return cores >= 14 ? 3.5 : cores >= 10 ? 2.5 : 2;
  }
  if (cores == null) return null;
  let t = cores >= 20 ? 3 : cores >= 14 ? 2.5 : cores >= 10 ? 2 : cores >= 6 ? 1.5 : cores >= 4 ? 1 : 0.5;
  if (/\bHX\b|\d{3,4}HX/i.test(name)) t = Math.max(t, 3);
  return t;
}

const isFanless = (v: Pick<Variant, "cooling">) => /sin ventilador|fanless|pasiv/i.test(v.cooling ?? "");
const isArm = (v: Pick<Variant, "cpu">) => !!v.cpu && /Apple|Qualcomm/i.test(v.cpu.manufacturer);
const isMac = (v: Pick<Variant, "os" | "cpu">) => /mac ?os/i.test(v.os ?? "") || (!!v.cpu && /Apple/i.test(v.cpu.manufacturer));

function gamutQuality(g: string | null): "alta" | "media" | "baja" | null {
  if (!g) return null;
  if (/P3|Adobe|100\s*%\s*sRGB|DCI/i.test(g)) return "alta";
  const pct = /(\d{2,3})\s*%\s*(NTSC|sRGB)/i.exec(g);
  if (pct) {
    const n = Number(pct[1]);
    if (/NTSC/i.test(pct[2])) return n >= 72 ? "media" : "baja";
    return n >= 95 ? "alta" : n >= 70 ? "media" : "baja";
  }
  return null;
}

const resWidth = (r: string | null) => (r ? Number(/^(\d+)/.exec(r)?.[1] ?? 0) : null);
const claimHours = (s: string | null) => {
  const m = s ? /hasta\s+(\d+(?:[.,]\d+)?)\s*h/i.exec(s) ?? /up to\s+(\d+(?:\.\d+)?)\s*h/i.exec(s) : null;
  return m ? Number(m[1].replace(",", ".")) : null;
};

/* ------------------------------------------------------------------ */
/* Scoring helpers                                                     */
/* ------------------------------------------------------------------ */

interface Acc {
  earned: number;
  knownMax: number;
  unknownMax: number;
  can: string[];
  limits: string[];
  missing: string[];
  cap: number;
}

const acc = (): Acc => ({ earned: 0, knownMax: 0, unknownMax: 0, can: [], limits: [], missing: [], cap: 100 });

/** Adds a factor. `points` null means the datum is unknown. */
function factor(a: Acc, max: number, points: number | null, missingLabel: string) {
  if (points === null) {
    a.unknownMax += max;
    if (!a.missing.includes(missingLabel)) a.missing.push(missingLabel);
  } else {
    a.knownMax += max;
    a.earned += Math.min(points, max);
  }
}

function finish(a: Acc): { level: Level; score: number | null } {
  if (a.knownMax < 50) return { level: "insuficiente", score: null };
  let score = Math.round((a.earned / a.knownMax) * 100);
  if (a.unknownMax >= 20) score = Math.min(score, 79); // important data missing → never "Excelente"
  score = Math.min(score, a.cap);
  const level: Level = score >= 80 ? "excelente" : score >= 60 ? "buena" : score >= 40 ? "regular" : "no-recomendada";
  return { level, score };
}

const gb = (n: number | null) => (n == null ? null : `${n} GB`);

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

type Evaluator = (v: Variant, ctx: { cpu: number | null; gpu: GpuClass | null }) => Acc & { summary: (l: Level) => string };

const profiles: { id: ProfileId; icon: string; title: string; run: Evaluator }[] = [
  {
    id: "estudiantes",
    icon: "🎓",
    title: "Estudiantes",
    run: (v, { cpu }) => {
      const a = acc();
      factor(a, 30, v.ram_gb == null ? null : v.ram_gb >= 16 ? 30 : v.ram_gb >= 8 ? 18 : 5, "RAM");
      if (v.ram_gb != null && v.ram_gb < 16) a.limits.push(`${gb(v.ram_gb)} de RAM: suficiente para lo básico, pero se quedará corta con muchas pestañas y apps abiertas.`);
      factor(a, 20, cpu == null ? null : cpu >= 1 ? 20 : 8, "procesador");
      const h = claimHours(v.battery_life_claim);
      factor(a, 20, v.battery_wh == null && h == null ? null : h != null ? (h >= 12 ? 20 : h >= 8 ? 14 : 8) : v.battery_wh! >= 55 ? 18 : v.battery_wh! >= 45 ? 13 : 7, "batería");
      factor(a, 20, v.weight_kg == null ? null : v.weight_kg <= 1.5 ? 20 : v.weight_kg <= 2 ? 12 : 4, "peso exacto");
      if (v.weight_kg != null && v.weight_kg > 2.2) a.limits.push(`Pesa ${v.weight_kg} kg: incómoda para llevar a clase todos los días.`);
      factor(a, 10, v.storage_gb == null ? null : v.storage_gb >= 512 ? 10 : v.storage_gb >= 256 ? 6 : 2, "almacenamiento");
      a.can.push("Documentos, presentaciones e investigación en línea", "Clases y videollamadas");
      if (h != null && h >= 12) a.can.push(`Jornadas largas sin cargador (autonomía declarada: ${v.battery_life_claim})`);
      return { ...a, summary: (l) => (l === "excelente" || l === "buena" ? "Cumple bien con el día a día académico." : "Sirve para tareas básicas, con concesiones.") };
    },
  },
  {
    id: "oficina",
    icon: "💼",
    title: "Oficina y productividad",
    run: (v, { cpu }) => {
      const a = acc();
      factor(a, 35, v.ram_gb == null ? null : v.ram_gb >= 16 ? 35 : v.ram_gb >= 8 ? 22 : 6, "RAM");
      factor(a, 25, cpu == null ? null : cpu >= 1.5 ? 25 : cpu >= 1 ? 18 : 8, "procesador");
      const w = resWidth(v.display_resolution);
      factor(a, 20, v.display_size_in == null && w == null ? null : (v.display_size_in != null && v.display_size_in >= 14 ? 10 : 5) + (w != null && w >= 1920 ? 10 : 4), "pantalla");
      factor(a, 10, v.storage_gb == null ? null : v.storage_gb >= 256 ? 10 : 4, "almacenamiento");
      factor(a, 10, v.ports?.length ? Math.min(10, 4 + v.ports.length) : null, "puertos");
      if (v.ram_gb != null && v.ram_gb >= 16) a.can.push("Word, Excel y hojas grandes, correo y decenas de pestañas a la vez");
      else a.can.push("Ofimática, correo y navegación");
      a.can.push("Videollamadas de trabajo");
      if (v.display_size_in != null && v.display_size_in < 14) a.limits.push(`Pantalla de ${v.display_size_in}": para trabajar muchas horas con varias ventanas conviene un monitor externo.`);
      return { ...a, summary: (l) => (l === "excelente" ? "Muy adecuada para productividad diaria." : l === "buena" ? "Adecuada para trabajo de oficina." : "Válida para tareas ligeras de oficina.") };
    },
  },
  {
    id: "programacion",
    icon: "💻",
    title: "Programación y ciberseguridad",
    run: (v, { cpu }) => {
      const a = acc();
      factor(a, 35, v.ram_gb == null ? null : v.ram_gb >= 32 ? 35 : v.ram_gb >= 24 ? 30 : v.ram_gb >= 16 ? 24 : 8, "RAM");
      if (v.ram_gb != null && v.ram_gb < 32) a.limits.push(`Con ${gb(v.ram_gb)} de RAM, varias máquinas virtuales o muchos contenedores a la vez irán justos.`);
      if (v.ram_gb != null && v.ram_gb < 16) a.cap = Math.min(a.cap, 59);
      factor(a, 25, cpu == null ? null : cpu >= 3 ? 25 : cpu >= 2.5 ? 22 : cpu >= 2 ? 18 : cpu >= 1.5 ? 12 : 5, "procesador");
      factor(a, 15, v.storage_gb == null ? null : v.storage_gb >= 1000 ? 15 : v.storage_gb >= 512 ? 10 : 4, "almacenamiento");
      const soldered = v.ram_soldered_gb != null && v.ram_gb != null && v.ram_soldered_gb >= v.ram_gb;
      const upg = v.ram_slots != null ? v.ram_slots > 0 : v.ram_soldered_gb != null ? !soldered : null;
      factor(a, 10, upg == null ? null : upg ? 10 : 4, "ampliabilidad de la RAM");
      if (upg) a.can.push("Ampliar la RAM más adelante (tiene ranura de memoria)");
      if (upg === false) a.limits.push("La RAM no se puede ampliar: elige desde el principio la capacidad que necesitarás.");
      const w = resWidth(v.display_resolution);
      factor(a, 15, w == null ? null : w >= 2560 ? 15 : w >= 1920 ? 11 : 5, "resolución de pantalla");
      a.can.push("Desarrollo web, scripts y programación general");
      if (v.ram_gb != null && v.ram_gb >= 16) a.can.push("Contenedores (Docker) y una máquina virtual ligera");
      if (isArm(v)) a.limits.push("Procesador ARM: algunas herramientas y máquinas virtuales x86 (por ejemplo, distribuciones de pentesting x86) no funcionan de forma nativa.");
      return { ...a, summary: (l) => (l === "excelente" ? "Muy capaz para desarrollo y laboratorios de seguridad." : l === "buena" ? "Adecuada para programación general." : "Útil para aprender a programar; se queda corta en cargas pesadas.") };
    },
  },
  {
    id: "gaming",
    icon: "🎮",
    title: "Gaming",
    run: (v, { cpu, gpu }) => {
      const a = acc();
      factor(a, 60, gpu == null ? null : gpu.tier >= 5 ? 60 : gpu.tier >= 4 ? 52 : gpu.tier >= 3 ? 44 : gpu.tier >= 2 ? 26 : gpu.tier >= 1.5 ? 16 : 6, "tarjeta gráfica");
      factor(a, 15, v.display_refresh_hz == null ? null : v.display_refresh_hz >= 144 ? 15 : v.display_refresh_hz >= 120 ? 11 : 3, "frecuencia de pantalla");
      factor(a, 10, cpu == null ? null : cpu >= 2 ? 10 : cpu >= 1.5 ? 6 : 2, "procesador");
      factor(a, 10, v.ram_gb == null ? null : v.ram_gb >= 16 ? 10 : 4, "RAM");
      factor(a, 5, v.cooling ? (isFanless(v) ? 0 : 5) : null, "refrigeración");
      if (isFanless(v)) a.limits.push("Diseño sin ventilador: en sesiones largas de juego el rendimiento sostenido se reduce para controlar la temperatura.");
      if (gpu) {
        if (!gpu.dedicated) {
          a.cap = Math.min(a.cap, gpu.tier >= 1.5 ? 59 : 39);
          a.limits.push("Sin tarjeta gráfica dedicada: los juegos AAA recientes no son su terreno.");
          a.can.push(gpu.tier >= 1.5 ? "Juegos ligeros, indie y títulos poco exigentes con ajustes bajos (estimación por clase de GPU)" : "Juegos muy ligeros o antiguos");
        } else if (gpu.tier >= 4) a.can.push("Juegos actuales con ajustes altos (estimación por clase de GPU, no es una prueba)");
        else if (gpu.tier >= 3) a.can.push("Juegos actuales a 1080p con ajustes medios-altos (estimación por clase de GPU)");
        else {
          a.can.push("Juegos populares a 1080p con ajustes medios-bajos (estimación por clase de GPU)");
          a.limits.push("Títulos muy exigentes requerirán bajar bastante la calidad gráfica.");
        }
      }
      if (v.display_refresh_hz != null && v.display_refresh_hz < 120) a.limits.push(`Pantalla de ${v.display_refresh_hz} Hz: no aprovecha juegos competitivos de alta tasa de fotogramas.`);
      if (isMac(v)) {
        a.cap = Math.min(a.cap, 59);
        a.limits.push("macOS tiene un catálogo de juegos más reducido que Windows: muchos títulos no están disponibles.");
      }
      return { ...a, summary: (l) => (l === "excelente" ? "Pensada para jugar con soltura." : l === "buena" ? "Apta para jugar con algunos ajustes." : l === "regular" ? "Solo para juegos ligeros." : "No es una laptop para jugar.") };
    },
  },
  {
    id: "diseno",
    icon: "🎨",
    title: "Diseño gráfico y fotografía",
    run: (v, { cpu, gpu }) => {
      const a = acc();
      const gq = gamutQuality(v.display_color_gamut);
      factor(a, 30, gq == null ? null : gq === "alta" ? 30 : gq === "media" ? 18 : 4, "cobertura de color de la pantalla");
      if (gq === "baja") {
        a.cap = Math.min(a.cap, 45);
        a.limits.push(`Cobertura de color limitada (${v.display_color_gamut}): no apta para trabajo de color preciso sin un monitor externo calibrado.`);
      }
      if (gq === "alta") a.can.push(`Edición fotográfica con buena fidelidad de color (${v.display_color_gamut})`);
      const w = resWidth(v.display_resolution);
      factor(a, 15, w == null ? null : w >= 2560 ? 15 : w >= 1920 ? 9 : 3, "resolución de pantalla");
      factor(a, 25, v.ram_gb == null ? null : v.ram_gb >= 32 ? 25 : v.ram_gb >= 16 ? 18 : 6, "RAM");
      factor(a, 15, cpu == null ? null : cpu >= 2.5 ? 15 : cpu >= 2 ? 12 : cpu >= 1.5 ? 8 : 3, "procesador");
      factor(a, 10, gpu == null ? null : gpu.tier >= 2 ? 10 : 5, "gráficos");
      factor(a, 5, v.display_brightness_nits == null ? null : v.display_brightness_nits >= 400 ? 5 : 2, "brillo");
      a.can.push("Diseño vectorial, maquetación y retoque de fotos");
      if (v.ram_gb != null && v.ram_gb < 16) a.limits.push("Archivos con muchas capas o lotes grandes de fotos RAW serán lentos con esta RAM.");
      return { ...a, summary: (l) => (l === "excelente" ? "Muy buena para trabajo creativo con color." : l === "buena" ? "Adecuada para diseño y fotografía." : "Válida para diseño ocasional, no para trabajo profesional de color.") };
    },
  },
  {
    id: "video",
    icon: "🎬",
    title: "Edición de video y contenido",
    run: (v, { cpu, gpu }) => {
      const a = acc();
      factor(a, 25, cpu == null ? null : cpu >= 3 ? 25 : cpu >= 2.5 ? 21 : cpu >= 2 ? 15 : cpu >= 1.5 ? 8 : 3, "procesador");
      factor(a, 25, v.ram_gb == null ? null : v.ram_gb >= 32 ? 25 : v.ram_gb >= 24 ? 19 : v.ram_gb >= 16 ? 13 : 4, "RAM");
      factor(a, 20, gpu == null ? null : gpu.tier >= 3 ? 20 : gpu.tier >= 2 ? 13 : gpu.tier >= 1.5 ? 8 : 3, "gráficos");
      factor(a, 15, v.storage_gb == null ? null : v.storage_gb >= 2000 ? 15 : v.storage_gb >= 1000 ? 12 : v.storage_gb >= 512 ? 7 : 2, "almacenamiento");
      const gq = gamutQuality(v.display_color_gamut);
      factor(a, 15, gq == null ? null : gq === "alta" ? 15 : gq === "media" ? 8 : 2, "cobertura de color de la pantalla");
      if (v.ram_gb != null && v.ram_gb < 16) a.cap = Math.min(a.cap, 45);
      if (cpu != null && cpu < 1.5) a.cap = Math.min(a.cap, 45);
      // "Excelente" means ready for demanding editing: needs a mid-range dedicated GPU or a high-end CPU.
      if (!((gpu?.tier ?? 0) >= 3 || (cpu ?? 0) >= 3)) a.cap = Math.min(a.cap, 79);
      if (isFanless(v)) {
        a.cap = Math.min(a.cap, 79);
        a.limits.push("Diseño sin ventilador: en exportaciones o renders largos el rendimiento sostenido se reduce.");
      } else if (v.cooling) a.can.push(`Refrigeración activa (${v.cooling}) para cargas sostenidas`);
      a.can.push("Edición de clips cortos y contenido para redes en 1080p");
      if ((v.ram_gb ?? 0) >= 24 && (cpu ?? 0) >= 2.5) a.can.push("Proyectos 4K de complejidad moderada");
      else a.limits.push("Proyectos 4K largos, muchas capas o efectos pesados serán lentos: no es una estación de edición profesional.");
      if (v.storage_gb != null && v.storage_gb < 1000) a.limits.push(`${v.storage_gb} GB de almacenamiento se llenan rápido con video: necesitarás un disco externo.`);
      return { ...a, summary: (l) => (l === "excelente" ? "Preparada para edición de video exigente." : l === "buena" ? "Buena para crear contenido con proyectos moderados." : l === "regular" ? "Para proyectos básicos, no para trabajo profesional pesado." : "No recomendada para editar video.") };
    },
  },
  {
    id: "ia",
    icon: "🧠",
    title: "IA y tareas exigentes",
    run: (v, { cpu, gpu }) => {
      const a = acc();
      const appleUnified = isMac(v) && /unificada|unified/i.test(v.ram_type ?? "");
      const vram = v.gpu?.vram_gb ?? null;
      let accel: number | null = null;
      if (gpu?.dedicated) accel = vram == null ? 15 : vram >= 12 ? 35 : vram >= 8 ? 26 : 12;
      else if (appleUnified && v.ram_gb != null) accel = v.ram_gb >= 32 ? 30 : v.ram_gb >= 24 ? 24 : 14;
      else if (gpu) accel = 6;
      factor(a, 35, accel, "acelerador gráfico para IA");
      factor(a, 25, v.ram_gb == null ? null : v.ram_gb >= 32 ? 25 : v.ram_gb >= 24 ? 19 : v.ram_gb >= 16 ? 12 : 3, "RAM");
      factor(a, 20, cpu == null ? null : cpu >= 3 ? 20 : cpu >= 2.5 ? 16 : cpu >= 2 ? 12 : 6, "procesador");
      if (isFanless(v)) a.limits.push("Sin ventilador: tareas intensivas prolongadas reducirán su rendimiento.");
      const npu = v.cpu?.npu_tops ?? null;
      factor(a, 20, npu == null ? (isMac(v) ? 12 : null) : npu >= 40 ? 20 : npu >= 10 ? 10 : 4, "NPU");
      if (npu != null && npu >= 40) a.can.push(`Funciones de IA locales aceleradas por NPU (${npu} TOPS)`);
      else if (npu != null) a.can.push(`Funciones básicas de IA con NPU (${npu} TOPS)`);
      if (gpu?.dedicated && vram != null) a.can.push(`Modelos de IA locales que quepan en ${vram} GB de memoria gráfica`);
      if (appleUnified && v.ram_gb != null) a.can.push(`Modelos de lenguaje locales pequeños y medianos usando la memoria unificada (${v.ram_gb} GB compartidos con la GPU)`);
      if (!gpu?.dedicated && !appleUnified) {
        a.cap = Math.min(a.cap, 45);
        a.limits.push("Sin GPU dedicada: entrenar o ejecutar modelos grandes en local no es viable; úsala con servicios en la nube.");
      }
      if (v.ram_gb != null && v.ram_gb < 32) a.limits.push("Para modelos grandes o entrenamiento conviene 32 GB o más de memoria, o recurrir a la nube.");
      return { ...a, summary: (l) => (l === "excelente" ? "Muy capaz para IA local y cargas intensivas." : l === "buena" ? "Adecuada para IA local de tamaño moderado." : l === "regular" ? "IA ligera y herramientas en la nube." : "No pensada para IA local ni cargas intensivas.") };
    },
  },
  {
    id: "movilidad",
    icon: "✈️",
    title: "Movilidad y batería",
    run: (v, { gpu }) => {
      const a = acc();
      factor(a, 35, v.weight_kg == null ? null : v.weight_kg <= 1.3 ? 35 : v.weight_kg <= 1.6 ? 28 : v.weight_kg <= 2 ? 16 : v.weight_kg <= 2.4 ? 8 : 2, "peso exacto");
      const h = claimHours(v.battery_life_claim);
      factor(a, 25, h == null ? null : h >= 15 ? 25 : h >= 10 ? 17 : 8, "autonomía declarada");
      factor(a, 25, v.battery_wh == null ? null : v.battery_wh >= 70 ? 25 : v.battery_wh >= 55 ? 20 : v.battery_wh >= 45 ? 13 : 5, "capacidad de batería");
      factor(a, 15, v.display_size_in == null ? null : v.display_size_in <= 14 ? 15 : v.display_size_in <= 15.6 ? 10 : 4, "tamaño");
      if (v.weight_kg != null && v.weight_kg <= 1.3) a.can.push(`Llevarla a todas partes (${v.weight_kg} kg)`);
      if (h != null) a.can.push(`Autonomía declarada por el fabricante: ${v.battery_life_claim}`);
      if (v.battery_wh != null && v.battery_wh < 50) a.limits.push(`Batería de ${v.battery_wh} Wh: modesta para jornadas largas lejos del enchufe.`);
      if (gpu?.dedicated && gpu.tier >= 3) {
        a.earned = Math.max(0, a.earned - 10);
        a.limits.push("La GPU dedicada consume mucho bajo carga: la autonomía real jugando o editando será corta.");
      }
      if (v.weight_kg == null) a.limits.push("El fabricante no publica el peso exacto de esta configuración.");
      return { ...a, summary: (l) => (l === "excelente" ? "Ideal para trabajar en movimiento." : l === "buena" ? "Portátil y con autonomía razonable." : l === "regular" ? "Transportable, pero no es su fuerte." : "Pensada más para el escritorio que para viajar.") };
    },
  },
];

export interface AudienceReport {
  profiles: ProfileResult[];
  bestFor: ProfileResult[];
  basis: { cpu: string | null; gpu: string | null };
}

export function evaluateAudience(v: Variant): AudienceReport {
  const cpu = classifyCpu(v);
  const gpu = classifyGpu(v);
  const results = profiles.map(({ id, icon, title, run }) => {
    const r = run(v, { cpu, gpu });
    const { level, score } = finish(r);
    return {
      id,
      icon,
      title,
      level,
      score,
      summary: level === "insuficiente" ? "Faltan datos verificados para evaluar este perfil con rigor." : r.summary(level),
      can: level === "insuficiente" || level === "no-recomendada" ? r.can.slice(0, 1) : r.can,
      limits: r.limits,
      missing: r.missing,
    } satisfies ProfileResult;
  });
  const bestFor = results.filter((r) => r.level === "excelente" || (r.level === "buena" && (r.score ?? 0) >= 70)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return {
    profiles: results,
    bestFor,
    basis: { cpu: v.cpu ? `${v.cpu.manufacturer} ${v.cpu.model}` : null, gpu: gpu?.label ?? null },
  };
}

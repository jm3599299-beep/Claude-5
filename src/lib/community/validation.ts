/**
 * Validation and anti-spam rules for community content. Pure functions:
 * used by server actions and covered by unit tests.
 */
import { z } from "zod";

export const EXPERIENCE_TAGS = [
  { id: "gaming", label: "Gaming" },
  { id: "estudios", label: "Estudios" },
  { id: "trabajo", label: "Trabajo" },
  { id: "programacion", label: "Programación" },
  { id: "edicion", label: "Edición" },
  { id: "bateria", label: "Batería" },
  { id: "temperaturas", label: "Temperaturas" },
  { id: "durabilidad", label: "Durabilidad" },
  { id: "problemas", label: "Problemas técnicos" },
] as const;
export const EXPERIENCE_TAG_IDS = EXPERIENCE_TAGS.map((t) => t.id) as [string, ...string[]];

export const REPORT_REASONS = [
  { id: "spam", label: "Spam o publicidad" },
  { id: "fake", label: "Reseña falsa o engañosa" },
  { id: "offensive", label: "Ofensivo o abusivo" },
  { id: "off_topic", label: "No trata sobre esta laptop" },
  { id: "copyright", label: "Infringe derechos de autor" },
  { id: "other", label: "Otro motivo" },
] as const;

const URL_RE = /\bhttps?:\/\/|\bwww\./gi;

/** Returns a reason when text looks like spam, otherwise null. */
export function spamReason(text: string): string | null {
  const links = text.match(URL_RE)?.length ?? 0;
  if (links > 2) return "Demasiados enlaces (máximo 2).";
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letters.length >= 20 && letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length / letters.length > 0.7) return "Evita escribir todo en mayúsculas.";
  if (/(.)\1{9,}/u.test(text)) return "El texto contiene caracteres repetidos en exceso.";
  if (/(\b\w+\b)(?:\W+\1\b){5,}/iu.test(text)) return "El texto repite la misma palabra demasiadas veces.";
  return null;
}

const cleanText = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((s) => s.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim())
    .pipe(z.string().min(min, `${label}: mínimo ${min} caracteres`).max(max, `${label}: máximo ${max} caracteres`))
    .superRefine((s, ctx) => {
      const reason = spamReason(s);
      if (reason) ctx.addIssue({ code: "custom", message: reason });
    });

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .union([z.literal(""), z.coerce.number()])
    .transform((v) => (v === "" ? null : v))
    .pipe(z.number().min(min, `${label} fuera de rango`).max(max, `${label} fuera de rango`).nullable());

/** Honeypot: real users never fill the hidden "website" field. */
const honeypot = z.literal("", { error: "Envío rechazado" });

export const reviewSchema = z.object({
  modelId: z.uuid(),
  modelSlug: z.string().regex(/^[a-z0-9-]+$/),
  variantId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  rating: z.coerce.number().int().min(1, "Elige una valoración").max(5),
  title: cleanText(3, 120, "Título"),
  body: cleanText(30, 8000, "Reseña"),
  tags: z.array(z.enum(EXPERIENCE_TAG_IDS)).max(9).default([]),
  usageMonths: optionalNumber(0, 240, "Meses de uso"),
  tempC: optionalNumber(0, 120, "Temperatura"),
  batteryH: optionalNumber(0, 48, "Autonomía"),
  website: honeypot,
});

export const commentSchema = z.object({
  modelId: z.uuid(),
  modelSlug: z.string().regex(/^[a-z0-9-]+$/),
  reviewId: z.uuid(),
  parentId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  body: cleanText(2, 2000, "Comentario"),
  website: honeypot,
});

export const reportSchema = z.object({
  targetType: z.enum(["review", "comment", "photo"]),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS.map((r) => r.id) as [string, ...string[]]),
  details: z.string().trim().max(1000).optional().default(""),
  modelSlug: z.string().regex(/^[a-z0-9-]+$/),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Nombre: mínimo 2 caracteres").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "Usuario: 3-24 caracteres (a-z, 0-9, _)")
    .or(z.literal("").transform(() => null)),
});

export const credentialsSchema = z.object({
  email: z.email("Correo no válido").max(254),
  password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(72),
  website: honeypot,
});

/** Image validation by magic bytes (never trust the declared MIME type). */
export function sniffImage(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos no válidos";
}

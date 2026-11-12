# Cuentas y comunidad

## Autenticación (Supabase Auth)
- Registro e inicio de sesión con correo y contraseña (`/registro`, `/entrar`), confirmación por correo (`/auth/confirm`,
  admite el flujo PKCE `?code=` y `?token_hash=`), «Mi cuenta» (`/cuenta`) y cierre de sesión.
- `src/proxy.ts` refresca la sesión en cada petición. Todo lo que depende del usuario se renderiza en tiempo de petición
  dentro de `<Suspense>`; el contenido público sigue cacheado.
- Mensajes genéricos (no revelan si un correo existe). Redirecciones solo a rutas internas (sin *open redirect*).

### Configuración en Supabase
1. Authentication → URL Configuration: *Site URL* = tu dominio; añade `https://<dominio>/auth/confirm` a *Redirect URLs*.
2. Authentication → Providers → Email: activa «Confirm email».
3. Ajusta los límites de Auth (Rate Limits) y, si quieres, activa CAPTCHA (hCaptcha/Turnstile) en Auth → Bot protection.

## Comunidad por modelo
Reseñas (1 por usuario y modelo, editables), valoración 1–5, etiquetas de experiencia (gaming, estudios, trabajo,
programación, edición, batería, temperaturas, durabilidad, problemas técnicos), datos aportados por el usuario
(meses de uso, temperatura, autonomía; marcados como **no verificados**), comentarios con respuestas (1 nivel),
«me gusta», reportes, fotos propias y favoritos. Feed general en `/comunidad`. Normas en `/normas`.

Opiniones de usuarios y **pruebas profesionales** se muestran y promedian por separado (`model_rating_stats`).

## Moderación y anti-spam
| Medida | Dónde |
| --- | --- |
| Reseñas de cuentas con < 24 h → `pending` | trigger `protect_review_fields` |
| Fotos de usuarios → siempre `pending`; bucket **privado**, solo se sirven aprobadas (URL firmada) | trigger + política de Storage |
| 3 reportes abiertos → contenido oculto | trigger `auto_hide_reported` (corregido en esta fase) |
| Campos protegidos (estado, «profesional», contadores, autor) | triggers `protect_*` |
| Contadores de «me gusta» calculados por la BD; no a contenido propio ni oculto | `sync_likes_count`, `check_like_target` |
| Límites: reseñas 3/h, comentarios 10/10 min, me gusta 120/h, reportes 20/día, fotos 10/día | `check_rate_limit` |
| Honeypot, máx. 2 enlaces, mayúsculas/repeticiones, comentarios duplicados en 24 h | `src/lib/community/validation.ts`, acciones |
| Imágenes validadas por *magic bytes* (JPEG/PNG/WebP), máx. 5 MB, carpeta por usuario | `uploadPhotoAction` + Storage |
| Cuentas suspendidas (`is_banned`) no pueden publicar | políticas RLS + acciones |

## Pruebas
- `supabase/tests/community_smoke.sql` (12 reglas en Postgres con RLS).
- `src/lib/community/validation.test.ts` (validación y antispam).
- Prueba de extremo a extremo en navegador (sesión simulada, escrituras reales con RLS) documentada en el historial;
  el inicio de sesión real con Supabase Auth debe probarse en un proyecto de Supabase.

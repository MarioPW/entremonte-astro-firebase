# Entremonte — Astro + Tailwind + Preact

Migración del sitio estático (`public_html`, template Sona/Bootstrap/jQuery) a Astro.

## Capa de datos (Repository Pattern)

```
src/lib/
├── types.ts                     ← contrato canónico del dominio (GalleryImage, Cabin, SliderSlide, Review)
├── config.ts                    ← resuelve PUBLIC_DATA_SOURCE / API_BASE_URL / timeout
├── providers/
│   ├── DataProvider.ts          ← INTERFAZ única de datos
│   ├── ApiDataProvider.ts       ← fetch al Django REST (Render), con timeout y normalización
│   ├── LocalDataProvider.ts     ← import estático de src/data/*.json (sin fetch)
│   ├── withFallback.ts          ← decorator: si el API falla, cae al local
│   └── index.ts                 ← fábrica + singleton `dataProvider`
└── services/
    ├── galleryService.ts        ← galleryService.getImages()
    ├── cabinService.ts          ← cabinService.getAll() / .getById(id)
    ├── sliderService.ts         ← sliderService.getSlides()
    └── reviewService.ts         ← reviewService.getAll()
```

**Regla:** páginas Astro e islas Preact leen **solo** desde `@/lib/services`;
las escrituras en cliente usan `@/lib/auth` (Firebase Auth) y `@/lib/reservations`
(Firestore). Nunca usan `fetch` directo ni importan providers concretos.

### Conmutación

| `PUBLIC_DATA_SOURCE` | Comportamiento |
|---|---|
| `api` | Siempre el API de Render. Si está caído, **el build falla** (ruidoso a propósito). |
| `local` | Siempre los JSON de `src/data/`. Sin red, build instantáneo. |
| `fallback` *(default)* | API primero; ante error/timeout → JSON local con `console.warn`. |

Variables (ver `.env.example`): `PUBLIC_API_BASE_URL`, `PUBLIC_API_TIMEOUT_MS`.

### Datos locales (`src/data/`)

Generados desde el volcado real de Django (`djangoDRF/datos_entremonte.json`):
3 cabañas + 7 servicios + 1 slider. `gallery.json` es el JSON de imágenes de Booking
ya existente. Las URLs de imágenes de cabañas/slider apuntan a ese JSON porque el
storage original (Cloudinary) no está disponible offline.

## Estructura

```
src/
├── layouts/Base.astro           ← <head> SEO + header + footer
├── components/
│   ├── Header.astro             ← nav + barra contacto + menú móvil (script vanilla)
│   ├── Footer.astro             ← redes, contacto, copyright (atribución Colorlib)
│   └── PageHead.astro           ← título + breadcrumbs
├── pages/
│   ├── index.astro              ← PLACEHOLDER smoke (se reemplaza en Fase 3)
│   ├── gallery.astro            ← 50 fotos desde el servicio + "Ver más"
│   ├── about-us.astro
│   └── contact.astro            ← datos + mapa (el form original estaba muerto)
├── lib/ …                       ← capa de datos (ver arriba)
├── data/                        ← JSON locales de respaldo
└── styles/global.css            ← design system (@theme + @layer components)
```

Sin Bootstrap, jQuery ni icon fonts: Tailwind v4 + SVG inline.

## Comandos

```bash
npm run dev      # desarrollo
npm run build    # genera dist/
npm run astro check
```

## QA (Lighthouse, mobile throttled, Chrome headless)

| Métrica | Resultado |
|---|---|
| Performance | **99** |
| Accessibility | **100** |
| Best Practices | **100** |
| SEO | **100** |
| FCP / LCP / TBT / CLS | 0.9 s / 2.2 s / 0 ms / 0.005 |

Optimizaciones que aportaron el salto (84 → 99):
1. **Fuentes self-hosted** (`@fontsource/lora`, `@fontsource/cabin`) → elimina render-blocking a Google Fonts.
2. **`<picture>` en el hero**: `max500` (37–63 KB) en móvil ≤768px, `max1024x768` (246 KB) en desktop.
   La CDN de Booking permite cambiar el segmento de tamaño manteniendo el hash `k`.
3. `fetchpriority="high"` + `loading="eager"` en el primer slide.

Verificación: links internos sin huérfanos, rutas 200/404 correctas, `/_astro/*` sin referencias rotas.

## Deploy

```bash
npm run deploy   # build + limpia artefactos + copia a ../public_html
```

- Destino: `/home/mario/Documents/entremonte/public_html` (Apache/cPanel).
- `.htaccess` propio: compresión, caché y **301** desde las rutas del sitio viejo
  (`/galery.html` → `/gallery`, `/room-details.html` → `/cabins`, etc.). Conservado por el script.
- Respaldo previo a la primera migración:
  `/home/mario/Documents/entremonte/respaldo_public_html_pre_migracion_20261110_0002.tar.gz` (4.8 MB).

## Estado

- [x] Fase 1: scaffold + capa de datos desacoplada
- [x] Fase 2: Base.astro + páginas gallery / about-us / contact
- [x] Fase 3: index real + cabins + cabin/[id] (getStaticPaths) + islas Preact
- [x] Fase 4: QA (Lighthouse 99/100/100/100) + deploy a public_html
- [x] Fase 5: Firebase SDK + `FirebaseDataProvider` + Auth/reservas con Firebase

### Pendientes / notas de backend

- Auth y reservas migradas a **Firebase Auth + Firestore** (`src/lib/auth.ts`, `src/lib/reservations.ts`); los endpoints JWT de Render ya no se usan desde el frontend. Admin: `PUBLIC_ADMIN_EMAILS` o colección `admins/{uid}`.
- Firestore en producción: abrir `allow read` en las reglas y sembrar los datos (`npm run seed` con una service account).
- El API de Render está caído (500/timeout) → las lecturas decaen al provider local (`fallback`).
- `POST /api/review/` probablemente falle en el servidor: el serializer no setea `user` (FK NOT NULL). Solo se consume GET.

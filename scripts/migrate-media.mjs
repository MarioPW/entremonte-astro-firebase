#!/usr/bin/env node
/**
 * Migración de medios: sube las imágenes externas (CDN de Booking) a
 * Cloudinary, actualiza Firestore y reescribe `src/data/*.json` con las
 * nuevas URLs para que un re-seed posterior no revierta la migración.
 *
 * Uso (después de `npm run seed`):
 *   npm run migrate:media
 *
 * Credenciales Firestore (una de las dos):
 *   - FIREBASE_SERVICE_ACCOUNT_KEY → JSON de la service account como string, o
 *   - GOOGLE_APPLICATION_CREDENTIALS → ruta al archivo JSON (ADC por defecto).
 * Cloudinary: PUBLIC_CLOUDINARY_CLOUD_NAME / PUBLIC_CLOUDINARY_UPLOAD_PRESET (.env).
 *
 * Idempotente: las URLs ya apuntando a `res.cloudinary.com` se omiten.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BATCH_LIMIT = 400;
const UPLOAD_CONCURRENCY = 4;
const pad = (index) => String(index + 1).padStart(3, '0');

/** Lee `.env` (con merge de `process.env`, que tiene prioridad). */
function readEnv() {
  const values = {};
  let raw = '';
  try {
    raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
  } catch {
    // sin .env: se confía en process.env
  }
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return { ...values, ...process.env };
}

function initApp(env) {
  if (getApps().length > 0) return getApps()[0];

  const key = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    const serviceAccount = JSON.parse(key.replace(/\\n/g, '\n'));
    return initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  return initializeApp({
    credential: applicationDefault(),
    projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
  });
}

function readItems(file) {
  const items = JSON.parse(readFileSync(resolve(ROOT, 'src/data', file), 'utf8'));
  if (!Array.isArray(items)) throw new Error(`src/data/${file} no contiene un array`);
  return items;
}

function writeItems(file, items) {
  writeFileSync(resolve(ROOT, 'src/data', file), `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

/** URLs externas aún no migradas (las de Cloudinary se omiten). */
function needsMigration(url) {
  return typeof url === 'string' && url.startsWith('http') && !url.includes('res.cloudinary.com');
}

/** Ejecuta `worker` sobre `items` con un máximo de `limit` en paralelo. */
async function pool(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) await worker(queue.shift());
  });
  await Promise.all(workers);
}

function fileNameFor(url) {
  try {
    const base = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base;
  } catch {
    // URL inválida → nombre por defecto
  }
  return 'imagen.jpg';
}

/** Descarga la imagen y la sube a Cloudinary (unsigned). */
async function uploadToCloudinary(url, endpoint, preset) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const download = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!download.ok) throw new Error(`descarga HTTP ${download.status}`);
      const type = download.headers.get('content-type') || 'image/jpeg';
      const bytes = await download.arrayBuffer();

      const form = new FormData();
      // Prefijo de hash → nombres únicos aunque repita el nombre del archivo.
      const hash = createHash('sha1').update(url).digest('hex').slice(0, 8);
      form.append('file', new Blob([bytes], { type }), `${hash}-${fileNameFor(url)}`);
      form.append('upload_preset', preset);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.secure_url || !payload?.public_id) {
        throw new Error(`Cloudinary ${response.status}: ${payload?.error?.message ?? 'sin detalle'}`);
      }
      return { url: payload.secure_url, publicId: payload.public_id };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${url} → ${lastError instanceof Error ? lastError.message : lastError}`);
}

/** Commit de updates en lotes de 400. */
async function commitUpdates(refs) {
  for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    refs.slice(start, start + BATCH_LIMIT).forEach(([ref, data]) => batch.update(ref, data));
    await batch.commit();
  }
}

let db;

async function main() {
  const env = readEnv();
  const cloudName = String(env.PUBLIC_CLOUDINARY_CLOUD_NAME ?? '').trim();
  const preset = String(env.PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '').trim();
  if (!cloudName || !preset) {
    throw new Error('Faltan PUBLIC_CLOUDINARY_CLOUD_NAME / PUBLIC_CLOUDINARY_UPLOAD_PRESET (revisa .env)');
  }

  db = getFirestore(initApp(env));
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const gallery = readItems('gallery.json');
  const slider = readItems('slider.json');
  const cabins = readItems('cabins.json');

  // 1. Recolectar URLs únicas pendientes de migrar.
  const pending = new Set();
  for (const item of gallery) if (needsMigration(item.url)) pending.add(item.url);
  for (const item of slider) if (needsMigration(item.url)) pending.add(item.url);
  for (const cabin of cabins) for (const url of cabin.images ?? []) if (needsMigration(url)) pending.add(url);

  // 2. Subir a Cloudinary (sin reintentos globales; cada URL dedupe por mapa).
  const urlMap = new Map(); // URL externa → { url, publicId }
  let done = 0;
  await pool([...pending], UPLOAD_CONCURRENCY, async (url) => {
    try {
      urlMap.set(url, await uploadToCloudinary(url, endpoint, preset));
    } catch (error) {
      console.error(`✖ ${error instanceof Error ? error.message : error}`);
      throw error;
    }
    done += 1;
    console.log(`  (${done}/${pending.size}) ✔ ${url.split('/').pop()?.slice(0, 40)}`);
  });
  console.log(`✔ ${urlMap.size} imágenes subidas a Cloudinary.`);

  // 3. Actualizar Firestore (ids deterministas del seed).
  const updates = [];

  const gallerySnap = await db.collection('gallery').get();
  const galleryById = new Map(gallerySnap.docs.map((doc) => [doc.id, doc]));
  gallery.forEach((item, index) => {
    const uploaded = urlMap.get(item.url);
    if (!uploaded) return;
    const snapshot = galleryById.get(`img-${pad(index)}`);
    if (!snapshot) return console.warn(`⚠ gallery/img-${pad(index)} no existe; se omite`);
    updates.push([snapshot.ref, { url: uploaded.url, public_id: uploaded.publicId }]);
  });

  const sliderSnap = await db.collection('slider').get();
  const sliderById = new Map(sliderSnap.docs.map((doc) => [doc.id, doc]));
  slider.forEach((item, index) => {
    const uploaded = urlMap.get(item.url);
    if (!uploaded) return;
    const snapshot = sliderById.get(`slide-${pad(index)}`);
    if (!snapshot) return console.warn(`⚠ slider/slide-${pad(index)} no existe; se omite`);
    updates.push([snapshot.ref, { url: uploaded.url }]);
  });

  const cabinsSnap = await db.collection('cabins').get();
  const cabinsById = new Map(cabinsSnap.docs.map((doc) => [doc.id, doc]));
  for (const cabin of cabins) {
    const snapshot = cabinsById.get(String(cabin.id));
    if (!snapshot) {
      console.warn(`⚠ cabins/${cabin.id} no existe; se omite`);
      continue;
    }
    const data = snapshot.data();
    const patch = {
      images: (cabin.images ?? []).map((url) => urlMap.get(url)?.url ?? url),
      priceWeekday: cabin.priceWeekday ?? null,
      priceWeekend: cabin.priceWeekend ?? null,
    };
    // El esquema no admite reseñas por cabaña (viven en `reviews`).
    if (data.reviews !== undefined) patch.reviews = FieldValue.delete();
    updates.push([snapshot.ref, patch]);
  }

  await commitUpdates(updates);
  console.log(`✔ Firestore: ${updates.length} docs actualizados.`);

  // 4. Reescribir los JSON locales (fuente del seed y del provider local).
  const nextGallery = gallery.map((item) =>
    urlMap.has(item.url) ? { ...item, url: urlMap.get(item.url).url } : item,
  );
  const nextSlider = slider.map((item) =>
    urlMap.has(item.url) ? { ...item, url: urlMap.get(item.url).url } : item,
  );
  const nextCabins = cabins.map(({ reviews: _reviews, ...cabin }) => ({
    ...cabin,
    images: (cabin.images ?? []).map((url) => urlMap.get(url)?.url ?? url),
    priceWeekday: cabin.priceWeekday ?? null,
    priceWeekend: cabin.priceWeekend ?? null,
  }));

  writeItems('gallery.json', nextGallery);
  writeItems('slider.json', nextSlider);
  writeItems('cabins.json', nextCabins);
  console.log('✔ src/data/{gallery,slider,cabins}.json reescritos.');
  console.log('✔ Migración completada.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('✖ Migración falló:', error instanceof Error ? error.message : error);
    process.exit(1);
  });

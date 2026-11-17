#!/usr/bin/env node
/**
 * Seed de Firestore desde los JSON locales (`src/data/*.json`).
 *
 * Uso:
 *   npm run seed
 *
 * Credenciales (una de las dos):
 *   - FIREBASE_SERVICE_ACCOUNT_KEY → JSON de la service account como string
 *     (admite \n escapados), o
 *   - GOOGLE_APPLICATION_CREDENTIALS → ruta al archivo JSON (ADC por defecto).
 *   El projectId se toma de la service account o de PUBLIC_FIREBASE_PROJECT_ID.
 *
 * Semántica: reemplazo — borra los docs existentes de cada colección y escribe
 * los del JSON con ids deterministas (`img-001`, `rev-001`, cabañas por uuid),
 * más el campo `order` con la posición original (lo usa `orderBy('order')`
 * en FirebaseDataProvider).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BATCH_LIMIT = 400; // el máximo de operaciones por batch es 500
const pad = (index) => String(index + 1).padStart(3, '0');

const COLLECTIONS = [
  { name: 'gallery', file: 'gallery.json', makeId: (_item, i) => `img-${pad(i)}` },
  { name: 'reviews', file: 'reviews.json', makeId: (_item, i) => `rev-${pad(i)}` },
  { name: 'cabins', file: 'cabins.json', makeId: (item) => String(item.id) },
  { name: 'slider', file: 'slider.json', makeId: (_item, i) => `slide-${pad(i)}` },
];

function initApp() {
  if (getApps().length > 0) return getApps()[0];

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    const serviceAccount = JSON.parse(key.replace(/\\n/g, '\n'));
    return initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID,
  });
}

function readItems(file) {
  const items = JSON.parse(readFileSync(resolve(ROOT, 'src/data', file), 'utf8'));
  if (!Array.isArray(items)) throw new Error(`src/data/${file} no contiene un array`);
  return items;
}

async function seedCollection(db, { name, file, makeId }) {
  const items = readItems(file);

  // 1. Limpiar la colección (reemplazo limpio, sin docs huérfanos).
  const existing = await db.collection(name).get();
  for (let start = 0; start < existing.size; start += BATCH_LIMIT) {
    const batch = db.batch();
    existing.docs.slice(start, start + BATCH_LIMIT).forEach((snapshot) => batch.delete(snapshot.ref));
    await batch.commit();
  }

  // 2. Escribir los docs nuevos con `order` (posición en el array original).
  let batch = db.batch();
  let pending = 0;
  for (const [index, item] of items.entries()) {
    batch.set(db.collection(name).doc(makeId(item, index)), { ...item, order: index });
    if (++pending === BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();

  console.log(`✔ ${name}: ${items.length} docs (${existing.size} eliminados)`);
}

async function main() {
  const authMode = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? 'FIREBASE_SERVICE_ACCOUNT_KEY'
    : process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? 'GOOGLE_APPLICATION_CREDENTIALS'
      : 'applicationDefault (revisa tus credenciales)';
  console.log(`→ Autenticación: ${authMode}`);

  const db = getFirestore(initApp());
  for (const spec of COLLECTIONS) await seedCollection(db, spec);
  console.log('✔ Seed completado.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('✖ Seed falló:', error instanceof Error ? error.message : error);
    process.exit(1);
  });

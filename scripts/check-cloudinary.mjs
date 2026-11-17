#!/usr/bin/env node
/**
 * Smoke test de la subida unsigned a Cloudinary (galería del panel admin).
 *
 *   npm run test:cloudinary
 *
 * Sube un PNG de 1×1 (70 bytes) y confirma que Cloudinary devuelve
 * `secure_url` + `public_id`. Sale con código 1 si algo falla.
 * Nota: cada ejecución deja una imagen de prueba en la cuenta de Cloudinary.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** PNG 1×1 transparente. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

async function main() {
  const env = readEnv();
  const cloudName = String(env.PUBLIC_CLOUDINARY_CLOUD_NAME ?? '').trim();
  const uploadPreset = String(env.PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '').trim();

  if (!cloudName || !uploadPreset) {
    console.error('✖ Faltan PUBLIC_CLOUDINARY_CLOUD_NAME / PUBLIC_CLOUDINARY_UPLOAD_PRESET (revisa .env)');
    process.exit(1);
  }

  const form = new FormData();
  form.append('file', new Blob([PIXEL_PNG], { type: 'image/png' }), 'smoke-test.png');
  form.append('upload_preset', uploadPreset);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  console.log(`→ POST ${endpoint}`);
  console.log(`→ preset: ${uploadPreset}`);

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    console.error('✖ Sin respuesta de Cloudinary:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.secure_url || !payload?.public_id) {
    console.error(`✖ Cloudinary respondió ${response.status}:`, payload?.error?.message ?? payload);
    console.error('  → Revisa que el preset esté en modo Unsigned (Settings → Upload → Upload presets).');
    process.exit(1);
  }

  console.log('✔ Subida correcta');
  console.log('  secure_url:', payload.secure_url);
  console.log('  public_id :', payload.public_id);
  console.log('  bytes     :', payload.bytes);
}

main();

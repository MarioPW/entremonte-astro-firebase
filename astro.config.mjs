// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// https://astro.build/config
export default defineConfig({
  // Dominio definitivo pendiente de confirmar (el certificado actual usa xn--entremontecabaas-kub.com).
  outDir: './public_html',
  integrations: [preact()],
  vite: {
    plugins: [
      // Cast defensivo: @tailwindcss/vite trae vite@8 y Astro usa vite@6 anidado.
      /** @type {any} */ (tailwindcss()),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  },
});
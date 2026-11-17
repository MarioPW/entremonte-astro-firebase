#!/usr/bin/env bash
# Build + deploy a public_html. Conserva .vscode y .htaccess;
# borra solo los artefactos que genera Astro (evita archivos huérfanos con hash).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$(cd "$ROOT/.." && pwd)/public_html"

if [ ! -d "$TARGET" ]; then
  echo "✖ No existe el destino: $TARGET" >&2
  exit 1
fi

cd "$ROOT"
echo "→ Build…"
npm run build

echo "→ Limpiando artefactos anteriores en $TARGET"
for path in _astro img about-us cabins cabin gallery contact index.html; do
  rm -rf "$TARGET/$path"
done

echo "→ Copiando dist/"
cp -r "$ROOT/dist/." "$TARGET/"

echo "✔ Deploy completo → $TARGET"

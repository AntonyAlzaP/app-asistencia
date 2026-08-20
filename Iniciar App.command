#!/bin/bash
# Doble clic para abrir la app sin pasar por el instalador empaquetado.
cd "$(dirname "$0")" || exit 1
npm run electron:run

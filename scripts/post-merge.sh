#!/bin/bash
set -e

echo "[post-merge] Installing root dependencies..."
npm install --no-audit --no-fund --prefer-offline

if [ -d "web-admin" ]; then
  echo "[post-merge] Installing web-admin dependencies..."
  npm install --prefix web-admin --no-audit --no-fund --prefer-offline
fi

echo "[post-merge] TypeScript check (mobile)..."
npx tsc --noEmit

if [ -d "web-admin" ]; then
  echo "[post-merge] TypeScript check (web-admin)..."
  (cd web-admin && npx tsc --noEmit)
fi

echo "[post-merge] Done."

#!/usr/bin/env bash
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is not installed. Install it first with: npm i -g vercel"
  exit 1
fi

echo "Deploying GasTos PH to Vercel production..."
vercel --prod

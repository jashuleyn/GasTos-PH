$ErrorActionPreference = "Stop"

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Host "Vercel CLI is not installed. Install it first with: npm i -g vercel" -ForegroundColor Yellow
  exit 1
}

Write-Host "Deploying GasTos PH to Vercel production..." -ForegroundColor Cyan
vercel --prod

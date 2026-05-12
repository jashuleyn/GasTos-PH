# GasTos PH - Vercel Deployment Guide

This folder contains the deployment configuration and performance-checking scripts for submitting GasTos PH as a cloud/edge-deployed HCI prototype.

## Deployment option A: Vercel Dashboard

1. Push this updated project to GitHub.
2. Open Vercel and choose **Add New Project**.
3. Import `jashuleyn/GasTos-PH`.
4. Use these settings:
   - Framework Preset: **Other**
   - Root Directory: `.`
   - Build Command: leave blank / none
   - Output Directory: `.`
   - Environment Variables: none required
5. Click **Deploy**.
6. After deployment, open the generated `https://<project-name>.vercel.app` URL.

## Deployment option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

On Windows PowerShell, you can also run:

```powershell
.\scripts\deploy-vercel.ps1
```

On Git Bash / macOS / Linux:

```bash
./scripts/deploy-vercel.sh
```

## Performance check

After deployment, run:

```bash
npm run perf -- https://<your-vercel-url>.vercel.app
```

To include external CDN/API resources such as Leaflet, Google Fonts, and map dependencies:

```bash
npm run perf -- https://<your-vercel-url>.vercel.app --include-external --runs=5
```

## Manual verification checklist

- Calculator page loads without console errors.
- Vehicle picker filters compatible fuel types.
- Fuel price auto-fills when fuel type or station changes.
- Origin/destination search returns Philippine locations.
- Road and straight-line distance modes update the distance field.
- Station locator searches nearby stations and shows station cards.
- “Use this price” / station price action returns to the calculator and applies the chosen price.
- Prices and community pages render correctly on desktop and mobile width.

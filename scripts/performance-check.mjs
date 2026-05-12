#!/usr/bin/env node
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const urlArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const target = urlArg || 'http://127.0.0.1:3000/';
const includeExternal = process.argv.includes('--include-external');
const runsArg = process.argv.find(arg => arg.startsWith('--runs='));
const runs = runsArg ? Math.max(1, Number(runsArg.split('=')[1]) || 1) : 3;

function requestMetrics(urlString) {
  return new Promise((resolve) => {
    const url = new URL(urlString);
    const lib = url.protocol === 'https:' ? https : http;
    const started = performance.now();
    let firstByte = null;
    let bytes = 0;

    const req = lib.get(url, {
      headers: {
        'User-Agent': 'GasTosPH-PerformanceCheck/1.0',
        'Accept': '*/*'
      }
    }, (res) => {
      firstByte = performance.now();
      const chunks = [];
      res.on('data', (chunk) => {
        bytes += chunk.length;
        chunks.push(chunk);
      });
      res.on('end', () => {
        const ended = performance.now();
        resolve({
          url: urlString,
          status: res.statusCode,
          bytes,
          ttfbMs: Math.round(firstByte - started),
          totalMs: Math.round(ended - started),
          contentType: res.headers['content-type'] || '',
          cacheControl: res.headers['cache-control'] || '',
          body: Buffer.concat(chunks).toString('utf8')
        });
      });
    });

    req.on('error', (error) => {
      resolve({ url: urlString, status: 'ERROR', bytes: 0, ttfbMs: 0, totalMs: 0, error: error.message, body: '' });
    });

    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timed out after 15 seconds'));
    });
  });
}

function unique(values) {
  return [...new Set(values)];
}

function extractAssets(html, baseUrl) {
  const urls = [];
  const patterns = [
    /<script[^>]+src=["']([^"']+)["']/gi,
    /<link[^>]+href=["']([^"']+)["']/gi,
    /<img[^>]+src=["']([^"']+)["']/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const assetUrl = new URL(match[1], baseUrl).toString();
        urls.push(assetUrl);
      } catch (_) {}
    }
  }

  const baseHost = new URL(baseUrl).host;
  return unique(urls).filter((assetUrl) => includeExternal || new URL(assetUrl).host === baseHost);
}

function average(items, key) {
  return Math.round(items.reduce((sum, item) => sum + Number(item[key] || 0), 0) / Math.max(1, items.length));
}

async function measureMany(urlString) {
  const measurements = [];
  for (let i = 0; i < runs; i++) {
    measurements.push(await requestMetrics(urlString));
  }
  const latest = measurements[measurements.length - 1];
  return {
    ...latest,
    runs,
    avgTtfbMs: average(measurements, 'ttfbMs'),
    avgTotalMs: average(measurements, 'totalMs')
  };
}

const normalizedTarget = new URL(target).toString();
const page = await measureMany(normalizedTarget);
const assets = extractAssets(page.body || '', normalizedTarget);
const assetMetrics = [];

for (const asset of assets) {
  assetMetrics.push(await measureMany(asset));
}

const successfulAssets = assetMetrics.filter(item => Number(item.status) >= 200 && Number(item.status) < 400);
const failedAssets = assetMetrics.filter(item => !(Number(item.status) >= 200 && Number(item.status) < 400));
const totalBytes = page.bytes + successfulAssets.reduce((sum, item) => sum + item.bytes, 0);
const slowest = [...assetMetrics].sort((a, b) => b.avgTotalMs - a.avgTotalMs).slice(0, 5);

console.log('\nGasTos PH Performance Check');
console.log('='.repeat(32));
console.log(`Target: ${normalizedTarget}`);
console.log(`Runs per resource: ${runs}`);
console.log(`Include external resources: ${includeExternal ? 'yes' : 'no'}`);
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('\nPage');
console.log(`- Status: ${page.status}`);
console.log(`- Avg TTFB: ${page.avgTtfbMs} ms`);
console.log(`- Avg total download: ${page.avgTotalMs} ms`);
console.log(`- HTML bytes: ${page.bytes.toLocaleString()}`);
console.log(`- Cache-Control: ${page.cacheControl || 'not set'}`);
if (page.error) console.log(`- Error: ${page.error}`);
console.log('\nAssets');
console.log(`- Assets checked: ${assetMetrics.length}`);
console.log(`- Successful assets: ${successfulAssets.length}`);
console.log(`- Failed assets: ${failedAssets.length}`);
console.log(`- Total transferred bytes checked: ${totalBytes.toLocaleString()}`);

if (slowest.length) {
  console.log('\nSlowest resources');
  for (const item of slowest) {
    console.log(`- ${item.avgTotalMs} ms | ${item.status} | ${item.bytes.toLocaleString()} bytes | ${item.url}`);
  }
}

if (failedAssets.length) {
  console.log('\nFailed resources');
  for (const item of failedAssets) {
    console.log(`- ${item.status} | ${item.error || ''} | ${item.url}`);
  }
  process.exitCode = 1;
}

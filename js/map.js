// ────────────────────────────────────────────────
// MAP — Leaflet calculator map + station locator
// fixed station locator logic
// ────────────────────────────────────────────────

let calcMap = null, mainMap = null;
let originMarker = null, destMarker = null;
let routingControl = null, straightLine = null;
let originData = null, destData = null;
let routeDistKm = null, routeType = 'road';
let pendingPin = { lat: null, lon: null, addr: null };

// Station locator state
let stationMarkers = [];
let locationPin = null;
let selectedStation = null;
let searchedStations = [];
let lastSearchedLocation = null;

// ── BRAND COLOUR MAP ──────────────────────────────────────
const BRAND_COLORS = {
  shell: '#FFD700',
  petron: '#FF4136',
  caltex: '#003580',
  seaoil: '#00AEEF',
  phoenix: '#FF6B35',
  'flying v': '#009944',
  cleanfuel: '#6AC259',
  jetti: '#E30613',
  default: '#00C46A'
};

const BRAND_EMOJIS = {
  shell: '🐚',
  petron: '🔴',
  caltex: '⭐',
  seaoil: '💧',
  phoenix: '🦅',
  'flying v': '✅',
  cleanfuel: '🌿',
  jetti: '⛽'
};

function getBrandKey(name = '') {
  const n = String(name).toLowerCase();
  for (const k of Object.keys(BRAND_COLORS)) {
    if (n.includes(k)) return k;
  }
  return 'default';
}

function getBrandColor(name) {
  return BRAND_COLORS[getBrandKey(name)] || BRAND_COLORS.default;
}

function getBrandEmoji(name) {
  return BRAND_EMOJIS[getBrandKey(name)] || '⛽';
}

// Match OSM station name → our BRANDS price table
function matchBrandPrices(osmName = '') {
  const n = String(osmName).toLowerCase();
  return BRANDS.find(b => n.includes(String(b.n).toLowerCase())) || null;
}

// ── CALCULATOR MAP ─────────────────────────────────────────
function initCalcMap() {
  if (calcMap) return;

  calcMap = L.map('calc-map', {
    zoomControl: true,
    scrollWheelZoom: true,
    maxBounds: [[3, 114], [22, 130]],
    maxBoundsViscosity: 0.7
  }).setView([12.8797, 121.7740], 6);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(calcMap);

  calcMap.on('click', function (e) {
    const { lat, lng } = e.latlng;
    pendingPin = { lat, lon: lng, addr: null };
    showPinPopup(e.containerPoint, 'Fetching address…');

    reverseGeocode(lat, lng).then(addr => {
      pendingPin.addr = addr;
      const el = document.getElementById('pin-addr');
      if (el) el.textContent = addr;
    });
  });
}

// ── MAIN MAP (Station Locator) ─────────────────────────────
function initMainMap() {
  if (mainMap) return;

  mainMap = L.map('main-map', {
    scrollWheelZoom: true
  }).setView([12.8797, 121.7740], 6);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mainMap);
}

// ── STATION LOCATOR SEARCH ────────────────────────────────
function doMapSearch() {
  const input = document.getElementById('map-search-input');
  const brandSelect = document.getElementById('map-brand-filter');
  const btn = document.querySelector('.search-btn');

  if (!input || !brandSelect || !btn) return;

  const q = input.value.trim();
  const brandFilter = brandSelect.value.toLowerCase();

  if (!q) {
    showToast('Enter a location to search');
    return;
  }

  btn.textContent = 'Searching…';
  btn.disabled = true;

  hideStationPanel();
  clearStationMarkers();
  hideStationResults();

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Philippines')}&format=json&limit=1&countrycodes=ph&addressdetails=1`;

  fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'GasTosPH/1.0'
    }
  })
    .then(r => {
      if (!r.ok) throw new Error('Location lookup failed: HTTP ' + r.status);
      return r.json();
    })
    .then(res => {
      if (!res || !res[0]) {
        throw new Error('Location not found');
      }

      const lat = parseFloat(res[0].lat);
      const lon = parseFloat(res[0].lon);

      lastSearchedLocation = {
        lat,
        lon,
        label: res[0].display_name || q
      };

      initMainMap();
      mainMap.setView([lat, lon], 14);

      if (locationPin) mainMap.removeLayer(locationPin);

      locationPin = L.marker([lat, lon], { icon: makeIcon('#3DB8FF', '📍') })
        .addTo(mainMap)
        .bindPopup(
          `<b>${escapeHtml((res[0].display_name || '').split(',')[0])}</b><br><small style="color:#aaa">${escapeHtml((res[0].display_name || '').split(',').slice(1, 3).join(', '))}</small>`
        )
        .openPopup();

      return fetchNearbyStations(lat, lon, brandFilter, btn);
    })
    .catch(err => {
      btn.textContent = 'Search →';
      btn.disabled = false;

      if (String(err.message || '').includes('Location not found')) {
        showToast('Location not found. Try a different name.');
      } else {
        showToast('Search failed. Check connection.');
      }

      console.error('Map search failed:', err);
    });
}

// ── OVERPASS CONFIG ───────────────────────────────────────
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

const OVERPASS_CLIENT_TIMEOUT_MS = 10000;

function buildOverpassQuery(lat, lon, radius) {
  return `[out:json][timeout:10];
  (
    node["amenity"="fuel"](around:${radius},${lat},${lon});
    way["amenity"="fuel"](around:${radius},${lat},${lon});
    relation["amenity"="fuel"](around:${radius},${lat},${lon});
  );
  out center tags;`;
}

function fetchWithTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);

  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

async function tryOverpassMirrors(query) {
  const encoded = encodeURIComponent(query);
  const errors = [];

  for (const base of OVERPASS_MIRRORS) {
    try {
      // 1) GET first — often friendlier in browser/file-origin cases
      const getUrl = `${base}?data=${encoded}`;
      let res = await fetchWithTimeout(getUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }, OVERPASS_CLIENT_TIMEOUT_MS);

      if (!res.ok) {
        // 2) POST fallback
        res = await fetchWithTimeout(base, {
          method: 'POST',
          body: 'data=' + encoded,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }, OVERPASS_CLIENT_TIMEOUT_MS);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (!data || !Array.isArray(data.elements)) {
        throw new Error('Invalid Overpass response');
      }

      return data;
    } catch (err) {
      errors.push(`${base} → ${err.message || err}`);
    }
  }

  const joined = errors.join(' | ');
  throw new Error(joined || 'All Overpass mirrors failed');
}

// ── NOMINATIM FALLBACK FOR FUEL POIS ──────────────────────
// Used only if Overpass completely fails.
async function fetchFuelStationsViaNominatimFallback(lat, lon, brandFilter) {
  const box = buildViewBox(lat, lon, 0.03); // around ~3km-ish, loose box
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent('gas station')}&bounded=1&limit=20&countrycodes=ph&viewbox=${box.left},${box.top},${box.right},${box.bottom}&addressdetails=1`;

  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'GasTosPH/1.0'
    }
  }, 10000);

  if (!res.ok) throw new Error('Fallback Nominatim failed: HTTP ' + res.status);

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  let stations = data.map((r, index) => {
    const slat = parseFloat(r.lat);
    const slon = parseFloat(r.lon);

    if (!Number.isFinite(slat) || !Number.isFinite(slon)) return null;

    const a = r.address || {};
    const name =
      a.amenity ||
      a.shop ||
      a.road ||
      (r.display_name || '').split(',')[0] ||
      'Gas Station';

    return {
      id: `nominatim-${index}`,
      lat: slat,
      lon: slon,
      name,
      tags: {
        brand: a.brand || '',
        'addr:street': a.road || '',
        'addr:city': a.city || a.town || a.municipality || '',
        description: r.display_name || ''
      },
      dist: haversine(lat, lon, slat, slon) * 1000,
      marker: null,
      resultIndex: index
    };
  }).filter(Boolean);

  stations = stations.filter(s => s.dist <= 3500);

  if (brandFilter) {
    stations = stations.filter(s => {
      const text = `${s.name} ${s.tags.brand || ''}`.toLowerCase();
      return text.includes(brandFilter);
    });
  }

  stations.sort((a, b) => a.dist - b.dist);

  const seen = new Set();
  stations = stations.filter(s => {
    const key = `${round6(s.lat)}|${round6(s.lon)}|${String(s.name).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return stations.slice(0, 15);
}

async function fetchNearbyStations(lat, lon, brandFilter, btn) {
  const radius = 3000;
  const query = buildOverpassQuery(lat, lon, radius);

  try {
    let stations = [];

    try {
      const data = await tryOverpassMirrors(query);

      stations = (data.elements || []).map((el, index) => {
        const slat = el.lat || el.center?.lat;
        const slon = el.lon || el.center?.lon;

        if (!slat || !slon) return null;

        const name = el.tags?.name || el.tags?.brand || el.tags?.operator || 'Gas Station';
        const dist = haversine(lat, lon, slat, slon) * 1000;

        return {
          id: `${el.type || 'station'}-${el.id || index}`,
          lat: slat,
          lon: slon,
          name,
          tags: el.tags || {},
          dist,
          marker: null,
          resultIndex: index
        };
      }).filter(Boolean);
    } catch (overpassErr) {
      console.warn('Overpass failed, trying fallback search:', overpassErr);
      stations = await fetchFuelStationsViaNominatimFallback(lat, lon, brandFilter);
    }

    if (brandFilter) {
      stations = stations.filter(s => {
        const text = `${s.name} ${s.tags.brand || ''} ${s.tags.operator || ''}`.toLowerCase();
        return text.includes(brandFilter);
      });
    }

    stations.sort((a, b) => a.dist - b.dist);

    const seen = new Set();
    stations = stations.filter(s => {
      const key = `${round6(s.lat)}|${round6(s.lon)}|${String(s.name).toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    stations = stations.slice(0, 15);

    searchedStations = stations;
    window._lastStationResults = stations;

    btn.textContent = 'Search →';
    btn.disabled = false;

    if (stations.length === 0) {
      hideStationResults();
      showToast('No gas stations found within 3 km. Try a different area.');
      return;
    }

    stations.forEach((s, i) => {
      s.resultIndex = i;
      plotStationMarker(s, i);
    });

    const allPoints = [[lat, lon], ...stations.map(s => [s.lat, s.lon])];
    mainMap.fitBounds(allPoints, { padding: [50, 50], maxZoom: 15 });

    renderStationResults(stations);
    showToast(`Found ${stations.length} nearby gas station${stations.length > 1 ? 's' : ''} ⛽`);
  } catch (err) {
    btn.textContent = 'Search →';
    btn.disabled = false;
    hideStationResults();
    showToast('Could not fetch stations — try again or check connection.');
    console.error('Station fetch failed:', err);
  }
}

// ── STATION RESULTS LIST ──────────────────────────────────
function renderStationResults(stations) {
  const box = document.getElementById('station-results-box');
  const list = document.getElementById('station-results-list');
  const count = document.getElementById('station-results-count');

  if (!box || !list || !count) return;

  if (!stations || stations.length === 0) {
    box.style.display = 'none';
    list.innerHTML = '';
    count.textContent = '';
    return;
  }

  count.textContent = `${stations.length} station${stations.length > 1 ? 's' : ''} found nearby`;
  box.style.display = 'block';

  list.innerHTML = stations.map((s, i) => {
    const color = getBrandColor(s.name);
    const emoji = getBrandEmoji(s.name);
    const distText = s.dist < 1000 ? Math.round(s.dist) + ' m' : (s.dist / 1000).toFixed(1) + ' km';
    const brandMatch = matchBrandPrices(s.name);
    const topFuel = brandMatch ? Object.entries(brandMatch.p)[0] : null;

    const priceSnippet = topFuel
      ? `<span class="srl-price">₱${topFuel[1].toFixed(2)}/L <span class="srl-fuel-tag">${escapeHtml(topFuel[0])}</span></span>`
      : `<span class="srl-price-na">Price at pump</span>`;

    const addr = [
      s.tags['addr:street'],
      s.tags['addr:city'] || s.tags['addr:municipality']
    ].filter(Boolean).join(', ');

    return `
      <div class="srl-item" id="srl-${i}" onclick="onResultRowClick(${i})">
        <div class="srl-rank" style="background:${color}22;color:${color};border-color:${color}44">${i + 1}</div>
        <div class="srl-emoji">${emoji}</div>
        <div class="srl-info">
          <div class="srl-name">${escapeHtml(s.name)}</div>
          ${addr ? `<div class="srl-addr">${escapeHtml(addr)}</div>` : ''}
        </div>
        <div class="srl-right">
          <div class="srl-dist">${distText}</div>
          ${priceSnippet}
          <button class="srl-details-btn" onclick="event.stopPropagation();onResultRowClick(${i})">View details →</button>
        </div>
      </div>
    `;
  }).join('');
}

function hideStationResults() {
  const box = document.getElementById('station-results-box');
  const list = document.getElementById('station-results-list');
  const count = document.getElementById('station-results-count');

  if (box) box.style.display = 'none';
  if (list) list.innerHTML = '';
  if (count) count.textContent = '';
}

function onResultRowClick(index) {
  selectStation(index, true);
}

// ── CENTRALIZED STATION SELECTION ─────────────────────────
function selectStation(index, scrollIntoView = false) {
  const stations = window._lastStationResults || searchedStations;
  if (!stations || !stations[index]) return;

  const s = stations[index];
  selectedStation = s;

  const distText = s.dist < 1000
    ? Math.round(s.dist) + ' m'
    : (s.dist / 1000).toFixed(1) + ' km';

  if (mainMap) {
    mainMap.setView([s.lat, s.lon], 16, { animate: true });
  }

  document.querySelectorAll('.station-pin').forEach(el => el.classList.remove('selected'));
  s.marker?.getElement()?.querySelector('.station-pin')?.classList.add('selected');

  document.querySelectorAll('.srl-item').forEach(el => el.classList.remove('active'));
  const row = document.getElementById('srl-' + index);
  if (row) {
    row.classList.add('active');
    if (scrollIntoView) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  showStationPanel(s, distText);
}

function plotStationMarker(station, index) {
  const color = getBrandColor(station.name);
  const emoji = getBrandEmoji(station.name);
  const shortLabel = String(station.name).split(' ')[0] || 'Gas';

  const icon = L.divIcon({
    className: '',
    html: `<div class="station-pin" style="--pin-color:${color}">
      <div class="pin-bubble">${emoji}</div>
      <div class="pin-tail"></div>
      <div class="pin-label">${escapeHtml(shortLabel)}</div>
    </div>`,
    iconSize: [56, 52],
    iconAnchor: [28, 44],
    popupAnchor: [0, -48]
  });

  const marker = L.marker([station.lat, station.lon], { icon }).addTo(mainMap);
  station.marker = marker;

  marker.on('click', () => {
    selectStation(index, true);
  });

  stationMarkers.push(marker);
}

function clearStationMarkers() {
  stationMarkers.forEach(m => {
    if (mainMap) mainMap.removeLayer(m);
  });

  stationMarkers = [];
  selectedStation = null;
  searchedStations = [];
  window._lastStationResults = [];

  hideStationResults();
}

// ── STATION DETAIL PANEL ──────────────────────────────────
function showStationPanel(station, distText) {
  selectedStation = station;

  const panel = document.getElementById('station-panel');
  if (!panel) return;

  const color = getBrandColor(station.name);
  const emoji = getBrandEmoji(station.name);
  const brandMatch = matchBrandPrices(station.name);

  const addr = [
    station.tags['addr:housenumber'],
    station.tags['addr:street'],
    station.tags['addr:city'] || station.tags['addr:municipality']
  ].filter(Boolean).join(' ') || station.tags['addr:full'] || station.tags.description || '';

  const phone = station.tags.phone || station.tags['contact:phone'] || '';
  const hours = station.tags.opening_hours || '';
  const brand = station.tags.brand || station.tags.operator || station.name;

  let priceRows = '';

  if (brandMatch) {
    priceRows = Object.entries(brandMatch.p).map(([fuel, price]) => `
      <div class="sp-price-row">
        <span class="sp-fuel-name">${escapeHtml(fuel)}</span>
        <span class="sp-fuel-price">₱${price.toFixed(2)}/L</span>
      </div>
    `).join('');
  } else {
    priceRows = `
      <div class="sp-no-price">ℹ️ Exact prices not available in our database — check the pump or use NCR average.</div>
    `;
  }

  const spName = document.getElementById('sp-name');
  const spEmoji = document.getElementById('sp-emoji');
  const spDist = document.getElementById('sp-dist');
  const spBrandBadge = document.getElementById('sp-brand-badge');
  const spAddr = document.getElementById('sp-addr');
  const spHours = document.getElementById('sp-hours');
  const spPhone = document.getElementById('sp-phone');
  const spPhoneRow = document.getElementById('sp-phone-row');
  const spPrices = document.getElementById('sp-prices');
  const spHeader = document.getElementById('sp-header');

  if (spName) spName.textContent = station.name;
  if (spEmoji) spEmoji.textContent = emoji;
  if (spDist) spDist.textContent = distText + ' away';

  if (spBrandBadge) {
    spBrandBadge.textContent = brand;
    spBrandBadge.style.setProperty('--badge-color', color);
  }

  if (spAddr) spAddr.textContent = addr || 'Address not available';
  if (spHours) spHours.textContent = hours || 'Hours unknown';
  if (spPhone) spPhone.textContent = phone || '';
  if (spPhoneRow) spPhoneRow.style.display = phone ? '' : 'none';
  if (spPrices) spPrices.innerHTML = priceRows;
  if (spHeader) spHeader.style.setProperty('--station-color', color);

  panel.classList.add('open');
}

function hideStationPanel() {
  const panel = document.getElementById('station-panel');
  if (panel) panel.classList.remove('open');

  selectedStation = null;
  document.querySelectorAll('.station-pin').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.srl-item').forEach(el => el.classList.remove('active'));
}

// Navigate to calculator with pre-filled station
// Delegates to injectPrice() in ui.js — single source of truth for all Use ↑ buttons.
function useStationInCalc(brandName, price, fuelType) {
  const fuelMap = {
    'RON 91': 'RON 91',
    'RON 95': 'RON 95',
    'V-Power 97': 'RON 97/100',
    'Blaze 100': 'RON 97/100',
    'RON 97': 'RON 97/100',
    'Diesel': 'Diesel',
    'Kerosene': 'Kerosene'
  };
  const mappedFuel = fuelMap[fuelType] || 'RON 95';
  injectPrice(Number(price), mappedFuel, brandName);
}

function useStationInCalcDefault(stationName) {
  const ncr = PRICES.ncr.find(r => r.t === 'RON 95');
  const price = ncr ? ncr.p : 88.10;
  injectPrice(price, 'RON 95');
}

function filterMapBrand() {
  const q = document.getElementById('map-search-input')?.value.trim();
  if (q) doMapSearch();
}

// ── SHARED HELPERS ────────────────────────────────────────
function makeIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:24px;height:24px">
      <div style="width:24px;height:24px;background:${color};border:3px solid rgba(255,255,255,0.9);border-radius:50%;box-shadow:0 0 12px ${color}AA,0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000;font-family:sans-serif">${escapeHtml(label)}</div>
      <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${color}"></div>
    </div>`,
    iconSize: [24, 30],
    iconAnchor: [12, 30],
    popupAnchor: [0, -30]
  });
}

function reverseGeocode(lat, lon) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`,
    {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'GasTosPH/1.0'
      }
    }
  )
    .then(r => r.json())
    .then(d => {
      if (!d || d.error) return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

      const a = d.address || {};
      const specific = a.amenity || a.shop || a.building || a.road || a.suburb || a.village || (d.display_name || '').split(',')[0];
      const city = a.city || a.town || a.municipality || a.county || '';

      return city && city !== specific ? `${specific}, ${city}` : specific || (d.display_name || '').split(',')[0];
    })
    .catch(() => `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
}

function buildViewBox(lat, lon, delta) {
  return {
    left: (lon - delta).toFixed(6),
    top: (lat + delta).toFixed(6),
    right: (lon + delta).toFixed(6),
    bottom: (lat - delta).toFixed(6)
  };
}

// ── PIN POPUP ─────────────────────────────────────────────
function showPinPopup(containerPoint, addr) {
  const popup = document.getElementById('pin-popup');
  const mapEl = document.getElementById('calc-map');
  if (!popup || !mapEl) return;

  const rect = mapEl.getBoundingClientRect();

  let x = containerPoint.x + 14;
  let y = containerPoint.y - 60;

  if (x + 230 > rect.width) x = containerPoint.x - 230 - 4;
  if (y < 4) y = containerPoint.y + 10;

  popup.style.left = x + 'px';
  popup.style.top = y + 'px';

  const addrEl = document.getElementById('pin-addr');
  if (addrEl) addrEl.textContent = addr;

  popup.classList.add('open');
}

function closePinPopup() {
  const popup = document.getElementById('pin-popup');
  if (popup) popup.classList.remove('open');
}

function confirmPin(field) {
  if (!pendingPin.lat) return;

  const addr = pendingPin.addr || `${pendingPin.lat.toFixed(5)}, ${pendingPin.lon.toFixed(5)}`;
  const input = document.getElementById('inp-' + field);
  const clearBtn = document.getElementById('cl-' + field);

  if (input) input.value = addr;
  if (clearBtn) clearBtn.classList.add('show');

  if (field === 'origin') {
    originData = { lat: pendingPin.lat, lon: pendingPin.lon, display_name: addr };
  } else {
    destData = { lat: pendingPin.lat, lon: pendingPin.lon, display_name: addr };
  }

  closePinPopup();
  updateMapRoute();
  showToast('📍 ' + (field === 'origin' ? 'Origin' : 'Destination') + ' set: ' + addr.split(',')[0]);
}

// ── ROUTE TYPE ────────────────────────────────────────────
function setRouteType(type, btn) {
  routeType = type;
  document.querySelectorAll('.rt-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (originData && destData) updateMapRoute();
}

// ── MAP MARKERS & ROUTING ─────────────────────────────────
function updateMapRoute() {
  if (!calcMap) return;

  if (originMarker) {
    calcMap.removeLayer(originMarker);
    originMarker = null;
  }

  if (destMarker) {
    calcMap.removeLayer(destMarker);
    destMarker = null;
  }

  if (routingControl) {
    calcMap.removeControl(routingControl);
    routingControl = null;
  }

  if (straightLine) {
    calcMap.removeLayer(straightLine);
    straightLine = null;
  }

  const overlay = document.getElementById('map-overlay');
  const dragHint = document.getElementById('drag-hint');
  const routeInfo = document.getElementById('route-info');

  if (originData) {
    originMarker = L.marker([originData.lat, originData.lon], {
      icon: makeIcon('#00C46A', 'A'),
      draggable: true
    }).addTo(calcMap).bindPopup(`<b>Origin</b><br>${escapeHtml(originData.display_name)}`);

    originMarker.on('dragend', function (e) {
      const pos = e.target.getLatLng();
      reverseGeocode(pos.lat, pos.lng).then(addr => {
        originData = { lat: pos.lat, lon: pos.lng, display_name: addr };
        const input = document.getElementById('inp-origin');
        if (input) input.value = addr;
        updateMapRoute();
      });
    });
  }

  if (destData) {
    destMarker = L.marker([destData.lat, destData.lon], {
      icon: makeIcon('#FF5252', 'B'),
      draggable: true
    }).addTo(calcMap).bindPopup(`<b>Destination</b><br>${escapeHtml(destData.display_name)}`);

    destMarker.on('dragend', function (e) {
      const pos = e.target.getLatLng();
      reverseGeocode(pos.lat, pos.lng).then(addr => {
        destData = { lat: pos.lat, lon: pos.lng, display_name: addr };
        const input = document.getElementById('inp-dest');
        if (input) input.value = addr;
        updateMapRoute();
      });
    });
  }

  if (originData && destData) {
    if (overlay) overlay.classList.add('hidden');
    if (dragHint) dragHint.style.display = 'block';

    if (routeType === 'road') {
      routingControl = L.Routing.control({
        waypoints: [
          L.latLng(originData.lat, originData.lon),
          L.latLng(destData.lat, destData.lon)
        ],
        routeWhileDragging: false,
        showAlternatives: false,
        fitSelectedRoutes: true,
        lineOptions: {
          styles: [{ color: '#00C46A', weight: 4, opacity: 0.85 }]
        },
        createMarker: function () {
          return null;
        },
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        })
      }).addTo(calcMap);

      routingControl.on('routesfound', function (e) {
        const routes = e.routes;
        if (routes && routes[0]) {
          const dist = routes[0].summary.totalDistance / 1000;
          routeDistKm = dist;

          const riDist = document.getElementById('ri-dist');
          const riTag = document.getElementById('ri-tag');
          const sDist = document.getElementById('s-dist');

          if (riDist) riDist.textContent = dist.toFixed(1) + ' km';
          if (riTag) {
            riTag.textContent = 'road';
            riTag.style.color = 'var(--green)';
          }
          if (routeInfo) routeInfo.classList.add('show');
          if (sDist) sDist.value = dist.toFixed(1);
        }
      });

      routingControl.on('routingerror', function () {
        showToast('Road routing failed — using straight-line estimate');
        drawStraightLine();
      });
    } else {
      drawStraightLine();
    }
  } else if (originData) {
    if (overlay) overlay.classList.add('hidden');
    if (dragHint) dragHint.style.display = 'block';
    calcMap.setView([originData.lat, originData.lon], 13);
  } else if (destData) {
    if (overlay) overlay.classList.add('hidden');
    if (dragHint) dragHint.style.display = 'block';
    calcMap.setView([destData.lat, destData.lon], 13);
  } else {
    if (overlay) overlay.classList.remove('hidden');
    if (dragHint) dragHint.style.display = 'none';
    if (routeInfo) routeInfo.classList.remove('show');
    routeDistKm = null;
  }
}

function drawStraightLine() {
  if (straightLine) {
    calcMap.removeLayer(straightLine);
    straightLine = null;
  }

  if (!originData || !destData) return;

  const latlngs = [
    [originData.lat, originData.lon],
    [destData.lat, destData.lon]
  ];

  straightLine = L.polyline(latlngs, {
    color: '#00C46A',
    weight: 2.5,
    opacity: 0.8,
    dashArray: '8,6'
  }).addTo(calcMap);

  calcMap.fitBounds(straightLine.getBounds(), { padding: [50, 50] });

  const dist = haversine(originData.lat, originData.lon, destData.lat, destData.lon);
  const roadEst = dist * 1.35;
  routeDistKm = routeType === 'straight' ? dist : roadEst;

  const riDist = document.getElementById('ri-dist');
  const riTag = document.getElementById('ri-tag');
  const routeInfo = document.getElementById('route-info');
  const sDist = document.getElementById('s-dist');

  if (riDist) {
    riDist.textContent =
      (routeType === 'straight' ? dist : roadEst).toFixed(1) + ' km' + (routeType !== 'straight' ? ' (est.)' : '');
  }

  if (riTag) {
    riTag.textContent = routeType === 'straight' ? 'straight line' : 'est.';
    riTag.style.color = routeType === 'straight' ? 'var(--blue)' : 'var(--amber)';
  }

  if (routeInfo) routeInfo.classList.add('show');
  if (sDist) sDist.value = routeDistKm.toFixed(1);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function applyRouteDistance() {
  if (routeDistKm) {
    const sDist = document.getElementById('s-dist');
    if (sDist) {
      sDist.value = routeDistKm.toFixed(1);
      sDist.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    showToast('Distance ' + routeDistKm.toFixed(1) + ' km applied ✓');
  }
}

function detectLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported');
    return;
  }

  showToast('Detecting your location…');

  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon } = pos.coords;

    reverseGeocode(lat, lon).then(addr => {
      const input = document.getElementById('inp-origin');
      const clearBtn = document.getElementById('cl-origin');

      if (input) input.value = addr;
      if (clearBtn) clearBtn.classList.add('show');

      originData = { lat, lon, display_name: addr };

      if (calcMap) calcMap.setView([lat, lon], 15);
      updateMapRoute();
      showToast('📍 Location detected: ' + addr.split(',')[0]);
    });
  }, () => showToast('Location access denied'));
}

// ── SMALL HELPERS ──────────────────────────────────────────
function round6(v) {
  return Number(v).toFixed(6);
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
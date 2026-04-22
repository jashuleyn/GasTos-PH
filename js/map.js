// ────────────────────────────────────────────────
// MAP — Leaflet calculator map + station locator
// ────────────────────────────────────────────────

let calcMap = null, mainMap = null;
let originMarker = null, destMarker = null;
let routingControl = null, straightLine = null;
let originData = null, destData = null;
let routeDistKm = null, routeType = 'road';
let pendingPin = {lat:null, lon:null, addr:null};

// Station locator state
let stationMarkers = [];
let locationPin = null;
let selectedStation = null;

// ── BRAND COLOUR MAP ──────────────────────────────────────
const BRAND_COLORS = {
  shell:      '#FFD700',
  petron:     '#FF4136',
  caltex:     '#003580',
  seaoil:     '#00AEEF',
  phoenix:    '#FF6B35',
  'flying v': '#009944',
  cleanfuel:  '#6AC259',
  jetti:      '#E30613',
  default:    '#00C46A'
};

const BRAND_EMOJIS = {
  shell:'🐚', petron:'🔴', caltex:'⭐', seaoil:'💧',
  phoenix:'🦅', 'flying v':'✅', cleanfuel:'🌿', jetti:'⛽'
};

function getBrandKey(name='') {
  const n = name.toLowerCase();
  for (const k of Object.keys(BRAND_COLORS)) {
    if (n.includes(k)) return k;
  }
  return 'default';
}

function getBrandColor(name) { return BRAND_COLORS[getBrandKey(name)] || BRAND_COLORS.default; }
function getBrandEmoji(name) { return BRAND_EMOJIS[getBrandKey(name)] || '⛽'; }

// Match OSM station name → our BRANDS price table
function matchBrandPrices(osmName='') {
  const n = osmName.toLowerCase();
  return BRANDS.find(b => n.includes(b.n.toLowerCase())) || null;
}

// ── CALCULATOR MAP ─────────────────────────────────────────
function initCalcMap() {
  calcMap = L.map('calc-map', {
    zoomControl: true,
    scrollWheelZoom: true,
    maxBounds: [[3,114],[22,130]],
    maxBoundsViscosity: 0.7
  }).setView([12.8797,121.7740], 6);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(calcMap);

  calcMap.on('click', function(e) {
    const {lat, lng} = e.latlng;
    pendingPin = {lat, lon:lng, addr:null};
    showPinPopup(e.containerPoint, 'Fetching address…');
    reverseGeocode(lat, lng).then(addr => {
      pendingPin.addr = addr;
      document.getElementById('pin-addr').textContent = addr;
    });
  });
}

// ── MAIN MAP (Station Locator) ─────────────────────────────
function initMainMap() {
  if (mainMap) return;
  mainMap = L.map('main-map', {scrollWheelZoom:true}).setView([12.8797,121.7740], 6);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(mainMap);
}

// ── STATION LOCATOR SEARCH ────────────────────────────────
function doMapSearch() {
  const q = document.getElementById('map-search-input').value.trim();
  const brandFilter = document.getElementById('map-brand-filter').value.toLowerCase();
  if (!q) { showToast('Enter a location to search'); return; }

  const btn = document.querySelector('.search-btn');
  btn.textContent = 'Searching…';
  btn.disabled = true;

  hideStationPanel();
  clearStationMarkers();

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q+', Philippines')}&format=json&limit=1&countrycodes=ph`;

  fetch(url, {headers:{'Accept-Language':'en','User-Agent':'GasTosPH/1.0'}})
    .then(r => r.json())
    .then(res => {
      if (!res || !res[0]) {
        showToast('Location not found. Try a different name.');
        btn.textContent = 'Search →'; btn.disabled = false;
        return;
      }
      const lat = parseFloat(res[0].lat), lon = parseFloat(res[0].lon);
      initMainMap();
      mainMap.setView([lat, lon], 14);

      // Drop location pin
      if (locationPin) mainMap.removeLayer(locationPin);
      locationPin = L.marker([lat, lon], {icon: makeIcon('#3DB8FF','📍')})
        .addTo(mainMap)
        .bindPopup(`<b>${res[0].display_name.split(',')[0]}</b><br><small style="color:#aaa">${res[0].display_name.split(',').slice(1,3).join(',')}</small>`)
        .openPopup();

      // Fetch nearby gas stations via Overpass API
      fetchNearbyStations(lat, lon, brandFilter, btn);
    })
    .catch(() => {
      showToast('Search failed. Check connection.');
      btn.textContent = 'Search →'; btn.disabled = false;
    });
}

function fetchNearbyStations(lat, lon, brandFilter, btn) {
  // Search within ~3km radius
  const radius = 3000;
  const overpassQuery = `
    [out:json][timeout:15];
    (
      node["amenity"="fuel"](around:${radius},${lat},${lon});
      way["amenity"="fuel"](around:${radius},${lat},${lon});
    );
    out center tags;
  `;

  fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(overpassQuery)
  })
  .then(r => r.json())
  .then(data => {
    btn.textContent = 'Search →'; btn.disabled = false;

    let stations = (data.elements || []).map(el => {
      const slat = el.lat || el.center?.lat;
      const slon = el.lon || el.center?.lon;
      if (!slat || !slon) return null;
      const name = el.tags?.name || el.tags?.brand || el.tags?.operator || 'Gas Station';
      const dist = haversine(lat, lon, slat, slon) * 1000; // metres
      return { lat: slat, lon: slon, name, tags: el.tags || {}, dist };
    }).filter(Boolean);

    // Apply brand filter
    if (brandFilter) {
      stations = stations.filter(s => s.name.toLowerCase().includes(brandFilter));
    }

    // Sort by distance
    stations.sort((a, b) => a.dist - b.dist);

    if (stations.length === 0) {
      showToast('No gas stations found within 3 km. Try a different area.');
      return;
    }

    // Show count
    showToast(`Found ${stations.length} gas station${stations.length > 1 ? 's' : ''} nearby ⛽`);

    // Plot markers
    stations.forEach((s, i) => plotStationMarker(s, i));

    // Fit map to show all results
    if (stations.length > 0) {
      const allPoints = [[lat, lon], ...stations.map(s => [s.lat, s.lon])];
      mainMap.fitBounds(allPoints, {padding: [50, 50], maxZoom: 15});
    }
  })
  .catch(err => {
    btn.textContent = 'Search →'; btn.disabled = false;
    showToast('Could not fetch stations. Check your connection.');
    console.error('Overpass error:', err);
  });
}

function plotStationMarker(station, index) {
  const color = getBrandColor(station.name);
  const emoji = getBrandEmoji(station.name);
  const distText = station.dist < 1000
    ? Math.round(station.dist) + ' m'
    : (station.dist / 1000).toFixed(1) + ' km';

  const icon = L.divIcon({
    className: '',
    html: `<div class="station-pin" style="--pin-color:${color}">
      <div class="pin-bubble">${emoji}</div>
      <div class="pin-tail"></div>
      <div class="pin-label">${station.name.split(' ')[0]}</div>
    </div>`,
    iconSize: [56, 52],
    iconAnchor: [28, 44],
    popupAnchor: [0, -48]
  });

  const marker = L.marker([station.lat, station.lon], {icon})
    .addTo(mainMap);

  marker.on('click', () => {
    showStationPanel(station, distText);
    // Highlight selected marker
    document.querySelectorAll('.station-pin').forEach(el => el.classList.remove('selected'));
    marker.getElement()?.querySelector('.station-pin')?.classList.add('selected');
  });

  stationMarkers.push(marker);
}

function clearStationMarkers() {
  stationMarkers.forEach(m => { if (mainMap) mainMap.removeLayer(m); });
  stationMarkers = [];
}

// ── STATION DETAIL PANEL ──────────────────────────────────
function showStationPanel(station, distText) {
  selectedStation = station;
  const panel = document.getElementById('station-panel');
  const color = getBrandColor(station.name);
  const emoji = getBrandEmoji(station.name);
  const brandMatch = matchBrandPrices(station.name);

  // Build address
  const addr = [
    station.tags['addr:housenumber'],
    station.tags['addr:street'],
    station.tags['addr:city'] || station.tags['addr:municipality']
  ].filter(Boolean).join(' ') || station.tags['addr:full'] || station.tags.description || '';

  const phone = station.tags.phone || station.tags['contact:phone'] || '';
  const hours = station.tags.opening_hours || '';
  const brand = station.tags.brand || station.tags.operator || station.name;

  // Fuel prices from our BRANDS table
  let priceRows = '';
  if (brandMatch) {
    priceRows = Object.entries(brandMatch.p).map(([fuel, price]) => `
      <div class="sp-price-row">
        <span class="sp-fuel-name">${fuel}</span>
        <span class="sp-fuel-price">₱${price.toFixed(2)}/L</span>
        <button class="sp-use-btn" onclick="useStationInCalc('${brandMatch.n}', ${price}, '${fuel}')">Use ↑</button>
      </div>`).join('');
  } else {
    priceRows = `<div class="sp-no-price">ℹ️ Exact prices not available in our database — check the pump or use NCR average.</div>
      <button class="sp-use-btn-full" onclick="useStationInCalcDefault('${station.name}')">Use NCR average price →</button>`;
  }

  document.getElementById('sp-name').textContent = station.name;
  document.getElementById('sp-emoji').textContent = emoji;
  document.getElementById('sp-dist').textContent = distText + ' away';
  document.getElementById('sp-brand-badge').textContent = brand;
  document.getElementById('sp-brand-badge').style.setProperty('--badge-color', color);
  document.getElementById('sp-addr').textContent = addr || 'Address not available';
  document.getElementById('sp-addr').style.display = addr ? '' : 'none';
  document.getElementById('sp-hours').textContent = hours || 'Hours unknown';
  document.getElementById('sp-phone').textContent = phone || '';
  document.getElementById('sp-phone-row').style.display = phone ? '' : 'none';
  document.getElementById('sp-prices').innerHTML = priceRows;
  document.getElementById('sp-header').style.setProperty('--station-color', color);

  panel.classList.add('open');
}

function hideStationPanel() {
  document.getElementById('station-panel').classList.remove('open');
  selectedStation = null;
  document.querySelectorAll('.station-pin').forEach(el => el.classList.remove('selected'));
}

// Navigate to calculator with pre-filled station
function useStationInCalc(brandName, price, fuelType) {
  // Map fuel type to our select options
  const fuelMap = {
    'RON 91': 'RON 91',
    'RON 95': 'RON 95',
    'V-Power 97': 'RON 97/100',
    'Blaze 100': 'RON 97/100',
    'RON 97': 'RON 97/100',
    'Diesel': 'Diesel'
  };
  const mappedFuel = fuelMap[fuelType] || 'RON 95';

  document.getElementById('s-station').value = brandName;
  document.getElementById('s-price').value = price.toFixed(2);
  document.getElementById('s-price-hint').textContent = brandName + ' price ↑';

  const fuelSel = document.getElementById('s-ftype');
  for (let i = 0; i < fuelSel.options.length; i++) {
    if (fuelSel.options[i].value === mappedFuel) { fuelSel.selectedIndex = i; break; }
  }

  showPage('calc', document.querySelectorAll('.nav-btn')[0]);
  showToast(`✓ ${brandName} · ₱${price.toFixed(2)}/L (${fuelType}) applied to calculator`);
}

function useStationInCalcDefault(stationName) {
  const ncr = PRICES.ncr.find(r => r.t === 'RON 95');
  const price = ncr ? ncr.p : 88.10;
  document.getElementById('s-price').value = price.toFixed(2);
  document.getElementById('s-price-hint').textContent = 'NCR avg ↑';
  showPage('calc', document.querySelectorAll('.nav-btn')[0]);
  showToast(`NCR average ₱${price.toFixed(2)}/L applied. Update station if needed.`);
}

function filterMapBrand() {
  // Re-trigger search if already searched
  const q = document.getElementById('map-search-input').value.trim();
  if (q) doMapSearch();
}

// ── SHARED HELPERS ────────────────────────────────────────
function makeIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:24px;height:24px">
      <div style="width:24px;height:24px;background:${color};border:3px solid rgba(255,255,255,0.9);border-radius:50%;box-shadow:0 0 12px ${color}AA,0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000;font-family:sans-serif">${label}</div>
      <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${color}"></div>
    </div>`,
    iconSize: [24,30], iconAnchor: [12,30], popupAnchor: [0,-30]
  });
}

function reverseGeocode(lat, lon) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`,
    {headers:{'Accept-Language':'en','User-Agent':'GasTosPH/1.0'}}
  ).then(r => r.json())
   .then(d => {
     if (!d || d.error) return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
     const a = d.address || {};
     const specific = a.amenity||a.shop||a.building||a.road||a.suburb||a.village||d.display_name.split(',')[0];
     const city = a.city||a.town||a.municipality||a.county||'';
     return city && city !== specific ? `${specific}, ${city}` : specific || d.display_name.split(',')[0];
   })
   .catch(() => `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
}

// ── PIN POPUP ─────────────────────────────────────────────
function showPinPopup(containerPoint, addr) {
  const popup = document.getElementById('pin-popup');
  const mapEl = document.getElementById('calc-map');
  const rect = mapEl.getBoundingClientRect();
  let x = containerPoint.x + 14, y = containerPoint.y - 60;
  if (x + 230 > rect.width) x = containerPoint.x - 230 - 4;
  if (y < 4) y = containerPoint.y + 10;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  document.getElementById('pin-addr').textContent = addr;
  popup.classList.add('open');
}

function closePinPopup() {
  document.getElementById('pin-popup').classList.remove('open');
}

function confirmPin(field) {
  if (!pendingPin.lat) return;
  const addr = pendingPin.addr || `${pendingPin.lat.toFixed(5)}, ${pendingPin.lon.toFixed(5)}`;
  document.getElementById('inp-' + field).value = addr;
  document.getElementById('cl-' + field).classList.add('show');
  if (field === 'origin') originData = {lat:pendingPin.lat, lon:pendingPin.lon, display_name:addr};
  else destData = {lat:pendingPin.lat, lon:pendingPin.lon, display_name:addr};
  closePinPopup();
  updateMapRoute();
  showToast('📍 ' + (field === 'origin' ? 'Origin' : 'Destination') + ' set: ' + addr.split(',')[0]);
}

// ── ROUTE TYPE ────────────────────────────────────────────
function setRouteType(type, btn) {
  routeType = type;
  document.querySelectorAll('.rt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (originData && destData) updateMapRoute();
}

// ── MAP MARKERS & ROUTING ─────────────────────────────────
function updateMapRoute() {
  if (originMarker) { calcMap.removeLayer(originMarker); originMarker = null; }
  if (destMarker) { calcMap.removeLayer(destMarker); destMarker = null; }
  if (routingControl) { calcMap.removeControl(routingControl); routingControl = null; }
  if (straightLine) { calcMap.removeLayer(straightLine); straightLine = null; }

  const overlay = document.getElementById('map-overlay');
  const dragHint = document.getElementById('drag-hint');
  const routeInfo = document.getElementById('route-info');

  if (originData) {
    originMarker = L.marker([originData.lat, originData.lon], {
      icon: makeIcon('#00C46A', 'A'),
      draggable: true
    }).addTo(calcMap).bindPopup(`<b>Origin</b><br>${originData.display_name}`);
    originMarker.on('dragend', function(e) {
      const pos = e.target.getLatLng();
      reverseGeocode(pos.lat, pos.lng).then(addr => {
        originData = {lat:pos.lat, lon:pos.lng, display_name:addr};
        document.getElementById('inp-origin').value = addr;
        updateMapRoute();
      });
    });
  }

  if (destData) {
    destMarker = L.marker([destData.lat, destData.lon], {
      icon: makeIcon('#FF5252', 'B'),
      draggable: true
    }).addTo(calcMap).bindPopup(`<b>Destination</b><br>${destData.display_name}`);
    destMarker.on('dragend', function(e) {
      const pos = e.target.getLatLng();
      reverseGeocode(pos.lat, pos.lng).then(addr => {
        destData = {lat:pos.lat, lon:pos.lng, display_name:addr};
        document.getElementById('inp-dest').value = addr;
        updateMapRoute();
      });
    });
  }

  if (originData && destData) {
    overlay.classList.add('hidden');
    dragHint.style.display = 'block';

    if (routeType === 'road') {
      routingControl = L.Routing.control({
        waypoints: [
          L.latLng(originData.lat, originData.lon),
          L.latLng(destData.lat, destData.lon)
        ],
        routeWhileDragging: false,
        showAlternatives: false,
        fitSelectedRoutes: true,
        lineOptions: {styles:[{color:'#00C46A',weight:4,opacity:0.85}]},
        createMarker: function() { return null; },
        router: L.Routing.osrmv1({serviceUrl:'https://router.project-osrm.org/route/v1'})
      }).addTo(calcMap);

      routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        if (routes && routes[0]) {
          const dist = routes[0].summary.totalDistance / 1000;
          routeDistKm = dist;
          document.getElementById('ri-dist').textContent = dist.toFixed(1) + ' km';
          document.getElementById('ri-tag').textContent = 'road';
          document.getElementById('ri-tag').style.color = 'var(--green)';
          routeInfo.classList.add('show');
          document.getElementById('s-dist').value = dist.toFixed(1);
        }
      });

      routingControl.on('routingerror', function() {
        showToast('Road routing failed — using straight-line estimate');
        drawStraightLine();
      });

    } else {
      drawStraightLine();
    }

  } else if (originData) {
    overlay.classList.add('hidden');
    dragHint.style.display = 'block';
    calcMap.setView([originData.lat, originData.lon], 13);
  } else if (destData) {
    overlay.classList.add('hidden');
    dragHint.style.display = 'block';
    calcMap.setView([destData.lat, destData.lon], 13);
  } else {
    overlay.classList.remove('hidden');
    dragHint.style.display = 'none';
    routeInfo.classList.remove('show');
    routeDistKm = null;
  }
}

function drawStraightLine() {
  if (straightLine) { calcMap.removeLayer(straightLine); straightLine = null; }
  if (!originData || !destData) return;
  const latlngs = [[originData.lat,originData.lon],[destData.lat,destData.lon]];
  straightLine = L.polyline(latlngs, {color:'#00C46A',weight:2.5,opacity:.8,dashArray:'8,6'}).addTo(calcMap);
  calcMap.fitBounds(straightLine.getBounds(), {padding:[50,50]});
  const dist = haversine(originData.lat, originData.lon, destData.lat, destData.lon);
  const roadEst = dist * 1.35;
  routeDistKm = routeType === 'straight' ? dist : roadEst;
  document.getElementById('ri-dist').textContent = (routeType === 'straight' ? dist : roadEst).toFixed(1) + ' km' + (routeType !== 'straight' ? ' (est.)' : '');
  document.getElementById('ri-tag').textContent = routeType === 'straight' ? 'straight line' : 'est.';
  document.getElementById('ri-tag').style.color = routeType === 'straight' ? 'var(--blue)' : 'var(--amber)';
  document.getElementById('route-info').classList.add('show');
  document.getElementById('s-dist').value = routeDistKm.toFixed(1);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function applyRouteDistance() {
  if (routeDistKm) {
    document.getElementById('s-dist').value = routeDistKm.toFixed(1);
    showToast('Distance ' + routeDistKm.toFixed(1) + ' km applied ✓');
    document.getElementById('s-dist').scrollIntoView({behavior:'smooth', block:'nearest'});
  }
}

function detectLocation() {
  if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
  showToast('Detecting your location…');
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude:lat, longitude:lon} = pos.coords;
    reverseGeocode(lat, lon).then(addr => {
      document.getElementById('inp-origin').value = addr;
      document.getElementById('cl-origin').classList.add('show');
      originData = {lat, lon, display_name:addr};
      calcMap.setView([lat,lon], 15);
      updateMapRoute();
      showToast('📍 Location detected: ' + addr.split(',')[0]);
    });
  }, () => showToast('Location access denied'));
}

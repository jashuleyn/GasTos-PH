// ────────────────────────────────────────────────
// MAP — Leaflet calculator map + station locator
// ────────────────────────────────────────────────

let calcMap = null, mainMap = null;
let originMarker = null, destMarker = null;
let routingControl = null, straightLine = null;
let originData = null, destData = null;
let routeDistKm = null, routeType = 'road';
let pendingPin = {lat:null, lon:null, addr:null};

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

function initMainMap() {
  if (mainMap) return;
  mainMap = L.map('main-map', {scrollWheelZoom:true}).setView([12.8797,121.7740], 6);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(mainMap);
}

function doMapSearch() {
  const q = document.getElementById('map-search-input').value.trim();
  if (!q) { showToast('Enter a location to search'); return; }
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q+', Philippines')}&format=json&limit=1&countrycodes=ph`;
  fetch(url, {headers:{'Accept-Language':'en','User-Agent':'GasTosPH/1.0'}})
    .then(r => r.json()).then(res => {
      if (!res || !res[0]) { showToast('Location not found. Try a different name.'); return; }
      const lat = parseFloat(res[0].lat), lon = parseFloat(res[0].lon);
      initMainMap();
      mainMap.setView([lat,lon], 14);
      L.marker([lat,lon], {icon:makeIcon('#3DB8FF','📍')}).addTo(mainMap)
        .bindPopup(`<b>${res[0].display_name.split(',')[0]}</b><br><small style="color:var(--text3)">${res[0].display_name.split(',').slice(1,3).join(',')}</small>`).openPopup();
    }).catch(() => showToast('Search failed. Check connection.'));
}

function filterMapBrand() {
  showToast('Brand filter: ' + (document.getElementById('map-brand-filter').value || 'All'));
}

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

// ── PIN POPUP ──
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

// ── ROUTE TYPE ──
function setRouteType(type, btn) {
  routeType = type;
  document.querySelectorAll('.rt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (originData && destData) updateMapRoute();
}

// ── MAP MARKERS & ROUTING ──
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

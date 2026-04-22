// ────────────────────────────────────────────────
// AUTOCOMPLETE — Nominatim with PH-wide coverage
// ────────────────────────────────────────────────

const acTimers = {};
const acResultsStore = {origin:[], dest:[]};

function onAcInput(field) {
  const inp = document.getElementById('inp-' + field);
  const val = inp.value.trim();
  const dd = document.getElementById('dd-' + field);
  const sp = document.getElementById('sp-' + field);
  const cl = document.getElementById('cl-' + field);

  cl.classList.toggle('show', val.length > 0);

  if (val.length === 0) { dd.classList.remove('open'); return; }

  if (val.length < 2) {
    dd.innerHTML = `<div class="ac-min-chars">⌨️ Keep typing for suggestions…</div>`;
    dd.classList.add('open');
    return;
  }

  clearTimeout(acTimers[field]);
  sp.classList.add('show');
  acTimers[field] = setTimeout(() => nominatimSearch(val, field), 350);
}

function nominatimSearch(query, field) {
  const sp = document.getElementById('sp-' + field);
  const dd = document.getElementById('dd-' + field);

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query+', Philippines')}&format=json&limit=10&countrycodes=ph&addressdetails=1&namedetails=1&layer=address,poi&dedupe=1`;

  fetch(url, {headers:{'Accept-Language':'en','User-Agent':'GasTosPH/1.0 (contact@gastosph.app)'}})
    .then(r => r.json())
    .then(results => {
      sp.classList.remove('show');
      if (!results || results.length === 0) {
        nominatimFallback(query, field, dd);
        return;
      }
      renderDropdown(results, field, dd);
    })
    .catch(() => { sp.classList.remove('show'); });
}

function nominatimFallback(query, field, dd) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query+', Philippines')}&format=json&limit=8&countrycodes=ph&addressdetails=1`;
  fetch(url, {headers:{'Accept-Language':'en','User-Agent':'GasTosPH/1.0'}})
    .then(r => r.json())
    .then(results => {
      if (!results || results.length === 0) {
        dd.innerHTML = `<div class="ac-no-result">No results — try a street name, barangay, or landmark</div>`;
        dd.classList.add('open');
        return;
      }
      renderDropdown(results, field, dd);
    }).catch(() => {});
}

function renderDropdown(results, field, dd) {
  acResultsStore[field] = results;

  const typeLabels = {
    amenity:'Landmark', shop:'Shop', building:'Building',
    tourism:'Tourist spot', road:'Street/Road',
    suburb:'Barangay/Suburb', quarter:'District', neighbourhood:'Neighbourhood',
    village:'Village/Barangay', city:'City', town:'Town',
    municipality:'Municipality', residential:'Subdivision',
    hospital:'Hospital', school:'School', university:'University',
    mall:'Mall', restaurant:'Restaurant', bank:'Bank',
    gas_station:'Gas Station', fuel:'Gas Station',
    administrative:'Admin Area'
  };
  const typeColors = {
    road:'#3DB8FF', suburb:'#00C46A', village:'#00C46A',
    city:'#FFB020', town:'#FFB020', municipality:'#FFB020',
    amenity:'#FF8C42', fuel:'#FF5252', gas_station:'#FF5252'
  };

  dd.innerHTML = results.map((r,i) => {
    const a = r.address || {};
    const nn = r.namedetails || {};

    const specific =
      a.amenity||a.shop||a.tourism||a.leisure||a.man_made||
      nn.name||
      (a.house_number ? (a.house_number+' '+(a.road||'')).trim() : null)||
      a.road||a.pedestrian||a.footway||a.cycleway||
      a.suburb||a.quarter||a.neighbourhood||a.village||a.hamlet||
      a.city_district||
      r.display_name.split(',')[0];

    const brgy = a.suburb||a.quarter||a.neighbourhood||a.village||a.hamlet||'';
    const city = a.city||a.town||a.municipality||a.county||'';
    const province = a.state||'';
    const ctx = [
      brgy !== specific ? brgy : '',
      city !== specific ? city : '',
      province !== city ? province : ''
    ].filter(Boolean).slice(0,2).join(', ');

    const typeKey = r.type||r.class||'';
    const typeLabel = typeLabels[typeKey]||typeLabels[r.class]||(typeKey.charAt(0).toUpperCase()+typeKey.slice(1))||'Place';
    const typeColor = typeColors[typeKey]||typeColors[r.class]||'var(--text3)';

    return `<div class="ac-item" data-idx="${i}" data-field="${field}">
      <div class="ac-main">
        <span class="ac-pin ${field}"></span>
        <span>${specific||r.display_name.split(',')[0]}</span>
        <span class="ac-type-tag" style="color:${typeColor};background:${typeColor}18;border-color:${typeColor}30">${typeLabel}</span>
      </div>
      <div class="ac-sub">${ctx||r.display_name.split(',').slice(1,3).join(',').trim()}</div>
    </div>`;
  }).join('');

  dd.querySelectorAll('.ac-item').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      selectAc(parseInt(item.dataset.idx), item.dataset.field);
    });
  });
  dd.classList.add('open');
}

function selectAc(idx, field) {
  const r = acResultsStore[field][idx];
  if (!r) return;
  const a = r.address || {};
  const nn = r.namedetails || {};

  const specific =
    a.amenity||a.shop||a.tourism||nn.name||
    (a.house_number ? (a.house_number+' '+(a.road||'')).trim() : null)||
    a.road||a.suburb||a.quarter||a.neighbourhood||a.village||a.hamlet||
    a.city_district||r.display_name.split(',')[0];

  const city = a.city||a.town||a.municipality||'';
  const province = a.state||'';
  const parts = [specific];
  if (city && city !== specific) parts.push(city);
  if (province && province !== city) parts.push(province);
  const displayVal = parts.filter(Boolean).join(', ');

  document.getElementById('inp-' + field).value = displayVal;
  document.getElementById('cl-' + field).classList.add('show');
  document.getElementById('dd-' + field).classList.remove('open');

  const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
  if (field === 'origin') originData = {lat, lon, display_name:displayVal};
  else destData = {lat, lon, display_name:displayVal};

  const zoomLevel = (r.type === 'city' || r.type === 'town') ? 11 : (r.type === 'municipality' ? 12 : 15);
  calcMap.setView([lat, lon], zoomLevel);
  updateMapRoute();
}

function clearField(field) {
  document.getElementById('inp-' + field).value = '';
  document.getElementById('cl-' + field).classList.remove('show');
  document.getElementById('dd-' + field).classList.remove('open');
  if (field === 'origin') originData = null;
  else destData = null;
  updateMapRoute();
}

function onAcKey(e, field) {
  const dd = document.getElementById('dd-' + field);
  const items = dd.querySelectorAll('.ac-item');
  let focused = dd.querySelector('.ac-item.focused');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (focused) { focused.classList.remove('focused'); const nx = focused.nextElementSibling; if (nx && nx.classList.contains('ac-item')) nx.classList.add('focused'); }
    else if (items[0]) items[0].classList.add('focused');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (focused) { focused.classList.remove('focused'); const pv = focused.previousElementSibling; if (pv && pv.classList.contains('ac-item')) pv.classList.add('focused'); }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (focused) { focused.dispatchEvent(new MouseEvent('mousedown')); }
  } else if (e.key === 'Escape') {
    dd.classList.remove('open');
  }
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
  ['origin','dest'].forEach(f => {
    const wrap = document.getElementById('aw-' + f);
    if (wrap && !wrap.contains(e.target)) {
      const dd = document.getElementById('dd-' + f);
      if (dd) dd.classList.remove('open');
    }
  });
  const popup = document.getElementById('pin-popup');
  const mapEl = document.getElementById('calc-map');
  if (popup && mapEl && !popup.contains(e.target) && !mapEl.contains(e.target)) {
    popup.classList.remove('open');
  }
});

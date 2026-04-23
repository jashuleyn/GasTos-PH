// ────────────────────────────────────────────────
// CALCULATOR — Fuel cost calculations
// ────────────────────────────────────────────────

// Vehicle → allowed fuel types (in display order)
const VEHICLE_FUEL_MAP = {
  motorcycle: ['RON 95', 'RON 91'],
  car:        ['RON 95', 'RON 91', 'RON 97/100'],
  van:        ['Diesel', 'RON 95', 'RON 91'],
  truck:      ['Diesel'],
  jeepney:    ['Diesel'],
  hybrid:     ['RON 95', 'RON 91'],
};

// All possible fuel options (value → label)
const ALL_FUEL_OPTIONS = [
  { value: 'RON 95',     label: 'RON 95' },
  { value: 'RON 91',     label: 'RON 91' },
  { value: 'RON 97/100', label: 'RON 97/100' },
  { value: 'Diesel',     label: 'Diesel' },
  { value: 'Kerosene',   label: 'Kerosene' },
];

let selectedVehicle = 'car';

function selectVehicle(vehicle, btn) {
  selectedVehicle = vehicle;

  // Update active button
  document.querySelectorAll('#vehicle-picker .vp-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Rebuild fuel type dropdown
  const sel = document.getElementById('s-ftype');
  const currentVal = sel.value;
  const allowed = VEHICLE_FUEL_MAP[vehicle] || ALL_FUEL_OPTIONS.map(o => o.value);

  sel.innerHTML = allowed.map(v => {
    const opt = ALL_FUEL_OPTIONS.find(o => o.value === v);
    return `<option value="${opt.value}">${opt.label}</option>`;
  }).join('');

  // Preserve selection if still valid, else pick first
  if (allowed.includes(currentVal)) sel.value = currentVal;
  else sel.selectedIndex = 0;

  onFuelOrStationChange();
}

// Fuel type key normaliser → matches BRANDS price keys
const FUEL_KEY_MAP = {
  'RON 95':    ['RON 95'],
  'RON 91':    ['RON 91'],
  'RON 97/100':['RON 97', 'V-Power 97', 'Blaze 100', 'RON 97/100'],
  'Diesel':    ['Diesel'],
  'Kerosene':  ['Kerosene'],
};

function brandPrice(brand, fuelType) {
  const keys = FUEL_KEY_MAP[fuelType] || [fuelType];
  for (const k of keys) {
    if (brand.p[k] !== undefined) return brand.p[k];
  }
  return null;
}

function onFuelOrStationChange() {
  const fuelType  = document.getElementById('s-ftype').value;
  const stationNm = document.getElementById('s-station').value;
  const priceInp  = document.getElementById('s-price');
  const hint      = document.getElementById('s-price-hint');

  if (stationNm) {
    const brand = BRANDS.find(b => b.n === stationNm);
    const p = brand ? brandPrice(brand, fuelType) : null;
    if (p !== null) {
      priceInp.value = p.toFixed(2);
      hint.textContent = stationNm + ' price \u2191';
    } else {
      priceInp.value = '';
      hint.textContent = 'Not offered \u2014 enter manually';
    }
  } else {
    const ncr = PRICES.ncr;
    const row = ncr.find(r => r.t === fuelType);
    if (row) { priceInp.value = row.p.toFixed(2); hint.textContent = 'NCR avg \u2191'; }
    else { priceInp.value = ''; hint.textContent = 'Enter price'; }
  }

  document.getElementById('station-cmp').style.display = 'none';
}

function autoFill(pfx) {
  if (pfx !== 's') {
    const sel = document.getElementById(pfx + '-ftype');
    const inp = document.getElementById(pfx + '-price');
    if (sel && inp) inp.value = parseFloat(sel.value).toFixed(2);
  }
}

function setPreset() {
  const v = document.getElementById('a-vtype').value;
  document.getElementById('a-kml').placeholder = 'Preset: ' + v + ' km/L';
}

function calcSimple() {
  const dist     = parseFloat(document.getElementById('s-dist').value) || 0;
  const price    = parseFloat(document.getElementById('s-price').value) || 0;
  const kml      = parseFloat(document.getElementById('s-kml').value) || 12;
  const rt       = document.getElementById('s-round').checked;
  const fuelType = document.getElementById('s-ftype').value;
  const station  = document.getElementById('s-station').value;

  if (!dist || !kml) { showToast('Please enter distance and km/L'); return; }
  if (!price)        { showToast('Please select a station or enter a fuel price'); return; }

  const d = rt ? dist * 2 : dist;
  showResult(d / kml * price, d / kml, d, 1,
    (rt ? 'Round trip \u00b7 ' : 'One-way \u00b7 ') + d.toFixed(1) + ' km');
  showStationComparison(fuelType, station, d, kml);
}

function calcAdv() {
  const dist  = parseFloat(document.getElementById('a-dist').value) || 0;
  const price = parseFloat(document.getElementById('a-price').value) || 88.10;
  const preset= parseFloat(document.getElementById('a-vtype').value) || 12;
  const kml   = parseFloat(document.getElementById('a-kml').value) || preset;
  const pax   = parseInt(document.getElementById('a-pax').value) || 1;
  const split = document.getElementById('a-split').checked;
  const rt    = document.getElementById('a-round').checked;
  if (!dist) { showToast('Please enter a distance'); return; }
  const d = rt ? dist * 2 : dist;
  showResult(
    d / kml * price, d / kml, d,
    split ? pax : 1,
    document.getElementById('a-vtype').options[document.getElementById('a-vtype').selectedIndex].text.split('\u2014')[0].trim()
  );
}

function calcCmp() {
  const dist  = parseFloat(document.getElementById('c-dist').value) || 0;
  const price = parseFloat(document.getElementById('c-price').value) || 88.10;
  const k1    = parseFloat(document.getElementById('c-kml1').value) || 0;
  const k2    = parseFloat(document.getElementById('c-kml2').value) || 0;
  if (!dist || !k1 || !k2) { showToast('Fill all compare fields'); return; }
  const t1 = dist / k1 * price, t2 = dist / k2 * price;
  document.getElementById('c-r1').textContent = '\u20b1' + t1.toFixed(2);
  document.getElementById('c-r2').textContent = '\u20b1' + t2.toFixed(2);
  document.getElementById('c-n1').textContent = (dist/k1).toFixed(2) + ' L \u00b7 ' + k1 + ' km/L';
  document.getElementById('c-n2').textContent = (dist/k2).toFixed(2) + ' L \u00b7 ' + k2 + ' km/L';
  const sav = Math.abs(t1 - t2);
  document.getElementById('c-save').textContent =
    (t1 < t2 ? 'Vehicle A' : 'Vehicle B') + ' saves \u20b1' + sav.toFixed(2) +
    ' per trip (' + ((sav / Math.max(t1, t2)) * 100).toFixed(1) + '% cheaper)';
  document.getElementById('cmp-out').style.display = 'block';
}

function showResult(total, liters, dist, pax, note) {
  const box = document.getElementById('main-result');
  box.classList.add('show');
  document.getElementById('r-total').textContent  = '\u20b1' + total.toFixed(2);
  document.getElementById('r-liters').textContent = liters.toFixed(2) + 'L';
  document.getElementById('r-dist').textContent   = dist.toFixed(1) + ' km';
  document.getElementById('r-per').textContent    = pax > 1 ? '\u20b1' + (total / pax).toFixed(2) : '\u2014';
  document.getElementById('r-note').textContent   = note || '';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── STATION COMPARISON ──────────────────────────
function showStationComparison(fuelType, selectedStation, distKm, kml) {
  const box    = document.getElementById('station-cmp');
  const list   = document.getElementById('scmp-list');
  const noteEl = document.getElementById('scmp-note');
  const tagEl  = document.getElementById('scmp-fuel-tag');

  const rows = BRANDS.map(b => {
    const p = brandPrice(b, fuelType);
    if (p === null) return null;
    const tripCost = (distKm / kml) * p;
    return { name: b.n, tag: b.tag, price: p, tripCost };
  }).filter(Boolean).sort((a, b) => a.price - b.price);

  if (!rows.length) { box.style.display = 'none'; return; }

  const cheapest = rows[0];
  const selected = rows.find(r => r.name === selectedStation);
  const userPrice = selected ? selected.price : (parseFloat(document.getElementById('s-price').value) || cheapest.price);
  const userCost  = (distKm / kml) * userPrice;

  tagEl.textContent = fuelType;

  if (selectedStation && selected) {
    const savVsCheap = userCost - cheapest.tripCost;
    if (savVsCheap > 0.5) {
      noteEl.innerHTML = 'Switching to <strong>' + cheapest.name + '</strong> saves you <strong>\u20b1' + savVsCheap.toFixed(2) + '</strong> on this trip.';
      noteEl.className = 'scmp-note warn';
    } else {
      noteEl.innerHTML = '<strong>' + selectedStation + '</strong> is already the cheapest for ' + fuelType + '! \u2713';
      noteEl.className = 'scmp-note good';
    }
  } else {
    noteEl.innerHTML = 'Cheapest ' + fuelType + ' is at <strong>' + cheapest.name + '</strong> \u2014 \u20b1' + cheapest.price.toFixed(2) + '/L.';
    noteEl.className = 'scmp-note info';
  }

  list.innerHTML = rows.map((r, i) => {
    const isSelected = r.name === selectedStation;
    const isCheapest = i === 0;
    const diffCost   = r.tripCost - cheapest.tripCost;
    const diffStr    = diffCost < 0.01 ? '' : '<span class="scmp-diff">+\u20b1' + diffCost.toFixed(2) + '</span>';
    const badges = [
      isCheapest  ? '<span class="scmp-badge cheapest">Cheapest</span>' : '',
      isSelected  ? '<span class="scmp-badge selected">Your pick</span>' : '',
      '<span class="scmp-badge type-tag">' + r.tag + '</span>',
    ].join('');

    return '<div class="scmp-row' + (isSelected ? ' is-selected' : '') + (isCheapest ? ' is-cheapest' : '') + '">' +
      '<div class="scmp-rank">' + (i + 1) + '</div>' +
      '<div class="scmp-info">' +
        '<div class="scmp-name">' + r.name + ' ' + badges + '</div>' +
        '<div class="scmp-meta">\u20b1' + r.price.toFixed(2) + '/L \u00b7 Trip cost: \u20b1' + r.tripCost.toFixed(2) + ' ' + diffStr + '</div>' +
      '</div>' +
      '<button class="scmp-use-btn" onclick="applyStationPrice(\'' + r.name + '\',' + r.price + ',\'' + fuelType + '\')">Use \u2191</button>' +
    '</div>';
  }).join('');

  box.style.display = 'block';
  setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
}

function applyStationPrice(stationName, price, fuelType) {
  document.getElementById('s-station').value = stationName;
  document.getElementById('s-price').value   = price.toFixed(2);
  document.getElementById('s-price-hint').textContent = stationName + ' price \u2191';
  showToast('\u20b1' + price.toFixed(2) + '/L from ' + stationName + ' applied \u2713');
  document.getElementById('station-cmp').style.display = 'none';
}

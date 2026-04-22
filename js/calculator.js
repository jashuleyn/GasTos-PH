// ────────────────────────────────────────────────
// CALCULATOR — Fuel cost calculations
// ────────────────────────────────────────────────

function autoFill(pfx) {
  const sel = document.getElementById(pfx + '-ftype');
  const inp = document.getElementById(pfx + '-price');
  if (sel && inp) inp.value = parseFloat(sel.value).toFixed(2);
}

function setPreset() {
  const v = document.getElementById('a-vtype').value;
  document.getElementById('a-kml').placeholder = 'Preset: ' + v + ' km/L';
}

function calcSimple() {
  const dist = parseFloat(document.getElementById('s-dist').value) || 0;
  const price = parseFloat(document.getElementById('s-price').value) || 88.10;
  const kml = parseFloat(document.getElementById('s-kml').value) || 12;
  const rt = document.getElementById('s-round').checked;
  if (!dist || !kml) { showToast('Please enter distance and km/L'); return; }
  const d = rt ? dist * 2 : dist;
  showResult(d/kml*price, d/kml, d, 1, rt ? 'Round trip · '+d.toFixed(1)+' km' : 'One-way · '+d.toFixed(1)+' km');
}

function calcAdv() {
  const dist = parseFloat(document.getElementById('a-dist').value) || 0;
  const price = parseFloat(document.getElementById('a-price').value) || 88.10;
  const preset = parseFloat(document.getElementById('a-vtype').value) || 12;
  const kml = parseFloat(document.getElementById('a-kml').value) || preset;
  const pax = parseInt(document.getElementById('a-pax').value) || 1;
  const split = document.getElementById('a-split').checked;
  const rt = document.getElementById('a-round').checked;
  if (!dist) { showToast('Please enter a distance'); return; }
  const d = rt ? dist * 2 : dist;
  showResult(
    d/kml*price, d/kml, d,
    split ? pax : 1,
    document.getElementById('a-vtype').options[document.getElementById('a-vtype').selectedIndex].text.split('—')[0].trim()
  );
}

function calcCmp() {
  const dist = parseFloat(document.getElementById('c-dist').value) || 0;
  const price = parseFloat(document.getElementById('c-price').value) || 88.10;
  const k1 = parseFloat(document.getElementById('c-kml1').value) || 0;
  const k2 = parseFloat(document.getElementById('c-kml2').value) || 0;
  if (!dist || !k1 || !k2) { showToast('Fill all compare fields'); return; }
  const t1 = dist/k1*price, t2 = dist/k2*price;
  document.getElementById('c-r1').textContent = '₱' + t1.toFixed(2);
  document.getElementById('c-r2').textContent = '₱' + t2.toFixed(2);
  document.getElementById('c-n1').textContent = (dist/k1).toFixed(2) + ' L · ' + k1 + ' km/L';
  document.getElementById('c-n2').textContent = (dist/k2).toFixed(2) + ' L · ' + k2 + ' km/L';
  const sav = Math.abs(t1-t2);
  document.getElementById('c-save').textContent = (t1<t2?'Vehicle A':'Vehicle B') + ' saves ₱' + sav.toFixed(2) + ' per trip (' + ((sav/Math.max(t1,t2))*100).toFixed(1) + '% cheaper)';
  document.getElementById('cmp-out').style.display = 'block';
}

function showResult(total, liters, dist, pax, note) {
  const box = document.getElementById('main-result');
  box.classList.add('show');
  document.getElementById('r-total').textContent = '₱' + total.toFixed(2);
  document.getElementById('r-liters').textContent = liters.toFixed(2) + 'L';
  document.getElementById('r-dist').textContent = dist.toFixed(1) + ' km';
  document.getElementById('r-per').textContent = pax > 1 ? '₱' + (total/pax).toFixed(2) : '—';
  document.getElementById('r-note').textContent = note || '';
  box.scrollIntoView({behavior:'smooth', block:'nearest'});
}

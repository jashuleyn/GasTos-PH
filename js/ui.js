// ────────────────────────────────────────────────
// UI — Rendering, navigation, toast, feedback
// ────────────────────────────────────────────────

// ── TICKER ──
function buildTicker() {
  const items = PRICES.ncr;
  let h = items.map(p => {
    const cc = p.c > 0 ? 'up' : p.c < 0 ? 'down' : 'flat';
    const cs = p.c > 0 ? `▲ +${p.c.toFixed(2)}` : p.c < 0 ? `▼ ${p.c.toFixed(2)}` : '— 0.00';
    return `<div class="t-item"><span class="t-name">${p.t}</span><span class="t-price">₱${p.p.toFixed(2)}/L</span><span class="t-chg ${cc}">${cs}</span></div>`;
  }).join('');
  document.getElementById('ticker').innerHTML = h + h;
}

// ── PRICE LIST ──
function renderPrices() {
  const r = document.getElementById('region-sel').value;
  const data = PRICES[r] || PRICES.ncr;
  document.getElementById('price-list').innerHTML = data.map(p => {
    const cc = p.c > 0 ? 'up' : p.c < 0 ? 'down' : 'flat';
    const cs = p.c === 0 ? '— no change' : p.c > 0 ? `▲ +₱${p.c.toFixed(2)} wk` : `▼ −₱${Math.abs(p.c).toFixed(2)} wk`;
    return `<div class="price-row">
      <div><div class="pr-name">${p.t}</div><div class="pr-brand">${p.b}</div></div>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="pr-val"><div class="pr-amount">₱${p.p.toFixed(2)}/L</div><div class="pr-chg ${cc}">${cs}</div></div>
        <button class="use-btn" onclick="injectPrice(${p.p},'${p.t}')">Use ↑</button>
      </div>
    </div>`;
  }).join('');
}

function injectPrice(price, type) {
  document.getElementById('s-price').value = price.toFixed(2);
  const sel = document.getElementById('s-ftype');
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].text.includes(type.substring(0,6))) { sel.selectedIndex = i; break; }
  }
  showPage('calc', document.querySelectorAll('.nav-btn')[0]);
  showToast(`₱${price.toFixed(2)}/L applied to calculator`);
}

// ── BRANDS ──
function buildBrands() {
  const el = document.getElementById('brands-grid');
  if (!el) return;
  el.innerHTML = BRANDS.map(b => `
    <div class="brand-card">
      <div class="bc-header"><div class="bc-name">${b.n}</div><div class="bc-tag">${b.tag}</div></div>
      <div>${Object.entries(b.p).map(([k,v]) => `<div class="bc-row"><span class="bc-type">${k}</span><span class="bc-val">₱${v.toFixed(2)}/L</span></div>`).join('')}</div>
    </div>`).join('');
}

// ── COMMUNITY ──
function buildComm() {
  const el = document.getElementById('comm-list');
  if (!el) return;
  el.innerHTML = REPORTS.map(r => `
    <div class="report-item">
      <div><div class="ri-station">${r.s}</div><div class="ri-meta">${r.f} · ${r.loc} · ${r.t}</div>
        <div class="vote-row">
          <button class="vote-btn" onclick="this.textContent='👍 '+(parseInt(this.textContent.replace(/\\D/g,''))+1);showToast('Vote recorded!')">👍 ${r.v}</button>
          <button class="vote-btn" onclick="showToast('Report flagged for review')">🚩 Flag</button>
        </div>
      </div>
      <div class="ri-price">₱${r.p.toFixed(2)}/L</div>
    </div>`).join('');
}

// ── NAVIGATION ──
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (id === 'mappage') { setTimeout(() => { initMainMap(); mainMap && mainMap.invalidateSize(); }, 100); }
  if (id === 'calc') { setTimeout(() => { calcMap && calcMap.invalidateSize(); }, 100); }
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tp-' + name).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('main-result').classList.remove('show');
}

// ── FEEDBACK & TOAST ──
let rating = 0;
function rate(n) {
  rating = n;
  document.querySelectorAll('#stars .star').forEach((s,i) => s.classList.toggle('on', i < n));
}

function submitFB() {
  const txt = document.getElementById('fb-txt').value.trim();
  if (!rating && !txt) { showToast('Please rate or leave a comment'); return; }
  document.getElementById('fb-txt').value = '';
  document.querySelectorAll('#stars .star').forEach(s => s.classList.remove('on'));
  rating = 0;
  showToast('Thanks for your feedback! 🙌');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

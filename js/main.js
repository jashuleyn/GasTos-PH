// ────────────────────────────────────────────────
// MAIN — App entry point
// ────────────────────────────────────────────────

function init() {
  const now = new Date();
  document.getElementById('upd-time').textContent =
    now.toLocaleDateString('en-PH', {month:'short', day:'numeric', year:'numeric'}) + ' · ' +
    now.toLocaleTimeString('en-PH', {hour:'2-digit', minute:'2-digit'});
  if (document.getElementById('comm-date'))
    document.getElementById('comm-date').value = now.toLocaleDateString('en-PH', {year:'numeric', month:'long', day:'numeric'});
  buildTicker();
  renderPrices();
  buildBrands();
  buildComm();
  autoFill('s');
  initCalcMap();
}

init();

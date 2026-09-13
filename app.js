/* ====== CONFIG ====== */
const SHEET_ID = '11FC4UKZGh3-2SoQHmenUeB2l-oGtEjQ0zFjXjYTG7og';
const PASSWORD = 'werchow2026'; // clave de acceso — cambiala acá cuando quieras

const PALETTE = {
  teal: '#0FBAB2', tealDark: '#0C9992', terracota: '#C2622E', indigo: '#3A5FCD',
  magenta: '#C2487A', gold: '#D9A521', purple: '#8B5FBF', green: '#2E8B57', rust: '#A6631F',
  good: '#1E8E5A', critical: '#D6304A',
};
const CATEGORICAL = [PALETTE.teal, PALETTE.terracota, PALETTE.indigo, PALETTE.magenta, PALETTE.gold, PALETTE.purple, PALETTE.green, PALETTE.rust];

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/* ====== GATE ====== */
const gate = document.getElementById('gate');
const app = document.getElementById('app');
const footer = document.getElementById('footer');

function unlock() {
  gate.classList.add('hidden');
  app.classList.remove('hidden');
  footer.style.display = 'block';
  boot();
}

if (sessionStorage.getItem('werchow_unlocked') === '1') {
  unlock();
} else {
  document.getElementById('gate-btn').addEventListener('click', tryUnlock);
  document.getElementById('gate-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
}
function tryUnlock() {
  const val = document.getElementById('gate-input').value;
  if (val === PASSWORD) {
    sessionStorage.setItem('werchow_unlocked', '1');
    unlock();
  } else {
    document.getElementById('gate-err').textContent = 'Clave incorrecta';
  }
}

/* ====== DATA FETCH ====== */
// Usamos /export?format=csv&gid=... en vez de /gviz/tq: el endpoint gviz
// devuelve filas corruptas (columnas enteras pegoteadas en una sola celda)
// para las pestañas con filas agrupadas de esta planilla.
const GIDS = {
  'Leads': 529628834,
  'Leads_Asesoramiento': 1657565566,
  'Leads_Emergencia_Sepelio': 283150958,
  'Leads_Sepelio_Interes': 1522551385,
  'Resumen Mensual': 588282422,
};
function csvUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GIDS[sheetName]}`;
}
function fetchSheet(sheetName, opts) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvUrl(sheetName), Object.assign({
      download: true,
      skipEmptyLines: true,
      complete: res => resolve(res.data),
      error: reject,
    }, opts || {}));
  });
}

function parseFecha(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function monthLabel(key) { const [y, m] = key.split('-'); return MESES[+m - 1] + ' ' + y; }
function mondayOf(d) {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day);
  return dt;
}
function fmtDM(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
function weekKey(d) { const m = mondayOf(d); return m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0') + '-' + String(m.getDate()).padStart(2, '0'); }
function weekLabel(key) {
  const d = new Date(key + 'T00:00:00');
  const end = new Date(d); end.setDate(end.getDate() + 6);
  return fmtDM(d) + '–' + fmtDM(end);
}

async function loadResumenMensual() {
  const rows = await fetchSheet('Resumen Mensual', { header: false });
  const out = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !/^\d{4}-\d{2}$/.test(r[0])) continue;
    out.push({
      mes: r[0],
      conversaciones: +r[1] || 0,
      leadsNuevos: +r[2] || 0,
      adhesiones: +r[3] || 0,
      emergencias: +r[4] || 0,
      calientes: +r[5] || 0,
    });
  }
  return out;
}

/* ====== STATE ====== */
const state = { leads: [], ases: [], emerg: [], interes: [], resumen: [] };

async function boot() {
  try {
    const [leads, ases, emerg, interes, resumen] = await Promise.all([
      fetchSheet('Leads', { header: true }),
      fetchSheet('Leads_Asesoramiento', { header: true }),
      fetchSheet('Leads_Emergencia_Sepelio', { header: true }),
      fetchSheet('Leads_Sepelio_Interes', { header: true }),
      loadResumenMensual(),
    ]);
    state.leads = leads.filter(r => r.Telefono);
    state.ases = ases.filter(r => r.Telefono);
    state.emerg = emerg.filter(r => r.Telefono);
    state.interes = interes.filter(r => r.Telefono);
    state.resumen = resumen;

    document.getElementById('last-update').textContent = 'Actualizado ' + new Date().toLocaleString('es-AR');
    renderAll();
  } catch (e) {
    console.error(e);
    document.getElementById('last-update').textContent = 'Error al cargar datos';
    document.getElementById('kpi-row').innerHTML =
      '<div class="error-msg" style="grid-column:1/-1">No se pudieron cargar los datos en vivo. ' +
      'Verificá que el Google Sheet esté compartido como "Cualquiera con el enlace puede ver".</div>';
  }
}
document.getElementById('refresh-btn').addEventListener('click', boot);

function renderAll() {
  populateMonthSelect();
  renderEmergBanner();
  renderKpis();
  renderTrendChart();
  renderPeriodChart();
  renderDistribution();
  renderCrm();
}

/* ====== EMERGENCY BANNER ====== */
function renderEmergBanner() {
  const pending = state.emerg.filter(r => (r.Estado || '').toLowerCase().includes('pendiente')).length;
  const banner = document.getElementById('emerg-banner');
  if (pending > 0) {
    document.getElementById('emerg-count').textContent = pending;
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }
}

/* ====== KPIs ====== */
function populateMonthSelect() {
  const sel = document.getElementById('month-select');
  sel.innerHTML = '';
  state.resumen.forEach((r, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = monthLabel(r.mes);
    sel.appendChild(opt);
  });
  sel.selectedIndex = state.resumen.length - 1;
  sel.addEventListener('change', renderKpis);
}
function renderKpis() {
  const sel = document.getElementById('month-select');
  const idx = +sel.value;
  const cur = state.resumen[idx];
  const prev = state.resumen[idx - 1];
  const row = document.getElementById('kpi-row');
  if (!cur) { row.innerHTML = ''; return; }
  const metrics = [
    ['Conversaciones', cur.conversaciones, prev && prev.conversaciones],
    ['Leads nuevos', cur.leadsNuevos, prev && prev.leadsNuevos],
    ['Adhesiones', cur.adhesiones, prev && prev.adhesiones],
    ['Emergencias', cur.emergencias, prev && prev.emergencias],
    ['Calientes', cur.calientes, prev && prev.calientes],
  ];
  row.innerHTML = metrics.map(([label, val, prevVal]) => {
    let delta = '';
    if (prevVal !== undefined && prevVal !== null) {
      const diff = val - prevVal;
      const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
      delta = `<div class="delta ${cls}">${arrow} ${Math.abs(diff)} vs mes anterior</div>`;
    }
    return `<div class="kpi"><div class="label">${label}</div><div class="value">${val}</div>${delta}</div>`;
  }).join('');
}

/* ====== TREND CHART (monthly, from Resumen Mensual) ====== */
let trendChart, periodChart, tiposChart, tempChart, localidadChart;

function renderTrendChart() {
  const labels = state.resumen.map(r => monthLabel(r.mes));
  const series = [
    { key: 'conversaciones', label: 'Conversaciones', color: CATEGORICAL[0] },
    { key: 'leadsNuevos', label: 'Leads nuevos', color: CATEGORICAL[1] },
    { key: 'adhesiones', label: 'Adhesiones', color: CATEGORICAL[2] },
    { key: 'emergencias', label: 'Emergencias', color: CATEGORICAL[3] },
    { key: 'calientes', label: 'Calientes', color: CATEGORICAL[4] },
  ];
  const datasets = series.map(s => ({
    label: s.label,
    data: state.resumen.map(r => r[s.key]),
    borderColor: s.color,
    backgroundColor: s.color,
    pointRadius: 3,
    borderWidth: 2,
    tension: .25,
  }));
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById('chart-trend'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' }, tooltip: { mode: 'index', intersect: false } },
      interaction: { mode: 'index', intersect: false },
      scales: { y: { beginAtZero: true, grid: { color: '#eef1f0' } }, x: { grid: { display: false } } },
    },
  });

  const tableWrap = document.getElementById('trend-table-wrap');
  tableWrap.innerHTML = '<table class="data-table"><thead><tr><th>Mes</th>' +
    series.map(s => `<th>${s.label}</th>`).join('') + '</tr></thead><tbody>' +
    state.resumen.map(r => `<tr><td>${monthLabel(r.mes)}</td>` + series.map(s => `<td>${r[s.key]}</td>`).join('') + '</tr>').join('') +
    '</tbody></table>';
  document.getElementById('toggle-trend-table').addEventListener('click', () => {
    const showing = tableWrap.style.display !== 'none';
    tableWrap.style.display = showing ? 'none' : 'block';
    document.getElementById('toggle-trend-table').textContent = showing ? 'Ver como tabla' : 'Ver como gráfico';
    document.getElementById('chart-trend').style.display = showing ? 'block' : 'none';
  });
}

/* ====== PERIOD CHART (month/week toggle, from raw lead sheets) ====== */
let currentPeriod = 'month';
document.querySelectorAll('#period-seg button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#period-seg button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    renderPeriodChart();
  });
});

function aggregate(records, dateField, keyFn) {
  const map = new Map();
  records.forEach(r => {
    const d = parseFecha(r[dateField]);
    if (!d) return;
    const k = keyFn(d);
    map.set(k, (map.get(k) || 0) + 1);
  });
  return map;
}

function renderPeriodChart() {
  const keyFn = currentPeriod === 'month' ? monthKey : weekKey;
  const labelFn = currentPeriod === 'month' ? monthLabel : weekLabel;

  const series = [
    { name: 'Leads nuevos', records: state.leads, field: 'Fecha_Registro', color: CATEGORICAL[0] },
    { name: 'Interesados en adhesión', records: state.ases, field: 'Fecha', color: CATEGORICAL[1] },
    { name: 'Emergencias sepelio', records: state.emerg, field: 'Fecha', color: CATEGORICAL[2] },
    { name: 'Interés sepelio', records: state.interes, field: 'Fecha', color: CATEGORICAL[3] },
  ].map(s => ({ ...s, map: aggregate(s.records, s.field, keyFn) }));

  const allKeys = new Set();
  series.forEach(s => s.map.forEach((_, k) => allKeys.add(k)));
  const sortedKeys = [...allKeys].sort();
  const keys = currentPeriod === 'week' ? sortedKeys.slice(-16) : sortedKeys;

  const datasets = series.map(s => ({
    label: s.name,
    data: keys.map(k => s.map.get(k) || 0),
    backgroundColor: s.color,
    borderRadius: 4,
  }));

  if (periodChart) periodChart.destroy();
  periodChart = new Chart(document.getElementById('chart-period'), {
    type: 'bar',
    data: { labels: keys.map(labelFn), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, grid: { color: '#eef1f0' } }, x: { grid: { display: false }, stacked: false } },
    },
  });
}

/* ====== DISTRIBUTION CHARTS ====== */
function topN(map, n) {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, n);
  const restTotal = entries.slice(n).reduce((s, e) => s + e[1], 0);
  if (restTotal > 0) top.push(['Otros', restTotal]);
  return top;
}

function renderDistribution() {
  // Tipo_Consulta: split multi-value comma field, single-hue ranking bar
  const tipoMap = new Map();
  state.leads.forEach(r => {
    (r.Tipo_Consulta || '').split(',').map(s => s.trim()).filter(Boolean).forEach(tag => {
      tipoMap.set(tag, (tipoMap.get(tag) || 0) + 1);
    });
  });
  const tipoTop = topN(tipoMap, 8).sort((a, b) => a[1] - b[1]);
  if (tiposChart) tiposChart.destroy();
  tiposChart = new Chart(document.getElementById('chart-tipos'), {
    type: 'bar',
    data: { labels: tipoTop.map(e => e[0]), datasets: [{ data: tipoTop.map(e => e[1]), backgroundColor: PALETTE.teal, borderRadius: 4 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: { x: { beginAtZero: true, grid: { color: '#eef1f0' } }, y: { grid: { display: false } } },
    },
  });

  // Temperatura: ordinal ramp frio->tibio->caliente + convertido as success accent
  const tempOrder = ['frio', 'tibio', 'caliente', 'convertido'];
  const tempColors = { frio: '#f3c9a8', tibio: '#dd8a4d', caliente: '#a84f24', convertido: PALETTE.teal };
  const tempCounts = {};
  tempOrder.forEach(t => tempCounts[t] = 0);
  state.leads.forEach(r => {
    const t = (r.Temperatura || '').trim().toLowerCase();
    if (tempCounts[t] !== undefined) tempCounts[t]++;
  });
  if (tempChart) tempChart.destroy();
  tempChart = new Chart(document.getElementById('chart-temp'), {
    type: 'bar',
    data: {
      labels: tempOrder.map(t => t[0].toUpperCase() + t.slice(1)),
      datasets: [{ data: tempOrder.map(t => tempCounts[t]), backgroundColor: tempOrder.map(t => tempColors[t]), borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, grid: { color: '#eef1f0' } }, y: { grid: { display: false } } },
    },
  });

  // Localidad: single-hue ranking bar (agrupado sin distinguir mayúsculas/minúsculas)
  const locGroups = new Map(); // key lowercase -> { label: mostFrequentOriginal, counts: Map(original->n), total }
  state.leads.forEach(r => {
    const loc = (r.Localidad || '').trim();
    if (!loc) return;
    const key = loc.toLowerCase();
    if (!locGroups.has(key)) locGroups.set(key, { counts: new Map(), total: 0 });
    const g = locGroups.get(key);
    g.counts.set(loc, (g.counts.get(loc) || 0) + 1);
    g.total++;
  });
  const locMap = new Map();
  locGroups.forEach(g => {
    const label = [...g.counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    locMap.set(label, g.total);
  });
  const locTop = topN(locMap, 8).sort((a, b) => a[1] - b[1]);
  if (localidadChart) localidadChart.destroy();
  localidadChart = new Chart(document.getElementById('chart-localidad'), {
    type: 'bar',
    data: { labels: locTop.map(e => e[0]), datasets: [{ data: locTop.map(e => e[1]), backgroundColor: PALETTE.terracota, borderRadius: 4 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, grid: { color: '#eef1f0' } }, y: { grid: { display: false } } },
    },
  });
}

/* ====== CRM TABLE ====== */
const TABS = {
  leads: {
    label: 'Todos los leads',
    data: () => state.leads,
    estadoField: 'Temperatura',
    columns: ['Fecha_Registro', 'Nombre', 'Telefono', 'Localidad', 'Tipo_Consulta', 'Temperatura', 'Ultima_Interaccion'],
    headers: ['Fecha', 'Nombre', 'Teléfono', 'Localidad', 'Motivo', 'Temperatura', 'Última interacción'],
  },
  ases: {
    label: 'Interesados en adhesión',
    data: () => state.ases,
    estadoField: 'Categoria',
    columns: ['Fecha', 'Nombre', 'Telefono', 'Localidad', 'Categoria', 'Horario_Llamada', 'Estado'],
    headers: ['Fecha', 'Nombre', 'Teléfono', 'Localidad', 'Categoría', 'Horario', 'Estado'],
  },
  emerg: {
    label: 'Emergencias sepelio',
    data: () => state.emerg,
    estadoField: 'Estado',
    columns: ['Fecha', 'Nombre', 'Telefono', 'Localidad', 'Estado', 'Atendido_Por', 'Fecha_Cierre'],
    headers: ['Fecha', 'Nombre', 'Teléfono', 'Localidad', 'Estado', 'Atendido por', 'Cierre'],
  },
  interes: {
    label: 'Interés sepelio',
    data: () => state.interes,
    estadoField: 'Estado',
    columns: ['Fecha', 'Nombre', 'Telefono', 'Localidad', 'Estado', 'En_Ventas'],
    headers: ['Fecha', 'Nombre', 'Teléfono', 'Localidad', 'Estado', 'En ventas'],
  },
};
let activeTab = 'leads';
let crmPage = 0;
const PAGE_SIZE = 25;

document.querySelectorAll('#crm-tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#crm-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    crmPage = 0;
    document.getElementById('crm-search').value = '';
    renderCrm();
  });
});
document.getElementById('crm-search').addEventListener('input', () => { crmPage = 0; renderCrm(); });
document.getElementById('crm-estado').addEventListener('change', () => { crmPage = 0; renderCrm(); });
document.getElementById('crm-prev').addEventListener('click', () => { if (crmPage > 0) { crmPage--; renderCrm(); } });
document.getElementById('crm-next').addEventListener('click', () => { crmPage++; renderCrm(); });

function badgeFor(field, value) {
  if (!value) return '';
  const v = value.trim();
  const lower = v.toLowerCase();
  if (['frio', 'tibio', 'caliente', 'convertido'].includes(lower)) return `<span class="badge ${lower}">${v}</span>`;
  if (field === 'Estado' && lower.includes('pendiente')) return `<span class="badge urgente">${v}</span>`;
  return `<span class="badge estado">${v}</span>`;
}

function renderCrm() {
  const tab = TABS[activeTab];
  let rows = tab.data();

  // populate estado filter options
  const estadoSel = document.getElementById('crm-estado');
  const distinct = [...new Set(rows.map(r => (r[tab.estadoField] || '').trim()).filter(Boolean))].sort();
  const prevVal = estadoSel.value;
  estadoSel.innerHTML = '<option value="">Todos</option>' + distinct.map(d => `<option value="${d}">${d}</option>`).join('');
  if (distinct.includes(prevVal)) estadoSel.value = prevVal;

  const search = document.getElementById('crm-search').value.trim().toLowerCase();
  const estadoFilter = estadoSel.value;

  if (search) {
    rows = rows.filter(r => (r.Nombre || '').toLowerCase().includes(search) || (r.Telefono || '').includes(search) || (r.Localidad || '').toLowerCase().includes(search));
  }
  if (estadoFilter) {
    rows = rows.filter(r => (r[tab.estadoField] || '').trim() === estadoFilter);
  }

  // sort by date desc when possible
  rows = rows.slice().sort((a, b) => {
    const da = parseFecha(a.Fecha || a.Fecha_Registro) || new Date(0);
    const db = parseFecha(b.Fecha || b.Fecha_Registro) || new Date(0);
    return db - da;
  });

  const total = rows.length;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  if (crmPage > maxPage) crmPage = maxPage;
  const pageRows = rows.slice(crmPage * PAGE_SIZE, crmPage * PAGE_SIZE + PAGE_SIZE);

  const thead = document.querySelector('#crm-table thead');
  thead.innerHTML = '<tr>' + tab.headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

  const tbody = document.querySelector('#crm-table tbody');
  if (pageRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${tab.headers.length}" class="empty-msg">Sin resultados</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(r => '<tr>' + tab.columns.map(c => {
      if (c === 'Temperatura' || c === 'Estado' || (c === 'Categoria' && tab.estadoField === 'Categoria')) return `<td>${badgeFor(c, r[c])}</td>`;
      return `<td>${r[c] || ''}</td>`;
    }).join('') + '</tr>').join('');
  }

  document.getElementById('crm-count').textContent = `${total} resultado${total === 1 ? '' : 's'} · página ${crmPage + 1} de ${maxPage + 1}`;
  document.getElementById('crm-prev').disabled = crmPage === 0;
  document.getElementById('crm-next').disabled = crmPage >= maxPage;
}

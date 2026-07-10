
var MAIN = null;
var CHART_OPTS = {
  theme: { mode: 'dark' },
  chart: { background: 'transparent', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
  grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
  dataLabels: { enabled: false },
  tooltip: { theme: 'dark', style: { fontSize: '14px', fontFamily: 'Outfit' } }
};
var apexCharts = {};

function fmtM(v) { 
  if(!v) return '0';
  return (v/1000000000).toFixed(3) + ' mlrd'; 
}
function fmtN(v) { 
  if(!v) return '0';
  return Math.round(v).toString().replace(/\\B(?=(\d{3})+(?!\d))/g, " "); 
}
function shortN(n) { return n.length > 25 ? n.substring(0,22)+'...' : n; }
function escA(s) { return String(s||'').replace(/"/g, '&quot;'); }
function esc(s) { return String(s||'').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

window.onload = function() {
  loadMain();
};

function refresh() {
  loadMain();
}

function loadMain() {
  g('mainApp').innerHTML = `
    <div class="loader-wrap">
      <div class="spinner"></div>
      <h3 style="color:var(--txt-mut)">Obyektlar va Shartnomalar tahlili olinmoqda...</h3>
    </div>
  `;
  google.script.run
    .withSuccessHandler(function(d) { MAIN = d; renderMain(); })
    .withFailureHandler(function(e) {
      g('mainApp').innerHTML = `<div class="glass" style="padding: 40px; text-align: center; border-color: rgba(248,113,113,0.3);">
        <div style="font-size: 56px; margin-bottom: 20px;">⚠️</div>
        <h2 style="color: var(--acc-red); margin-bottom: 12px;">Xatolik</h2>
        <p style="color: var(--txt-mut); font-size: 16px;">${e.message || e}</p>
        <button class="btn pri" style="margin: 32px auto 0;" onclick="refresh()">Qayta urinish</button>
      </div>`;
    })
    .apiBossData();
}

function g(id) { return document.getElementById(id); }

function renderMain() {
  if (!MAIN || !MAIN.jami) { refresh(); return; }
  var j = MAIN.jami, obs = MAIN.objects || [];
  if (MAIN.sana) g('hdrSana').innerHTML = "So'nggi yangilanish:<br><b style='color:#fff'>" + MAIN.sana + "</b>";

  var h = `
    <div class="kpi-grid">
      ${kpiCard('Umumiy Smeta', '💰', fmtM(j.smeta), obs.length + ' ta guruh', 'pri')}
      ${kpiCard('Fakt Bajarilgan', '✅', fmtM(j.fakt), 'Hajm', 'grn', j.progress)}
      ${kpiCard('F-2 Olingan', '📤', fmtM(j.f2), 'Faktdan', 'amb', j.f2pct)}
      ${kpiCard('Qolgan Ish (Qoldiq)', '⏳', fmtM(j.qoldiq), 'Smetadan', 'red', 100 - j.progress)}
    </div>

    <div class="chart-row">
      <div class="glass chart-box">
        <div class="chart-title">Shartnomalar kesimida daromad</div>
        <div id="chartBarMain" class="chart-wrapper"></div>
      </div>
      <div class="glass chart-box">
        <div class="chart-title">Umumiy xarajatlar taqsimoti</div>
        <div id="chartPieMain" class="chart-wrapper"></div>
      </div>
    </div>

    <h2 style="margin-bottom: 24px; font-size: 24px;">Ierarxik Moliyaviy Jadval</h2>
    <div class="hier-table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width: 40%">Nomi (Shartnoma / Obyekt / Razdel)</th>
            <th style="text-align:right">Smeta (so'm)</th>
            <th style="text-align:right">Fakt Bajarildi</th>
            <th style="text-align:right">Progress</th>
            <th style="text-align:right">F-2 Olingan</th>
            <th style="text-align:right">Qoldiq</th>
          </tr>
        </thead>
        <tbody>
  `;

  obs.sort((a,b) => b.smeta - a.smeta).forEach((grp, i) => {
    var pCol = grp.progress >= 70 ? 'var(--acc-grn)' : grp.progress >= 30 ? 'var(--acc-amb)' : 'var(--acc-red)';
    var grpId = 'grp-' + i;
    
    h += `
      <!-- SHARTNOMA ROW -->
      <tr class="lvl1-row" onclick="toggleLvl1('${grpId}', this)">
        <td class="lvl1-td">
          <span class="lvl1-icon">▶</span>
          ${esc(grp.nom)} <span style="font-size: 13px; color: var(--txt-mut); font-weight: 500; margin-left: 8px;">(${grp.subItems.length} ta obyekt)</span>
        </td>
        <td class="num-font val-pri" style="text-align:right">${fmtN(grp.smeta)}</td>
        <td class="num-font val-grn" style="text-align:right">${fmtN(grp.fakt)}</td>
        <td>
          <div class="prog-cell">
            <div class="prog-bar"><div class="prog-fill" style="width: ${Math.min(grp.progress, 100)}%; background: ${pCol}"></div></div>
            <span class="num-font" style="font-weight:800; color:${pCol}; width: 40px; text-align:right;">${grp.progress}%</span>
          </div>
        </td>
        <td class="num-font val-amb" style="text-align:right">${fmtN(grp.f2)}</td>
        <td class="num-font val-red" style="text-align:right">${fmtN(grp.qoldiq)}</td>
      </tr>
    `;

    grp.subItems.sort((a,b) => b.smeta - a.smeta).forEach((sub, j) => {
      var subPCol = sub.progress >= 70 ? 'var(--acc-grn)' : sub.progress >= 30 ? 'var(--acc-amb)' : 'var(--acc-red)';
      var obId = grpId + '-ob-' + j;
      h += `
        <!-- OBYEKT ROW -->
        <tr class="lvl2-row ${grpId}" data-ob="${escA(sub.nom)}" id="${obId}" onclick="toggleLvl2('${obId}', '${escA(sub.nom)}', this)">
          <td class="lvl2-td">
            <span class="lvl2-icon">▶</span>
            📄 ${esc(sub.nom)}
          </td>
          <td class="num-font" style="text-align:right; color:var(--txt-main)">${fmtN(sub.smeta)}</td>
          <td class="num-font val-grn" style="text-align:right">${fmtN(sub.fakt)}</td>
          <td>
            <div class="prog-cell">
              <div class="prog-bar"><div class="prog-fill" style="width: ${Math.min(sub.progress, 100)}%; background: ${subPCol}"></div></div>
              <span class="num-font" style="font-weight:800; color:${subPCol}; width: 40px; text-align:right;">${sub.progress}%</span>
            </div>
          </td>
          <td class="num-font val-amb" style="text-align:right">${fmtN(sub.f2)}</td>
          <td class="num-font val-red" style="text-align:right">${fmtN(sub.qoldiq)}</td>
        </tr>
        
        <!-- LOADING ROW FOR RAZDEL -->
        <tr class="loading-row ${obId}-loading">
          <td colspan="6" class="loading-td">
            <div style="display:inline-block; width:16px; height:16px; border:2px solid rgba(56,189,248,0.2); border-top-color:var(--pri); border-radius:50%; animation:spin 1s linear infinite; vertical-align:middle; margin-right:8px;"></div>
            Razdellar yuklanmoqda...
          </td>
        </tr>
      `;
    });
  });

  h += `
        </tbody>
      </table>
    </div>
  `;

  g('mainApp').innerHTML = h;

  setTimeout(() => {
    drawApexMainBar(obs);
    drawApexMainPie(j);
  }, 100);
}

/* HIERARCHY LOGIC */
function toggleLvl1(grpId, rowEl) {
  var isOpen = rowEl.classList.contains('open');
  if(isOpen) rowEl.classList.remove('open');
  else rowEl.classList.add('open');
  
  var childRows = document.querySelectorAll('.' + grpId);
  childRows.forEach(r => {
    if(isOpen) {
      r.style.display = 'none';
      if(r.classList.contains('open')) {
        toggleLvl2(r.id, r.getAttribute('data-ob'), r, true);
      }
    } else {
      r.style.display = 'table-row';
    }
  });
}

function toggleLvl2(obId, obNom, rowEl, forceClose) {
  var isOpen = rowEl.classList.contains('open');
  if(forceClose && !isOpen) return;

  if(isOpen) {
    rowEl.classList.remove('open');
    document.querySelectorAll('.' + obId + '-rz').forEach(r => r.style.display = 'none');
  } else {
    rowEl.classList.add('open');
    
    var existingRz = document.querySelectorAll('.' + obId + '-rz');
    if(existingRz.length > 0) {
      existingRz.forEach(r => r.style.display = 'table-row');
    } else {
      var loadRow = document.querySelector('.' + obId + '-loading');
      loadRow.style.display = 'table-row';
      
      google.script.run
        .withSuccessHandler(function(d) {
          loadRow.style.display = 'none';
          renderRazdels(obId, d.rzList || []);
        })
        .withFailureHandler(function(e) {
          loadRow.style.display = 'none';
          alert("Razdellarni yuklashda xatolik: " + e.message);
          rowEl.classList.remove('open');
        })
        .apiBossObyekt(obNom);
    }
  }
}

function renderRazdels(obId, rzList) {
  var loadRow = document.querySelector('.' + obId + '-loading');
  var html = '';
  
  if(rzList.length === 0) {
    html = `<tr class="lvl3-row ${obId}-rz" style="display:table-row"><td colspan="6" style="padding-left: 96px; color: var(--txt-mut); font-style: italic;">Razdellar mavjud emas</td></tr>`;
  } else {
    rzList.sort((a,b) => b.res - a.res).forEach(rz => {
      var pCol = rz.progress >= 70 ? 'var(--acc-grn)' : rz.progress >= 30 ? 'var(--acc-amb)' : 'var(--acc-red)';
      html += `
        <tr class="lvl3-row ${obId}-rz" style="display:table-row">
          <td class="lvl3-td">${esc(rz.nom)}</td>
          <td class="num-font" style="text-align:right; color:var(--txt-mut)">${fmtN(rz.res)}</td>
          <td class="num-font val-grn" style="text-align:right">${fmtN(rz.fakt)}</td>
          <td>
            <div class="prog-cell" style="opacity: 0.8;">
              <div class="prog-bar" style="height: 4px;"><div class="prog-fill" style="width: ${Math.min(rz.progress, 100)}%; background: ${pCol}"></div></div>
              <span class="num-font" style="font-weight:700; color:${pCol}; width: 40px; text-align:right; font-size:13px;">${rz.progress}%</span>
            </div>
          </td>
          <td class="num-font val-amb" style="text-align:right">${fmtN(rz.f2)}</td>
          <td class="num-font val-red" style="text-align:right">${fmtN(rz.ost)}</td>
        </tr>
      `;
    });
  }
  
  loadRow.insertAdjacentHTML('afterend', html);
}

function kpiCard(title, icon, val, sub, theme, pct) {
  var badge = pct !== undefined ? `<div class="kpi-badge">${pct}%</div>` : '';
  return `
    <div class="glass kpi-card ${theme}">
      <div class="kpi-icon-bg">${icon}</div>
      <div class="kpi-header">
        <div class="kpi-title">${title}</div>
        <div class="kpi-icon">${icon}</div>
      </div>
      <div class="kpi-val num-font">${val}</div>
      <div class="kpi-sub">
        <span>${sub}</span>
        ${badge}
      </div>
    </div>
  `;
}

function destroyChart(id) {
  if (apexCharts[id]) { apexCharts[id].destroy(); delete apexCharts[id]; }
}

function drawApexMainBar(obs) {
  destroyChart('barMain');
  var top10 = obs.slice(0, 10);
  if(top10.length === 0) top10 = [{nom: 'Ma`lumot yo`q', smeta: 0, fakt: 0, f2: 0}];
  var options = {
    ...CHART_OPTS,
    series: [
      { name: 'Smeta', data: top10.map(o => o.smeta || 0) },
      { name: 'Fakt', data: top10.map(o => o.fakt || 0) },
      { name: 'F-2', data: top10.map(o => o.f2 || 0) }
    ],
    chart: { type: 'bar', height: '100%', ...CHART_OPTS.chart },
    plotOptions: { bar: { horizontal: false, columnWidth: '60%', borderRadius: 4 } },
    colors: ['var(--pri)', 'var(--acc-grn)', 'var(--acc-amb)'],
    xaxis: { categories: top10.map(o => shortN(o.nom)), labels: { style: { colors: 'var(--txt-mut)', fontSize: '11px', fontWeight: 600 } } },
    yaxis: { labels: { formatter: (v) => fmtM(v), style: { colors: 'var(--txt-mut)', fontWeight: 600 } } },
    legend: { position: 'top', labels: { colors: 'var(--txt-mut)' } }
  };
  apexCharts['barMain'] = new ApexCharts(document.querySelector("#chartBarMain"), options);
  apexCharts['barMain'].render();
}

function drawApexMainPie(j) {
  destroyChart('pieMain');
  // ⚡ 2026-07-10 TUZATILDI: КАБ (kabel/provod) pie'da umuman yo'q edi — pul
  //   ko'rinmasdi, slice summalari haqiqiy smetadan kam chiqardi.
  var s = [j.chel||0, j.mash||0, j.mat||0, j.ob||0, j.mk||0, j.kab||0];
  var isEmpty = s.every(v => v === 0);

  var options = {
    ...CHART_OPTS,
    series: isEmpty ? [1] : s,
    chart: { type: 'donut', height: '100%', ...CHART_OPTS.chart },
    labels: isEmpty ? ['Hali xarajat yo\'q'] : ['CHEL', 'MASH', 'MAT', 'OB', 'M/K', 'KAB'],
    colors: isEmpty ? ['rgba(255,255,255,0.05)'] : ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#6366f1', '#ec4899'],
    plotOptions: { pie: { donut: { size: '70%', labels: { show: true, name: { color: 'var(--txt-mut)' }, value: { color: '#fff', fontSize: '24px', fontWeight: 800, formatter: (v) => isEmpty ? '0' : fmtM(v) } } } } },
    stroke: { show: true, colors: ['var(--bg-dark)'], width: 4 },
    legend: { position: 'bottom', labels: { colors: 'var(--txt-mut)', fontWeight: 600 }, itemMargin: { horizontal: 10, vertical: 5 } }
  };
  apexCharts['pieMain'] = new ApexCharts(document.querySelector("#chartPieMain"), options);
  apexCharts['pieMain'].render();
}

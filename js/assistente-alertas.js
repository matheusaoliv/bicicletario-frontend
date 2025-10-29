// --- Assistente Preditivo — Alertas de Inatividade ---
let _assistTimerId = null;
let _assistAlertMap = new Map();
let _assistFirstLoadDone = false;

// Utilitário: formata datas como dd/mm/yyyy HH:mm (robusto para ISO e strings comuns)
function formatDateTimeExact(input){
  try {
    if (!input) return '-';
    const d = new Date(input);
    if (isNaN(d.getTime())) return String(input);
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch { return String(input||'-'); }
}

// Util: carregar logo como dataURL para PDF (opcional)
function loadAssistLogo(){
  try {
    if (window.assistPdfLogo) return; // já carregado
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function(){
      try {
        const canvas = document.createElement('canvas');
        canvas.width = this.naturalWidth; canvas.height = this.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this, 0, 0);
        window.assistPdfLogo = canvas.toDataURL('image/png');
      } catch(_){ }
    };
    img.src = 'imagens/image.png'; // brasão/logotipo, se existir
  } catch(_){ }
}

// Container para chips de filtros ao lado do resumo
function ensureAssistChipsContainer(){
  try {
    const resumoEl = document.getElementById('assistResumo');
    if (!resumoEl) return null;
    let chips = document.getElementById('assistChips');
    if (!chips) {
      chips = document.createElement('span');
      chips.id = 'assistChips';
      resumoEl.insertAdjacentElement('afterend', chips);
    }
    return chips;
  } catch(_) { return null; }
}

function renderAssistChips(dias, localVal, sevVal){
  try {
    const chipsEl = ensureAssistChipsContainer();
    if (!chipsEl) return;
    const chips = [];
    const defaultDias = 3;
    if (Number(dias) !== defaultDias) {
      chips.push(`<span class="assist-chip" data-type="dias">Dias ≥ ${dias}<button type="button" class="chip-close" data-type="dias" aria-label="Remover">×</button></span>`);
    }
    if (localVal) {
      chips.push(`<span class="assist-chip" data-type="local">Local: ${escapeHtml(localVal)}<button type="button" class="chip-close" data-type="local" aria-label="Remover">×</button></span>`);
    }
    if (sevVal) {
      const label = (sevVal==='alta'?'Alta':(sevVal==='media'?'Média':'Baixa'));
      chips.push(`<span class="assist-chip" data-type="sev">Severidade: ${label}<button type="button" class="chip-close" data-type="sev" aria-label="Remover">×</button></span>`);
    }
    chipsEl.innerHTML = chips.join(' ');
  } catch(_){ }
}

function updateSevBadgeActive(sevVal){
  try {
    const bAlta = document.querySelector('#assistenteAlertasCard .sev-badge.sev-alta');
    const bMedia = document.querySelector('#assistenteAlertasCard .sev-badge.sev-media');
    const bBaixa = document.querySelector('#assistenteAlertasCard .sev-badge.sev-baixa');
    [bAlta, bMedia, bBaixa].forEach(b=>{ if(b){ b.classList.remove('filter-active'); }});
    if (sevVal === 'alta' && bAlta) bAlta.classList.add('filter-active');
    else if (sevVal === 'media' && bMedia) bMedia.classList.add('filter-active');
    else if (sevVal === 'baixa' && bBaixa) bBaixa.classList.add('filter-active');
  } catch(_){ }
}

// Destaque visual para os novos cards de severidade
function updateSevCardActive(sevVal){
  try {
    const cards = document.querySelectorAll('#assistenteAlertasCard .sev-card');
    cards.forEach(card => {
      const v = card.getAttribute('data-sev-filter') || '';
      card.classList.toggle('active', !!sevVal && v === sevVal);
    });
  } catch(_){ }
}

function escapeHtml(s){
  try { return String(s).replace(/[&<>"]+/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); } catch{ return s; }
}

// Skeleton loader para tabela de alertas (UX de carregamento)
function assistSkeletonHtml(rows = 8){
  const row = () => '<div class="s-row">'
    + '<div class="s-line"></div>' // Proprietário
    + '<div class="s-line"></div>' // Bicicleta
    + '<div class="s-line"></div>' // Entrada
    + '<div class="s-line"></div>' // Local
    + '<div class="s-line"></div>' // Inatividade
    + '<div class="s-line"></div>' // Severidade
    + '<div class="s-line"></div>' // Ações
    + '</div>';
  return '<div class="assist-skeleton">' + Array.from({length: rows}).map(row).join('') + '</div>';
}

function renderAssistChartsFromSeries(series){
  try { if(!window.Chart) return; } catch(_) { return; }
  if(!series || !Array.isArray(series.labels)) return;
  const ctxSev = document.getElementById('assistChartSev')?.getContext?.('2d');
  const ctxLoc = document.getElementById('assistChartLocal')?.getContext?.('2d');
  const ctxTr  = document.getElementById('assistChartTrend')?.getContext?.('2d');
  if(!ctxSev || !ctxLoc || !ctxTr) return;

  // Severidade total (somatório das séries)
  const sum = (arr)=> (Array.isArray(arr)?arr:[]).reduce((a,b)=> a + (Number(b)||0), 0);
  const cAlta = sum(series.alta);
  const cMedia = sum(series.media);
  const cBaixa = sum(series.baixa);
  const sevBg = [ cssVar('--sev-alta-bg','#dc3545'), cssVar('--sev-media-bg','#ffc107'), cssVar('--sev-baixa-bg','#6c757d') ];
  try { if(window.assistCharts.sev){ window.assistCharts.sev.destroy(); } } catch(_){}
  window.assistCharts.sev = new Chart(ctxSev, {
    type:'doughnut', data:{ labels:['Alta','Média','Baixa'], datasets:[{ data:[cAlta,cMedia,cBaixa], backgroundColor: sevBg, borderColor: sevBg, borderWidth:1 }] }, options:{ plugins:{ legend:{ position:'bottom' } } }
  });

  // Locais (do backend): series.locais = [{local, total}]
  const locLabels = Array.isArray(series.locais) ? series.locais.map(x=> x.local) : [];
  const locValues = Array.isArray(series.locais) ? series.locais.map(x=> x.total) : [];
  const locColor = cssVar('--admin-accent-info','#0ea5e9');
  try { if(window.assistCharts.local){ window.assistCharts.local.destroy(); } } catch(_){}
  window.assistCharts.local = new Chart(ctxLoc, {
    type:'bar', data:{ labels: locLabels, datasets:[{ label:'Alertas', data: locValues, backgroundColor: locColor }] },
    options:{ indexAxis:'y', responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true, ticks:{ precision:0 } } } }
  });

  // Tendência (labels YYYY-MM-DD → dd/mm)
  const labels = series.labels.map(s=>{ try { const parts = String(s).split('-'); return `${parts[2]||''}/${parts[1]||''}`; } catch{ return String(s); } });
  const counts = Array.isArray(series.total) ? series.total : [];
  const trendColor = cssVar('--admin-success','#22b573');
  try { if(window.assistCharts.trend){ window.assistCharts.trend.destroy(); } } catch(_){}
  window.assistCharts.trend = new Chart(ctxTr, {
    type:'line', data:{ labels, datasets:[{ label:'Alertas/dia', data: counts, borderColor: trendColor, backgroundColor: trendColor+'33', tension:0.25, fill:true }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } }
  });
}

// --- Analytics (Chart.js): severidade, locais, tendência ---
window.assistCharts = window.assistCharts || { sev:null, local:null, trend:null };
function cssVar(name, fallback){
  try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; } catch(_) { return fallback; }
}
function updateAssistCharts(alerts, sevCfg){
  try { if(!window.Chart) return; } catch(_) { return; }
  const ctxSev = document.getElementById('assistChartSev')?.getContext?.('2d');
  const ctxLoc = document.getElementById('assistChartLocal')?.getContext?.('2d');
  const ctxTr  = document.getElementById('assistChartTrend')?.getContext?.('2d');
  if(!ctxSev || !ctxLoc || !ctxTr) return;

  // 1) Severidade
  let cAlta=0, cMedia=0, cBaixa=0;
  alerts.forEach(a=>{ const s=getSevForAlert(a, sevCfg); if(s==='alta') cAlta++; else if(s==='media') cMedia++; else cBaixa++; });
  const sevData = [cAlta, cMedia, cBaixa];
  const sevLabels = ['Alta','Média','Baixa'];
  const sevBg = [ cssVar('--sev-alta-bg','#dc3545'), cssVar('--sev-media-bg','#ffc107'), cssVar('--sev-baixa-bg','#6c757d') ];
  const sevBorder = sevBg.map(c=>c);
  try { if(window.assistCharts.sev){ window.assistCharts.sev.destroy(); } } catch(_){}
  window.assistCharts.sev = new Chart(ctxSev, {
    type: 'doughnut', data: { labels: sevLabels, datasets:[{ data: sevData, backgroundColor: sevBg, borderColor: sevBorder, borderWidth:1 }] }, options:{ plugins:{ legend:{ position:'bottom' } } }
  });

  // 2) Locais (Top 7 + Outros)
  const byLocal = new Map();
  alerts.forEach(a=>{ const k=(a.local||'-').trim()||'-'; byLocal.set(k, (byLocal.get(k)||0)+1); });
  const sorted = Array.from(byLocal.entries()).sort((a,b)=> b[1]-a[1]);
  const topN = 7;
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const restSum = rest.reduce((acc, [,v])=> acc+v, 0);
  const locLabels = top.map(([k])=> k).concat(restSum?['Outros']:[]);
  const locValues = top.map(([,v])=> v).concat(restSum? [restSum] : []);
  const locColor = cssVar('--admin-accent-info','#0ea5e9');
  try { if(window.assistCharts.local){ window.assistCharts.local.destroy(); } } catch(_){}
  window.assistCharts.local = new Chart(ctxLoc, {
    type:'bar', data:{ labels: locLabels, datasets:[{ label:'Alertas', data: locValues, backgroundColor: locColor }] },
    options:{ indexAxis:'y', responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true, ticks:{ precision:0 } } } }
  });

  // 3) Tendência (últimos 14 dias por data de entrada)
  const days=14; const now = new Date();
  const labels=[]; const counts = Array.from({length:days}, ()=>0);
  for(let i=days-1;i>=0;i--){ const d=new Date(now); d.setDate(d.getDate()-i); labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})); }
  alerts.forEach(a=>{
    const dtStr = a.data_hora_entrada || a.data || a.entrada || '';
    const dt = dtStr ? new Date(dtStr) : null;
    if(!dt || isNaN(dt.getTime())) return;
    const diffDays = Math.floor((now - dt)/(24*3600*1000));
    if(diffDays>=0 && diffDays<days){ counts[days-1-diffDays]++; }
  });
  const trendColor = cssVar('--admin-success','#22b573');
  try { if(window.assistCharts.trend){ window.assistCharts.trend.destroy(); } } catch(_){}
  window.assistCharts.trend = new Chart(ctxTr, {
    type:'line', data:{ labels, datasets:[{ label:'Alertas/dia', data: counts, borderColor: trendColor, backgroundColor: trendColor+'33', tension:0.25, fill:true }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } }
  });
}

// --- Severidade configurável ---
function getSevConfig(){
  try {
    const mode = localStorage.getItem('assist_sev_mode') || 'backend';
    let med = parseInt(localStorage.getItem('assist_sev_med_days') || '3', 10);
    let hi = parseInt(localStorage.getItem('assist_sev_hi_days') || '7', 10);
    if(!Number.isFinite(med) || med < 0) med = 3;
    if(!Number.isFinite(hi) || hi < 0) hi = 7;
    if(hi < med) hi = med; // garante Alta ≥ Média
    return { mode, med, hi };
  } catch(_) { return { mode: 'backend', med: 3, hi: 7 }; }
}
function loadSevConfigToUI(){
  const cfg = getSevConfig();
  const modeEl = document.getElementById('assistSevMode');
  const medEl = document.getElementById('assistSevMedDays');
  const hiEl = document.getElementById('assistSevHiDays');
  if(modeEl) modeEl.value = cfg.mode;
  if(medEl) medEl.value = String(cfg.med);
  if(hiEl) hiEl.value = String(cfg.hi);
  updateSevUIEnabled();
}
function updateSevUIEnabled(){
  const modeEl = document.getElementById('assistSevMode');
  const medEl = document.getElementById('assistSevMedDays');
  const hiEl = document.getElementById('assistSevHiDays');
  const isBackend = (modeEl && modeEl.value === 'backend');
  if(medEl) medEl.disabled = !!isBackend;
  if(hiEl) hiEl.disabled = !!isBackend;
}
function saveSevConfigFromUI(){
  const modeEl = document.getElementById('assistSevMode');
  const medEl = document.getElementById('assistSevMedDays');
  const hiEl = document.getElementById('assistSevHiDays');
  const mode = (modeEl && modeEl.value) || 'backend';
  let med = parseInt((medEl && medEl.value) || '3', 10);
  let hi = parseInt((hiEl && hiEl.value) || '7', 10);
  if(!Number.isFinite(med) || med < 0) med = 3;
  if(!Number.isFinite(hi) || hi < 0) hi = 7;
  if(hi < med) hi = med;
  try {
    localStorage.setItem('assist_sev_mode', mode);
    localStorage.setItem('assist_sev_med_days', String(med));
    localStorage.setItem('assist_sev_hi_days', String(hi));
  } catch(_){ }
}
function resetSevConfigDefaults(){
  try {
    localStorage.setItem('assist_sev_mode', 'backend');
    localStorage.setItem('assist_sev_med_days', '3');
    localStorage.setItem('assist_sev_hi_days', '7');
  } catch(_){ }
}
function getInactivityDays(a){
  if (Number.isFinite(a?.dias_inatividade)) return a.dias_inatividade;
  if (Number.isFinite(a?.horas_inatividade)) return a.horas_inatividade / 24;
  if (Number.isFinite(a?.minutos_inatividade)) return a.minutos_inatividade / 1440;
  return 0;
}
function classifySeverityByDays(days, cfg){
  if (days >= cfg.hi) return 'alta';
  if (days >= cfg.med) return 'media';
  return 'baixa';
}
function getSevForAlert(a, cfg){
  const raw = (a?.severidade || '').toLowerCase();
  if (!cfg || cfg.mode !== 'local') return raw || 'baixa';
  const d = getInactivityDays(a);
  return classifySeverityByDays(d, cfg);
}
    

function digitsOnly(s){ return (s||'').replace(/\D+/g,''); }
function waLink(phone, msg){ const p=digitsOnly(phone); if(!p) return ''; const t=encodeURIComponent(msg||''); return `https://wa.me/${p}${t?('?text='+t):''}`; }
function mailLink(email, subject, body){ const e=(email||'').trim(); if(!e) return ''; return `mailto:${encodeURIComponent(e)}?subject=${encodeURIComponent(subject||'')}&body=${encodeURIComponent(body||'')}`; }
function getAlertKey(a){
  return String(a?.id || a?.controle_id || a?.registro_id || a?.bicicleta_id || a?.proprietario_id || [a?.proprietario_nome, a?.numero_identificacao, a?.data_hora_entrada, a?.local].map(v=>String(v||'').trim()).join('|'));
}
async function callAssistApi(path, body){
  try {
    // Usa apiFetch (definido em admin.js) para manter token e base
    const resp = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if(!resp.ok) throw new Error('http');
    return true;
  } catch(_) { return false; }
}
function getSilencedSet(){
  try {
    const raw = localStorage.getItem('assist_silenced');
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr)?arr:[]);
  } catch(_) { return new Set(); }
}
function saveSilencedSet(set){
  try { localStorage.setItem('assist_silenced', JSON.stringify(Array.from(set))); } catch(_){ }
}
function getResolvedSet(){
  try { const raw = localStorage.getItem('assist_resolved'); const arr = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(arr)?arr:[]); } catch(_) { return new Set(); }
}
function saveResolvedSet(set){
  try { localStorage.setItem('assist_resolved', JSON.stringify(Array.from(set))); } catch(_){ }
}
// Seen alerts (para notificar apenas novidades)
function getSeenSet(){
  try { const raw = localStorage.getItem('assist_seen_alerts'); const arr = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(arr)?arr:[]); } catch(_) { return new Set(); }
}
function saveSeenSet(set, currentKeys){
  try {
    const curr = Array.isArray(currentKeys) ? currentKeys.slice() : [];
    const prev = Array.from(set);
    // concatena mantendo ordem simples: atuais primeiro (mais recentes)
    const merged = curr.concat(prev.filter(k => !curr.includes(k)));
    const capped = merged.slice(0, 500);
    localStorage.setItem('assist_seen_alerts', JSON.stringify(capped));
  } catch(_){ }
}
// Notificações
function isNotifEnabled(){ try { return localStorage.getItem('assist_notif_enabled') === '1' && Notification && Notification.permission === 'granted'; } catch(_) { return false; } }
function updateNotifBtnUI(){
  const btn = document.getElementById('assistNotifBtn');
  if(!btn) return;
  const on = isNotifEnabled();
  btn.textContent = on ? 'Notificações: ON' : 'Notificações: OFF';
  btn.classList.toggle('btn-success', on);
  btn.classList.toggle('btn-outline-secondary', !on);
}
async function enableNotifications(){
  try {
    if(!('Notification' in window)) return alert('Navegador não suporta Notificações.');
    const perm = await Notification.requestPermission();
    if(perm === 'granted'){ localStorage.setItem('assist_notif_enabled','1'); } else { localStorage.setItem('assist_notif_enabled','0'); }
  } catch(_){ localStorage.setItem('assist_notif_enabled','0'); }
  updateNotifBtnUI();
}
function showToastAlert(a, sev){
  try {
    const cont = document.getElementById('toastContainer');
    if(!cont) return;
    const nome = a.proprietario_nome || '-';
    const bike = [a.numero_identificacao, [a.marca, a.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' • ');
    const entrada = a.data_hora_entrada ? formatDateTimeExact(a.data_hora_entrada) : '-';
    const local = a.local || '-';
    const inat = (Number.isFinite(a.dias_inatividade) ? (a.dias_inatividade+'d') : (Number.isFinite(a.horas_inatividade)?(a.horas_inatividade+'h') : (Number.isFinite(a.minutos_inatividade)?(a.minutos_inatividade+'m'):'-')));
    const resp = a.funcionario_entrada_nome || a.funcionario_entrada || a.responsavel || '';
    const sevLabel = (sev||'').toUpperCase();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role','alert'); toast.setAttribute('aria-live','assertive'); toast.setAttribute('aria-atomic','true');
    toast.innerHTML = `
      <div class="toast-header ${sev==='alta'?'text-bg-danger':(sev==='media'?'text-bg-warning':'text-bg-secondary')}">
        <strong class="me-auto">Assistente — ${sevLabel}</strong>
        <small>agora</small>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Fechar"></button>
      </div>
      <div class="toast-body">
        <div><strong>${nome}</strong> • ${bike||'-'}</div>
        <div>Local: ${local} • Entrada: ${entrada}</div>
        <div>Inatividade: ${inat}</div>
        <div>${resp?('Responsável: '+resp+' • '):''}Esqueceu de registrar a Saída (checkout)</div>
      </div>`;
    cont.appendChild(toast);
    const t = bootstrap && bootstrap.Toast ? new bootstrap.Toast(toast, { autohide: true, delay: 9000 }) : null;
    if(t) t.show();
  } catch(_){ }
}
function initAssistenteAlertas(){
  const btn = document.getElementById('assistAtualizar');
  const diasEl = document.getElementById('assistDias');
  const localEl = document.getElementById('assistLocal');
  const sevEl = document.getElementById('assistSeveridade');
  const autoEl = document.getElementById('assistAuto');
  const showSilEl = document.getElementById('assistShowSilenced');
  const sevModalEl = document.getElementById('assistSevModal');
  const sevModeEl = document.getElementById('assistSevMode');
  const sevSaveEl = document.getElementById('assistSevSave');
  const sevResetEl = document.getElementById('assistSevReset');
  const notifBtn = document.getElementById('assistNotifBtn');
  if (btn && !btn._bound) { btn.addEventListener('click', carregarAssistAlertas); btn._bound = true; }
  if (diasEl && !diasEl._bound) { diasEl.addEventListener('change', carregarAssistAlertas); diasEl._bound = true; }
  if (localEl && !localEl._bound) {
    localEl.addEventListener('change', carregarAssistAlertas);
    localEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); carregarAssistAlertas(); }});
    localEl._bound = true;
  }
  if (sevEl && !sevEl._persistBound) {
    sevEl.addEventListener('change', ()=>{
      try { localStorage.setItem('assist_sev', sevEl.value||''); } catch(_){}
      // A busca por severidade é aplicada após DataTable inicializar em carregarAssistAlertas()
    });
    sevEl._persistBound = true;
  }
  if (diasEl && !diasEl._persistBound) {
    diasEl.addEventListener('change', ()=>{ try { localStorage.setItem('assist_dias', diasEl.value||''); } catch(_){} });
    diasEl._persistBound = true;
  }
  if (localEl && !localEl._persistBound) {
    localEl.addEventListener('change', ()=>{ try { localStorage.setItem('assist_local', localEl.value||''); } catch(_){} });
    localEl._persistBound = true;
  }
  function applyAuto(){
    const secs = Number((autoEl && autoEl.value) || 0) || 0;
    try { localStorage.setItem('assist_auto_sec', String(secs)); } catch(_){}
    if(_assistTimerId){ clearInterval(_assistTimerId); _assistTimerId = null; }
    if(secs > 0){ _assistTimerId = setInterval(()=>{ try { carregarAssistAlertas(); } catch(_){} }, secs*1000); }
  }
  if (autoEl && !autoEl._bound) { autoEl.addEventListener('change', applyAuto); autoEl._bound = true; }
  if (showSilEl && !showSilEl._bound) {
    showSilEl.addEventListener('change', ()=>{ try{ localStorage.setItem('assist_show_silenced', showSilEl.checked ? '1':'0'); }catch(_){} carregarAssistAlertas(); });
    showSilEl._bound = true;
  }
  if (notifBtn && !notifBtn._bound) { notifBtn.addEventListener('click', enableNotifications); notifBtn._bound = true; }
  if (sevModalEl && !sevModalEl._bound) {
    sevModalEl.addEventListener('shown.bs.modal', ()=>{ try { loadSevConfigToUI(); } catch(_){} });
    if (sevModeEl) sevModeEl.addEventListener('change', updateSevUIEnabled);
    if (sevSaveEl) sevSaveEl.addEventListener('click', ()=>{ try { saveSevConfigFromUI(); } catch(_){} carregarAssistAlertas(); if(window.bootstrap){ const m=bootstrap.Modal.getOrCreateInstance(sevModalEl); m.hide(); } });
    if (sevResetEl) sevResetEl.addEventListener('click', ()=>{ try { resetSevConfigDefaults(); loadSevConfigToUI(); } catch(_){} });
    sevModalEl._bound = true;
  }

  // Aplicar preferências salvas
  try {
    const sd = localStorage.getItem('assist_dias'); if(sd && diasEl) diasEl.value = sd;
    const sl = localStorage.getItem('assist_local'); if(sl && localEl) localEl.value = sl;
    const ss = localStorage.getItem('assist_sev'); if(ss && sevEl) sevEl.value = ss;
    const sa = localStorage.getItem('assist_auto_sec'); if(sa && autoEl) autoEl.value = sa;
    const ssil = localStorage.getItem('assist_show_silenced'); if(typeof ssil==='string' && showSilEl) showSilEl.checked = (ssil==='1');
    try { updateSevCardActive(sevEl ? sevEl.value : ''); } catch(_){ }
  } catch(_){ }
  if (autoEl) { try { applyAuto(); } catch(_){} }
  loadAssistLogo();
  try { updateNotifBtnUI(); } catch(_){ }
  // Chips: remoção de filtros (delegação)
  try {
    if (!window._assistChipBound) {
      document.addEventListener('click', function(ev){
        const btn = ev.target.closest('#assistChips .chip-close');
        if (!btn) return;
        const type = btn.getAttribute('data-type');
        if (!type) return;
        try {
          if (type === 'dias') {
            const diasEl2 = document.getElementById('assistDias');
            if (diasEl2) diasEl2.value = '3';
            try { localStorage.setItem('assist_dias','3'); } catch(_){ }
          } else if (type === 'local') {
            const localEl2 = document.getElementById('assistLocal');
            if (localEl2) localEl2.value = '';
            try { localStorage.removeItem('assist_local'); } catch(_){ }
          } else if (type === 'sev') {
            const sevEl2 = document.getElementById('assistSeveridade');
            if (sevEl2) sevEl2.value = '';
            try { localStorage.setItem('assist_sev',''); } catch(_){ }
            updateSevBadgeActive('');
          }
        } catch(_){ }
        try { carregarAssistAlertas(); } catch(_){ }
      });
      window._assistChipBound = true;
    }
  } catch(_){ }
  // Badges de severidade clicáveis (toggle filtro)
  try {
    if (!window._assistKpiBind) {
      const sevSelect = document.getElementById('assistSeveridade');
      const bindBadge = (sel, value) => {
        if (sel && !sel._assistBound) {
          sel.style.cursor = 'pointer';
          sel.title = 'Filtrar por severidade';
          sel.addEventListener('click', function(){
            try {
              const curr = (sevSelect && sevSelect.value) || '';
              const next = (curr === value) ? '' : value;
              if (sevSelect) sevSelect.value = next;
              try { localStorage.setItem('assist_sev', next); } catch(_){ }
              updateSevBadgeActive(next);
              carregarAssistAlertas();
            } catch(_){ }
          });
          sel._assistBound = true;
        }
      };
      bindBadge(document.querySelector('#assistenteAlertasCard .sev-badge.sev-alta'), 'alta');
      bindBadge(document.querySelector('#assistenteAlertasCard .sev-badge.sev-media'), 'media');
      bindBadge(document.querySelector('#assistenteAlertasCard .sev-badge.sev-baixa'), 'baixa');
      // estado inicial
      try { updateSevBadgeActive(sevSelect ? sevSelect.value : ''); } catch(_){ }
      window._assistKpiBind = true;
    }
  } catch(_){ }
  // Ajusta DataTable quando a seção for expandida
  try {
    const col = document.getElementById('assistenteAlertasCollapse');
    if (col && !col._assistDTBound) {
      col.addEventListener('shown.bs.collapse', ()=>{
        try {
          if (window.jQuery && jQuery.fn.DataTable) {
            const dt = jQuery('#assistAlertasTable').DataTable();
            if (dt && dt.columns) dt.columns.adjust();
          }
        } catch(_){}
      });
      col._assistDTBound = true;
    }
  } catch(_){ }
  carregarAssistAlertas();
}

async function carregarAssistAlertas(){
  const cont = document.getElementById('assistAlertasLista');
  const resumo = document.getElementById('assistResumo');
  const kAltaEl = document.getElementById('assistKpiAlta');
  const kMediaEl = document.getElementById('assistKpiMedia');
  const kBaixaEl = document.getElementById('assistKpiBaixa');
  const showSil = document.getElementById('assistShowSilenced')?.checked;
  const sevCfg = getSevConfig();
  if(!cont) return;
  cont.innerHTML = assistSkeletonHtml(8);
  try {
    const dias = Math.max(1, parseInt(document.getElementById('assistDias')?.value || '3', 10));
    const localVal = (document.getElementById('assistLocal')?.value || '').trim();
    const sevVal = (document.getElementById('assistSeveridade')?.value || '').trim();
    // Chips e estado dos filtros (badges antigos + cards novos)
    try { renderAssistChips(dias, localVal, sevVal); updateSevBadgeActive(sevVal); updateSevCardActive(sevVal); } catch(_){ }
    const query = { dias: String(dias), limit: '200' };
    if(localVal) query.local_ilike = localVal;
    const data = await apiFetchJson('/admin/alertas', { query });
    const alertas = Array.isArray(data?.alertas) ? data.alertas : [];
    // Map e filtro de silenciados
    _assistAlertMap = new Map();
    const sil = getSilencedSet();
    const withKeys = alertas.map(a=>{ const key=getAlertKey(a); _assistAlertMap.set(key, a); return { key, a }; });
    const resolved = getResolvedSet();
    let visiveis = withKeys.filter(x=> (showSil ? true : !sil.has(x.key)) && !resolved.has(x.key));
    if (sevVal) {
      visiveis = visiveis.filter(x => getSevForAlert(x.a, sevCfg) === sevVal);
    }
    // Notificações: identificar novidades
    try {
      const seen = getSeenSet();
      const currentKeys = visiveis.map(x => x.key);
      const newKeys = currentKeys.filter(k => !seen.has(k));
      const maxToasts = 5;
      const sevCfgLocal = getSevConfig();
      newKeys.slice(0, maxToasts).forEach(k => {
        const a = _assistAlertMap.get(k) || {};
        const sevN = getSevForAlert(a, sevCfgLocal);
        showToastAlert(a, sevN);
        if (sevN === 'alta' && isNotifEnabled()) {
          const title = 'Alerta Alta — Bicicletário Japeri';
          const bike = [a.numero_identificacao, [a.marca, a.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' • ');
          const local = a.local || '-';
          const entrada = a.data_hora_entrada ? formatDateTimeExact(a.data_hora_entrada) : '-';
          const body = `${a.proprietario_nome || '-'} • ${bike || '-'} • ${local} • ${entrada}`;
          try { new Notification(title, { body }); } catch(_) {}
        }
      });
      saveSeenSet(seen, currentKeys);
    } catch(_){ }

    // Texto de corte para exibir e exportar
    let cutoffTxt = '';
    try {
      cutoffTxt = data?.cutoff_iso ? formatDateTimeExact(data.cutoff_iso) : '';
      if (resumo) resumo.textContent = `${alertas.length} alerta(s) • visíveis: ${visiveis.length} • corte: ${cutoffTxt || '-'}`;
    } catch {}

    if(alertas.length === 0){
      cont.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="bx bx-check-shield"></i></div><div class="empty-text">Tudo em ordem! Nenhum alerta de inatividade para os filtros selecionados.</div></div>';
      try { if(kAltaEl) kAltaEl.textContent='0'; if(kMediaEl) kMediaEl.textContent='0'; if(kBaixaEl) kBaixaEl.textContent='0'; } catch(_){ }
      return;
    }

    // KPIs por severidade (Assistente) e KPIs da aba Ativos
    try {
      let cAlta = 0, cMedia = 0, cBaixa = 0;
      visiveis.forEach(x=>{ const s=getSevForAlert(x.a, sevCfg); if(s==='alta') cAlta++; else if(s==='media') cMedia++; else cBaixa++; });
      // KPIs do card (antigos)
      if(kAltaEl) kAltaEl.textContent = String(cAlta);
      if(kMediaEl) kMediaEl.textContent = String(cMedia);
      if(kBaixaEl) kBaixaEl.textContent = String(cBaixa);

      // Novos KPIs na aba "Ativos": Atenção (média), Críticos (alta)
      const kAtivosTotal = document.getElementById('kpi-ativos-total');
      const kAtivosAtencao = document.getElementById('kpi-ativos-atencao');
      const kAtivosCriticos = document.getElementById('kpi-ativos-criticos');
      if (kAtivosAtencao) kAtivosAtencao.textContent = String(cMedia);
      if (kAtivosCriticos) kAtivosCriticos.textContent = String(cAlta);

      // Total de bicicletas guardadas agora via /dashboard/stats (compat=1)
      try {
        const tz = new Date().getTimezoneOffset();
        const stats = await apiFetchJson('/dashboard/stats', { query: { compat: '1', tzOffsetMinutes: String(tz) } });
        if (kAtivosTotal && stats && typeof stats.bicicletasEstacionadasAgora === 'number') {
          kAtivosTotal.textContent = String(stats.bicicletasEstacionadasAgora);
        }
      } catch(_) {
        // Fallback: usar quantidade de alertas visíveis caso a chamada falhe
        if (kAtivosTotal) kAtivosTotal.textContent = String(visiveis.length);
      }
    } catch(_){ }
    // Gráficos (tenta backend series; fallback client-side)
    try {
      const tz = new Date().getTimezoneOffset();
      const q = { dias: '14', limiar_dias: String(dias), tzOffsetMinutes: String(tz) };
      if (localVal) q.local_ilike = localVal;
      const series = await apiFetchJson('/admin/alertas/series', { query: q });
      renderAssistChartsFromSeries(series);
    } catch(_) {
      try { updateAssistCharts(visiveis.map(x=>x.a), sevCfg); } catch(__){}
    }

    let html = '<div class="table-responsive"><table id="assistAlertasTable" class="table table-sm table-striped align-middle w-100"><thead><tr>'
      + '<th>Proprietário</th><th>Bicicleta</th><th>Entrada</th><th>Local</th><th>Inatividade</th><th>Severidade</th><th>Ações</th>'
      + '</tr></thead><tbody>';

    visiveis.forEach(({key, a}) => {
      const nome = a.proprietario_nome || '-';
      const bike = [a.numero_identificacao, [a.marca, a.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' • ');
      const entrada = a.data_hora_entrada ? formatDateTimeExact(a.data_hora_entrada) : '-';
      const local = a.local || '-';
      const d = Number.isFinite(a.dias_inatividade) ? a.dias_inatividade : null;
      const h = Number.isFinite(a.horas_inatividade) ? a.horas_inatividade : null;
      const m = Number.isFinite(a.minutos_inatividade) ? a.minutos_inatividade : null;
      let inat = '-';
      if (d !== null && d >= 1) inat = d + 'd';
      else if (h !== null && h >= 1) inat = h + 'h';
      else if (m !== null) inat = m + 'm';
      const sev = getSevForAlert(a, sevCfg);
      const sevNum = sev==='alta' ? 3 : (sev==='media' ? 2 : 1);
      const sevClass = sev==='alta' ? 'sev-alta' : (sev==='media' ? 'sev-media' : 'sev-baixa');
      const rowClass = 'row-sev-' + (sev || 'baixa');
      const minOrder = Number.isFinite(m) ? m : (Number.isFinite(h) ? (h*60) : (Number.isFinite(d) ? (d*1440) : 0));
      // Ações
      const contatoTel = a.proprietario_contato || a.telefone || a.celular || a.contato || '';
      const contatoEmail = a.proprietario_email || a.email || '';
      const resumoMsg = `Olá, aqui é da Administração do Bicicletário Municipal de Japeri. Detectamos inatividade da sua bicicleta (${bike||'-'}) no local ${local} com entrada em ${entrada}. Por favor, entre em contato.`;
      const wa = waLink(contatoTel, resumoMsg);
      const ml = mailLink(contatoEmail, 'Alerta de Inatividade - Bicicletário Japeri', resumoMsg);
      const silSet = getSilencedSet();
      const isSil = silSet.has(key);
      // Ações reorganizadas
      const btnDarSaida = `<button type="button" class="btn btn-success btn-sm assist-acao-dar-saida" data-key="${key}" title="Dar Saída agora (fecha estada)"><i class='bx bx-log-out'></i> Dar Saída</button>`;
      const btnResolver = `<button type="button" class="btn btn-primary btn-sm assist-acao-resolver" data-key="${key}" title="Marcar como resolvido"><i class='bx bx-check-shield'></i> Resolver</button>`;

      let menuContato = '';
      if (wa || ml) {
        menuContato = `
          <div class="btn-group">
            <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" title="Opções de Contato">
              <i class='bx bxs-phone'></i> Contato
            </button>
            <ul class="dropdown-menu">
              ${wa ? `<li><a class="dropdown-item" target="_blank" rel="noopener" href="${wa}"><i class='bx bxl-whatsapp'></i> WhatsApp</a></li>`  : ''}
              ${ml ? `<li><a class="dropdown-item" href="${ml}"><i class='bx bx-envelope'></i> E-mail</a></li>`  : ''}
            </ul>
          </div>`;
      }

      const menuMaisOpcoes = `
        <div class="btn-group">
          <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" title="Mais Opções">
            <i class='bx bx-dots-vertical-rounded'></i>
          </button>
          <ul class="dropdown-menu">
            <li><button class="dropdown-item assist-acao-detalhe" type="button" data-key="${key}"><i class='bx bx-show-alt'></i> Detalhar Alerta</button></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item assist-acao-silenciar" type="button" data-key="${key}" data-sil="${isSil ? 1 : 0}"><i class='bx ${isSil ? 'bxs-bell' : 'bx-bell-off'}'></i> ${isSil ? 'Reativar Alerta' : 'Silenciar'}</button></li>
          </ul>
        </div>`;
      const respName = a.funcionario_entrada_nome || a.responsavel || '';
      const warnTitle = respName ? `${respName} deixou o checkout pendente` : 'Checkout pendente';
      const warnBadge = `<span class="badge bg-danger-subtle text-danger assist-warn" title="${warnTitle}">${respName ? respName : 'Funcionário não identificado'} deixou o checkout pendente</span>`;

      html += '<tr class="' + rowClass + '">' 
        + '<td>' + nome + '</td>'
        + '<td>' + (bike || '-') + '</td>'
        + '<td>' + entrada + '</td>'
        + '<td>' + local + '</td>'
        + '<td data-order="' + minOrder + '">' + inat + '</td>'
        + '<td data-order="' + sevNum + '"><span class="badge sev-badge ' + sevClass + '">' + (sev || '-') + '</span></td>'
        + '<td class="text-nowrap d-flex flex-wrap gap-1">' + warnBadge + ' ' + btnDarSaida + ' ' + btnResolver + ' ' + menuContato + ' ' + menuMaisOpcoes + '</td>'
        + '</tr>';
    });

    html += '</tbody></table></div>';
    cont.innerHTML = html;
    // Inicializa DataTable se disponível
    try {
      if (window.jQuery && jQuery.fn.DataTable) {
        const $t = jQuery('#assistAlertasTable');
        if (jQuery.fn.DataTable.isDataTable($t)) {
          $t.DataTable().destroy();
        }
        // Títulos e arquivo para exportações
        const now = new Date();
        const pad = n => String(n).padStart(2,'0');
        const fname = `alertas_inatividade_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        const exportTitle = `Alertas de Inatividade — ${now.toLocaleString('pt-BR')} — Dias≥${dias}${localVal?` — Local: ${localVal}`:''}`;
        const exportSub = `Corte: ${cutoffTxt || '-'}`;
        // Evita foco automático em inputs da DataTable durante a inicialização
        try { $t.off('preInit.dt.assist').on('preInit.dt.assist', function(){ try{ document.activeElement && document.activeElement.blur(); }catch(_){ } }); } catch(_){ }
        const dt = $t.DataTable({
          pageLength: 25,
          lengthMenu: [10,25,50,100],
          order: [[5, 'desc'], [4, 'desc']],
          responsive: true,
          scrollX: true,
          autoWidth: false,
          dom: 'Bfrtip',
          columnDefs: [ { targets: 6, orderable: false, searchable: false } ],
          buttons: [
            { extend:'copy', text:'Copiar', exportOptions:{ columns:[0,1,2,3,4,5] } },
            { extend:'csv', text:'CSV', filename: fname, title: exportTitle, exportOptions:{ columns:[0,1,2,3,4,5] } },
            { extend:'excel', text:'Excel', filename: fname, title: exportTitle, exportOptions:{ columns:[0,1,2,3,4,5] } },
            { extend:'pdfHtml5', text:'PDF', filename: fname, title: exportTitle, orientation:'landscape', pageSize:'A4', exportOptions:{ columns:[0,1,2,3,4,5] },
              customize: function(doc){
                try {
                  doc.pageMargins = [22, 36, 22, 28];
                  doc.defaultStyle.fontSize = 10;
                  if (doc.content && doc.content.length>0 && doc.content[0].text) {
                    doc.content[0].margin = [0,0,0,8];
                  }
                  doc.content.splice(1,0,{ text: exportSub, fontSize: 9, margin:[0,0,0,8] });
                  // Cabeçalho institucional
                  doc.images = doc.images || {};
                  if (window.assistPdfLogo) doc.images.logo = window.assistPdfLogo;
                  doc.header = function(){
                    return {
                      columns: [
                        (window.assistPdfLogo ? { image: 'logo', width: 50 } : { text: '' }),
                        { text: 'Bicicletário Municipal de Japeri', alignment: 'center', fontSize: 12, bold: true },
                        { text: 'Somente para uso interno', alignment: 'right', fontSize: 9, color: '#666' }
                      ],
                      margin: [22, 12, 22, 0]
                    };
                  };
                  doc.footer = function(currentPage, pageCount){
                    return { text: currentPage + ' / ' + pageCount, alignment: 'right', margin:[22,0,22,12], fontSize: 9 };
                  };
                } catch(_){ }
              }
            },
            { extend:'print', text:'Imprimir', title: exportTitle, exportOptions:{ columns:[0,1,2,3,4,5] } },
            { extend:'colvis', text:'Colunas' }
          ],
          language:{ url:'https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json' },
          initComplete: function(){
            try { if (document.activeElement) document.activeElement.blur(); } catch(_){ }
            try {
              if (!_assistFirstLoadDone) {
                window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                _assistFirstLoadDone = true;
              }
            } catch(_){ }
            try { $t.off('preInit.dt.assist'); } catch(_){ }
          }
        });
        // Elevar z-index do TD enquanto o dropdown estiver aberto
        try {
          jQuery('#assistAlertasTable')
            .off('shown.bs.dropdown.assist hidden.bs.dropdown.assist')
            .on('shown.bs.dropdown.assist', 'button[data-bs-toggle="dropdown"]', function(){ const td = this.closest('td'); if (td) td.classList.add('dropdown-open'); })
            .on('hidden.bs.dropdown.assist', 'button[data-bs-toggle="dropdown"]', function(){ const td = this.closest('td'); if (td) td.classList.remove('dropdown-open'); });
        } catch(_){ }
        // Filtro por severidade
        const $sev = jQuery('#assistSeveridade');
        if ($sev.length && !$sev[0]._assistBound) {
          $sev.on('change', function(){
            const v = this.value;
            // Usa regex ancorado para buscar exatamente o valor da severidade na coluna 5
            dt.column(5).search(v ? ('^'+v+'$') : '', true, false).draw();
          });
          $sev[0]._assistBound = true;
        }
        // Aplicar valor atual do select
        const v0 = ($sev.length ? $sev.val() : '') || '';
        dt.column(5).search(v0 ? ('^'+v0+'$') : '', true, false).draw();

        // Evitar que foco automático do DataTables desloque a página para baixo
        try { if (document.activeElement) document.activeElement.blur(); } catch(_){ }

        // Delegação: ações dos botões
        jQuery('#assistAlertasTable').off('click.assist').on('click.assist', '.assist-acao-detalhe', function(){
          try {
            const key = this.getAttribute('data-key');
            const a = _assistAlertMap.get(key) || {};
            const nome = a.proprietario_nome || '-';
            const bike = [a.numero_identificacao, [a.marca, a.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' • ');
            const entrada = a.data_hora_entrada ? formatDateTimeExact(a.data_hora_entrada) : '-';
            const local = a.local || '-';
            const sev = (a.severidade||'-');
            const inat = (Number.isFinite(a.dias_inatividade) ? (a.dias_inatividade+'d') : (Number.isFinite(a.horas_inatividade)?(a.horas_inatividade+'h') : (Number.isFinite(a.minutos_inatividade)?(a.minutos_inatividade+'m'):'-')));
            const html = `
              <div class="row g-2">
                <div class="col-md-6"><strong>Proprietário:</strong> ${nome}</div>
                <div class="col-md-6"><strong>Bicicleta:</strong> ${bike||'-'}</div>
                <div class="col-md-6"><strong>Entrada:</strong> ${entrada}</div>
                <div class="col-md-6"><strong>Local:</strong> ${local}</div>
                <div class="col-md-6"><strong>Inatividade:</strong> ${inat}</div>
                <div class="col-md-6"><strong>Severidade:</strong> ${sev}</div>
              </div>
              <hr/>
              <div class="row g-2 align-items-end">
                <div class="col-md-6">
                  <label class="form-label">Atribuir responsável</label>
                  <input id="assistRespInp" class="form-control" placeholder="Nome do responsável">
                </div>
                <div class="col-md-3">
                  <button type="button" class="btn btn-outline-primary w-100" id="assistRespBtn">Atribuir</button>
                </div>
              </div>
              <div class="row g-2 mt-2">
                <div class="col-12">
                  <label class="form-label">Comentário</label>
                  <textarea id="assistComentInp" class="form-control" rows="2" placeholder="Adicionar uma nota..."></textarea>
                </div>
                <div class="col-md-6">
                  <button type="button" class="btn btn-outline-secondary w-100" id="assistComentBtn">Comentar</button>
                </div>
                <div class="col-md-6">
                  <button type="button" class="btn btn-success w-100" id="assistResolverBtn">Resolver</button>
                </div>
              </div>`;
            const body = document.getElementById('assistDetalheBody');
            if(body) body.innerHTML = html;
            const copyBtn = document.getElementById('assistCopyBtn');
            if(copyBtn){ copyBtn.onclick = ()=>{ try { navigator.clipboard.writeText(`Alerta: ${nome} — ${bike} — Entrada: ${entrada} — Local: ${local} — Inatividade: ${inat} — Severidade: ${sev}`); copyBtn.textContent='Copiado!'; setTimeout(()=> copyBtn.textContent='Copiar resumo', 1200); } catch(_){} } }
            // Bind ações do modal
            const idCtrl = a.controle_id || a.id;
            const doAssign = async ()=>{ const r=(document.getElementById('assistRespInp')?.value||'').trim(); if(!r) return; const ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(idCtrl)}/atribuir`, { responsavel: r }); if(!ok) alert('Falha ao atribuir.'); };
            const doComment = async ()=>{ const c=(document.getElementById('assistComentInp')?.value||'').trim(); if(!c) return; const ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(idCtrl)}/comentar`, { comentario: c }); if(!ok) alert('Falha ao comentar.'); };
            const doResolve = async ()=>{ const ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(idCtrl)}/resolver`, { motivo: 'resolvido_via_modal' }); if(!ok){ // fallback local
                const set = getResolvedSet(); set.add(getAlertKey(a)); saveResolvedSet(set); }
              carregarAssistAlertas(); try{ const m=bootstrap.Modal.getInstance(document.getElementById('assistDetalheModal')); m && m.hide(); }catch(_){}}
            const b1=document.getElementById('assistRespBtn'); if(b1) b1.onclick = doAssign;
            const b2=document.getElementById('assistComentBtn'); if(b2) b2.onclick = doComment;
            const b3=document.getElementById('assistResolverBtn'); if(b3) b3.onclick = doResolve;
            const modalEl = document.getElementById('assistDetalheModal');
            if (modalEl && window.bootstrap) {
              const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
              modal.show();
            }
          } catch(_){ }
        }).on('click.assist', '.assist-acao-silenciar', async function(){
          try {
            const key = this.getAttribute('data-key');
            const isSil = this.getAttribute('data-sil') === '1';
            const a = _assistAlertMap.get(key) || {};
            const id = a.controle_id || a.id;
            // Tentativa de registrar no backend (stub). Ignora falhas.
            try { if(id!=null){ await callAssistApi(`/admin/alertas/${encodeURIComponent(id)}/silenciar`, { ativo: isSil }); } } catch(_){ }
            const set = getSilencedSet();
            if(isSil) set.delete(key); else set.add(key);
            saveSilencedSet(set);
            carregarAssistAlertas();
          } catch(_){ }
        }).on('click.assist', '.assist-acao-dar-saida', async function(){
          try {
            const key = this.getAttribute('data-key');
            const a = _assistAlertMap.get(key) || {};
            const id = a.controle_id || a.id;
            if (!id) return;
            if (!confirm('Confirmar DAR SAÍDA agora para este registro?')) return;
            let ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(id)}/dar-saida`, { motivo: 'acao_rapida' });
            if (!ok) {
              // Fallback: marcar como resolvido (não fecha estada no backend)
              ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(id)}/resolver`, { motivo: 'fallback_dar_saida' });
            }
            if (!ok) alert('Falha ao dar saída.');
            carregarAssistAlertas();
          } catch(_){ }
        }).on('click.assist', '.assist-acao-resolver', async function(){
          try {
            const key = this.getAttribute('data-key');
            const a = _assistAlertMap.get(key) || {};
            const id = a.controle_id || a.id;
            let ok = false;
            if(id!=null){ ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(id)}/resolver`, { motivo: 'resolvido_via_lista' }); }
            if(!ok){ const set = getResolvedSet(); set.add(key); saveResolvedSet(set); }
            carregarAssistAlertas();
          } catch(_){ }
        });
      }
    } catch(_){ }
  } catch(err){
    console.error('Assistente alertas:', err);
    cont.innerHTML = '<p class="text-danger mb-0">Erro ao carregar alertas: ' + ((err && err.message) || 'erro desconhecido') + '</p>';
  }
}

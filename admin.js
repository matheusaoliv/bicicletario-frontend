// admin.js
// Lógica de autenticação e funcionalidades do painel admin

// Configuração da URL base da API (normalizada com ou sem '/api')
const BASE_API = (
  (window.API_BASE_URL && window.API_BASE_URL.trim())
    ? window.API_BASE_URL
    : 'https://southamerica-east1-bicicletario-japeri-v3.cloudfunctions.net/api'
).replace(/\/$/, '');

const ADMINS = [
  "Matheus Oliveira",
  "Wenderson da silva soares",
  "Joice barbosa nascimento",
  "Marcelo damasceno de oliveira",
  "Shaiene maiara ferreira de oliveira",
  "Jorge luiz costa dos santos",
  "Marcelo da silva rocha"
];

// Evitar "pulo" de rolagem quando DataTables inicializa
let _monitFirstLoadDone = false;

// Listas de funcionários por local
const FUNC_BICICLETARIO = [
  'raiane carvalho de souza',
  'ana paula dos santos',
  'deniesth vidal duarte',
  'alan pereira fiorani',
  'eloa cristina marques do nascimento',
  'matheus oliveira'
];
const FUNC_SECRETARIA = [
  'matheus oliveira',
  'marcelo da silva rocha',
  'wenderson da silva soares',
  'joice barbosa nascimento',
  'marcelo damasceno de oliveira',
  'shaiene maiara ferreira de oliveira',
  'jorge luiz costa dos santos'
];

// Proteção de acesso ao painel admin (somente com token válido em sessionStorage)
if (!sessionStorage.getItem('token')) {
  window.location.href = 'admin-login.html';
}

const adminLoginSection = document.getElementById('adminLoginSection');
const adminPanelSection = document.getElementById('adminPanelSection');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminLoginMsg = document.getElementById('adminLoginMsg');
const adminMsg = document.getElementById('adminMsg');

// [removido] handler duplicado de logout; o handler ativo está definido abaixo.

// Injeção de estilos e normalização do header (cores da prefeitura), sem duplicar
(function injectAdminUI() {
  try {
    // CSS global para responsividade e visual institucional
    if (!document.getElementById('adminDynamicStyles')) {
      const style = document.createElement('style');
      style.id = 'adminDynamicStyles';
      style.textContent = `
:root { --admin-header-height: 64px; --municipal-left:#0aa04f; --municipal-right:#0d6efd; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { padding-top: var(--admin-header-height); background: #f8f9fa; }

/* Header institucional (aplica em header existente ou no #adminHeader injetado) */
header.municipal-header, #adminHeader {
  position: fixed; top: 0; left: 0; right: 0; height: var(--admin-header-height);
  background: linear-gradient(90deg, var(--municipal-left), var(--municipal-right));
  color: #fff;
  display: flex; align-items: center; z-index: 1000;
  box-shadow: 0 2px 10px rgba(0,0,0,.12);
}
header.municipal-header .wrap, #adminHeader .wrap {
  width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 16px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
header.municipal-header h1, #adminHeader h1 { font-size: 18px; margin: 0; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
header.municipal-header nav, #adminHeader nav { display: flex; gap: 12px; flex-wrap: wrap; }
header.municipal-header nav a, #adminHeader nav a {
  color: #fff; text-decoration: none; font-weight: 600;
  padding: 6px 10px; border-radius: 6px; transition: background .2s ease;
}
header.municipal-header nav a:hover, #adminHeader nav a:hover { background: rgba(255,255,255,0.18); }

/* Ocupa toda a largura útil da página */
body > main { width: 100vw; max-width: 100vw; margin: 0 auto; padding: 12px; }
#adminPanelSection, #adminLoginSection { width: 100%; max-width: 100vw; margin: 12px auto; padding: 12px; }

/* Tabela e containers */
.tab-content { overflow-x: auto; }
.table-responsive, .dataTables_wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }
th, td { word-break: break-word; white-space: normal; vertical-align: middle; }
#tabelaMonitoramento td, #tabelaMonitoramento th { font-size: .92rem; }
/* Coluna Ações com quebra de linha para caber melhor */
#tabelaMonitoramento td:nth-child(9) { white-space: normal; }
#tabelaMonitoramento td:nth-child(9) .btn { margin: 2px 4px; }

img { max-width: 100%; }
.avatar-placeholder { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #e9ecef; border-radius: 50%; }
canvas { max-width: 100% !important; height: auto !important; }

@media (max-width: 576px) {
  :root { --admin-header-height: 72px; }
  header.municipal-header .wrap, #adminHeader .wrap { flex-direction: column; align-items: flex-start; gap: 6px; padding: 6px 12px; }
  header.municipal-header nav, #adminHeader nav { width: 100%; gap: 8px; }
}
      `;
      document.head.appendChild(style);
      // estilos de redimensionamento de colunas e min-widths
      if (!document.getElementById('adminTableResizeStyles')) {
        const styleCols = document.createElement('style');
        styleCols.id = 'adminTableResizeStyles';
        styleCols.textContent = `
#tabelaMonitoramento { table-layout: auto; }
#tabelaMonitoramento th.resizable {
  resize: horizontal;
  overflow: auto;
  cursor: col-resize;
  min-width: 80px;
}
/* Larguras mínimas por coluna (th) e reflete em td por índice */
#tabelaMonitoramento th.col-foto,   #tabelaMonitoramento td:nth-child(1) { min-width: 64px;  width: 64px; }
#tabelaMonitoramento th.col-nome,   #tabelaMonitoramento td:nth-child(2) { min-width: 160px; }
#tabelaMonitoramento th.col-local,  #tabelaMonitoramento td:nth-child(3) { min-width: 120px; }
#tabelaMonitoramento th.col-status, #tabelaMonitoramento td:nth-child(4) { min-width: 110px; }
#tabelaMonitoramento th.col-ping,   #tabelaMonitoramento td:nth-child(5) { min-width: 160px; }
#tabelaMonitoramento th.col-tempo,  #tabelaMonitoramento td:nth-child(6) { min-width: 140px; }
#tabelaMonitoramento th.col-total,  #tabelaMonitoramento td:nth-child(7) { min-width: 160px; }
#tabelaMonitoramento th.col-ultima, #tabelaMonitoramento td:nth-child(8) { min-width: 220px; }
#tabelaMonitoramento th.col-ranking,#tabelaMonitoramento td:nth-child(9) { min-width: 90px;  text-align: center; }
#tabelaMonitoramento th.col-acoes,  #tabelaMonitoramento td:nth-child(10){ min-width: 240px; }
        `;
        document.head.appendChild(styleCols);
      }
      // estilos do lightbox para fotos dos proprietários
      if (!document.getElementById('propLightboxStyles')) {
        const lb = document.createElement('style');
        lb.id = 'propLightboxStyles';
        lb.textContent = `
.prop-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.8);display:none;align-items:center;justify-content:center;z-index:2000}
.prop-lightbox.open{display:flex}
.prop-lightbox img{max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
        `;
        document.head.appendChild(lb);
      }
    }

    // Se já existe um header na página, decidir se devemos mexer nele
    const pageHeader = document.querySelector('header');
    const injectedHeader = document.getElementById('adminHeader');
    // Em admin.html o header já está pronto com classe .header. Não reestruturar.
    if (pageHeader && pageHeader.classList.contains('header')) {
      // Apenas garantir que não exista um #adminHeader extra
      if (injectedHeader && injectedHeader !== pageHeader) {
        injectedHeader.remove();
      }
      // Não altera DOM do header existente
      return;
    }

    if (pageHeader) {
      pageHeader.classList.add('municipal-header');
      // Se por acaso já tinha sido injetado um #adminHeader antes, remove para evitar duplicidade
      if (injectedHeader && injectedHeader !== pageHeader) {
        injectedHeader.remove();
      }
      // Garante que existe área de navegação com link de sair
      let nav = pageHeader.querySelector('nav');
      if (!nav) {
        nav = document.createElement('nav');
        pageHeader.appendChild(nav);
      }
      if (!nav.querySelector('.logout-admin-link') && !nav.querySelector('#logoutAdmin')) {
        const aLogout = document.createElement('a');
        aLogout.href = '#';
        aLogout.className = 'logout-admin-link';
        aLogout.textContent = 'Sair';
        nav.appendChild(aLogout);
      }
      if (!nav.querySelector('a[href="area-funcionario.html"]')) {
        const aPainel = document.createElement('a');
        aPainel.href = 'area-funcionario.html';
        aPainel.textContent = 'Painel de Controle';
        nav.prepend(aPainel);
      }
      if (!pageHeader.querySelector('h1')) {
        const h = document.createElement('h1');
        h.textContent = 'Painel do Administrador';
        const wrap = document.createElement('div');
        wrap.className = 'wrap';
        wrap.appendChild(h);
        wrap.appendChild(nav);
        // move conteúdo atual do header para dentro do wrap se necessário
        pageHeader.innerHTML = '';
        pageHeader.appendChild(wrap);
      } else if (!pageHeader.querySelector('.wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'wrap';
        // move todos filhos para dentro do .wrap
        while (pageHeader.firstChild) wrap.appendChild(pageHeader.firstChild);
        pageHeader.appendChild(wrap);
      }
    } else {
      // Caso não exista nenhum header, cria um com o visual institucional
      const header = document.createElement('header');
      header.id = 'adminHeader';
      header.innerHTML = `
        <div class="wrap">
          <h1>Painel do Administrador</h1>
          <nav>
            <a href="area-funcionario.html">Painel de Controle</a>
            <a href="#" class="logout-admin-link">Sair</a>
          </nav>
        </div>
      `;
      document.body.insertBefore(header, document.body.firstChild);
    }
  } catch (e) {
    console.warn('Falha ao injetar UI admin:', e);
  }
})();

// --- Toasts globais (Bootstrap) ---
function showToast(message, type = 'info', delayMs = 3200) {
  try {
    let cont = document.getElementById('toastContainer');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'toastContainer';
      cont.className = 'position-fixed bottom-0 end-0 p-3';
      cont.style.zIndex = 11000;
      document.body.appendChild(cont);
    }
    const color = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : type === 'warning' ? 'bg-warning' : 'bg-info';
    const el = document.createElement('div');
    el.className = `toast align-items-center text-white ${color} border-0`;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    cont.appendChild(el);
    try {
      if (window.bootstrap && window.bootstrap.Toast) {
        const t = new window.bootstrap.Toast(el, { delay: delayMs });
        t.show();
        el.addEventListener('hidden.bs.toast', () => el.remove());
      } else {
        // Fallback simples
        el.classList.add('show');
        setTimeout(() => { el.remove(); }, delayMs);
      }
    } catch { el.classList.add('show'); setTimeout(() => { el.remove(); }, delayMs); }
  } catch {}
}

// --- Wrapper de fetch com token, BASE_API e tratamento 401 ---
function buildUrlWithQuery(baseUrl, query) {
  try {
    const u = new URL(baseUrl, window.location.origin);
    if (query && typeof query === 'object') {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
      });
    }
    return u.toString();
  } catch { return baseUrl; }
}

function ensureCompatQuery(url){
  try{
    const u = new URL(url, window.location.origin);
    if (/\/admin\//.test(u.pathname) && !u.searchParams.has('compat')) {
      u.searchParams.set('compat','1');
    }
    return u.toString();
  } catch { return url; }
}

async function apiFetch(pathOrUrl, options = {}) {
  const token = sessionStorage.getItem('token');
  let url = pathOrUrl;
  if (!/^https?:/i.test(pathOrUrl)) {
    url = `${BASE_API}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  }
  if (options.query) {
    url = buildUrlWithQuery(url, options.query);
  }
  // Garantir compat=1 por padrão para endpoints /admin/*
  url = ensureCompatQuery(url);
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // Não fixa Content-Type para FormData
  const isForm = (options.body instanceof FormData);
  if (!isForm && options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const fetchOpts = { ...options, headers };
  if (fetchOpts.body && !isForm && typeof fetchOpts.body === 'object' && headers.get('Content-Type')?.includes('application/json')) {
    fetchOpts.body = JSON.stringify(fetchOpts.body);
  }
  const resp = await fetch(url, fetchOpts);
  if (resp.status === 401) {
    showToast('Sessão expirada. Faça login novamente.', 'error');
    try { sessionStorage.clear(); } catch {}
    setTimeout(() => { window.location.href = 'admin-login.html'; }, 1200);
    throw new Error('Sessão expirada (401)');
  }
  return resp;
}

async function apiFetchJson(pathOrUrl, options = {}) {
  const resp = await apiFetch(pathOrUrl, options);
  let data = null;
  try { data = await resp.json(); } catch {}
  if (!resp.ok) {
    const msg = (data && (data.erro || data.message)) || `Erro ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

// --- Heartbeat (ping de atividade do funcionário) ---
let _adminHeartbeatTimer = null;
const ADMIN_HEARTBEAT_MS = 2 * 60 * 1000; // 2 minutos

async function _sendAdminHeartbeat(){
  try {
    // Só envia se houver token
    if (!sessionStorage.getItem('token')) return;
    await apiFetch('/funcionarios/ping', { method: 'POST' });
  } catch (e) {
    try { console.warn('[heartbeat] falha no ping:', e?.message || String(e)); } catch(_){ }
  }
}

function startAdminHeartbeat(){
  if (_adminHeartbeatTimer) return;
  _sendAdminHeartbeat();
  _adminHeartbeatTimer = setInterval(_sendAdminHeartbeat, ADMIN_HEARTBEAT_MS);
}

function stopAdminHeartbeat(){
  if (_adminHeartbeatTimer) {
    clearInterval(_adminHeartbeatTimer);
    _adminHeartbeatTimer = null;
  }
}

document.addEventListener('visibilitychange', ()=>{
  try {
    if (document.visibilityState === 'visible') startAdminHeartbeat(); else stopAdminHeartbeat();
  } catch(_){ }
});

// Logout (delegação): limpa sessão e volta ao login
document.addEventListener('click', (e)=>{
  const a = e.target.closest('#logoutAdmin, .logout-admin-link');
  if(a){ e.preventDefault(); try{ sessionStorage.clear(); }catch(_){} window.location.href='admin-login.html'; }
});

// Exibir painel diretamente se já houver token e ligar filtros
document.addEventListener('DOMContentLoaded', ()=>{
  const token = sessionStorage.getItem('token');
  if(token){
    try{
      adminLoginSection?.classList.add('hidden');
      adminPanelSection?.classList.remove('hidden');
    } catch(_) {}
  }
    bindMonitorFilters();
    // Inicia heartbeat quando a aba estiver visível
    try { if (document.visibilityState === 'visible') startAdminHeartbeat(); } catch(_){ }
    // Ajusta gráficos e DataTable ao abrir o acordeão de análise detalhada
    try {
      const collapseEl = document.getElementById('collapseDetalhada');
      if (collapseEl) {
        collapseEl.addEventListener('shown.bs.collapse', () => {
          try { if (window.graficoProdutividade?.resize) window.graficoProdutividade.resize(); } catch (e) {}
          try { if (window.graficoRanking?.resize) window.graficoRanking.resize(); } catch (e) {}
          try {
            if (window.jQuery) {
              const dt = window.jQuery('#tabelaMonitoramento').DataTable();
              if (dt) { dt.columns.adjust(); if (dt.responsive) dt.responsive.recalc(); }
            }
          } catch (e) {}
        });
      }
    } catch (e) {}
});

function bindMonitorFilters(){
  const token = sessionStorage.getItem('token');
  const r = ()=> carregarMonitoramento(token);
  ['filtroLocal','filtroStatus','filtroDataInicio','filtroDataFim'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el || el._boundMonitor) return;
    el.addEventListener('change', r);
    el._boundMonitor = true;
  });
}
const modalEmail = document.getElementById('modalEmail');
const inputEmail = document.getElementById('inputEmail');
const btnSalvarEmail = document.getElementById('btnSalvarEmail');

let adminEmail = null;
let adminNome = null;

// --- Autenticação restrita ---
// O listener de login só é ativado na tela de login (admin-login.html)
if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    adminLoginMsg.textContent = '';
    const nome = document.getElementById('adminName').value;
    const login = document.getElementById('adminLogin').value.trim();
    const senha = document.getElementById('adminSenha').value;
    if (!ADMINS.includes(nome)) {
      adminLoginMsg.textContent = 'Acesso restrito apenas para administradores.';
      return;
    }
    try {
      // Login via backend próprio
      const res = await fetch(`${BASE_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_usuario: login, senha })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        adminLoginMsg.textContent = errorData.erro || 'Login ou senha incorretos.';
        return;
      }
      const data = await res.json();
      const token = data.token;
      if (!token) {
        adminLoginMsg.textContent = 'Token não recebido do backend.';
        return;
      }
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('admin_nome', nome);
      adminEmail = data.email || login;
      adminNome = nome;
      adminLoginSection?.classList.add('hidden');
      adminPanelSection?.classList.remove('hidden');
      adminMsg.textContent = 'Login de administrador realizado com sucesso!';
      adminMsg.classList.add('sucesso');
      // Checar se já tem e-mail salvo
      adminEmail = localStorage.getItem('admin_email_' + nome);
      if (!adminEmail) {
        setTimeout(() => {
          modalEmail.classList.remove('hidden');
        }, 600);
      } else {
        mostrarPainelAdmin(token);
      }
    } catch (err) {
      adminLoginMsg.textContent = err.message || 'Falha no login.';
    }
  });
}

btnSalvarEmail.addEventListener('click', () => {
  const email = inputEmail.value.trim();
  if (!email || !/^[\w-.]+@[\w-]+\.[a-z]{2,}$/i.test(email)) {
    inputEmail.classList.add('erro');
    inputEmail.focus();
    return;
  }
  localStorage.setItem('admin_email_' + adminNome, email);
  adminEmail = email;
  modalEmail.classList.add('hidden');
  adminMsg.textContent = 'E-mail salvo com sucesso!';
  adminMsg.classList.add('sucesso');
  try{ carregarMonitoramento(sessionStorage.getItem('token')); }catch(_){ }
});

// --- Monitoramento de Funcionários ---
async function carregarMonitoramento(token) {
  const monitoramentoDiv = document.getElementById('equipeTab');
  if (!monitoramentoDiv) return;
  const loadingDiv = document.getElementById('loadingMonitoramento');
  if (loadingDiv) loadingDiv.innerHTML = 'Carregando monitoramento...';
  try {
    const vLocal = document.getElementById('filtroLocal')?.value || '';
    const vStatus = document.getElementById('filtroStatus')?.value || '';
    const vIni = document.getElementById('filtroDataInicio')?.value || '';
    const vFim = document.getElementById('filtroDataFim')?.value || '';
    const query = { compat: '1' };
    if (vLocal) query.local_ilike = vLocal;
    if (vStatus) query.status = vStatus;
    if (vIni) query.start = `${vIni}T00:00:00`;
    if (vFim) {
      const d = new Date(`${vFim}T00:00:00`);
      d.setDate(d.getDate()+1);
      const pad = (n)=> String(n).padStart(2,'0');
      const ymd = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      query.end = `${ymd}T00:00:00`;
    }
    const { funcionarios, ranking, fluxoPorDia, fluxoPorFuncionarioPorDia, thresholds = {}, server_now } = await apiFetchJson('/admin/monitoramento', { query });

    // Guarda em memória para reuso (edição etc.)
    window.ultimoMonitoramento = funcionarios;

    // --- KPIs (Ativos, Movimentações Hoje, Alertas) ---
    try {
      const elAtivos = document.getElementById('kpi-ativos');
      const elMov = document.getElementById('kpi-mov-hoje');
      const elAlertas = document.getElementById('kpi-alertas');
      if (elAtivos || elMov || elAlertas) {
        let ativos = 0, movHoje = 0, alertas = 0;
        (funcionarios || []).forEach(f => {
          const st = (f.status || '').toString().toLowerCase();
          if (st === 'trabalhando' || st === 'ativo') ativos++;
          try { movHoje += Number(getMovHoje(f) || 0); } catch {}
          if (typeof f.tempoParadoMin === 'number' && f.tempoParadoMin > 60) alertas++;
        });
        // Tentar usar o endpoint de dashboard (compat=1) como fonte da movimentação do dia
        try {
          const tz = new Date().getTimezoneOffset();
          const stats = await apiFetchJson('/dashboard/stats', { query: { compat: '1', tzOffsetMinutes: String(tz) } });
          if (stats && typeof stats.entradasHoje === 'number' && typeof stats.saidasHoje === 'number') {
            movHoje = Number(stats.entradasHoje || 0) + Number(stats.saidasHoje || 0);
          }
        } catch {}
        if (elAtivos) elAtivos.textContent = String(ativos);
        if (elMov) elMov.textContent = String(movHoje);
        if (elAlertas) elAlertas.textContent = String(alertas);
      }
    } catch(_) {}

    // Verificação defensiva para o canvas
    const canvasProd = document.getElementById('graficoProdutividade');
    if (!canvasProd) {
      if (loadingDiv) loadingDiv.innerHTML = 'Erro: Canvas de produtividade não encontrado.';
      return;
    }
    const ctxProd = canvasProd.getContext('2d');
    const dias = Object.keys(fluxoPorDia).sort();
    // Apenas funcionários do bicicletário
    const funcionariosBici = (funcionarios || []).filter(f => {
      const nomeLower = (f.nome || '').toLowerCase();
      return FUNC_BICICLETARIO.includes(nomeLower);
    });
    const datasetsProd = [];
    funcionariosBici.forEach(f => {
      const checkins = dias.map(d => f.checkinsPorDia[d]?.checkins || 0);
      const checkouts = dias.map(d => f.checkinsPorDia[d]?.checkouts || 0);
      datasetsProd.push({
        label: `${f.nome} (Check-ins)`,
        data: checkins,
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        type: 'bar',
        stack: f.nome
      });
      datasetsProd.push({
        label: `${f.nome} (Check-outs)`,
        data: checkouts,
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        type: 'bar',
        stack: f.nome
      });
    });
    if (window.graficoProdutividade && typeof window.graficoProdutividade.destroy === 'function') {
      window.graficoProdutividade.destroy();
    }
    window.graficoProdutividade = new Chart(ctxProd, {
      type: 'bar',
      data: {
        labels: dias,
        datasets: datasetsProd
      },
      options: {
        responsive: true,
        scales: {
          x: {
            stacked: true
          },
          y: {
            stacked: true
          }
        }
      }
    });
    // Gráfico de ranking
    const ctxRank = document.getElementById('graficoRanking').getContext('2d');
    if (window.graficoRanking && typeof window.graficoRanking.destroy === 'function') {
      window.graficoRanking.destroy();
    }
    const rankingBici = (ranking || []).filter(r => {
      const nomeLower = (r.nome || '').toLowerCase();
      return FUNC_BICICLETARIO.includes(nomeLower);
    });
    window.graficoRanking = new Chart(ctxRank, {
      type: 'bar',
      data: { labels: rankingBici.map(f => f.nome), datasets: [{ label: 'Movimentações', data: rankingBici.map(f => f.totalMovimentacoes), backgroundColor: 'rgba(75,192,192,0.7)' }] },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }
    });

    // Gráfico de fluxo geral
    const ctxFluxo = document.getElementById('graficoFluxo').getContext('2d');
    if (window.graficoFluxo && typeof window.graficoFluxo.destroy === 'function') {
      window.graficoFluxo.destroy();
    }
    window.graficoFluxo = new Chart(ctxFluxo, {
      type: 'line',
      data: { labels: dias, datasets: [
        { label: 'Check-ins', data: dias.map(d => fluxoPorDia[d]?.checkins || 0), borderColor: 'rgba(54,162,235,1)', backgroundColor: 'rgba(54,162,235,0.2)', fill: true },
        { label: 'Check-outs', data: dias.map(d => fluxoPorDia[d]?.checkouts || 0), borderColor: 'rgba(255,99,132,1)', backgroundColor: 'rgba(255,99,132,0.2)', fill: true }
      ] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 16, right: 8, bottom: 8, left: 8 } },
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    // Tabela dinâmica de funcionários
    const tabela = $('#tabelaMonitoramento');
    if ($.fn.DataTable.isDataTable(tabela)) tabela.DataTable().destroy();
    tabela.empty();
    tabela.append('<thead><tr>'
      + '<th class="resizable col-foto">Foto</th>'
      + '<th class="resizable col-nome">Nome</th>'
      + '<th class="resizable col-local">Local</th>'
      + '<th class="resizable col-status">Status</th>'
      + '<th class="resizable col-ping">Último Ping</th>'
      + '<th class="resizable col-tempo">Tempo Parado</th>'
      + '<th class="resizable col-total">Total Mov.</th>'
      + '<th class="resizable col-ultima">Última Movimentação</th>'
      + '<th class="resizable col-ranking">Ranking</th>'
      + '<th class="resizable col-acoes">Ações</th>'
      + '</tr></thead><tbody></tbody>');
    funcionarios.forEach((f, idx) => {
      const nomeLower = (f.nome || '').toLowerCase();
      let local = '';
      if (FUNC_BICICLETARIO.includes(nomeLower) && FUNC_SECRETARIA.includes(nomeLower)) {
        local = 'Secretaria/Bicicletário';
      } else if (FUNC_BICICLETARIO.includes(nomeLower)) {
        local = 'Bicicletário';
      } else if (FUNC_SECRETARIA.includes(nomeLower)) {
        local = 'Secretaria';
      } else {
        local = 'Outro';
      }
      const destaque = f.status === 'Parado' ? 'table-danger' : '';
      const isAdmin = FUNC_SECRETARIA.includes(nomeLower);
      const edicoes = parseInt(localStorage.getItem('edicoes_funcionario_' + f.id) || '0', 10);
      const btnEditar = `<button class='btn btn-sm btn-primary' onclick="editarFuncionario('${f.id}')"><i class='bx bxs-edit'></i> Editar (${edicoes})</button>`;
      const btnExcluir = isAdmin ? '' : `<button class='btn btn-sm btn-danger' onclick="excluirFuncionario('${f.id}', '${(f.nome || '').replace(/'/g, '&#39;')}')"><i class='bx bxs-trash'></i> Excluir</button>`;
      const btnDeslogar = `<button class='btn btn-sm btn-warning' onclick="deslogarFuncionario('${f.id}', '${(f.nome || '').replace(/'/g, '&#39;')}')"><i class='bx bx-log-out'></i> Deslogar</button>`;
      const fotoUrl = f.fotoUrl || '';
      const avatar = fotoUrl ? `<img src='${fotoUrl}' alt='Foto de ${f.nome}' style='width:36px;height:36px;border-radius:50%;object-fit:cover;'>` : '<span class="avatar-placeholder">👤</span>';
      const lastPingStr = f.last_ping ? formatDateTimeExact(f.last_ping) : '-';
      const tempoParadoStr = (Number.isFinite(f.tempoParadoSec) ? formatTempoParadoSecs(f.tempoParadoSec) : (Number.isFinite(f.tempoParadoMin) ? formatTempoParado(f.tempoParadoMin) : '-'));
      const alertaCut = (thresholds && Number.isFinite(thresholds.ATIVO_MOV_MIN)) ? thresholds.ATIVO_MOV_MIN : 60;
      const alertaStr = (Number.isFinite(f.tempoParadoMin) && f.tempoParadoMin > alertaCut) ? ' <span class="badge bg-danger">Alerta</span>' : '';
      const totalMovStr = `${f.totalMovimentacoes} <small class="text-muted">(hoje: ${getMovHoje(f)})</small>`;
      const ultimaMovStr = f.ultimaMov ? `${formatDateTimeExact(f.ultimaMov)} (${f.tipoUltimaMov})` : '-';
      const basis = (f.status_basis || '').toLowerCase();
      const basisBadge = basis==='ping' ? '<span class="badge bg-secondary">ping</span>' : (basis==='mov' ? '<span class="badge bg-success">mov</span>' : (basis==='ambos' ? '<span class="badge bg-primary">ping+mov</span>' : ''));
      const statusHtml = (f.status_preditivo && f.status_preditivo !== f.status)
        ? `${formatStatus(f.status_preditivo)} <span class="badge bg-info" title="${(f.motivos_preditivos||[]).join(' | ').replace(/\"/g,'&quot;')}">heurística</span>${basisBadge ? ' ' + basisBadge : ''}`
        : `${formatStatus(f.status)}${basisBadge ? ' ' + basisBadge : ''}`;
      tabela.append(`<tr class="${destaque}"><td>${avatar}</td><td>${f.nome}</td><td>${local}</td><td>${statusHtml}</td><td>${lastPingStr}</td><td>${tempoParadoStr}${alertaStr}</td><td>${totalMovStr}</td><td>${ultimaMovStr}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir} ${btnDeslogar}</td></tr>`);
    });
    const prevY = (window.scrollY || document.documentElement.scrollTop || 0);
    tabela.DataTable({
      responsive: true,
      scrollX: true,
      autoWidth: false,
      order: [[8, 'asc']],
      dom: 'Bfrtip',
      buttons: [ { extend:'colvis', text:'Colunas' } ],
      language: { url:'https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json' },
      initComplete: function(){
        try { if (document.activeElement) document.activeElement.blur(); } catch(_){ }
        try {
          if (!_monitFirstLoadDone) {
            window.scrollTo({ top: prevY, left: 0, behavior: 'auto' });
            _monitFirstLoadDone = true;
          }
        } catch(_){ }
      }
    });

    // Justificativas de inatividade
    const justificativasDiv = document.getElementById('justificativasContainer');
    justificativasDiv.innerHTML = '<h4>Justificativas de Inatividade Recentes</h4>';
    let justificativasHtml = '<ul class="list-group">';
    funcionarios.forEach(f => {
      if(f.tipoUltimaMov === 'justificativa' && f.tempoParadoMin < 180) {
        justificativasHtml += `<li class="list-group-item"><b>${f.nome}:</b> Última justificativa há ${f.tempoParadoMin} min</li>`;
      }
    });
    justificativasHtml += '</ul>';
    justificativasDiv.innerHTML += justificativasHtml;

    if (loadingDiv) loadingDiv.innerHTML = '';
  } catch (error) {
    console.error('Erro ao carregar monitoramento:', error);
    if (loadingDiv) loadingDiv.innerHTML = 'Erro ao carregar monitoramento.';
    showToast(error.message || 'Erro ao carregar monitoramento', 'error');
  }
}

// SUBSTITUIR implementação antiga (primeira) de carregarProprietarios por stub para evitar uso
// async function carregarProprietarios(token) { /* substituída por versão em cards no final do arquivo */ }

// --- Exibir abas e carregar dados após login ---
function mostrarPainelAdmin(token) {
  adminLoginSection.classList.add('hidden');
  adminPanelSection.classList.remove('hidden');
  // Carregamento inicial será feito pelo sistema de abas (aba ativa)
}

// --- Sistema de Abas (Unificado: carrega por demanda) ---
document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.admin-tabs .tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  function loadTabData(tabName){
    try {
      switch (tabName) {
        case 'ativos':
          if (typeof initAssistenteAlertas === 'function') {
            initAssistenteAlertas();
          }
          break;
        case 'equipe': {
          const token = sessionStorage.getItem('token');
          if (typeof carregarMonitoramento === 'function') {
            carregarMonitoramento(token);
            try { iniciarAutoRefresh && iniciarAutoRefresh(); } catch(_){ }
          }
          break;
        }
        case 'proprietarios':
          if (typeof carregarProprietarios === 'function') {
            carregarProprietarios();
          }
          break;
        case 'auditoria':
          if (typeof renderizarBloqueiosPendentes === 'function') renderizarBloqueiosPendentes();
          if (typeof renderizarProprietariosBloqueados === 'function') renderizarProprietariosBloqueados();
          if (typeof renderizarLogsAuditoria === 'function') renderizarLogsAuditoria();
          try { ensureLogsControleHandlers(); carregarLogsControle(); } catch(_){ }
          break;
      }
    } catch(_){ }
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Esconde todos e remove a classe 'active'
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Mostra o conteúdo e o botão da aba clicada
      button.classList.add('active');
      const target = document.getElementById(tabName + 'Tab');
      if (target) target.classList.add('active');

      // Carrega os dados da aba ativa
      loadTabData(tabName);
    });
  });

  // Carrega dados iniciais da aba já ativa ao abrir a página
  const initialBtn = document.querySelector('.admin-tabs .tab-button.active');
  if (initialBtn) {
    const initialTab = initialBtn.getAttribute('data-tab');
    loadTabData(initialTab);
  }
});

// --- Relatórios e Backup ---
document.getElementById('btnRelatorioDia').onclick = () => imprimirRelatorio('dia');
document.getElementById('btnRelatorioMes').onclick = () => imprimirRelatorio('mes');
document.getElementById('btnGerarRelatorioDia').onclick = () => gerarRelatorio('dia');
document.getElementById('btnGerarRelatorioMes').onclick = () => gerarRelatorio('mes');
document.getElementById('btnBackup').onclick = realizarBackup;

async function imprimirRelatorio(tipo) {
  try {
    adminMsg.textContent = `Gerando relatório ${tipo === 'mes' ? 'mensal' : 'diário'}...`;
    adminMsg.classList.remove('sucesso');
    // Fazer requisição com token (wrapper trata 401)
    const res = await apiFetch('/admin/relatorio', { method:'GET', query:{ tipo } });
    if (!res.ok) { const errorData = await res.json().catch(()=>({})); throw new Error(errorData.erro || 'Falha ao gerar relatório.'); }
    
    // Criar blob e download
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const hoje = new Date().toISOString().slice(0,10);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${tipo}-${hoje}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    adminMsg.textContent = `Relatório ${tipo === 'mes' ? 'mensal' : 'diário'} gerado com sucesso!`;
    adminMsg.classList.add('sucesso');
    showToast('Relatório gerado com sucesso!', 'success');
  } catch (err) {
    adminMsg.textContent = 'Erro ao gerar relatório: ' + (err.message || 'Erro desconhecido');
    adminMsg.classList.remove('sucesso');
    adminMsg.style.color = 'red';
    showToast(err.message || 'Erro ao gerar relatório', 'error');
  }
}

async function gerarRelatorio(tipo) {
  if (!adminEmail) {
    modalEmail.classList.remove('hidden');
    return;
  }
  try {
    adminMsg.textContent = 'Gerando relatório...';
    await apiFetch('/admin/gerar-relatorio', { method:'POST', body: { tipo, email: adminEmail } });
    adminMsg.textContent = 'Relatório gerado e enviado para todos os administradores!';
    adminMsg.classList.add('sucesso');
    showToast('Relatório enviado por e-mail!', 'success');
  } catch (err) {
    adminMsg.textContent = err.message || 'Erro ao gerar relatório.';
    adminMsg.classList.remove('sucesso');
    showToast(err.message || 'Erro ao gerar relatório', 'error');
  }
}

async function realizarBackup() {
  try {
    adminMsg.textContent = 'Realizando backup completo do sistema...';
    adminMsg.classList.remove('sucesso');
    const res = await apiFetch('/admin/backup', { method:'POST' });
    if (!res.ok) { const errorData = await res.json().catch(()=>({})); throw new Error(errorData.erro || 'Falha ao realizar backup.'); }
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const hoje = new Date().toISOString().slice(0,10);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-bicicletario-${hoje}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    
    adminMsg.textContent = `Backup completo realizado com sucesso! Arquivo salvo: backup-bicicletario-${hoje}.json`;
    adminMsg.classList.add('sucesso');
    showToast('Backup realizado com sucesso!', 'success');
  } catch (err) {
    adminMsg.textContent = 'Erro ao realizar backup: ' + (err.message || 'Erro desconhecido');
    adminMsg.classList.remove('sucesso');
    adminMsg.style.color = 'red';
    showToast(err.message || 'Erro ao realizar backup', 'error');
  }
}

// [removido] fetchComToken (substituído por apiFetch/apiFetchJson)

// Helpers de formatação e auto-refresh
function formatDateTimeExact(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return typeof iso === 'string' ? iso : '-';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}
function formatTempoParado(min) {
  if (min === null || min === undefined) return '-';
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return (h > 0 ? `${h}h ` : '') + `${m}m`;
}
function formatTempoParadoSecs(sec){
  if (sec === null || sec === undefined) return '-';
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}
function formatStatus(status) {
  const raw = (status || '').toString();
  const s = raw.toLowerCase();
  if (s.includes('ativo')) return '<span class="badge bg-success">Ativo</span>';
  if (s.includes('parado')) return '<span class="badge bg-danger">Parado</span>';
  if (s.includes('ausente')) return '<span class="badge bg-secondary">Ausente</span>';
  return `<span class="badge bg-light text-dark">${raw || '-'}</span>`;
}
function getMovHoje(f) {
  try {
    const key = new Date().toISOString().slice(0, 10);
    const obj = f.checkinsPorDia?.[key] || {};
    return (obj.checkins || 0) + (obj.checkouts || 0);
  } catch {
    return 0;
  }
}
let _monitoramentoIntervalId = null;
function iniciarAutoRefresh() {
  if (_monitoramentoIntervalId) return;
  _monitoramentoIntervalId = setInterval(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      carregarMonitoramento(token);
    }
  }, 30000); // 30s
}

// Lightbox simples para fotos dos proprietários
function openPropLightbox(src) {
  if (!src) return;
  let box = document.getElementById('propLightbox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'propLightbox';
    box.className = 'prop-lightbox';
    box.innerHTML = `<img src="" alt="Foto do proprietário">`;
    box.addEventListener('click', () => box.classList.remove('open'));
    document.body.appendChild(box);
  }
  const img = box.querySelector('img');
  img.src = src;
  box.classList.add('open');
}
if (!window._boundPropFotoClick) {
  document.addEventListener('click', function(e) {
    const a = e.target.closest('.prop-foto');
    if (a) {
      e.preventDefault();
      openPropLightbox(a.getAttribute('data-src') || a.querySelector('img')?.src);
    }
  });
  window._boundPropFotoClick = true;
}

// --- Funções para buscar e exibir monitoramento e proprietários ---

// Removida a implementação em cards; nova versão em tabela conforme especificação do usuário
(function initProprietariosTabela(){
  window._proprietariosEnhanced = false;
  const MAX_BIKE_CHARS = 260;
  function prepararBikesHtml(raw){
    if(raw.length <= MAX_BIKE_CHARS) return raw;
    const preview = raw.slice(0, MAX_BIKE_CHARS) + '...';
    const id = 'bxp_' + Math.random().toString(36).slice(2);
    return `<div class="bike-preview" data-full="${raw.replace(/"/g,'&quot;')}"><span class="bike-short" id="${id}">${preview}</span> <button class="btn btn-sm btn-link p-0 btn-expand-bike" data-target="${id}" type="button">ver mais</button></div>`;
  }
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.btn-expand-bike');
    if(btn){
      const targetId = btn.getAttribute('data-target');
      const span = document.getElementById(targetId);
      if(!span) return;
      const wrap = span.closest('.bike-preview');
      const full = wrap?.getAttribute('data-full');
      if(!full) return;
      const expanded = wrap.classList.toggle('expanded');
      if(expanded){ span.textContent = full; btn.textContent='ver menos'; }
      else { span.textContent = full.slice(0, MAX_BIKE_CHARS) + '...'; btn.textContent='ver mais'; }
    }
  });
  window.carregarProprietarios = function(token){
    token = token || sessionStorage.getItem('token');
    const proprietariosDiv = document.getElementById('proprietariosList');
    if(!proprietariosDiv) return;
    proprietariosDiv.innerHTML = '<div>Carregando proprietários...</div>';
    if(!token){ proprietariosDiv.innerHTML = '<p>Token ausente. Faça login.</p>'; return; }
    const termo=(document.getElementById('searchProprietarios')?.value||'').trim();
    apiFetchJson('/admin/proprietarios', { query: termo ? { termo } : {} })
      .then(async proprietarios=>{
        if(!Array.isArray(proprietarios) || !proprietarios.length){ proprietariosDiv.innerHTML='<p>Nenhum proprietário encontrado.</p>'; return; }
        // Buscar resumo otimizado de check-in/checkout por proprietário
        let resumoMap = {};
        try {
          const ids = proprietarios.map(p=>p.id).filter(Boolean);
          if (ids.length) {
            const CHUNK = 120; // um pouco abaixo do limite do backend
            for (let i=0; i<ids.length; i+=CHUNK) {
              const part = ids.slice(i, i+CHUNK);
              const resumo = await apiFetchJson('/admin/proprietarios/resumo', { query: { ids: part.join(',') } });
              const itens = Array.isArray(resumo?.itens) ? resumo.itens : [];
              itens.forEach(it => { resumoMap[it.proprietario_id] = it; });
            }
          }
        } catch (e) {
          console.warn('Falha ao carregar resumo otimizado:', e?.message||e);
        }

        let html = '<div class="table-responsive"><table id="tabelaProprietariosFull" class="table table-striped table-bordered align-middle" style="min-width:1200px"><thead><tr>'
          + '<th>Foto</th><th>Nome</th><th>Endereço</th><th>Celular</th><th>E-mail</th><th>CPF</th><th>Bicicletas</th><th>Check-in</th><th>Check-out</th>'
          + '</tr></thead><tbody>';
        proprietarios.forEach(p => {
          const fotoPrincipal = p.fotoUrl || p.foto || p.foto_proprietario_url || '';
          const fotoExtra = p.foto_proprietario_extra_url || '';
          const temExtra = !!fotoExtra;
          let fotoCell;
          if (fotoPrincipal) {
            // Monta bloco com principal + (opcional) extra
            let principalImg = `<a href="#" class="prop-foto me-1" data-src="${fotoPrincipal}" title="Ver foto principal"><img src="${fotoPrincipal}" alt="Foto principal de ${(p.nome||'').replace(/"/g,'&quot;')}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.12);"></a>`;
            let extraImg = temExtra ? `<a href="#" class="prop-foto" data-src="${fotoExtra}" title="Ver foto extra"><img src="${fotoExtra}" alt="Foto extra de ${(p.nome||'').replace(/"/g,'&quot;')}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.12);"></a>` : '';
            let btnExtra = `<button type="button" class="btn btn-sm btn-${temExtra?'outline-secondary':'secondary'} btn-add-foto-extra mt-1" data-prop="${p.id}" title="${temExtra?'Substituir foto extra':'Adicionar foto extra'}">${temExtra?'Substituir Foto Extra':'Adicionar Foto Extra'}</button>`;
            let badge = temExtra ? '<span class="badge bg-info ms-1 mt-1">2 fotos</span>' : '';
            fotoCell = `<div class="d-flex align-items-center flex-wrap" style="gap:4px 6px;max-width:110px">${principalImg}${extraImg}<div class="w-100"></div>${btnExtra}${badge}</div>`;
          } else {
            // Sem foto principal ainda
            let btnExtra = `<button type="button" class="btn btn-sm btn-secondary btn-add-foto-extra" data-prop="${p.id}" title="Adicionar foto">Adicionar Foto</button>`;
            fotoCell = `<div>${btnExtra}</div>`;
          }
          const nome = p.nome || '';
          const endereco = p.endereco || [p.logradouro, p.numero, p.bairro, p.cidade, p.uf].filter(Boolean).join(', ') || '';
          // Prioriza campo 'contato' (telefone/celular) e inclui variantes antigas
          const celularRaw = p.contato || p.celular || p.telefoneCelular || p.telefone || p.telefone1 || '';
          const email = p.email || '';
          const cpf = p.cpf || p.documento || '';
          let bikes = Array.isArray(p.bicicletas) ? p.bicicletas : (p.bicicleta ? [p.bicicleta] : []);
          let bikesHtmlRaw = bikes.map(b => {
            const modelo = b.modelo || b.modeloBicicleta || b.modelo_bike || '';
            const marca = b.marca || b.marca_bike || '';
            const id = b.numeroIdentificacao || b.identificacao || b.numeroSerie || b.serie || b.numero || b.numero_identificacao || '';
            const tipo = b.tipo || b.categoria || b.tipo_bike || '';
            const obs = b.caracteristicas || b.observacoes || b.observacao || b.caracteristicasDistintivas || b.observacoes_bike || '';
            return [
              modelo ? `<div><b>Modelo:</b> ${modelo}</div>` : '',
              marca ? `<div><b>Marca:</b> ${marca}</div>` : '',
              id ? `<div><b>ID:</b> ${id}</div>` : '',
              tipo ? `<div><b>Tipo:</b> ${tipo}</div>` : '',
              obs ? `<div><b>Características/Obs.:</b> ${obs}</div>` : ''
            ].filter(Boolean).join('');
          }).join('<hr>');
          const bikesHtml = bikesHtmlRaw ? prepararBikesHtml(bikesHtmlRaw) : '-';
          // Usar resumo otimizado
          const resumo = resumoMap[p.id] || {};
          const checkinOper = resumo.checkin?.operador || '';
          const checkinHora = resumo.checkin?.dataHora || '';
          const checkoutOper = resumo.checkout?.operador || '';
          const checkoutHora = resumo.checkout?.dataHora || '';
          const fdt = (typeof window.formatDateTimeExact === 'function') ? window.formatDateTimeExact : (s=>{ try{ return s? new Date(s).toLocaleString('pt-BR',{hour12:false}) : ''; }catch(_){ return s||''; } });
          const checkinPartes = [];
          if (checkinOper) checkinPartes.push(`<div><b>Funcionário:</b> ${checkinOper}</div>`);
          if (checkinHora) checkinPartes.push(`<div><b>Data/Hora:</b> ${fdt(checkinHora)}</div>`);
          if (resumo.checkin?.numero_lacre) checkinPartes.push(`<div><b>Lacre:</b> ${resumo.checkin.numero_lacre}</div>`);
          const checkinStr = checkinPartes.length ? checkinPartes.join('') : '-';
          const checkoutPartes = [];
          if (checkoutOper) checkoutPartes.push(`<div><b>Funcionário:</b> ${checkoutOper}</div>`);
          if (checkoutHora) checkoutPartes.push(`<div><b>Data/Hora:</b> ${fdt(checkoutHora)}</div>`);
          const checkoutStr = checkoutPartes.length ? checkoutPartes.join('') : '-';
          // Nome clicável para abrir histórico
          const nomeHtml = nome
            ? `<a href="#" class="link-historico-prop" data-prop-id="${p.id}" data-prop-nome="${(nome||'').replace(/"/g,'&quot;')}" data-prop-cpf="${(cpf||'').replace(/"/g,'&quot;')}">${nome}</a>`
            : '-';
          // Celular + botão WhatsApp
          let celularHtml = '-';
          if (celularRaw) {
            const digits = String(celularRaw).replace(/\D+/g,'');
            const brDigits = digits.length === 11 ? digits : (digits.length === 10 ? '9'+digits : digits); // tentativa de normalização simples
            const waHref = brDigits ? `https://wa.me/55${brDigits}` : '';
            const pretty = (function formatPhone(pt){
              const d = String(pt).replace(/\D+/g,'');
              if (d.length >= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
              if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6,10)}`;
              if (d.length === 9) return `${d.slice(0,5)}-${d.slice(5,9)}`;
              return celularRaw;
            })(celularRaw);
            const waBtn = waHref ? `<a class="btn btn-outline-success btn-sm ms-1" target="_blank" rel="noopener" href="${waHref}" title="WhatsApp"><i class='bx bxl-whatsapp'></i></a>` : '';
            celularHtml = `<span>${pretty}</span>${waBtn}`;
          }
          html += `<tr>
            <td>${fotoCell}</td>
            <td>${nomeHtml}</td>
            <td>${endereco}</td>
            <td>${celularHtml}</td>
            <td>${email}</td>
            <td>${cpf}</td>
            <td>${bikesHtml}</td>
            <td>${checkinStr}</td>
            <td>${checkoutStr}</td>
          </tr>`;
        });
        html += '</tbody></table></div>';
        proprietariosDiv.innerHTML = html;
        // Inicializa DataTable se disponível
        if(window.jQuery && jQuery.fn.DataTable){
          const table = jQuery('#tabelaProprietariosFull');
          if(jQuery.fn.DataTable.isDataTable(table)) table.DataTable().destroy();
          table.DataTable({
            pageLength: 25,
            lengthMenu: [10,25,50,100],
            order: [[1,'asc']],
            responsive: false,
            scrollX: true,
            autoWidth: false,
            dom: 'Bfrtip',
            buttons: [
              { extend:'copy', text:'Copiar' },
              { extend:'csv', text:'CSV' },
              { extend:'excel', text:'Excel' },
              { extend:'print', text:'Imprimir' },
              { extend:'colvis', text:'Colunas' }
            ],
            language:{
              url:'https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json'
            }
          });
        }
      })
      .catch(err=>{ console.error('Erro proprietarios:', err); proprietariosDiv.innerHTML='<p>Erro ao carregar proprietários.</p>'; showToast(err.message||'Erro ao carregar proprietários','error'); });
    if(!window._bindBuscaPropsTabela){
      const input=document.getElementById('searchProprietarios');
      const btnBuscar=document.getElementById('btnBuscarProprietarios');
      const btnTodos=document.getElementById('btnListarTodos');
      const btnExport=document.getElementById('btnExportarProprietarios');
      if(btnBuscar) btnBuscar.addEventListener('click', ()=>carregarProprietarios());
      if(btnTodos) btnTodos.addEventListener('click', ()=>{ if(input) input.value=''; carregarProprietarios(); });
      if(input) input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); carregarProprietarios(); }});
      if(btnExport && !btnExport._bound){
        btnExport.addEventListener('click', ()=>{
          const tableEl = document.querySelector('#tabelaProprietariosFull');
          if(!tableEl){ alert('Tabela não carregada'); return; }
          let csv = 'Nome,Endereco,Celular,Email,CPF,Bicicletas,Checkin,Checkout\n';
          [...tableEl.querySelectorAll('tbody tr')].forEach(tr=>{
            const tds = tr.querySelectorAll('td');
            const getTxt = (i)=> (tds[i]?.innerText||'').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
            const linha = [1,2,3,4,5,6,7,8].map(i=> '"'+getTxt(i).replace(/"/g,'""')+'"').join(',');
            csv += linha + '\n';
          });
            const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href=url; a.download='proprietarios.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        });
        btnExport._bound = true;
      }
      // Clique no nome abre histórico do proprietário
      document.addEventListener('click', (e)=>{
        const a = e.target.closest('.link-historico-prop');
        if(a){
          e.preventDefault();
          const pid = parseInt(a.getAttribute('data-prop-id')||'');
          const nome = a.getAttribute('data-prop-nome') || '';
          const cpf = a.getAttribute('data-prop-cpf') || '';
          if (window.openHistoricoProp) {
            window.openHistoricoProp(pid, nome || cpf || '');
          } else {
            // fallback simples: preenche termo e clica buscar
            try {
              const elTermo = document.getElementById('histTermo');
              if (elTermo) elTermo.value = nome || cpf || '';
              document.getElementById('btnBuscarHistorico')?.click();
            } catch(_){ }
            document.getElementById('historicoProprietarioCard')?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
      window._bindBuscaPropsTabela = true;
    }
  };
})();

// ==============================
// FUNCIONALIDADES DE GERENCIAMENTO DE BLOQUEIOS
// =============================================================================

// Variáveis globais para bloqueios
let proprietariosBloqueados = JSON.parse(localStorage.getItem('proprietariosBloqueados') || '[]');
let bloqueiosPendentes = JSON.parse(localStorage.getItem('bloqueiosPendentes') || '[]');
let logsAuditoria = JSON.parse(localStorage.getItem('logsAuditoria') || '[]');

// Função para renderizar bloqueios pendentes
function renderizarBloqueiosPendentes() {
    const container = document.getElementById('listaBloqueiosPendentes');
    if (!container) return;

    container.innerHTML = '';

    if (!bloqueiosPendentes || bloqueiosPendentes.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhuma solicitação de bloqueio pendente.</p>';
        return;
    }

    const lista = document.createElement('div');
    lista.className = 'list-group';

    bloqueiosPendentes.forEach((nome, idx) => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.innerHTML = `
            <div>
                <h6 class="mb-1">${nome}</h6>
                <small class="text-muted">Solicitado por funcionário em ${new Date().toLocaleDateString('pt-BR')}</small>
            </div>
            <div>
                <button onclick="confirmarBloqueio(${idx})" class="btn btn-danger btn-sm me-2">
                    <i class="bx bx-block"></i> Confirmar Bloqueio
                </button>
                <button onclick="rejeitarBloqueio(${idx})" class="btn btn-outline-secondary btn-sm">
                    <i class="bx bx-x"></i> Rejeitar
                </button>
            </div>
        `;
        lista.appendChild(item);
    });

    container.appendChild(lista);
}

// Função para renderizar proprietários bloqueados
function renderizarProprietariosBloqueados() {
    const container = document.getElementById('listaProprietariosBloqueados');
    if (!container) return;

    container.innerHTML = '';

    if (!proprietariosBloqueados || proprietariosBloqueados.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum proprietário bloqueado.</p>';
        return;
    }

    const lista = document.createElement('div');
    lista.className = 'list-group';

    proprietariosBloqueados.forEach((nome, idx) => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.innerHTML = `
            <div>
                <h6 class="mb-1">${nome}</h6>
                <small class="text-muted">Bloqueado em ${new Date().toLocaleDateString('pt-BR')}</small>
            </div>
            <div>
                <button onclick="desbloquearProprietario(${idx})" class="btn btn-success btn-sm">
                    <i class="bx bx-check"></i> Desbloquear
                </button>
            </div>
        `;
        lista.appendChild(item);
    });

    container.appendChild(lista);
}

// Função para confirmar bloqueio
function confirmarBloqueio(idx) {
    const nome = bloqueiosPendentes[idx];
    if (!nome) return;

    const confirmacao = confirm(`Confirmar bloqueio do proprietário "${nome}"?`);
    if (!confirmacao) return;

    // Adiciona à lista de bloqueados
    proprietariosBloqueados.push(nome.toLowerCase());

    // Remove da lista pendente
    bloqueiosPendentes.splice(idx, 1);

    // Adiciona log de auditoria
    const adminLogado = sessionStorage.getItem('admin_nome');
    logsAuditoria.push({
        data: new Date().toISOString(),
        admin: adminLogado || 'Admin',
        acao: 'Bloqueio Confirmado',
        detalhes: `Proprietário "${nome}" foi bloqueado`
    });

    // Salva no localStorage
    localStorage.setItem('proprietariosBloqueados', JSON.stringify(proprietariosBloqueados));
    localStorage.setItem('bloqueiosPendentes', JSON.stringify(bloqueiosPendentes));
    localStorage.setItem('logsAuditoria', JSON.stringify(logsAuditoria));

    // Atualiza as visualizações
    renderizarBloqueiosPendentes();
    renderizarProprietariosBloqueados();
    renderizarLogsAuditoria();

    alert(`Bloqueio confirmado para "${nome}"`);
}

// Função para rejeitar bloqueio
function rejeitarBloqueio(idx) {
    const nome = bloqueiosPendentes[idx];
    if (!nome) return;

    const confirmacao = confirm(`Rejeitar solicitação de bloqueio do proprietário "${nome}"?`);
    if (!confirmacao) return;

    // Remove da lista pendente
    bloqueiosPendentes.splice(idx, 1);

    // Adiciona log de auditoria
    const adminLogado = sessionStorage.getItem('admin_nome');
    logsAuditoria.push({
        data: new Date().toISOString(),
        admin: adminLogado || 'Admin',
        acao: 'Bloqueio Rejeitado',
        detalhes: `Solicitação de bloqueio do proprietário "${nome}" foi rejeitada`
    });

    // Salva no localStorage
    localStorage.setItem('bloqueiosPendentes', JSON.stringify(bloqueiosPendentes));
    localStorage.setItem('logsAuditoria', JSON.stringify(logsAuditoria));

    // Atualiza as visualizações
    renderizarBloqueiosPendentes();
    renderizarLogsAuditoria();

    alert(`Solicitação de bloqueio rejeitada para "${nome}"`);
}

// Função para desbloquear proprietário
function desbloquearProprietario(idx) {
    const nome = proprietariosBloqueados[idx];
    if (!nome) return;

    const confirmacao = confirm(`Desbloquear o proprietário "${nome}"?`);
    if (!confirmacao) return;

    // Remove da lista de bloqueados
    proprietariosBloqueados.splice(idx, 1);

    // Adiciona log de auditoria
    const adminLogado = sessionStorage.getItem('admin_nome');
    logsAuditoria.push({
        data: new Date().toISOString(),
        admin: adminLogado || 'Admin',
        acao: 'Proprietário Desbloqueado',
        detalhes: `Proprietário "${nome}" foi desbloqueado`
    });

    // Salva no localStorage
    localStorage.setItem('proprietariosBloqueados', JSON.stringify(proprietariosBloqueados));
    localStorage.setItem('logsAuditoria', JSON.stringify(logsAuditoria));

    // Atualiza as visualizações
    renderizarProprietariosBloqueados();
    renderizarLogsAuditoria();

    alert(`Proprietário "${nome}" foi desbloqueado`);
}

// Função para renderizar logs de auditoria
function renderizarLogsAuditoria() {
    const tabela = document.getElementById('tabelaAuditoria');
    if (!tabela) return;

    // Se já existe uma instância do DataTable, destroi primeiro
    if ($.fn.DataTable.isDataTable('#tabelaAuditoria')) {
        $('#tabelaAuditoria').DataTable().destroy();
    }

    const tbody = tabela.querySelector('tbody');
    tbody.innerHTML = '';

    logsAuditoria.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(log.data).toLocaleString('pt-BR')}</td>
            <td>${log.admin}</td>
            <td>${log.acao}</td>
            <td>${log.detalhes}</td>
        `;
        tbody.appendChild(row);
    });

    // Inicializa DataTable
    $('#tabelaAuditoria').DataTable({
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json'
        },
        order: [[0, 'desc']], // Ordena por data decrescente
        pageLength: 10
    });
}

// ==============================
// Logs de Controle (Auditoria)
// ==============================
let _logsControleCache = { dias: 7, total: 0, logs: [] };

function ensureLogsControleHandlers(){
  const btnAtualizar = document.getElementById('btnAtualizarLogsControle');
  const btnExport = document.getElementById('btnExportarLogsControle');
  const selDias = document.getElementById('logsControleDias');
  if(btnAtualizar && !btnAtualizar._bound){ btnAtualizar.addEventListener('click', ()=>{ carregarLogsControle(); }); btnAtualizar._bound = true; }
  if(selDias && !selDias._bound){ selDias.addEventListener('change', ()=>{ carregarLogsControle(); }); selDias._bound = true; }
  if(btnExport && !btnExport._bound){ btnExport.addEventListener('click', exportarLogsControleCsv); btnExport._bound = true; }
}

async function carregarLogsControle(){
  const selDias = document.getElementById('logsControleDias');
  const diasStr = selDias ? selDias.value : '7';
  const dias = parseInt(diasStr || '7', 10);
  const status = document.getElementById('logsControleStatus');
  const tableEl = document.getElementById('tabelaLogsControle');
  if(status) status.textContent = 'Carregando...';
  if(tableEl){
    try { if (window.jQuery && jQuery.fn && jQuery.fn.DataTable && jQuery.fn.DataTable.isDataTable(tableEl)) { jQuery(tableEl).DataTable().clear().destroy(); } } catch(_){ }
    const tbody = tableEl.querySelector('tbody'); if (tbody) tbody.innerHTML = '';
  }
  try{
    const data = await apiFetchJson('/admin/logs-controle', { query: { dias: String(Math.max(1, Math.min(dias,30))) } });
    _logsControleCache = data || { dias, total: 0, logs: [] };
    renderLogsControleTable(_logsControleCache.logs);
    if(status) status.textContent = `Últimos ${_logsControleCache.dias} dia(s). Registros: ${_logsControleCache.total}.`;
  }catch(e){
    if(status) status.textContent = 'Erro ao carregar logs.';
    try { showToast(e?.message || 'Erro ao carregar logs', 'error'); } catch(_){ }
  }
}

function renderLogsControleTable(items){
  const tableEl = document.getElementById('tabelaLogsControle'); if(!tableEl) return;
  const tbody = tableEl.querySelector('tbody'); if(!tbody) return;
  const rows = Array.isArray(items) ? items : [];
  const html = rows.map(r=>{
    const dh = formatDateTimeExact(r.data_hora);
    const func = r.funcionario || '-';
    const tipo = r.tipo === 'checkin' ? 'Check-in' : (r.tipo === 'checkout' ? 'Check-out' : (r.tipo||'-'));
    const prop = r.proprietario || '-';
    const bike = r.bicicleta || '-';
    const local = r.local || '-';
    const desc = r.tipo === 'checkin' ? 'Entrada registrada' : (r.tipo === 'checkout' ? 'Saída registrada' : '-');
    return `<tr><td>${dh}</td><td>${func}</td><td>${tipo}</td><td>${prop}</td><td>${bike}</td><td>${local}</td><td>${desc}</td></tr>`;
  }).join('');
  tbody.innerHTML = html;
  try{
    if (window.jQuery) {
      jQuery(tableEl).DataTable({
        responsive: true,
        scrollX: true,
        pageLength: 25,
        order: [[0,'desc']],
        language: { url:'https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json' }
      });
    }
  }catch(_){ }
}

function exportarLogsControleCsv(){
  const data = _logsControleCache || { logs: [] };
  const rows = Array.isArray(data.logs) ? data.logs : [];
  if(!rows.length){ alert('Nada para exportar.'); return; }
  let csv = 'Data/Hora,Funcionário,Tipo,Proprietário,ID Bicicleta,Local,Descrição\n';
  rows.forEach(r=>{
    const dh = formatDateTimeExact(r.data_hora);
    const func = r.funcionario || '-';
    const tipo = r.tipo || '-';
    const prop = r.proprietario || '-';
    const bike = r.bicicleta || '-';
    const local = r.local || '-';
    const desc = (r.tipo === 'checkin' ? 'Entrada registrada' : (r.tipo === 'checkout' ? 'Saída registrada' : '-'));
    const line = [dh, func, tipo, prop, bike, local, desc].map(v=> '"'+ String(v).replace(/"/g,'""') +'"').join(',');
    csv += line + '\n';
  });
  try{
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `logs-controle-${(new Date().toISOString().slice(0,10))}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }catch(_){ }
}

// ==============================
// Histórico Completo do Proprietário
// ==============================
(function initHistoricoProprietario(){
  let _histState = { itens: [], proprietario: null, total: 0, page: 1, pageSize: 500, sortDesc: true, filtroNumero: null };
  const elTermo = document.getElementById('histTermo');
  const elNumero = document.getElementById('histNumeroBike');
  const elBtnBuscar = document.getElementById('btnBuscarHistorico');
  const elBtnExport = document.getElementById('btnExportarHistorico');
  const elSortDesc = document.getElementById('histSortDesc');
  const elSel = document.getElementById('histSelProprietario');
  const elResumo = document.getElementById('histResumo');
  const elCont = document.getElementById('historicoProprietarioContainer');

  function setResumo(text){ if (elResumo) elResumo.textContent = text || ''; }
  function setLoading(msg){ if (elCont) elCont.innerHTML = `<p class="text-muted">${msg || 'Carregando histórico...'}</p>`; }
  function safe(val){ return (val==null? '' : String(val)); }

  function renderTabela(itens){
    if (!elCont) return;
    if (!Array.isArray(itens) || !itens.length) {
      elCont.innerHTML = '<p class="text-muted">Nenhum registro encontrado.</p>';
      return;
    }
    let html = '<table id="tabelaHistoricoProprietario" class="table table-striped table-bordered align-middle" style="min-width:1400px">'
      + '<thead><tr>'
      + '<th>Entrada</th><th>Funcionário Entrada</th>'
      + '<th>Saída</th><th>Funcionário Saída</th>'
      + '<th>Lacre</th><th>Local</th>'
      + '<th>Obs. Entrada</th><th>Obs. Saída</th><th>Obs. Geral</th>'
      + '<th>Bicicleta</th><th>Ações</th>'
      + '</tr></thead><tbody>';
    itens.forEach(r => {
      const ent = r.data_hora_entrada ? formatDateTimeExact(r.data_hora_entrada) : '-';
      const sai = r.data_hora_saida ? formatDateTimeExact(r.data_hora_saida) : '-';
      const funcE = r.funcionario_entrada || '-';
      const funcS = r.funcionario_saida || '-';
      const lacre = r.numero_lacre || '-';
      const local = r.local || '-';
      const obsE = (r.observacoes_entrada || '').trim() || '-';
      const obsS = (r.observacoes_saida || '').trim() || '-';
      const obsG = (r.observacao_geral || '').trim() || '-';
      const bike = r.bicicleta ? `${safe(r.bicicleta.numero_identificacao)}${(r.bicicleta.marca||r.bicicleta.modelo)? ' - ' : ''}${safe(r.bicicleta.marca)} ${safe(r.bicicleta.modelo)}`.trim() : '-';
      const acoes = !r.data_hora_saida ? `<button type="button" class="btn btn-sm btn-outline-danger btn-dar-saida" data-controle-id="${r.id}">Dar Saída</button>` : '-';
      html += `<tr>`
        + `<td>${ent}</td>`
        + `<td>${funcE}</td>`
        + `<td>${sai}</td>`
        + `<td>${funcS}</td>`
        + `<td>${lacre}</td>`
        + `<td>${local}</td>`
        + `<td>${obsE}</td>`
        + `<td>${obsS}</td>`
        + `<td>${obsG}</td>`
        + `<td>${bike}</td>`
        + `<td>${acoes}</td>`
        + `</tr>`;
    });
    html += '</tbody></table>';
    elCont.innerHTML = html;

    if (window.jQuery && jQuery.fn.DataTable) {
      const table = jQuery('#tabelaHistoricoProprietario');
      if (jQuery.fn.DataTable.isDataTable(table)) table.DataTable().destroy();
      table.DataTable({
        pageLength: 25,
        lengthMenu: [10,25,50,100,250,500],
        order: [[0, _histState.sortDesc ? 'desc' : 'asc']],
        responsive: false,
        scrollX: true,
        autoWidth: false,
        dom: 'Bfrtip',
        buttons: [
          { extend:'copy', text:'Copiar' },
          { extend:'csv', text:'CSV' },
          { extend:'excel', text:'Excel' },
          { extend:'print', text:'Imprimir' }
        ],
        language:{ url:'https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json' }
      });
      // Bind de ações da tabela (delegação)
      document.getElementById('tabelaHistoricoProprietario').addEventListener('click', async (ev)=>{
        const btn = ev.target.closest('.btn-dar-saida');
        if (btn) {
          const id = parseInt(btn.getAttribute('data-controle-id')||'');
          if (!id) return;
          if (!confirm('Confirmar dar saída agora?')) return;
          btn.disabled = true; btn.textContent = 'Processando...';
          try {
            const resp = await apiFetch(`/admin/alertas/${id}/dar-saida`, { method: 'POST', body: {} });
            const data = await resp.json().catch(()=>({}));
            if (!resp.ok) throw new Error(data?.erro || 'Falha ao dar saída');
            showToast('Saída registrada!', 'success');
            // Recarrega histórico para refletir
            await carregarHistorico();
          } catch (e) {
            showToast(e?.message || 'Erro ao dar saída', 'error');
          } finally {
            btn.disabled = false; btn.textContent = 'Dar Saída';
          }
        }
      });
    }
  }

  async function buscarProprietariosPorTermo(termo){
    const t = (termo||'').trim();
    const data = await apiFetchJson('/admin/proprietarios', { query: t ? { termo: t } : {} });
    return Array.isArray(data) ? data : [];
  }

  function preencherSelect(props){
    if (!elSel) return;
    elSel.innerHTML = '';
    if (!props.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Nenhum proprietário encontrado';
      elSel.appendChild(opt);
      return;
    }
    const frag = document.createDocumentFragment();
    props.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const cpf = p.cpf ? ` - CPF: ${p.cpf}` : '';
      opt.textContent = `${p.nome || p.nome_completo || 'Sem nome'}${cpf}`;
      frag.appendChild(opt);
    });
    elSel.appendChild(frag);
  }

  async function carregarHistorico(){
    const pid = parseInt(elSel?.value || '');
    if (!pid) { setResumo(''); setLoading('Selecione um proprietário.'); return; }
    setLoading('Carregando histórico...');
    try {
      const numero = (elNumero?.value || '').trim();
      const sortDesc = !!(elSortDesc && elSortDesc.checked);
      const pageSize = _histState.pageSize;
      const data = await apiFetchJson(`/admin/proprietarios/${pid}/historico`, { query: { numero, sortDesc: sortDesc ? '1':'0', page: '1', pageSize: String(pageSize) } });
      _histState = { ..._histState, itens: data.itens || [], proprietario: data.proprietario || { id: pid }, total: data.total || 0, page: data.page || 1, pageSize: data.pageSize || pageSize, sortDesc, filtroNumero: data.filtroNumero || (numero||null) };
      const nome = _histState.proprietario?.nome || '';
      const cpf = _histState.proprietario?.cpf || '';
      const exib = _histState.itens.length;
      setResumo(`${nome ? nome : ''}${cpf ? ` — CPF: ${cpf}` : ''} — Exibindo ${exib} de ${_histState.total} registros${_histState.filtroNumero ? ` (Filtro nº: ${_histState.filtroNumero})` : ''}.`);
      renderTabela(_histState.itens);
    } catch (e) {
      const msg = (e && (e.message || e.erro || e.description)) || 'Falha ao carregar histórico';
      setLoading('Nenhum registro encontrado ou histórico indisponível no momento.');
      try { showToast(msg, 'warning'); } catch(_){ }
    }
  }

  async function acionarBusca(){
    const termo = elTermo?.value || '';
    setResumo('');
    if (elSel) { elSel.innerHTML = '<option>Buscando...</option>'; }
    try {
      const props = await buscarProprietariosPorTermo(termo);
      preencherSelect(props);
      if (props.length) {
        elSel.value = props[0].id;
        await carregarHistorico();
      } else {
        setLoading('Informe um termo e clique em "Buscar histórico".');
      }
    } catch (e) {
      console.error('Erro na busca de proprietários:', e);
      if (elSel) { elSel.innerHTML = '<option>Erro na busca</option>'; }
      setLoading('Erro na busca.');
      showToast(e?.message || 'Erro na busca', 'error');
    }
  }

  // Exportar CSV do histórico atual
  function exportarCsv(){
    const rows = _histState.itens || [];
    if (!rows.length) { alert('Nada para exportar'); return; }
    let csv = 'Entrada,Funcionário Entrada,Saída,Funcionário Saída,Lacre,Local,Bicicleta\n';
    rows.forEach(r => {
      const ent = r.data_hora_entrada ? formatDateTimeExact(r.data_hora_entrada) : '-';
      const sai = r.data_hora_saida ? formatDateTimeExact(r.data_hora_saida) : '-';
      const funcE = r.funcionario_entrada || '-';
      const funcS = r.funcionario_saida || '-';
      const lacre = r.numero_lacre || '-';
      const local = r.local || '-';
      const bike = r.bicicleta ? `${safe(r.bicicleta.numero_identificacao)} ${safe(r.bicicleta.marca)} ${safe(r.bicicleta.modelo)}`.trim() : '-';
      const linha = [ent, funcE, sai, funcS, lacre, local, bike]
        .map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',');
      csv += linha + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'historico_proprietario.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // Expor função global para abrir histórico de um proprietário específico
  window.openHistoricoProp = async function(pid, termo){
    try {
      if (elTermo) elTermo.value = termo || '';
      // Buscar lista por termo e selecionar pid quando disponível
      const props = await buscarProprietariosPorTermo(termo || '');
      preencherSelect(props);
      if (elSel) elSel.value = String(pid);
      await carregarHistorico();
      document.getElementById('historicoProprietarioCard')?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      console.warn('Falha ao abrir histórico:', e?.message||e);
    }
  };

  // Bind eventos
  if (elBtnBuscar && !elBtnBuscar._bound) { elBtnBuscar.addEventListener('click', acionarBusca); elBtnBuscar._bound = true; }
  if (elSel && !elSel._boundChange) { elSel.addEventListener('change', carregarHistorico); elSel._boundChange = true; }
  if (elBtnExport && !elBtnExport._bound) { elBtnExport.addEventListener('click', exportarCsv); elBtnExport._bound = true; }
  if (elSortDesc && !elSortDesc._bound) { elSortDesc.addEventListener('change', carregarHistorico); elSortDesc._bound = true; }
  if (elTermo && !elTermo._boundKey) { elTermo.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); acionarBusca(); } }); elTermo._boundKey = true; }
  if (elNumero && !elNumero._boundKey) { elNumero.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); carregarHistorico(); } }); elNumero._boundKey = true; }
})();


// ==============================
// Assistente Preditivo — Alertas de Inatividade (unificado)
// ==============================
// Observação: mantemos a função global formatDateTimeExact já definida neste arquivo.
// Aqui, integramos toda a lógica do antigo js/assistente-alertas.js.

// Estado global do assistente
let _assistTimerId = null;
let _assistAlertMap = new Map();
let _assistFirstLoadDone = false;

// Logo para PDFs (opcional)
function loadAssistLogo(){
  try {
    if (window.assistPdfLogo) return;
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
    img.src = 'imagens/image.png';
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

function escapeHtml(s){
  try { return String(s).replace(/[&<>"]+/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); } catch{ return s; }
}

// Skeleton loader para tabela de alertas (UX)
function assistSkeletonHtml(rows = 8){
  const row = () => '<div class="s-row">'
    + '<div class="s-line"></div>'
    + '<div class="s-line"></div>'
    + '<div class="s-line"></div>'
    + '<div class="s-line"></div>'
    + '<div class="s-line"></div>'
    + '<div class="s-line"></div>'
    + '<div class="s-line"></div>'
    + '</div>';
  return '<div class="assist-skeleton">' + Array.from({length: rows}).map(row).join('') + '</div>';
}

// Helper para ler variáveis CSS com fallback
function cssVar(name, fallback){
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    const s = (v || '').trim();
    return s || fallback;
  } catch(_){ return fallback; }
}

// Gráficos a partir de séries do backend
function renderAssistChartsFromSeries(series){
  try { if(!window.Chart) return; } catch(_) { return; }
  if(!series || !Array.isArray(series.labels)) return;
  const ctxSev = document.getElementById('assistChartSev')?.getContext?.('2d');
  const ctxLoc = document.getElementById('assistChartLocal')?.getContext?.('2d');
  const ctxTr  = document.getElementById('assistChartTrend')?.getContext?.('2d');
  if(!ctxSev || !ctxLoc || !ctxTr) return;

  const sum = (arr)=> (Array.isArray(arr)?arr:[]).reduce((a,b)=> a + (Number(b)||0), 0);
  const cAlta = sum(series.alta);
  const cMedia = sum(series.media);
  const cBaixa = sum(series.baixa);
  const sevBg = [ cssVar('--sev-alta-bg','#dc3545'), cssVar('--sev-media-bg','#ffc107'), cssVar('--sev-baixa-bg','#6c757d') ];
  try { if(window.assistCharts.sev){ window.assistCharts.sev.destroy(); } } catch(_){ }
  window.assistCharts.sev = new Chart(ctxSev, {
    type:'doughnut', data:{ labels:['Alta','Média','Baixa'], datasets:[{ data:[cAlta,cMedia,cBaixa], backgroundColor: sevBg, borderColor: sevBg, borderWidth:1 }] }, options:{ plugins:{ legend:{ position:'bottom' } } }
  });

  const locLabels = Array.isArray(series.locais) ? series.locais.map(x=> x.local) : [];
  const locValues = Array.isArray(series.locais) ? series.locais.map(x=> x.total) : [];
  const locColor = cssVar('--admin-accent-info','#0ea5e9');
  try { if(window.assistCharts.local){ window.assistCharts.local.destroy(); } } catch(_){ }
  window.assistCharts.local = new Chart(ctxLoc, {
    type:'bar', data:{ labels: locLabels, datasets:[{ label:'Alertas', data: locValues, backgroundColor: locColor }] },
    options:{ indexAxis:'y', responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true, ticks:{ precision:0 } } } }
  });

  const labels = series.labels.map(s=>{ try { const parts = String(s).split('-'); return `${parts[2]||''}/${parts[1]||''}`; } catch{ return String(s); } });
  const counts = Array.isArray(series.total) ? series.total : [];
  const trendColor = cssVar('--admin-success','#22b573');
  try { if(window.assistCharts.trend){ window.assistCharts.trend.destroy(); } } catch(_){ }
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
    if(hi < med) hi = med;
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

// Helpers de contato e chaves
function digitsOnly(s){ return (s||'').replace(/\D+/g,''); }
function waLink(phone, msg){ const p=digitsOnly(phone); if(!p) return ''; const t=encodeURIComponent(msg||''); return `https://wa.me/${p}${t?('?text='+t):''}`; }
function mailLink(email, subject, body){ const e=(email||'').trim(); if(!e) return ''; return `mailto:${encodeURIComponent(e)}?subject=${encodeURIComponent(subject||'')}&body=${encodeURIComponent(body||'')}`; }
function getAlertKey(a){
  return String(a?.id || a?.controle_id || a?.registro_id || a?.bicicleta_id || a?.proprietario_id || [a?.proprietario_nome, a?.numero_identificacao, a?.data_hora_entrada, a?.local].map(v=>String(v||'').trim()).join('|'));
}
async function callAssistApi(path, body){
  try {
    const resp = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if(!resp.ok) throw new Error('http');
    return true;
  } catch(_) { return false; }
}

function printAlertLabel(a, sev, cfg){
  try{
    const nome = a.proprietario_nome || '-';
    const entradaStr = a.data_hora_entrada ? formatDateTimeExact(a.data_hora_entrada) : '-';
    const bikeStr = [a.numero_identificacao, [a.marca, a.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' • ') || '-';
    const localStr = a.local || '-';
    const med = Number(cfg?.med || 3);
    const hi = Number(cfg?.hi || 7);
    const limiar = sev === 'alta' ? hi : med;
    let prazo = '-';
    try{
      if(a.data_hora_entrada){
        const d = new Date(a.data_hora_entrada);
        if(!isNaN(d)){
          d.setDate(d.getDate()+limiar);
          prazo = d.toLocaleDateString('pt-BR');
        }
      }
    }catch(_){ }
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if(!win) return;
    const css = `@page { size: 58mm auto; margin: 2mm; } body{font-family: Arial, sans-serif; margin:0; padding:0;}
      .wrap{width:100%;}
      .card{width: 54mm; padding: 2mm;}
      .title{font-weight:700; font-size:14pt; text-align:center;}
      .line{margin: 2mm 0; font-size: 11pt;}
      .label{font-weight:700;}
      .status{font-size:12pt; text-align:center; padding:2mm 0;}
      .status.red{color:#b91c1c;}
      .status.yellow{color:#b45309;}
    `;
    const statusTxt = 'ALERTA DE PERMANÊNCIA';
    const statusClass = sev === 'alta' ? 'red' : 'yellow';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta</title><style>${css}</style></head><body>
      <div class="wrap"><div class="card">
        <div class="title">Bicicletário Municipal</div>
        <div class="status ${statusClass}"><b>STATUS:</b> ${statusTxt}</div>
        <div class="line"><span class="label">Proprietário:</span> ${nome}</div>
        <div class="line"><span class="label">Bike:</span> ${bikeStr}</div>
        <div class="line"><span class="label">Local:</span> ${localStr}</div>
        <div class="line"><span class="label">Entrada:</span> ${entradaStr}</div>
        <div class="line"><span class="label">Prazo Final:</span> ${prazo}</div>
      </div></div>
      <script>window.onload=function(){ setTimeout(function(){ window.print(); }, 50); setTimeout(function(){ window.close(); }, 400); }<\/script>
    </body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }catch(_){ }
}

function addPlantonistaTask(a){
  try{
    const nome = a.proprietario_nome || '-';
    const bike = [a.numero_identificacao, [a.marca, a.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' • ');
    const local = a.local || '-';
    const entrada = a.data_hora_entrada ? formatDateTimeExact(a.data_hora_entrada) : '-';
    const msg = `Por favor, contate o proprietário ${nome} sobre a bicicleta ${bike} no local ${local}. Entrada: ${entrada}.`;
    // Tentativa de enviar ao backend primeiro
    (async ()=>{
      const alertaId = a.controle_id || a.id || null;
      const ok = await callAssistApi('/admin/tarefas', {
        alerta_id: alertaId,
        mensagem: msg,
        assignedTo: { role: 'plantonista' },
        meta: { proprietario_nome: nome, bike, local, entrada: a.data_hora_entrada || null }
      });
      if (ok) { try{ showToast('Tarefa enviada ao plantonista.', 'success'); }catch(_){ } return; }
      // Fallback local
      try{
        const storeKey = 'plantonista_tasks';
        const raw = localStorage.getItem(storeKey);
        const arr = raw ? JSON.parse(raw) : [];
        const t = { id: String(Date.now())+'_'+(a.id||a.controle_id||''), createdAt: new Date().toISOString(), status: 'pending', mensagem: msg };
        arr.unshift(t);
        localStorage.setItem(storeKey, JSON.stringify(arr.slice(0,100)));
        try{ showToast('Tarefa salva localmente (offline).', 'warning'); }catch(_){ }
      }catch(_){ }
    })();
  }catch(_){ }
}

// Atalho para Big Screen
function injectBigScreenButton(){
  try{
    if (window._bigScreenBtnInjected) return;
    function makeBtn(text){
      const a = document.createElement('a');
      a.href = 'big-screen.html'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text || 'Big Screen';
      a.setAttribute('title','Abrir Big Screen'); a.style.display = 'inline-block'; a.style.marginLeft = '8px'; a.className = 'btn btn-sm btn-outline-primary';
      return a;
    }
    const nav = document.querySelector('.header nav') || document.querySelector('header nav');
    if (nav) { nav.appendChild(makeBtn('Big Screen')); }
    window._bigScreenBtnInjected = true;
  }catch(_){ }
}

// Conjuntos persistidos (silenciados, resolvidos, vistos)
function getSilencedSet(){ try { const raw = localStorage.getItem('assist_silenced'); const arr = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(arr)?arr:[]); } catch(_) { return new Set(); } }
function saveSilencedSet(set){ try { localStorage.setItem('assist_silenced', JSON.stringify(Array.from(set))); } catch(_){ } }
function getResolvedSet(){ try { const raw = localStorage.getItem('assist_resolved'); const arr = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(arr)?arr:[]); } catch(_) { return new Set(); } }
function saveResolvedSet(set){ try { localStorage.setItem('assist_resolved', JSON.stringify(Array.from(set))); } catch(_){ } }
function getSeenSet(){ try { const raw = localStorage.getItem('assist_seen_alerts'); const arr = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(arr)?arr:[]); } catch(_) { return new Set(); } }
function saveSeenSet(set, currentKeys){
  try {
    const curr = Array.isArray(currentKeys) ? currentKeys.slice() : [];
    const prev = Array.from(set);
    const merged = curr.concat(prev.filter(k => !curr.includes(k)));
    const capped = merged.slice(0, 500);
    localStorage.setItem('assist_seen_alerts', JSON.stringify(capped));
  } catch(_){ }
}

// Notificações e UI
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
    const t = window.bootstrap && window.bootstrap.Toast ? new window.bootstrap.Toast(toast, { autohide: true, delay: 9000 }) : null;
    if(t) t.show();
  } catch(_){ }
}

// Inicializador e carregador principal
function updateSevCardActive(sevVal){
  try {
    const cards = document.querySelectorAll('#assistenteAlertasCard .sev-card');
    cards.forEach(card => {
      const v = card.getAttribute('data-sev-filter') || '';
      card.classList.toggle('active', !!sevVal && v === sevVal);
    });
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
    // Debounce de 300ms para digitação no filtro de Local
    const debouncedInput = (function(){ let t=null; return function(){
      if (t) clearTimeout(t);
      t = setTimeout(()=>{ try { carregarAssistAlertas(); } catch(_){ } }, 300);
    }; })();
    localEl.addEventListener('input', debouncedInput);
    // Mudança explícita ou Enter ainda forçam recarga imediata
    localEl.addEventListener('change', carregarAssistAlertas);
    localEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); carregarAssistAlertas(); }});
    localEl._bound = true;
  }
  if (sevEl && !sevEl._persistBound) {
    sevEl.addEventListener('change', ()=>{ try { localStorage.setItem('assist_sev', sevEl.value||''); } catch(_){} });
    sevEl._persistBound = true;
  }
  if (diasEl && !diasEl._persistBound) { diasEl.addEventListener('change', ()=>{ try { localStorage.setItem('assist_dias', diasEl.value||''); } catch(_){} }); diasEl._persistBound = true; }
  if (localEl && !localEl._persistBound) { localEl.addEventListener('change', ()=>{ try { localStorage.setItem('assist_local', localEl.value||''); } catch(_){} }); localEl._persistBound = true; }
  function applyAuto(){
    const secs = Number((autoEl && autoEl.value) || 0) || 0;
    try { localStorage.setItem('assist_auto_sec', String(secs)); } catch(_){ }
    if(_assistTimerId){ clearInterval(_assistTimerId); _assistTimerId = null; }
    if(secs > 0){ _assistTimerId = setInterval(()=>{ try { carregarAssistAlertas(); } catch(_){} }, secs*1000); }
  }
  if (autoEl && !autoEl._bound) { autoEl.addEventListener('change', applyAuto); autoEl._bound = true; }
  if (showSilEl && !showSilEl._bound) { showSilEl.addEventListener('change', ()=>{ try{ localStorage.setItem('assist_show_silenced', showSilEl.checked ? '1':'0'); }catch(_){} carregarAssistAlertas(); }); showSilEl._bound = true; }
  const orderRiskEl = document.getElementById('assistOrderRisk');
  if (orderRiskEl && !orderRiskEl._bound) {
    try { const v = localStorage.getItem('assist_order_risk'); if (typeof v === 'string') orderRiskEl.checked = (v === '1'); } catch(_){ }
    const riskBadge = (function(){
      const lbl = document.querySelector('label[for="assistOrderRisk"]');
      if (!lbl) return null;
      let b = document.getElementById('assistRiskTypeBadge');
      if (!b) { b = document.createElement('span'); b.id = 'assistRiskTypeBadge'; b.className = 'badge bg-secondary ms-2 align-middle'; b.textContent = ''; lbl.parentElement && lbl.parentElement.appendChild(b); }
      return b;
    })();
    const setRiskBadge = (algo)=>{ try { if (!riskBadge) return; if (!orderRiskEl.checked) { riskBadge.textContent=''; riskBadge.className='badge bg-secondary ms-2 align-middle'; return; } const txt = (algo==='ml')?'ML':'Heurístico'; riskBadge.textContent = txt; riskBadge.className = 'badge ' + (algo==='ml'?'bg-info':'bg-secondary') + ' ms-2 align-middle'; } catch(_){ } };
    const detectRiskAlgoIfNeeded = async ()=>{
      try {
        if (!orderRiskEl.checked) { setRiskBadge(''); return; }
        const cacheKey = 'assist_risk_algo_cache';
        const now = Date.now();
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const obj = JSON.parse(raw);
            if (obj && obj.t && (now - obj.t) < 5*60*1000 && obj.algo) { setRiskBadge(obj.algo); return; }
          }
        } catch(_){ }
        const tzOff = new Date().getTimezoneOffset();
        const body = { entrada_iso: new Date().toISOString(), local: '', tzOffsetMinutes: tzOff };
        let algo = 'heuristic';
        try {
          const r = await apiFetchJson('/admin/risk/score', { method:'POST', body });
          if (r && (r.algo==='ml' || r.algo==='heuristic')) algo = r.algo;
        } catch(_){ algo = 'heuristic'; }
        try { localStorage.setItem(cacheKey, JSON.stringify({ t: now, algo })); } catch(_){ }
        setRiskBadge(algo);
      } catch(_){ }
    };
    orderRiskEl.addEventListener('change', ()=>{ try{ localStorage.setItem('assist_order_risk', orderRiskEl.checked ? '1':'0'); }catch(_){} detectRiskAlgoIfNeeded(); carregarAssistAlertas(); });
    setTimeout(detectRiskAlgoIfNeeded, 0);
    orderRiskEl._bound = true;
  }
  if (notifBtn && !notifBtn._bound) { notifBtn.addEventListener('click', enableNotifications); notifBtn._bound = true; }
  if (sevModalEl && !sevModalEl._bound) {
    sevModalEl.addEventListener('shown.bs.modal', ()=>{ try { loadSevConfigToUI(); } catch(_){} });
    if (sevModeEl) sevModeEl.addEventListener('change', updateSevUIEnabled);
    if (sevSaveEl) sevSaveEl.addEventListener('click', ()=>{ try { saveSevConfigFromUI(); } catch(_){} carregarAssistAlertas(); if(window.bootstrap){ const m=window.bootstrap.Modal.getOrCreateInstance(sevModalEl); m.hide(); } });
    if (sevResetEl) sevResetEl.addEventListener('click', ()=>{ try { resetSevConfigDefaults(); loadSevConfigToUI(); } catch(_){} });
    sevModalEl._bound = true;
  }
  try {
    const sd = localStorage.getItem('assist_dias'); if(sd && diasEl) diasEl.value = sd;
    const sl = localStorage.getItem('assist_local'); if(sl && localEl) localEl.value = sl;
    const ss = localStorage.getItem('assist_sev'); if(ss && sevEl) sevEl.value = ss;
    const sa = localStorage.getItem('assist_auto_sec'); if(sa && autoEl) autoEl.value = sa;
    const ssil = localStorage.getItem('assist_show_silenced'); if(typeof ssil==='string' && showSilEl) showSilEl.checked = (ssil==='1');
  } catch(_){ }
  if (autoEl) { try { applyAuto(); } catch(_){} }
  loadAssistLogo();
  try { updateNotifBtnUI(); } catch(_){ }
  try { updateSevCardActive(sevEl ? sevEl.value : ''); } catch(_){ }
  try {
    if (!window._assistChipBound) {
      document.addEventListener('click', function(ev){
        const btn = ev.target.closest('#assistChips .chip-close');
        if (!btn) return;
        const type = btn.getAttribute('data-type');
        if (!type) return;
        try {
          if (type === 'dias') {
            const diasEl2 = document.getElementById('assistDias'); if (diasEl2) diasEl2.value = '3'; try { localStorage.setItem('assist_dias','3'); } catch(_){ }
          } else if (type === 'local') {
            const localEl2 = document.getElementById('assistLocal'); if (localEl2) localEl2.value = ''; try { localStorage.removeItem('assist_local'); } catch(_){ }
          } else if (type === 'sev') {
            const sevEl2 = document.getElementById('assistSeveridade'); if (sevEl2) sevEl2.value = ''; try { localStorage.setItem('assist_sev',''); } catch(_){ } updateSevBadgeActive('');
          }
        } catch(_){ }
        try { carregarAssistAlertas(); } catch(_){ }
      });
      window._assistChipBound = true;
    }
  } catch(_){ }
  try {
    if (!window._assistKpiBind) {
      const sevSelect = document.getElementById('assistSeveridade');
      const bindBadge = (sel, value) => {
        if (sel && !sel._assistBound) {
          sel.style.cursor = 'pointer'; sel.title = 'Filtrar por severidade';
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
      try { updateSevBadgeActive(sevSelect ? sevSelect.value : ''); } catch(_){ }
      window._assistKpiBind = true;
    }
  } catch(_){ }
  try {
    const col = document.getElementById('assistenteAlertasCollapse');
    if (col && !col._assistDTBound) {
      col.addEventListener('shown.bs.collapse', ()=>{
        try {
          if (window.jQuery && window.jQuery.fn && window.jQuery.fn.DataTable) {
            const dt = window.jQuery('#assistAlertasTable').DataTable();
            if (dt && dt.columns) dt.columns.adjust();
          }
        } catch(_){ }
      });
      col._assistDTBound = true;
    }
  } catch(_){ }
  try {
    if (!window._assistKpiCardBind) {
      const ativosTab = document.getElementById('ativosTab');
      if (ativosTab) {
        ativosTab.addEventListener('click', function(ev){
          const card = ev.target.closest('.sev-card');
          if (!card) return;
          const sevSelect = document.getElementById('assistSeveridade');
          const value = card.getAttribute('data-sev-filter') || '';
          if (!sevSelect) return;
          const curr = (sevSelect && sevSelect.value) || '';
          const next = (curr === value) ? '' : value;
          sevSelect.value = next;
          try { localStorage.setItem('assist_sev', next); } catch(_){ }
          try { updateSevCardActive(next); } catch(_){ }
          try { carregarAssistAlertas(); } catch(_){ }
        });
      }
      window._assistKpiCardBind = true;
    }
  } catch(_){ }
  try {
    if (!window._assistViewToggleBind) {
      const toggleContainer = document.getElementById('assistViewToggle');
      const tabelaContainer = document.getElementById('assistAlertasLista');
      const graficosContainer = document.getElementById('assistAnalyticsContainer');
      if (toggleContainer && tabelaContainer && graficosContainer) {
        toggleContainer.addEventListener('click', function(ev){
          const button = ev.target.closest('button[data-view]');
          if (!button) return;
          const view = button.getAttribute('data-view');
          toggleContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          if (view === 'tabela') {
            tabelaContainer.classList.remove('d-none');
            graficosContainer.classList.add('d-none');
            try {
              if (window.jQuery && window.jQuery.fn && window.jQuery.fn.DataTable) {
                const dt = window.jQuery('#assistAlertasTable').DataTable();
                if (dt && dt.columns) dt.columns.adjust();
              }
            } catch(_){ }
          } else {
            tabelaContainer.classList.add('d-none');
            graficosContainer.classList.remove('d-none');
            try {
              if (window.assistCharts) {
                const cs = window.assistCharts;
                ['sev','local','trend'].forEach(k=>{ try{ cs[k] && cs[k].resize && cs[k].resize(); }catch(_){ } });
              }
            } catch(_){ }
          }
        });
      }
      window._assistViewToggleBind = true;
    }
  } catch(_){ }
  try { injectBigScreenButton(); } catch(_){ }
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
    try { renderAssistChips(dias, localVal, sevVal); updateSevBadgeActive(sevVal); } catch(_){ }
    const query = { dias: String(dias), limit: '200' };
    if(localVal) query.local_ilike = localVal;
    const orderRisk = document.getElementById('assistOrderRisk')?.checked;
    const tzOff = new Date().getTimezoneOffset();
    if (orderRisk) {
      query.risk = '1';
      query.order = 'risk';
      query.riskType = 'ml';
      query.tzOffsetMinutes = String(tzOff);
    }
    const data = await apiFetchJson('/admin/alertas', { query });
    const alertas = Array.isArray(data?.alertas) ? data.alertas : [];
    _assistAlertMap = new Map();
    const sil = getSilencedSet();
    const withKeys = alertas.map(a=>{ const key=getAlertKey(a); _assistAlertMap.set(key, a); return { key, a }; });
    const resolved = getResolvedSet();
    let visiveis = withKeys.filter(x=> (showSil ? true : !sil.has(x.key)) && !resolved.has(x.key));
    if (sevVal) { visiveis = visiveis.filter(x => getSevForAlert(x.a, sevCfg) === sevVal); }
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
          try { new Notification(title, { body }); } catch(_){ }
        }
      });
      saveSeenSet(seen, currentKeys);
    } catch(_){ }

    let cutoffTxt = '';
    try {
      cutoffTxt = data?.cutoff_iso ? formatDateTimeExact(data.cutoff_iso) : '';
      if (resumo) resumo.textContent = `${alertas.length} alerta(s) • visíveis: ${visiveis.length} • corte: ${cutoffTxt || '-'}`;
    } catch {}

    if(alertas.length === 0){
      cont.innerHTML = '<p class="text-muted mb-0">Nenhum alerta para os filtros informados.</p>';
      try { if(kAltaEl) kAltaEl.textContent='0'; if(kMediaEl) kMediaEl.textContent='0'; if(kBaixaEl) kBaixaEl.textContent='0'; } catch(_){ }
      return;
    }

    try {
      let cAlta = 0, cMedia = 0, cBaixa = 0;
      visiveis.forEach(x=>{ const s=getSevForAlert(x.a, sevCfg); if(s==='alta') cAlta++; else if(s==='media') cMedia++; else cBaixa++; });
      if(kAltaEl) kAltaEl.textContent = String(cAlta);
      if(kMediaEl) kMediaEl.textContent = String(cMedia);
      if(kBaixaEl) kBaixaEl.textContent = String(cBaixa);

      const kAtivosTotal = document.getElementById('kpi-ativos-total');
      const kAtivosAtencao = document.getElementById('kpi-ativos-atencao');
      const kAtivosCriticos = document.getElementById('kpi-ativos-criticos');
      if (kAtivosAtencao) kAtivosAtencao.textContent = String(cMedia);
      if (kAtivosCriticos) kAtivosCriticos.textContent = String(cAlta);

      try {
        const tz = new Date().getTimezoneOffset();
        const stats = await apiFetchJson('/dashboard/stats', { query: { compat: '1', tzOffsetMinutes: String(tz) } });
        if (kAtivosTotal && stats && typeof stats.bicicletasEstacionadasAgora === 'number') {
          kAtivosTotal.textContent = String(stats.bicicletasEstacionadasAgora);
        }
      } catch(_) {
        if (kAtivosTotal) kAtivosTotal.textContent = String(visiveis.length);
      }
    } catch(_){ }
    try {
      const tz = new Date().getTimezoneOffset();
      const q = { dias: '14', limiar_dias: String(dias), tzOffsetMinutes: String(tz) };
      if (localVal) q.local_ilike = localVal;
      const series = await apiFetchJson('/admin/alertas/series', { query: q });
      renderAssistChartsFromSeries(series);
    } catch(_) {
      try { updateAssistCharts(visiveis.map(x=>x.a), sevCfg); } catch(__){}
    }

    const useScroller = (window.ASSIST_USE_SCROLLER === true) && window.jQuery && jQuery.fn && jQuery.fn.DataTable && jQuery.fn.DataTable.Scroller;
    const wrapTable = !useScroller;
    let html = (wrapTable ? '<div class="table-responsive">' : '') + '<table id="assistAlertasTable" class="table table-sm table-striped align-middle w-100"><thead><tr>'
      + '<th>Proprietário</th><th>Bicicleta</th><th>Entrada</th><th>Local</th><th>Inatividade</th><th>Severidade</th><th>Ações</th>'
      + (orderRisk ? '<th>Risco (%)</th>' : '')
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
      const contatoTel = a.proprietario_contato || a.telefone || a.celular || a.contato || '';
      const contatoEmail = a.proprietario_email || a.email || '';
      const resumoMsg = `Olá, aqui é da Administração do Bicicletário Municipal de Japeri. Detectamos inatividade da sua bicicleta (${bike||'-'}) no local ${local} com entrada em ${entrada}. Por favor, entre em contato.`;
      const wa = waLink(contatoTel, resumoMsg);
      const ml = mailLink(contatoEmail, 'Alerta de Inatividade - Bicicletário Japeri', resumoMsg);
      const silSet = getSilencedSet();
      const isSil = silSet.has(key);
      const btnDarSaida = `<button type="button" class="btn btn-success btn-sm assist-acao-dar-saida" data-key="${key}" title="Dar Saída agora (fecha estada)"><i class='bx bx-log-out'></i> Dar Saída</button>`;
      const btnResolver = `<button type="button" class="btn btn-primary btn-sm assist-acao-resolver" data-key="${key}" title="Marcar como resolvido"><i class='bx bx-check-shield'></i> Resolver</button>`;
      let menuContato = '';
      if (wa || ml) {
        menuContato = `
          <div class="btn-group">
            <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-display="static" aria-expanded="false" title="Opções de Contato">
              <i class='bx bxs-phone'></i> Contato
            </button>
            <ul class="dropdown-menu">
              ${wa ? `<li><a class="dropdown-item" target="_blank" rel="noopener" href="${wa}"><i class='bx bxl-whatsapp'></i> WhatsApp</a></li>` : ''}
              ${ml ? `<li><a class="dropdown-item" href="${ml}"><i class='bx bx-envelope'></i> E-mail</a></li>` : ''}
            </ul>
          </div>`;
      }
      const menuMaisOpcoes = `
        <div class="btn-group">
          <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-display="static" aria-expanded="false" title="Mais Opções">
            <i class='bx bx-dots-vertical-rounded'></i>
          </button>
          <ul class="dropdown-menu">
            <li><button class="dropdown-item assist-acao-detalhe" type="button" data-key="${key}"><i class='bx bx-show-alt'></i> Detalhar Alerta</button></li>
            ${(sev==='alta'||sev==='media')?`<li><button class="dropdown-item assist-acao-print-etiqueta" type="button" data-key="${key}"><i class='bx bx-printer'></i> Imprimir Etiqueta</button></li>`:''}
            <li><button class="dropdown-item assist-acao-atribuir-plantonista" type="button" data-key="${key}"><i class='bx bx-user-check'></i> Atribuir ao Plantonista</button></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item assist-acao-silenciar" type="button" data-key="${key}" data-sil="${isSil ? 1 : 0}"><i class='bx ${isSil ? 'bxs-bell' : 'bx-bell-off'}'></i> ${isSil ? 'Reativar Alerta' : 'Silenciar'}</button></li>
          </ul>
        </div>`;
      const respName = a.funcionario_entrada_nome || a.responsavel || '';
      const warnTitle = respName ? `${respName} deixou o checkout pendente` : 'Checkout pendente';
      const warnBadge = (sev==='alta' || sev==='media') ? `<span class="badge bg-danger-subtle text-danger assist-warn" title="${warnTitle}">${respName ? `${respName} deixou o checkout pendente` : 'Checkout pendente'}</span>` : '';
      const riskNum = (orderRisk && Number.isFinite(a.risk_percent)) ? Number(a.risk_percent) : null;
      const riskCell = orderRisk ? (`<td class="text-end" data-order="${riskNum!=null ? riskNum : 0}">${riskNum!=null ? (riskNum + '%') : '-'}</td>`) : '';
      html += '<tr class="' + rowClass + '">'
        + '<td>' + nome + '</td>'
        + '<td>' + (bike || '-') + '</td>'
        + '<td>' + entrada + '</td>'
        + '<td>' + local + '</td>'
        + '<td data-order="' + minOrder + '">' + inat + '</td>'
        + '<td data-order="' + sevNum + '"><span class="badge sev-badge ' + sevClass + '">' + (sev || '-') + '</span></td>'
        + '<td class="text-nowrap d-flex align-items-center flex-wrap gap-1">' + warnBadge + ' ' + btnDarSaida + ' ' + btnResolver + ' ' + menuContato + ' ' + menuMaisOpcoes + '</td>'
        + riskCell
        + '</tr>';
    });

    html += '</tbody></table>' + (wrapTable ? '</div>' : '');
    cont.innerHTML = html;
    try {
      const colTbl = document.getElementById('assistTableCollapse');
      if (colTbl && !colTbl._assistDTBound) {
        colTbl.addEventListener('shown.bs.collapse', ()=>{
          try {
            if (window.jQuery && jQuery.fn.DataTable) {
              const dt = jQuery('#assistAlertasTable').DataTable();
              if (dt && dt.columns) dt.columns.adjust();
            }
          } catch(_){ }
        });
        colTbl._assistDTBound = true;
      }
    } catch(_){ }
    try {
      if (window.jQuery && jQuery.fn.DataTable) {
        const $t = jQuery('#assistAlertasTable');
        if (jQuery.fn.DataTable.isDataTable($t)) { $t.DataTable().destroy(); }
        const now = new Date(); const pad = n => String(n).padStart(2,'0');
        const fname = `alertas_inatividade_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        const exportTitle = `Alertas de Inatividade — ${now.toLocaleString('pt-BR')} — Dias≥${dias}${localVal?` — Local: ${localVal}`:''}`;
        const exportSub = `Corte: ${cutoffTxt || '-'}`;
        try { $t.off('preInit.dt.assist').on('preInit.dt.assist', function(){ try{ document.activeElement && document.activeElement.blur(); }catch(_){ } }); } catch(_){ }
        // Configuração base do DataTable
        const exportCols = orderRisk ? [0,1,2,3,4,5,7] : [0,1,2,3,4,5];
        const dtOrder = orderRisk ? [[7, 'desc']] : [[5, 'desc'], [4, 'desc']];
        const dtOpts = {
          pageLength: 25,
          lengthMenu: [10,25,50,100],
          order: dtOrder,
          responsive: true,
          autoWidth: false,
          dom: 'Bfrtip',
          columnDefs: [ { targets: 6, orderable: false, searchable: false } ],
          buttons: [
            { extend:'copy', text:'Copiar', exportOptions:{ columns: exportCols } },
            { extend:'csv', text:'CSV', filename: fname, title: exportTitle, exportOptions:{ columns: exportCols } },
            { extend:'excel', text:'Excel', filename: fname, title: exportTitle, exportOptions:{ columns: exportCols } },
            { extend:'pdfHtml5', text:'PDF', filename: fname, title: exportTitle, orientation:'landscape', pageSize:'A4', exportOptions:{ columns: exportCols },
              customize: function(doc){
                try {
                  doc.pageMargins = [22, 36, 22, 28];
                  doc.defaultStyle.fontSize = 10;
                  if (doc.content && doc.content.length>0 && doc.content[0].text) { doc.content[0].margin = [0,0,0,8]; }
                  doc.content.splice(1,0,{ text: exportSub, fontSize: 9, margin:[0,0,0,8] });
                  doc.images = doc.images || {};
                  if (window.assistPdfLogo) doc.images.logo = window.assistPdfLogo;
                  doc.header = function(){ return { columns: [ (window.assistPdfLogo ? { image: 'logo', width: 50 } : { text: '' }), { text: 'Bicicletário Municipal de Japeri', alignment: 'center', fontSize: 12, bold: true }, { text: 'Somente para uso interno', alignment: 'right', fontSize: 9, color: '#666' } ], margin: [22, 12, 22, 0] }; };
                  doc.footer = function(currentPage, pageCount){ return { text: currentPage + ' / ' + pageCount, alignment: 'right', margin:[22,0,22,12], fontSize: 9 }; };
                } catch(_){ }
              }
            },
            { extend:'print', text:'Imprimir', title: exportTitle, exportOptions:{ columns: exportCols } },
            { extend:'colvis', text:'Colunas' }
          ],
          language:{ url:'https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json' },
          initComplete: function(){
            try { if (document.activeElement) document.activeElement.blur(); } catch(_){ }
            try { if (!_assistFirstLoadDone) { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); _assistFirstLoadDone = true; } } catch(_){ }
            try { $t.off('preInit.dt.assist'); } catch(_){ }
          }
        };
        // Avaliação: Scroller (opcional, desativado por padrão). Ative com window.ASSIST_USE_SCROLLER = true
        try {
          const useScroller = (window.ASSIST_USE_SCROLLER === true) && jQuery && jQuery.fn && jQuery.fn.DataTable && jQuery.fn.DataTable.Scroller;
          if (useScroller) {
            Object.assign(dtOpts, { deferRender: true, scrollY: '60vh', scrollCollapse: true, scroller: true, responsive: false });
            console.info('[Assistente] DataTables Scroller ativado para avaliação.');
          }
        } catch(_){ }
        const dt = $t.DataTable(dtOpts);
        // Elevar z-index do TD enquanto o dropdown estiver aberto
        try {
          jQuery('#assistAlertasTable')
            .off('shown.bs.dropdown.assistZ hidden.bs.dropdown.assistZ')
            .on('shown.bs.dropdown.assistZ', 'button[data-bs-toggle="dropdown"]', function(){ const td = this.closest('td'); if (td) td.classList.add('dropdown-open'); })
            .on('hidden.bs.dropdown.assistZ', 'button[data-bs-toggle="dropdown"]', function(){ const td = this.closest('td'); if (td) td.classList.remove('dropdown-open'); });
        } catch(_){ }
        const $sev = jQuery('#assistSeveridade');
        if ($sev.length && !$sev[0]._assistBound) {
          $sev.on('change', function(){ const v = this.value; dt.column(5).search(v ? ('^'+v+'$') : '', true, false).draw(); });
          $sev[0]._assistBound = true;
        }
        const v0 = ($sev.length ? $sev.val() : '') || '';
        dt.column(5).search(v0 ? ('^'+v0+'$') : '', true, false).draw();
        try { if (document.activeElement) document.activeElement.blur(); } catch(_){ }
        jQuery('#assistAlertasTable').off('click.assist')
          .on('click.assist', '.assist-acao-detalhe', function(){
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
                  <div class="col-md-6"><label class="form-label">Atribuir responsável</label><input id="assistRespInp" class="form-control" placeholder="Nome do responsável"></div>
                  <div class="col-md-3"><button type="button" class="btn btn-outline-primary w-100" id="assistRespBtn">Atribuir</button></div>
                </div>
                <div class="row g-2 mt-2">
                  <div class="col-12"><label class="form-label">Comentário</label><textarea id="assistComentInp" class="form-control" rows="2" placeholder="Adicionar uma nota..."></textarea></div>
                  <div class="col-md-6"><button type="button" class="btn btn-outline-secondary w-100" id="assistComentBtn">Comentar</button></div>
                  <div class="col-md-6"><button type="button" class="btn btn-success w-100" id="assistResolverBtn">Resolver</button></div>
                </div>`;
              const body = document.getElementById('assistDetalheBody');
              if(body) body.innerHTML = html;
              const copyBtn = document.getElementById('assistCopyBtn');
              if(copyBtn){ copyBtn.onclick = ()=>{ try { navigator.clipboard.writeText(`Alerta: ${nome} — ${bike} — Entrada: ${entrada} — Local: ${local} — Inatividade: ${inat} — Severidade: ${sev}`); copyBtn.textContent='Copiado!'; setTimeout(()=> copyBtn.textContent='Copiar resumo', 1200); } catch(_){} } }
              const idCtrl = a.controle_id || a.id;
              const doAssign = async ()=>{ const r=(document.getElementById('assistRespInp')?.value||'').trim(); if(!r) return; const ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(idCtrl)}/atribuir`, { responsavel: r }); if(!ok) alert('Falha ao atribuir.'); };
              const doComment = async ()=>{ const c=(document.getElementById('assistComentInp')?.value||'').trim(); if(!c) return; const ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(idCtrl)}/comentar`, { comentario: c }); if(!ok) alert('Falha ao comentar.'); };
              const doResolve = async ()=>{ const ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(idCtrl)}/resolver`, { motivo: 'resolvido_via_modal' }); if(!ok){ const set = getResolvedSet(); set.add(getAlertKey(a)); saveResolvedSet(set); } carregarAssistAlertas(); try{ const m=window.bootstrap.Modal.getInstance(document.getElementById('assistDetalheModal')); m && m.hide(); }catch(_){} };
              const b1=document.getElementById('assistRespBtn'); if(b1) b1.onclick = doAssign;
              const b2=document.getElementById('assistComentBtn'); if(b2) b2.onclick = doComment;
              const b3=document.getElementById('assistResolverBtn'); if(b3) b3.onclick = doResolve;
              const modalEl = document.getElementById('assistDetalheModal');
              if (modalEl && window.bootstrap) { const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl); modal.show(); }
            } catch(_){ }
          })
          .on('click.assist', '.assist-acao-silenciar', async function(){
            try {
              const key = this.getAttribute('data-key');
              const isSil = this.getAttribute('data-sil') === '1';
              const a = _assistAlertMap.get(key) || {};
              const id = a.controle_id || a.id;
              try { if(id!=null){ await callAssistApi(`/admin/alertas/${encodeURIComponent(id)}/silenciar`, { ativo: isSil }); } } catch(_){ }
              const set = getSilencedSet(); if(isSil) set.delete(key); else set.add(key); saveSilencedSet(set); carregarAssistAlertas();
            } catch(_){ }
          })
          .on('click.assist', '.assist-acao-dar-saida', async function(){
            try {
              const key = this.getAttribute('data-key');
              const a = _assistAlertMap.get(key) || {};
              const id = a.controle_id || a.id; if (!id) return;
              if (!confirm('Confirmar DAR SAÍDA agora para este registro?')) return;
              let ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(id)}/dar-saida`, { motivo: 'acao_rapida' });
              if (!ok) { ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(id)}/resolver`, { motivo: 'fallback_dar_saida' }); }
              if (!ok) alert('Falha ao dar saída.');
              carregarAssistAlertas();
            } catch(_){ }
          })
          .on('click.assist', '.assist-acao-resolver', async function(){
            try {
              const key = this.getAttribute('data-key');
              const a = _assistAlertMap.get(key) || {};
              const id = a.controle_id || a.id;
              let ok = false;
              if(id!=null){ ok = await callAssistApi(`/admin/alertas/${encodeURIComponent(id)}/resolver`, { motivo: 'resolvido_via_lista' }); }
              if(!ok){ const set = getResolvedSet(); set.add(key); saveResolvedSet(set); }
              carregarAssistAlertas();
            } catch(_){ }
          })
          .on('click.assist', '.assist-acao-print-etiqueta', function(){
            try{
              const key = this.getAttribute('data-key');
              const a = _assistAlertMap.get(key) || {};
              const cfg = getSevConfig();
              const sev = getSevForAlert(a, cfg);
              printAlertLabel(a, sev, cfg);
            }catch(_){ }
          })
          .on('click.assist', '.assist-acao-atribuir-plantonista', function(){
            try{
              const key = this.getAttribute('data-key');
              const a = _assistAlertMap.get(key) || {};
              addPlantonistaTask(a);
            }catch(_){ }
          });
      }
    } catch(_){ }
  } catch(err){
    console.error('Assistente alertas:', err);
    cont.innerHTML = '<p class="text-danger mb-0">Erro ao carregar alertas: ' + ((err && err.message) || 'erro desconhecido') + '</p>';
  }
}

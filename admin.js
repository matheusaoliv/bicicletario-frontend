// admin.js
// Lógica de autenticação e funcionalidades do painel admin

// Configuração da URL base da API
const API_BASE_URL = 'https://bicicletario-backend.onrender.com';

const ADMINS = [
  "Matheus Oliveira",
  "Wenderson da silva soares",
  "Joice barbosa nascimento",
  "Marcelo damasceno de oliveira",
  "Shaiene maiara ferreira de oliveira",
  "Jorge luiz costa dos santos",
  "Marcelo da silva rocha"
];

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

// Proteção de acesso ao painel admin
if (!localStorage.getItem('adminLogado')) {
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
#tabelaMonitoramento th.col-tempo,  #tabelaMonitoramento td:nth-child(5) { min-width: 140px; }
#tabelaMonitoramento th.col-total,  #tabelaMonitoramento td:nth-child(6) { min-width: 160px; }
#tabelaMonitoramento th.col-ultima, #tabelaMonitoramento td:nth-child(7) { min-width: 220px; }
#tabelaMonitoramento th.col-ranking,#tabelaMonitoramento td:nth-child(8) { min-width: 90px;  text-align: center; }
#tabelaMonitoramento th.col-acoes,  #tabelaMonitoramento td:nth-child(9) { min-width: 240px; }
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

    // Se já existe um header na página, aplicar classe institucional e não criar outro
    const pageHeader = document.querySelector('header');
    const injectedHeader = document.getElementById('adminHeader');

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
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
      // Marca sessão logada
      localStorage.setItem('adminLogado', '1');
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
  carregarMonitoramento();
});

// --- Monitoramento de Funcionários ---
async function carregarMonitoramento(token) {
  const monitoramentoDiv = document.getElementById('monitoramentoTab');
  if (!monitoramentoDiv) return;
  const loadingDiv = document.getElementById('loadingMonitoramento');
  if (loadingDiv) loadingDiv.innerHTML = 'Carregando monitoramento...';
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/monitoramento`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro ao buscar monitoramento');
    const { funcionarios, ranking, fluxoPorDia, fluxoPorFuncionarioPorDia } = await res.json();
    // Guarda em memória para reuso (edição etc.)
    window.ultimoMonitoramento = funcionarios;

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
      options: { responsive: true }
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
      // Botões de ação
      const isAdmin = FUNC_SECRETARIA.includes(nomeLower);
      const edicoes = parseInt(localStorage.getItem('edicoes_funcionario_' + f.id) || '0', 10);
      const btnEditar = `<button class='btn btn-sm btn-primary' onclick="editarFuncionario('${f.id}')">Editar (${edicoes})</button>`;
      const btnExcluir = isAdmin ? '' : `<button class='btn btn-sm btn-danger' onclick="excluirFuncionario('${f.id}', '${(f.nome || '').replace(/'/g, '&#39;')}')">Excluir</button>`;
      const btnDeslogar = `<button class='btn btn-sm btn-warning' onclick="deslogarFuncionario('${f.id}', '${(f.nome || '').replace(/'/g, '&#39;')}')">Deslogar</button>`;
      const fotoUrl = f.fotoUrl || '';
      const avatar = fotoUrl ? `<img src='${fotoUrl}' alt='Foto de ${f.nome}' style='width:36px;height:36px;border-radius:50%;object-fit:cover;'>` : '<span class="avatar-placeholder">👤</span>';
      const tempoParadoStr = (typeof f.tempoParadoMin === 'number') ? formatTempoParado(f.tempoParadoMin) : '-';
      const alertaStr = (f.tempoParadoMin > 60) ? ' <span class="badge bg-danger">Alerta</span>' : '';
      const totalMovStr = `${f.totalMovimentacoes} <small class="text-muted">(hoje: ${getMovHoje(f)})</small>`;
      const ultimaMovStr = f.ultimaMov ? `${formatDateTimeExact(f.ultimaMov)} (${f.tipoUltimaMov})` : '-';
      tabela.append(`<tr class="${destaque}"><td>${avatar}</td><td>${f.nome}</td><td>${local}</td><td>${formatStatus(f.status)}</td><td>${tempoParadoStr}${alertaStr}</td><td>${totalMovStr}</td><td>${ultimaMovStr}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir} ${btnDeslogar}</td></tr>`);
    });
    tabela.DataTable({ responsive: false, scrollX: false, autoWidth: false, order: [[7, 'asc']] });

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
  }
}

// SUBSTITUIR implementação antiga (primeira) de carregarProprietarios por stub para evitar uso
// async function carregarProprietarios(token) { /* substituída por versão em cards no final do arquivo */ }

// --- Exibir abas e carregar dados após login ---
function mostrarPainelAdmin(token) {
  adminLoginSection.classList.add('hidden');
  adminPanelSection.classList.remove('hidden');
  carregarMonitoramento(token);
  carregarProprietarios(token);
}

// --- Sistema de Abas ---
document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Remove active de todos os botões e conteúdos
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Adiciona active ao botão clicado e conteúdo correspondente
      button.classList.add('active');
      document.getElementById(tabName + 'Tab').classList.add('active');
      
      // Carrega dados da aba se necessário
      if (tabName === 'proprietarios') {
        carregarProprietarios();
      }
    });
  });
});

// --- Relatórios e Backup ---
document.getElementById('btnRelatorioDia').onclick = () => imprimirRelatorio('dia');
document.getElementById('btnRelatorioMes').onclick = () => imprimirRelatorio('mes');
document.getElementById('btnGerarRelatorioDia').onclick = () => gerarRelatorio('dia');
document.getElementById('btnGerarRelatorioMes').onclick = () => gerarRelatorio('mes');
document.getElementById('btnBackup').onclick = realizarBackup;

async function imprimirRelatorio(tipo) {
  try {
    const token = sessionStorage.getItem('token');
    adminMsg.textContent = `Gerando relatório ${tipo === 'mes' ? 'mensal' : 'diário'}...`;
    adminMsg.classList.remove('sucesso');
    
    // Fazer requisição com token
    const res = await fetch(`${API_BASE_URL}/api/admin/relatorio?tipo=${tipo}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.erro || 'Falha ao gerar relatório.');
    }
    
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
  } catch (err) {
    adminMsg.textContent = 'Erro ao gerar relatório: ' + (err.message || 'Erro desconhecido');
    adminMsg.classList.remove('sucesso');
    adminMsg.style.color = 'red';
  }
}

async function gerarRelatorio(tipo) {
  if (!adminEmail) {
    modalEmail.classList.remove('hidden');
    return;
  }
  try {
    const token = sessionStorage.getItem('token');
    adminMsg.textContent = 'Gerando relatório...';
    const res = await fetch(`${API_BASE_URL}/api/admin/gerar-relatorio`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tipo, email: adminEmail })
    });
    if (!res.ok) throw new Error('Falha ao gerar relatório.');
    adminMsg.textContent = 'Relatório gerado e enviado para todos os administradores!';
    adminMsg.classList.add('sucesso');
  } catch (err) {
    adminMsg.textContent = err.message || 'Erro ao gerar relatório.';
    adminMsg.classList.remove('sucesso');
  }
}

async function realizarBackup() {
  try {
    const token = sessionStorage.getItem('token');
    adminMsg.textContent = 'Realizando backup completo do sistema...';
    adminMsg.classList.remove('sucesso');
    
    const res = await fetch(`${API_BASE_URL}/api/admin/backup`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.erro || 'Falha ao realizar backup.');
    }
    
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
  } catch (err) {
    adminMsg.textContent = 'Erro ao realizar backup: ' + (err.message || 'Erro desconhecido');
    adminMsg.classList.remove('sucesso');
    adminMsg.style.color = 'red';
  }
}

// Todas as funções fetch para o backend devem usar o token do sessionStorage:
async function fetchComToken(url, options = {}) {
  const token = sessionStorage.getItem('token');
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`
    }
  });
}

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
function formatStatus(status) {
  const s = (status || '').toString().toLowerCase();
  if (s === 'parado') return 'ta em casa';
  if (s === 'ativo') return 'trabalhando';
  return status || '-';
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

async function carregarMonitoramento(token) {
  const monitoramentoDiv = document.getElementById('monitoramentoTab');
  if (!monitoramentoDiv) return;
  const loadingDiv = document.getElementById('loadingMonitoramento');
  if (loadingDiv) loadingDiv.innerHTML = 'Carregando monitoramento...';
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/monitoramento`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro ao buscar monitoramento');
    const { funcionarios, ranking, fluxoPorDia, fluxoPorFuncionarioPorDia } = await res.json();

    // Verificação defensiva para o canvas
    const canvasProd = document.getElementById('graficoProdutividade');
    if (!canvasProd) {
      if (loadingDiv) loadingDiv.innerHTML = 'Erro: Canvas de produtividade não encontrado.';
      return;
    }
    const ctxProd = canvasProd.getContext('2d');
    const dias = Object.keys(fluxoPorDia).sort();
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
      options: { responsive: true }
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
      // Botões de ação
      const isAdmin = FUNC_SECRETARIA.includes(nomeLower);
      const edicoes = parseInt(localStorage.getItem('edicoes_funcionario_' + f.id) || '0', 10);
      const btnEditar = `<button class='btn btn-sm btn-primary' onclick="editarFuncionario('${f.id}')">Editar (${edicoes})</button>`;
      const btnExcluir = isAdmin ? '' : `<button class='btn btn-sm btn-danger' onclick="excluirFuncionario('${f.id}', '${(f.nome || '').replace(/'/g, '&#39;')}')">Excluir</button>`;
      const btnDeslogar = `<button class='btn btn-sm btn-warning' onclick="deslogarFuncionario('${f.id}', '${(f.nome || '').replace(/'/g, '&#39;')}')">Deslogar</button>`;
      const fotoUrl = f.fotoUrl || '';
      const avatar = fotoUrl ? `<img src='${fotoUrl}' alt='Foto de ${f.nome}' style='width:36px;height:36px;border-radius:50%;object-fit:cover;'>` : '<span class="avatar-placeholder">👤</span>';
      const tempoParadoStr = (typeof f.tempoParadoMin === 'number') ? formatTempoParado(f.tempoParadoMin) : '-';
      const alertaStr = (f.tempoParadoMin > 60) ? ' <span class="badge bg-danger">Alerta</span>' : '';
      const totalMovStr = `${f.totalMovimentacoes} <small class="text-muted">(hoje: ${getMovHoje(f)})</small>`;
      const ultimaMovStr = f.ultimaMov ? `${formatDateTimeExact(f.ultimaMov)} (${f.tipoUltimaMov})` : '-';
      tabela.append(`<tr class="${destaque}"><td>${avatar}</td><td>${f.nome}</td><td>${local}</td><td>${formatStatus(f.status)}</td><td>${tempoParadoStr}${alertaStr}</td><td>${totalMovStr}</td><td>${ultimaMovStr}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir} ${btnDeslogar}</td></tr>`);
    });
    tabela.DataTable({ responsive: false, scrollX: false, autoWidth: false, order: [[7, 'asc']] });

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
  }
}

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
    const url = new URL(`${API_BASE_URL}/api/admin/proprietarios`);
    if(termo) url.searchParams.set('termo', termo);
    fetch(url.toString(), { headers:{ Authorization:'Bearer '+token }})
      .then(r=>{ if(!r.ok) throw new Error('Erro '+r.status); return r.json(); })
      .then(proprietarios=>{
        if(!Array.isArray(proprietarios) || !proprietarios.length){ proprietariosDiv.innerHTML='<p>Nenhum proprietário encontrado.</p>'; return; }
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
          const celular = p.celular || p.telefoneCelular || p.telefone || p.telefone1 || '';
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
          const checkinOper = p.checkin?.operador || p.checkin?.usuarioNome || p.operadorCheckin || p.funcionario_entrada || '';
          const checkinHora = p.checkin?.dataHora || p.dataCheckin || p.data_hora_entrada || '';
          const checkoutOper = p.checkout?.operador || p.checkout?.usuarioNome || p.operadorCheckout || p.funcionario_saida || '';
          const checkoutHora = p.checkout?.dataHora || p.dataCheckout || p.data_hora_saida || '';
          const checkinStr = (checkinOper && checkinHora)
            ? `<div><b>Funcionário:</b> ${checkinOper}</div><div><b>Data/Hora:</b> ${formatDateTimeExact(checkinHora)}</div>`
            : '-';
          const checkoutStr = (checkoutOper && checkoutHora)
            ? `<div><b>Funcionário:</b> ${checkoutOper}</div><div><b>Data/Hora:</b> ${formatDateTimeExact(checkoutHora)}</div>`
            : '-';
          html += `<tr>
            <td>${fotoCell}</td>
            <td>${nome}</td>
            <td>${endereco}</td>
            <td>${celular}</td>
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
      .catch(err=>{ console.error('Erro proprietarios:', err); proprietariosDiv.innerHTML='<p>Erro ao carregar proprietários.</p>'; });
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
      window._bindBuscaPropsTabela = true;
    }
  };
})();

// =============================================================================
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
    const adminLogado = localStorage.getItem('adminLogado');
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
    const adminLogado = localStorage.getItem('adminLogado');
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
    const adminLogado = localStorage.getItem('adminLogado');
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

// Função para exportar lista de bloqueados
function exportarListaBloqueados() {
    if (!proprietariosBloqueados || proprietariosBloqueados.length === 0) {
        alert('Não há proprietários bloqueados para exportar.');
        return;
    }

    const csv = 'Nome,Data Bloqueio\n' +
                proprietariosBloqueados.map(nome => `"${nome}","${new Date().toLocaleDateString('pt-BR')}"`).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proprietarios-bloqueados-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Event listeners para a aba de bloqueios
document.addEventListener('DOMContentLoaded', function() {
    // Adiciona event listener para o botão de exportar bloqueados
    const btnExportarBloqueados = document.getElementById('btnExportarBloqueados');
    if (btnExportarBloqueados) {
        btnExportarBloqueados.addEventListener('click', exportarListaBloqueados);
    }

    // Adiciona event listener para o botão de exportar auditoria
    const btnExportarAuditoria = document.getElementById('btnExportarAuditoria');
    if (btnExportarAuditoria) {
        btnExportarAuditoria.addEventListener('click', function() {
            if (!logsAuditoria || logsAuditoria.length === 0) {
                alert('Não há logs de auditoria para exportar.');
                return;
            }

            const csv = 'Data/Hora,Admin,Ação,Detalhes\n' +
                        logsAuditoria.map(log => `"${new Date(log.data).toLocaleString('pt-BR')}","${log.admin}","${log.acao}","${log.detalhes}"`).join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `logs-auditoria-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        });
    }

    // Renderiza as listas quando a aba de bloqueios é ativada
    const tabBloqueios = document.querySelector('[data-tab="bloqueios"]');
    if (tabBloqueios) {
        tabBloqueios.addEventListener('click', function() {
            // Aguarda um pouco para garantir que a aba foi ativada
            setTimeout(() => {
                renderizarBloqueiosPendentes();
                renderizarProprietariosBloqueados();
                renderizarLogsAuditoria();
            }, 100);
        });
    }

    // Se a aba de bloqueios estiver ativa no carregamento, renderiza
    const bloqueiosTab = document.getElementById('bloqueiosTab');
    if (bloqueiosTab && bloqueiosTab.classList.contains('active')) {
        renderizarBloqueiosPendentes();
        renderizarProprietariosBloqueados();
        renderizarLogsAuditoria();
    }
});

// Torna as funções globais para serem chamadas pelos botões
window.confirmarBloqueio = confirmarBloqueio;
window.rejeitarBloqueio = rejeitarBloqueio;
window.desbloquearProprietario = desbloquearProprietario;

// --- Logout admin ---
function bindLogoutLinks() {
  const links = [
    ...document.querySelectorAll('.logout-admin-link'),
    ...[document.getElementById('logoutAdmin')].filter(Boolean)
  ];
  links.forEach(link => {
    if (!link._logoutBound) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.clear();
        localStorage.removeItem('adminLogado');
        window.location.href = 'admin-login.html';
      });
      link._logoutBound = true;
    }
  });
}
document.addEventListener('DOMContentLoaded', bindLogoutLinks);
bindLogoutLinks();

// [removido] Duplicata de editar/salvar/excluir funcionário para manter uma única fonte de verdade


// --- Busca, filtros e exportação na tabela de funcionários ---
$(document).ready(function() {
  // Busca global
  $('#buscaFuncionario').on('keyup', function() {
    $('#tabelaMonitoramento').DataTable().search(this.value).draw();
  });
  // Filtros por local e status (colunas: Local=2, Status=3)
  $('#filtroLocal, #filtroStatus').on('change', function() {
    const localVal = $('#filtroLocal').val();
    const statusVal = $('#filtroStatus').val();
    const table = $('#tabelaMonitoramento').DataTable();
    // Quando "Todos", limpa a busca
    table.column(2).search(localVal && localVal !== 'Todos' ? localVal : '');
    table.column(3).search(statusVal && statusVal !== 'Todos' ? statusVal : '');
    table.draw();
  });
  // Filtro por período (Última Movimentação = coluna 6, formato "YYYY-MM-DD HH:mm (tipo)")
  $('#filtroDataInicio, #filtroDataFim').on('change', function() {
    const table = $('#tabelaMonitoramento').DataTable();
    table.draw();
  });
  // Custom filter para período
  $.fn.dataTable.ext.search.push(function(settings, data) {
    const inicio = $('#filtroDataInicio').val();
    const fim = $('#filtroDataFim').val();
    const colUltima = data[6] || ''; // "YYYY-MM-DD HH:mm (tipo)"
    const dataUltimaMov = colUltima ? colUltima.split(' ')[0] : '';
    if (!inicio && !fim) return true;
    if (inicio && (!dataUltimaMov || dataUltimaMov < inicio)) return false;
    if (fim && (!dataUltimaMov || dataUltimaMov > fim)) return false;
    return true;
  });
  // Exportação CSV
  $('#btnExportarFuncionarios').on('click', function() {
    let table = $('#tabelaMonitoramento').DataTable();
    let csv = 'Nome,Local,Status,Tempo Parado,Total Mov.,Última Movimentação,Ranking\n';
    table.rows({search:'applied'}).every(function() {
      let d = this.data();
      csv += d.slice(0,7).join(',') + '\n';
    });
    let blob = new Blob([csv], {type: 'text/csv'});
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'funcionarios.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  });
});

// --- Novas funcionalidades para proprietários ---

// --- Adição de foto extra ---
document.addEventListener('click', e=>{
    // Upload foto extra
    const btnExtra = e.target.closest('.btn-add-foto-extra');
    if(btnExtra){
      const propId = btnExtra.getAttribute('data-prop');
      const token = sessionStorage.getItem('token');
      if(!propId || !token) return;
      const input = document.createElement('input');
      input.type='file'; input.accept='image/*';
      input.onchange = async ev => {
        if(!ev.target.files || !ev.target.files[0]) return;
        const fd = new FormData(); fd.append('fotoProprietarioExtra', ev.target.files[0]);
        btnExtra.disabled=true; btnExtra.textContent='Enviando...';
        try {
          const resp = await fetch(`${API_BASE_URL}/api/proprietarios/${propId}/foto-extra`, { method:'PUT', headers:{'Authorization':`Bearer ${token}`}, body: fd });
          const js = await resp.json();
          if(!resp.ok) throw new Error(js.erro||'Falha upload');
          // Atualiza badge de fotos
          const card = btnExtra.closest('.proprietario-card');
            if(card){
              const badgeWrap = card.querySelector('.prop-badges');
              if(badgeWrap){
                let count = 0;
                if(card.querySelector('.foto-wrap img')) count++;
                count++; // nova extra
                let fotosBadge = badgeWrap.querySelector('.badge.bg-info');
                if(!fotosBadge){
                  fotosBadge = document.createElement('span');
                  fotosBadge.className='badge bg-info';
                  badgeWrap.appendChild(fotosBadge);
                }
                fotosBadge.textContent = `${count} fotos`;
              }
            }
          showToast('Foto extra adicionada!', 'success');
        } catch(err){
          showToast(err.message,'error');
        } finally { btnExtra.disabled=false; btnExtra.textContent='Adicionar Foto Extra'; }
      };
      input.click();
      return;
    }
  });
(function darkModeSetup(){
  if(document.getElementById('darkModeStyles')) return;
  const st = document.createElement('style');
  st.id='darkModeStyles';
  st.textContent = `body.dark-mode{background:#121212;color:#e0e0e0;}body.dark-mode header.municipal-header,body.dark-mode #adminHeader{box-shadow:0 2px 10px rgba(0,0,0,.6);}body.dark-mode table{background:#1e1e1e;color:#ddd;}body.dark-mode thead th{background:#2a2f33!important;color:#eee;}body.dark-mode .dataTables_wrapper .dataTables_paginate .paginate_button{color:#fff!important;}body.dark-mode .btn,body.dark-mode .dataTables_wrapper .dt-buttons .dt-button{background:#2d3439;color:#eee;border-color:#444;}body.dark-mode .dt-button:hover{background:#3a444b!important;color:#fff;}body.dark-mode .modal-dialog{background:#1f1f1f!important;color:#f1f1f1;}body.dark-mode .prop-lightbox{background:rgba(0,0,0,.9);}body.dark-mode .bike-preview{color:#ccc;}`;
  document.head.appendChild(st);
  document.addEventListener('click', e=>{
    if(e.target && e.target.id==='btnToggleDark'){
      document.body.classList.toggle('dark-mode');
      e.target.textContent = document.body.classList.contains('dark-mode')? 'Modo Claro':'Modo Escuro';
    }
  });
})();

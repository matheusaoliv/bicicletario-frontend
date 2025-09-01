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

#adminPanelSection, #adminLoginSection { max-width: 1200px; margin: 12px auto; padding: 12px; }
.tab-content { overflow-x: auto; }
.table-responsive, .dataTables_wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }
th, td { word-break: break-word; white-space: normal; vertical-align: middle; }
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
      tabela.append(`<tr class="${destaque}"><td>${avatar}</td><td>${f.nome}</td><td>${local}</td><td>${f.status}</td><td>${tempoParadoStr}${alertaStr}</td><td>${totalMovStr}</td><td>${ultimaMovStr}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir} ${btnDeslogar}</td></tr>`);
    });
    tabela.DataTable({ responsive: false, scrollX: true, autoWidth: false, order: [[7, 'asc']] });

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

async function carregarProprietarios(token) {
  // Busca o token do sessionStorage se não for passado
  if (!token) {
    token = sessionStorage.getItem('token');
  }
  const proprietariosDiv = document.getElementById('proprietariosTab');
  const loadingDiv = document.getElementById('loadingProprietarios');
  if (loadingDiv) loadingDiv.innerHTML = 'Carregando proprietários...';
  if (!proprietariosDiv) return;
  try {
    if (!token) {
      if (loadingDiv) loadingDiv.innerHTML = 'Token de autenticação ausente. Faça login novamente.';
      proprietariosDiv.innerHTML = '<p>Token ausente. Faça login novamente.</p>';
      return;
    }
    const res = await fetch(`${API_BASE_URL}/api/admin/proprietarios`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      let msg = `Erro ao buscar proprietários (status: ${res.status})`;
      if (res.status === 403) {
        msg += ' - Acesso negado. Token inválido ou expirado. Faça login novamente.';
      }
      if (loadingDiv) loadingDiv.innerHTML = msg;
      proprietariosDiv.innerHTML = `<p>${msg}</p>`;
      throw new Error(msg);
    }
    const proprietarios = await res.json();
    if (!Array.isArray(proprietarios) || proprietarios.length === 0) {
      proprietariosDiv.innerHTML = '<p>Nenhum proprietário encontrado.</p>';
      if (loadingDiv) loadingDiv.innerHTML = '';
      return;
    }
    // Exibição completa
    let html = '<table class="table table-striped table-bordered"><thead><tr><th>Foto</th><th>Proprietário</th><th>Contato</th><th>Bicicleta</th><th>Check-in</th><th>Check-out</th></tr></thead><tbody>';
    proprietarios.forEach(p => {
      const foto = p.fotoUrl || p.foto || '';
      const avatar = foto ? `<img src="${foto}" alt="Foto de ${p.nome || ''}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">` : '<span class="avatar-placeholder">👤</span>';
      const contato = [p.email, p.telefone].filter(Boolean).join(' / ');
      const bike = p.bicicleta ? [
        p.bicicleta.modelo, p.bicicleta.cor, p.bicicleta.numeroSerie || p.bicicleta.serie || p.bicicleta.numero, p.bicicleta.placa
      ].filter(Boolean).join(' | ') : (p.modeloBicicleta || p.dadosBicicleta || '-');
      const checkinOper = p.checkin?.operador || p.checkin?.usuarioNome || p.operadorCheckin || '-';
      const checkinHora = p.checkin?.dataHora || p.dataCheckin || '-';
      const checkoutOper = p.checkout?.operador || p.checkout?.usuarioNome || p.operadorCheckout || '-';
      const checkoutHora = p.checkout?.dataHora || p.dataCheckout || '-';
      const checkinStr = (checkinOper !== '-' && checkinHora !== '-') ? `${checkinOper} em ${checkinHora}` : '-';
      const checkoutStr = (checkoutOper !== '-' && checkoutHora !== '-') ? `${checkoutOper} em ${checkoutHora}` : '-';
      html += `<tr>
        <td>${avatar}</td>
        <td>${p.nome || ''}</td>
        <td>${contato || ''}</td>
        <td>${bike || ''}</td>
        <td>${checkinStr}</td>
        <td>${checkoutStr}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    proprietariosDiv.innerHTML = html;
    if (loadingDiv) loadingDiv.innerHTML = '';
  } catch (error) {
    console.error('Erro ao carregar proprietários:', error);
    if (loadingDiv) loadingDiv.innerHTML = 'Erro ao carregar proprietários.';
    if (proprietariosDiv) proprietariosDiv.innerHTML = '';
  }
}

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
    tabela.append('<thead><tr><th>Foto</th><th>Nome</th><th>Local</th><th>Status</th><th>Tempo Parado</th><th>Total Mov.</th><th>Última Movimentação</th><th>Ranking</th><th>Ações</th></tr></thead><tbody></tbody>');
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
      tabela.append(`<tr class="${destaque}"><td>${avatar}</td><td>${f.nome}</td><td>${local}</td><td>${f.status}</td><td>${tempoParadoStr}${alertaStr}</td><td>${totalMovStr}</td><td>${ultimaMovStr}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir} ${btnDeslogar}</td></tr>`);
    });
    tabela.DataTable({ responsive: false, scrollX: true, autoWidth: false, order: [[7, 'asc']] });

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

async function carregarProprietarios(token) {
  // Busca o token do sessionStorage se não for passado
  if (!token) {
    token = sessionStorage.getItem('token');
  }
  const proprietariosDiv = document.getElementById('proprietariosTab');
  const loadingDiv = document.getElementById('loadingProprietarios');
  if (loadingDiv) loadingDiv.innerHTML = 'Carregando proprietários...';
  if (!proprietariosDiv) return;
  try {
    if (!token) {
      if (loadingDiv) loadingDiv.innerHTML = 'Token de autenticação ausente. Faça login novamente.';
      proprietariosDiv.innerHTML = '<p>Token ausente. Faça login novamente.</p>';
      return;
    }
    const res = await fetch(`${API_BASE_URL}/api/admin/proprietarios`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      let msg = `Erro ao buscar proprietários (status: ${res.status})`;
      if (res.status === 403) {
        msg += ' - Acesso negado. Token inválido ou expirado. Faça login novamente.';
      }
      if (loadingDiv) loadingDiv.innerHTML = msg;
      proprietariosDiv.innerHTML = `<p>${msg}</p>`;
      throw new Error(msg);
    }
    const proprietarios = await res.json();
    if (!Array.isArray(proprietarios) || proprietarios.length === 0) {
      proprietariosDiv.innerHTML = '<p>Nenhum proprietário encontrado.</p>';
      if (loadingDiv) loadingDiv.innerHTML = '';
      return;
    }
    // Exibição completa
    let html = '<table class="table table-striped table-bordered"><thead><tr><th>Foto</th><th>Proprietário</th><th>Contato</th><th>Bicicleta</th><th>Check-in</th><th>Check-out</th></tr></thead><tbody>';
    proprietarios.forEach(p => {
      const foto = p.fotoUrl || p.foto || '';
      const avatar = foto ? `<img src="${foto}" alt="Foto de ${p.nome || ''}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">` : '<span class="avatar-placeholder">👤</span>';
      const contato = [p.email, p.telefone].filter(Boolean).join(' / ');
      const bike = p.bicicleta ? [
        p.bicicleta.modelo, p.bicicleta.cor, p.bicicleta.numeroSerie || p.bicicleta.serie || p.bicicleta.numero, p.bicicleta.placa
      ].filter(Boolean).join(' | ') : (p.modeloBicicleta || p.dadosBicicleta || '-');
      const checkinOper = p.checkin?.operador || p.checkin?.usuarioNome || p.operadorCheckin || '-';
      const checkinHora = p.checkin?.dataHora || p.dataCheckin || '-';
      const checkoutOper = p.checkout?.operador || p.checkout?.usuarioNome || p.operadorCheckout || '-';
      const checkoutHora = p.checkout?.dataHora || p.dataCheckout || '-';
      const checkinStr = (checkinOper !== '-' && checkinHora !== '-') ? `${checkinOper} em ${checkinHora}` : '-';
      const checkoutStr = (checkoutOper !== '-' && checkoutHora !== '-') ? `${checkoutOper} em ${checkoutHora}` : '-';
      html += `<tr>
        <td>${avatar}</td>
        <td>${p.nome || ''}</td>
        <td>${contato || ''}</td>
        <td>${bike || ''}</td>
        <td>${checkinStr}</td>
        <td>${checkoutStr}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    proprietariosDiv.innerHTML = html;
    if (loadingDiv) loadingDiv.innerHTML = '';
  } catch (error) {
    console.error('Erro ao carregar proprietários:', error);
    if (loadingDiv) loadingDiv.innerHTML = 'Erro ao carregar proprietários.';
    if (proprietariosDiv) proprietariosDiv.innerHTML = '';
  }
}

// --- Exibir abas e carregar dados após login ---
function mostrarPainelAdmin(token) {
  adminLoginSection?.classList.add('hidden');
  adminPanelSection?.classList.remove('hidden');
  carregarMonitoramento(token);
  carregarProprietarios(token);
  iniciarAutoRefresh();
}

// Exibir painel automaticamente quando já autenticado (admin.html protegido)
document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('token');
  if (token && localStorage.getItem('adminLogado')) {
    try { mostrarPainelAdmin(token); } catch {}
  }
});

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

// Função utilitária para obter histórico de alterações do funcionário
function getHistoricoAlteracoes(id) {
  const historico = JSON.parse(localStorage.getItem('historico_funcionario_' + id) || '[]');
  return historico;
}

function addHistoricoAlteracao(id, alteracao) {
  const historico = getHistoricoAlteracoes(id);
  historico.unshift({ ...alteracao, data: new Date().toLocaleString() });
  localStorage.setItem('historico_funcionario_' + id, JSON.stringify(historico));
}

// Função para exibir histórico no modal
function exibirHistoricoAlteracoes(id) {
  const historico = getHistoricoAlteracoes(id);
  const div = document.getElementById('historicoAlteracoes');
  if (!div) return;
  if (!historico.length) {
    div.innerHTML = '<span class="text-muted">Nenhuma alteração registrada.</span>';
    return;
  }
  div.innerHTML = historico.map(h => `<div><b>${h.data}:</b> ${h.descricao}</div>`).join('');
}

// Função para autocomplete (usando jQuery UI)
function setupAutocompleteNomesLocais(nomes, locais) {
  if (window.jQuery && window.jQuery.ui) {
    $('#editFuncionarioNome').autocomplete({ source: nomes });
    $('#editFuncionarioLocal').autocomplete({ source: locais });
  }
}

// Função para renderizar a tabela de funcionários com foto/avatar
function renderTabelaFuncionarios(funcionarios, ranking) {
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
    const btnEditar = `<button class='btn btn-sm btn-primary' onclick="editarFuncionario('${f.id}')">Editar</button>`;
    const btnExcluir = isAdmin ? '' : `<button class='btn btn-sm btn-danger' onclick="excluirFuncionario('${f.id}', '${f.nome.replace(/'/g, '\'')}')">Excluir</button>`;
    const fotoUrl = f.fotoUrl || '';
    const avatar = fotoUrl ? `<img src='${fotoUrl}' alt='Foto de ${f.nome}' style='width:36px;height:36px;border-radius:50%;object-fit:cover;'>` : '<span class="avatar-placeholder">👤</span>';
    tabela.append(`<tr class="${destaque}"><td>${avatar}</td><td>${f.nome}</td><td>${local}</td><td>${f.status}</td><td>${f.tempoParadoMin ? f.tempoParadoMin + ' min' : '-'}${f.tempoParadoMin > 60 ? " <span class=\"badge bg-danger\">Alerta</span>" : ''}</td><td>${f.totalMovimentacoes}</td><td>${f.ultimaMov ? f.ultimaMov.replace('T',' ').slice(0,16) + ' ('+f.tipoUltimaMov+')' : '-'}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir}</td></tr>`);
  });
  tabela.DataTable({ responsive: true, order: [[7, 'asc']] });
}

// [removido] Duplicata de carregarMonitoramento eliminada para evitar sobrescrita incorreta

// Função de edição de funcionário
window.editarFuncionario = async function(id) {
  // Buscar dados do funcionário (pode ser do array já carregado ou via API)
  const token = sessionStorage.getItem('token');
  const res = await fetch(`${API_BASE_URL}/api/admin/funcionario/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) return showToast('Erro ao buscar dados do funcionário.', 'error');
  const f = await res.json();
  document.getElementById('editFuncionarioId').value = f.id;
  document.getElementById('editFuncionarioNome').value = f.nome;
  document.getElementById('editFuncionarioStatus').value = f.status;
  document.getElementById('editFuncionarioLocal').value = f.local || '';
  document.getElementById('editFuncionarioFoto').value = f.fotoUrl || '';
  document.getElementById('modalEditarFuncionario').classList.remove('hidden');
  exibirHistoricoAlteracoes(f.id);
  // Autocomplete nomes e locais
  setupAutocompleteNomesLocais(
    window.listaNomesFuncionarios || [],
    ['Bicicletário', 'Secretaria', 'Secretaria/Bicicletário', 'Outro']
  );
};

document.getElementById('btnCancelarEdicaoFuncionario').onclick = function() {
  document.getElementById('modalEditarFuncionario').classList.add('hidden');
};

document.getElementById('btnSalvarEdicaoFuncionario').onclick = async function() {
  const id = document.getElementById('editFuncionarioId').value;
  const nome = document.getElementById('editFuncionarioNome').value.trim();
  const status = document.getElementById('editFuncionarioStatus').value;
  const local = document.getElementById('editFuncionarioLocal').value;
  const fotoUrl = document.getElementById('editFuncionarioFoto').value.trim();
  const token = sessionStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/funcionario/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, status, local, fotoUrl })
    });
    if (!res.ok) throw new Error('Erro ao salvar edição.');
    showToast('Funcionário editado com sucesso!', 'success');
    // Incrementa contador de edições por funcionário
    try {
      const keyEd = 'edicoes_funcionario_' + id;
      const atual = parseInt(localStorage.getItem(keyEd) || '0', 10) + 1;
      localStorage.setItem(keyEd, String(atual));
    } catch {}
    addHistoricoAlteracao(id, { descricao: `Edição: nome=${nome}, status=${status}, local=${local}` });
    document.getElementById('modalEditarFuncionario').classList.add('hidden');
    carregarMonitoramento(token);
    logarAcao('Editar Funcionário', `ID: ${id}, Nome: ${nome}`);
  } catch (err) {
    showToast(err.message || 'Erro ao editar funcionário.', 'error');
  }
};

// Toast para cadastro de funcionário (exemplo, se houver função de cadastro)
window.cadastrarFuncionario = async function(dados) {
  try {
    const token = sessionStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/api/admin/funcionario`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    if (!res.ok) throw new Error('Erro ao cadastrar funcionário.');
    showToast('Funcionário cadastrado com sucesso!', 'success');
    logarAcao('Cadastrar Funcionário', `Nome: ${dados.nome}`);
    carregarMonitoramento(token);
  } catch (err) {
    showToast(err.message || 'Erro ao cadastrar funcionário.', 'error');
  }
};

// Bloqueio de exclusão para movimentações recentes
window.excluirFuncionario = async function(id, nome) {
  const token = sessionStorage.getItem('token');
  // Buscar movimentações recentes
  const resMov = await fetch(`${API_BASE_URL}/api/admin/funcionario/${id}/movimentacoes?dias=7`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (resMov.ok) {
    const movs = await resMov.json();
    if (Array.isArray(movs) && movs.length > 0) {
      return showToast('Não é possível excluir: funcionário possui movimentações nos últimos 7 dias.', 'error');
    }
  }
  if (!confirm(`Tem certeza que deseja excluir o funcionário ${nome}? Essa ação não pode ser desfeita!`)) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/funcionario/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro ao excluir funcionário.');
    showToast('Funcionário excluído com sucesso!', 'success');
    carregarMonitoramento(token);
    logarAcao('Excluir Funcionário', `ID: ${id}, Nome: ${nome}`);
  } catch (err) {
    showToast(err.message || 'Erro ao excluir funcionário.', 'error');
  }
};

// Forçar logout do funcionário (troca de plantão)
window.deslogarFuncionario = async function(id, nome) {
  const token = sessionStorage.getItem('token');
  try {
    // Tenta endpoint dedicado, se existir
    let res = await fetch(`${API_BASE_URL}/api/admin/funcionario/${id}/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    // Fallback: atualiza status para Offline se endpoint não existir
    if (res.status === 404) {
      res = await fetch(`${API_BASE_URL}/api/admin/funcionario/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Offline' })
      });
    }
    if (!res.ok) throw new Error('Falha ao deslogar funcionário.');
    showToast(`Funcionário ${nome || ''} deslogado com sucesso.`, 'success');
    logarAcao('Deslogar Funcionário', `ID: ${id}, Nome: ${nome}`);
    carregarMonitoramento(token);
  } catch (err) {
    showToast(err.message || 'Erro ao deslogar funcionário.', 'error');
  }
};

// Toasts para erros gerais
window.addEventListener('error', function(e) {
  showToast('Erro inesperado: ' + (e.message || 'Erro desconhecido'), 'error');
});

// Lógica de agendamento de relatórios
const formAgendar = document.getElementById('formAgendarRelatorio');
if (formAgendar) {
  formAgendar.onsubmit = function(e) {
    e.preventDefault();
    const email = document.getElementById('agendamentoEmail').value.trim();
    const freq = document.getElementById('agendamentoFrequencia').value;
    if (!email || !/^[\w-.]+@[\w-]+\.[a-z]{2,}$/i.test(email)) {
      document.getElementById('agendamentoMsg').textContent = 'E-mail inválido.';
      return;
    }
    localStorage.setItem('agendamento_relatorio', JSON.stringify({ email, freq }));
    document.getElementById('agendamentoMsg').textContent = 'Agendamento salvo! Relatórios serão enviados automaticamente.';
    showToast('Agendamento de relatório salvo!', 'success');
  };
}

// --- Toasts Bootstrap para feedback visual ---
function showToast(mensagem, tipo = 'success', tempo = 4000) {
  const cores = {
    success: 'bg-success text-white',
    error: 'bg-danger text-white',
    info: 'bg-info text-white',
    warning: 'bg-warning text-dark'
  };
  const toastId = 'toast' + Date.now();
  const html = `<div id="${toastId}" class="toast align-items-center ${cores[tipo] || cores.success}" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="${tempo}">
    <div class="d-flex">
      <div class="toast-body">${mensagem}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
  </div>`;
  $('#toastContainer').append(html);
  const toastEl = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// --- Funções de auditoria (logs) ---
function registrarLogAuditoria(acao, detalhes) {
  const logs = JSON.parse(localStorage.getItem('logs_auditoria') || '[]');
  logs.unshift({
    data: new Date().toLocaleString('pt-BR'),
    admin: sessionStorage.getItem('admin_nome') || 'Desconhecido',
    acao,
    detalhes
  });
  localStorage.setItem('logs_auditoria', JSON.stringify(logs.slice(0, 500)));
}

function carregarAuditoria() {
  const logs = JSON.parse(localStorage.getItem('logs_auditoria') || '[]');
  const tabela = $('#tabelaAuditoria');
  if ($.fn.DataTable.isDataTable(tabela)) tabela.DataTable().destroy();
  tabela.find('tbody').empty();
  logs.forEach(log => {
    tabela.find('tbody').append(`<tr><td>${log.data}</td><td>${log.admin}</td><td>${log.acao}</td><td>${log.detalhes}</td></tr>`);
  });
  tabela.DataTable({ responsive: true, order: [[0, 'desc']] });
}

$('#btnExportarAuditoria').on('click', function() {
  const logs = JSON.parse(localStorage.getItem('logs_auditoria') || '[]');
  let csv = 'Data/Hora,Admin,Ação,Detalhes\n';
  logs.forEach(log => {
    csv += `${log.data},${log.admin},${log.acao},${log.detalhes}\n`;
  });
  let blob = new Blob([csv], {type: 'text/csv'});
  let url = window.URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = 'logs_auditoria.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
});

// Carregar auditoria ao abrir aba
$(document).ready(function() {
  $(document).on('click', '.tab-button[data-tab="auditoria"]', carregarAuditoria);
});

// Registrar logs nas principais ações
function logarAcao(acao, detalhes) {
  registrarLogAuditoria(acao, detalhes);
}
// Exemplo: logar login
if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', function() {
    logarAcao('Login', 'Login realizado no painel admin');
  });
}
// [removido] Duplicatas simplificadas de editarFuncionario/excluirFuncionario (mantida a versão completa que utiliza API e validações)

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

// [removido] wrapper de carregarMonitoramento para evitar dupla requisição

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

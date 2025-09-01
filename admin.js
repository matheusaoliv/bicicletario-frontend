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

// Logout funcional
const logoutBtn = document.getElementById('logoutAdmin');
if (logoutBtn) {
  logoutBtn.addEventListener('click', function(e) {
    e.preventDefault();
    localStorage.removeItem('adminLogado');
    window.location.href = 'admin-login.html';
  });
}

const modalEmail = document.getElementById('modalEmail');
const inputEmail = document.getElementById('inputEmail');
const btnSalvarEmail = document.getElementById('btnSalvarEmail');

let adminEmail = null;
let adminNome = null;

// --- Autenticação restrita ---
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
    adminLoginSection.classList.add('hidden');
    adminPanelSection.classList.remove('hidden');
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

    // Verificação defensiva para o canvas
    const canvasProd = document.getElementById('graficoProdutividade');
    if (!canvasProd) {
      if (loadingDiv) loadingDiv.innerHTML = 'Erro: Canvas de produtividade não encontrado.';
      return;
    }
    const ctxProd = canvasProd.getContext('2d');
    const dias = Object.keys(fluxoPorDia).sort();
    const datasetsProd = [];
    funcionarios.forEach(f => {
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
    window.graficoRanking = new Chart(ctxRank, {
      type: 'bar',
      data: { labels: ranking.map(f => f.nome), datasets: [{ label: 'Movimentações', data: ranking.map(f => f.totalMovimentacoes), backgroundColor: 'rgba(75,192,192,0.7)' }] },
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
      const btnEditar = `<button class='btn btn-sm btn-primary' onclick="editarFuncionario('${f.id}')">Editar</button>`;
      const btnExcluir = isAdmin ? '' : `<button class='btn btn-sm btn-danger' onclick="excluirFuncionario('${f.id}', '${f.nome.replace(/'/g, '\'')}')">Excluir</button>`;
      const fotoUrl = f.fotoUrl || '';
      const avatar = fotoUrl ? `<img src='${fotoUrl}' alt='Foto de ${f.nome}' style='width:36px;height:36px;border-radius:50%;object-fit:cover;'>` : '<span class="avatar-placeholder">👤</span>';
      tabela.append(`<tr class="${destaque}"><td>${avatar}</td><td>${f.nome}</td><td>${local}</td><td>${f.status}</td><td>${f.tempoParadoMin ? f.tempoParadoMin + ' min' : '-'}${f.tempoParadoMin > 60 ? " <span class=\"badge bg-danger\">Alerta</span>" : ''}</td><td>${f.totalMovimentacoes}</td><td>${f.ultimaMov ? f.ultimaMov.replace('T',' ').slice(0,16) + ' ('+f.tipoUltimaMov+')' : '-'}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir}</td></tr>`);
    });
    tabela.DataTable({ responsive: true, order: [[7, 'asc']] });

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
    // Exemplo simples de exibição
    let html = '<table><tr><th>Nome</th><th>Email</th></tr>';
    proprietarios.forEach(p => {
      html += `<tr><td>${p.nome || ''}</td><td>${p.email || ''}</td></tr>`;
    });
    html += '</table>';
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
    const datasetsProd = [];
    funcionarios.forEach(f => {
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
    window.graficoRanking = new Chart(ctxRank, {
      type: 'bar',
      data: { labels: ranking.map(f => f.nome), datasets: [{ label: 'Movimentações', data: ranking.map(f => f.totalMovimentacoes), backgroundColor: 'rgba(75,192,192,0.7)' }] },
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
      const btnEditar = `<button class='btn btn-sm btn-primary' onclick="editarFuncionario('${f.id}')">Editar</button>`;
      const btnExcluir = isAdmin ? '' : `<button class='btn btn-sm btn-danger' onclick="excluirFuncionario('${f.id}', '${f.nome.replace(/'/g, '\'')}')">Excluir</button>`;
      const fotoUrl = f.fotoUrl || '';
      const avatar = fotoUrl ? `<img src='${fotoUrl}' alt='Foto de ${f.nome}' style='width:36px;height:36px;border-radius:50%;object-fit:cover;'>` : '<span class="avatar-placeholder">👤</span>';
      tabela.append(`<tr class="${destaque}"><td>${avatar}</td><td>${f.nome}</td><td>${local}</td><td>${f.status}</td><td>${f.tempoParadoMin ? f.tempoParadoMin + ' min' : '-'}${f.tempoParadoMin > 60 ? " <span class=\"badge bg-danger\">Alerta</span>" : ''}</td><td>${f.totalMovimentacoes}</td><td>${f.ultimaMov ? f.ultimaMov.replace('T',' ').slice(0,16) + ' ('+f.tipoUltimaMov+')' : '-'}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir}</td></tr>`);
    });
    tabela.DataTable({ responsive: true, order: [[7, 'asc']] });

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
    // Exemplo simples de exibição
    let html = '<table><tr><th>Nome</th><th>Email</th></tr>';
    proprietarios.forEach(p => {
      html += `<tr><td>${p.nome || ''}</td><td>${p.email || ''}</td></tr>`;
    });
    html += '</table>';
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
adminLoginForm.addEventListener('submit', function() {
  logarAcao('Login', 'Login realizado no painel admin');
});
// [removido] Duplicatas simplificadas de editarFuncionario/excluirFuncionario (mantida a versão completa que utiliza API e validações)

// --- Logout admin ---
const logoutAdmin = document.getElementById('logoutAdmin');
if (logoutAdmin) {
  logoutAdmin.onclick = (e) => {
    e.preventDefault();
    sessionStorage.clear();
    localStorage.removeItem('adminLogado');
    window.location.href = 'admin-login.html';
  };
}

// [removido] Duplicata de editar/salvar/excluir funcionário para manter uma única fonte de verdade

// --- Guardar último monitoramento para edição ---
const _carregarMonitoramento = carregarMonitoramento;
carregarMonitoramento = async function(token) {
  await _carregarMonitoramento(token);
  // Guarda a lista de funcionários para edição
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/monitoramento`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const { funcionarios } = await res.json();
      window.ultimoMonitoramento = funcionarios;
    }
  } catch {}
};

// --- Busca, filtros e exportação na tabela de funcionários ---
$(document).ready(function() {
  // Busca global
  $('#buscaFuncionario').on('keyup', function() {
    $('#tabelaMonitoramento').DataTable().search(this.value).draw();
  });
  // Filtros por local e status
  $('#filtroLocal, #filtroStatus').on('change', function() {
    let local = $('#filtroLocal').val();
    let status = $('#filtroStatus').val();
    let table = $('#tabelaMonitoramento').DataTable();
    table.columns(1).search(local).columns(2).search(status).draw();
  });
  // Filtro por período (última movimentação)
  $('#filtroDataInicio, #filtroDataFim').on('change', function() {
    let inicio = $('#filtroDataInicio').val();
    let fim = $('#filtroDataFim').val();
    let table = $('#tabelaMonitoramento').DataTable();
    table.draw();
  });
  // Custom filter para período
  $.fn.dataTable.ext.search.push(function(settings, data) {
    let inicio = $('#filtroDataInicio').val();
    let fim = $('#filtroDataFim').val();
    let dataUltimaMov = data[5] ? data[5].split(' ')[0] : '';
    if (!inicio && !fim) return true;
    if (inicio && dataUltimaMov < inicio) return false;
    if (fim && dataUltimaMov > fim) return false;
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

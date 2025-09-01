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

const adminLoginSection = document.getElementById('adminLoginSection');
const adminPanelSection = document.getElementById('adminPanelSection');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminLoginMsg = document.getElementById('adminLoginMsg');
const adminMsg = document.getElementById('adminMsg');
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
    tabela.append('<thead><tr><th>Nome</th><th>Local</th><th>Status</th><th>Tempo Parado</th><th>Total Mov.</th><th>Última Movimentação</th><th>Ranking</th><th>Ações</th></tr></thead><tbody></tbody>');
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
      tabela.append(`<tr class="${destaque}"><td>${f.nome}</td><td>${local}</td><td>${f.status}</td><td>${f.tempoParadoMin ? f.tempoParadoMin + ' min' : '-'}${f.tempoParadoMin > 60 ? ' <span class='badge bg-danger'>Alerta</span>' : ''}</td><td>${f.totalMovimentacoes}</td><td>${f.ultimaMov ? f.ultimaMov.replace('T',' ').slice(0,16) + ' ('+f.tipoUltimaMov+')' : '-'}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir}</td></tr>`);
    });
    tabela.DataTable({ responsive: true, order: [[6, 'asc']] });

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
    tabela.append('<thead><tr><th>Nome</th><th>Local</th><th>Status</th><th>Tempo Parado</th><th>Total Mov.</th><th>Última Movimentação</th><th>Ranking</th><th>Ações</th></tr></thead><tbody></tbody>');
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
      tabela.append(`<tr class="${destaque}"><td>${f.nome}</td><td>${local}</td><td>${f.status}</td><td>${f.tempoParadoMin ? f.tempoParadoMin + ' min' : '-'}${f.tempoParadoMin > 60 ? ' <span class='badge bg-danger'>Alerta</span>' : ''}</td><td>${f.totalMovimentacoes}</td><td>${f.ultimaMov ? f.ultimaMov.replace('T',' ').slice(0,16) + ' ('+f.tipoUltimaMov+')' : '-'}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir}</td></tr>`);
    });
    tabela.DataTable({ responsive: true, order: [[6, 'asc']] });

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
    tabela.append('<thead><tr><th>Nome</th><th>Local</th><th>Status</th><th>Tempo Parado</th><th>Total Mov.</th><th>Última Movimentação</th><th>Ranking</th><th>Ações</th></tr></thead><tbody></tbody>');
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
      tabela.append(`<tr class="${destaque}"><td>${f.nome}</td><td>${local}</td><td>${f.status}</td><td>${f.tempoParadoMin ? f.tempoParadoMin + ' min' : '-'}${f.tempoParadoMin > 60 ? ' <span class='badge bg-danger'>Alerta</span>' : ''}</td><td>${f.totalMovimentacoes}</td><td>${f.ultimaMov ? f.ultimaMov.replace('T',' ').slice(0,16) + ' ('+f.tipoUltimaMov+')' : '-'}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td><td>${btnEditar} ${btnExcluir}</td></tr>`);
    });
    tabela.DataTable({ responsive: true, order: [[6, 'asc']] });

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

// --- Logout admin ---
const logoutAdmin = document.getElementById('logoutAdmin');
if (logoutAdmin) {
  logoutAdmin.onclick = () => {
    sessionStorage.clear();
    window.location.href = 'area-funcionario.html';
  };
}

// Funções para editar/excluir funcionário
function editarFuncionario(id) {
  alert('Função de edição de funcionário em desenvolvimento. ID: ' + id);
  // Aqui pode abrir um modal para edição
}
function excluirFuncionario(id, nome) {
  if (confirm('Tem certeza que deseja excluir o funcionário ' + nome + '? Essa ação não pode ser desfeita!')) {
    // Aqui você pode fazer uma requisição para o backend para excluir
    alert('Função de exclusão em desenvolvimento. ID: ' + id);
  }
}

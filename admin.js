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
  const monitoramentoDiv = document.getElementById('monitoramentoTab'); // Corrigido o id
  if (!monitoramentoDiv) return;
  monitoramentoDiv.innerHTML = '<p>Carregando monitoramento...</p>';
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/monitoramento`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro ao buscar monitoramento');
    const { funcionarios, ranking, fluxoPorDia, fluxoPorFuncionarioPorDia } = await res.json();

    // Gráfico de produtividade (check-ins/check-outs por dia por funcionário)
    const ctxProd = document.getElementById('graficoProdutividade').getContext('2d');
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
    if(window.graficoProdutividade) window.graficoProdutividade.destroy();
    window.graficoProdutividade = new Chart(ctxProd, {
      type: 'bar',
      data: { labels: dias, datasets: datasetsProd },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // Gráfico de ranking
    const ctxRank = document.getElementById('graficoRanking').getContext('2d');
    const nomesRanking = ranking.map(f => f.nome);
    const movsRanking = ranking.map(f => f.totalMovimentacoes);
    if(window.graficoRanking) window.graficoRanking.destroy();
    window.graficoRanking = new Chart(ctxRank, {
      type: 'bar',
      data: { labels: nomesRanking, datasets: [{ label: 'Movimentações', data: movsRanking, backgroundColor: 'rgba(75,192,192,0.7)' }] },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }
    });

    // Gráfico de fluxo geral
    const ctxFluxo = document.getElementById('graficoFluxo').getContext('2d');
    const checkinsFluxo = dias.map(d => fluxoPorDia[d]?.checkins || 0);
    const checkoutsFluxo = dias.map(d => fluxoPorDia[d]?.checkouts || 0);
    if(window.graficoFluxo) window.graficoFluxo.destroy();
    window.graficoFluxo = new Chart(ctxFluxo, {
      type: 'line',
      data: { labels: dias, datasets: [
        { label: 'Check-ins', data: checkinsFluxo, borderColor: 'rgba(54,162,235,1)', backgroundColor: 'rgba(54,162,235,0.2)', fill: true },
        { label: 'Check-outs', data: checkoutsFluxo, borderColor: 'rgba(255,99,132,1)', backgroundColor: 'rgba(255,99,132,0.2)', fill: true }
      ] },
      options: { responsive: true }
    });

    // Tabela dinâmica de funcionários
    const tabela = $('#tabelaMonitoramento');
    if ($.fn.DataTable.isDataTable(tabela)) tabela.DataTable().destroy();
    tabela.empty();
    tabela.append('<thead><tr><th>Nome</th><th>Status</th><th>Tempo Parado</th><th>Total Mov.</th><th>Última Movimentação</th><th>Ranking</th></tr></thead><tbody></tbody>');
    funcionarios.forEach((f, idx) => {
      const destaque = f.status === 'Parado' ? 'table-danger' : '';
      tabela.append(`<tr class="${destaque}"><td>${f.nome}</td><td>${f.status}</td><td>${f.tempoParadoMin ? f.tempoParadoMin + ' min' : '-'}${f.tempoParadoMin > 60 ? ' <span class=\'badge bg-danger\'>Alerta</span>' : ''}</td><td>${f.totalMovimentacoes}</td><td>${f.ultimaMov ? f.ultimaMov.replace('T',' ').slice(0,16) + ' ('+f.tipoUltimaMov+')' : '-'}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td></tr>`);
    });
    tabela.DataTable({ responsive: true, order: [[5, 'asc']] });

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

    monitoramentoDiv.innerHTML = '';
    document.getElementById('tabelaMonitoramentoContainer').style.display = 'block';
    document.getElementById('justificativasContainer').style.display = 'block';
  } catch (err) {
    monitoramentoDiv.innerHTML = `<p class="erro">Erro ao carregar monitoramento: ${err.message}</p>`;
  }
}

async function carregarProprietarios(token) {
  const proprietariosDiv = document.getElementById('proprietariosTab');
  proprietariosDiv.innerHTML = '<p>Carregando proprietários...</p>';
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/proprietarios`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro ao buscar proprietários');
    const proprietarios = await res.json();
    let html = '<div class="lista-proprietarios">';
    proprietarios.forEach(p => {
      html += `<div class="proprietario-card"><h4>${p.nome_completo} (CPF: ${p.cpf})</h4>`;
      (p.bicicletas||[]).forEach(b => {
        html += `<div class="bicicleta-card"><b>Bicicleta:</b> ${b.numero_identificacao} - ${b.marca} ${b.modelo} (${b.tipo_bike})<br>`;
        html += '<b>Histórico:</b><ul>';
        (b.historico||[]).forEach(h => {
          html += `<li>Entrada: ${h.data_hora_entrada || '-'} (${h.funcionario_entrada || '-'})<br>Saída: ${h.data_hora_saida || '-'} (${h.funcionario_saida || '-'})</li>`;
        });
        html += '</ul></div>';
      });
      html += '</div>';
    });
    html += '</div>';
    proprietariosDiv.innerHTML = html;
  } catch (err) {
    proprietariosDiv.innerHTML = `<p class="erro">Erro ao carregar proprietários: ${err.message}</p>`;
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
  const monitoramentoDiv = document.getElementById('monitoramentoTab'); // Corrigido o id
  if (!monitoramentoDiv) return;
  monitoramentoDiv.innerHTML = '<p>Carregando monitoramento...</p>';
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/monitoramento`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro ao buscar monitoramento');
    const { funcionarios, ranking, fluxoPorDia, fluxoPorFuncionarioPorDia } = await res.json();

    // Gráfico de produtividade (check-ins/check-outs por dia por funcionário)
    const ctxProd = document.getElementById('graficoProdutividade').getContext('2d');
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
    if(window.graficoProdutividade) window.graficoProdutividade.destroy();
    window.graficoProdutividade = new Chart(ctxProd, {
      type: 'bar',
      data: { labels: dias, datasets: datasetsProd },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // Gráfico de ranking
    const ctxRank = document.getElementById('graficoRanking').getContext('2d');
    const nomesRanking = ranking.map(f => f.nome);
    const movsRanking = ranking.map(f => f.totalMovimentacoes);
    if(window.graficoRanking) window.graficoRanking.destroy();
    window.graficoRanking = new Chart(ctxRank, {
      type: 'bar',
      data: { labels: nomesRanking, datasets: [{ label: 'Movimentações', data: movsRanking, backgroundColor: 'rgba(75,192,192,0.7)' }] },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }
    });

    // Gráfico de fluxo geral
    const ctxFluxo = document.getElementById('graficoFluxo').getContext('2d');
    const checkinsFluxo = dias.map(d => fluxoPorDia[d]?.checkins || 0);
    const checkoutsFluxo = dias.map(d => fluxoPorDia[d]?.checkouts || 0);
    if(window.graficoFluxo) window.graficoFluxo.destroy();
    window.graficoFluxo = new Chart(ctxFluxo, {
      type: 'line',
      data: { labels: dias, datasets: [
        { label: 'Check-ins', data: checkinsFluxo, borderColor: 'rgba(54,162,235,1)', backgroundColor: 'rgba(54,162,235,0.2)', fill: true },
        { label: 'Check-outs', data: checkoutsFluxo, borderColor: 'rgba(255,99,132,1)', backgroundColor: 'rgba(255,99,132,0.2)', fill: true }
      ] },
      options: { responsive: true }
    });

    // Tabela dinâmica de funcionários
    const tabela = $('#tabelaMonitoramento');
    if ($.fn.DataTable.isDataTable(tabela)) tabela.DataTable().destroy();
    tabela.empty();
    tabela.append('<thead><tr><th>Nome</th><th>Status</th><th>Tempo Parado</th><th>Total Mov.</th><th>Última Movimentação</th><th>Ranking</th></tr></thead><tbody></tbody>');
    funcionarios.forEach((f, idx) => {
      const destaque = f.status === 'Parado' ? 'table-danger' : '';
      tabela.append(`<tr class="${destaque}"><td>${f.nome}</td><td>${f.status}</td><td>${f.tempoParadoMin ? f.tempoParadoMin + ' min' : '-'}${f.tempoParadoMin > 60 ? ' <span class=\'badge bg-danger\'>Alerta</span>' : ''}</td><td>${f.totalMovimentacoes}</td><td>${f.ultimaMov ? f.ultimaMov.replace('T',' ').slice(0,16) + ' ('+f.tipoUltimaMov+')' : '-'}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td></tr>`);
    });
    tabela.DataTable({ responsive: true, order: [[5, 'asc']] });

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

    monitoramentoDiv.innerHTML = '';
    document.getElementById('tabelaMonitoramentoContainer').style.display = 'block';
    document.getElementById('justificativasContainer').style.display = 'block';
  } catch (err) {
    monitoramentoDiv.innerHTML = `<p class="erro">Erro ao carregar monitoramento: ${err.message}</p>`;
  }
}

async function carregarProprietarios(token) {
  const proprietariosDiv = document.getElementById('proprietariosTab');
  proprietariosDiv.innerHTML = '<p>Carregando proprietários...</p>';
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/proprietarios`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro ao buscar proprietários');
    const proprietarios = await res.json();
    let html = '<div class="lista-proprietarios">';
    proprietarios.forEach(p => {
      html += `<div class="proprietario-card"><h4>${p.nome_completo} (CPF: ${p.cpf})</h4>`;
      (p.bicicletas||[]).forEach(b => {
        html += `<div class="bicicleta-card"><b>Bicicleta:</b> ${b.numero_identificacao} - ${b.marca} ${b.modelo} (${b.tipo_bike})<br>`;
        html += '<b>Histórico:</b><ul>';
        (b.historico||[]).forEach(h => {
          html += `<li>Entrada: ${h.data_hora_entrada || '-'} (${h.funcionario_entrada || '-'})<br>Saída: ${h.data_hora_saida || '-'} (${h.funcionario_saida || '-'})</li>`;
        });
        html += '</ul></div>';
      });
      html += '</div>';
    });
    html += '</div>';
    proprietariosDiv.innerHTML = html;
  } catch (err) {
    proprietariosDiv.innerHTML = `<p class="erro">Erro ao carregar proprietários: ${err.message}</p>`;
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
  const monitoramentoDiv = document.getElementById('monitoramentoTab'); // Corrigido o id
  if (!monitoramentoDiv) return;
  monitoramentoDiv.innerHTML = '<p>Carregando monitoramento...</p>';
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/monitoramento`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro ao buscar monitoramento');
    const { funcionarios, ranking, fluxoPorDia, fluxoPorFuncionarioPorDia } = await res.json();

    // Gráfico de produtividade (check-ins/check-outs por dia por funcionário)
    const ctxProd = document.getElementById('graficoProdutividade').getContext('2d');
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
    if(window.graficoProdutividade) window.graficoProdutividade.destroy();
    window.graficoProdutividade = new Chart(ctxProd, {
      type: 'bar',
      data: { labels: dias, datasets: datasetsProd },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // Gráfico de ranking
    const ctxRank = document.getElementById('graficoRanking').getContext('2d');
    const nomesRanking = ranking.map(f => f.nome);
    const movsRanking = ranking.map(f => f.totalMovimentacoes);
    if(window.graficoRanking) window.graficoRanking.destroy();
    window.graficoRanking = new Chart(ctxRank, {
      type: 'bar',
      data: { labels: nomesRanking, datasets: [{ label: 'Movimentações', data: movsRanking, backgroundColor: 'rgba(75,192,192,0.7)' }] },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }
    });

    // Gráfico de fluxo geral
    const ctxFluxo = document.getElementById('graficoFluxo').getContext('2d');
    const checkinsFluxo = dias.map(d => fluxoPorDia[d]?.checkins || 0);
    const checkoutsFluxo = dias.map(d => fluxoPorDia[d]?.checkouts || 0);
    if(window.graficoFluxo) window.graficoFluxo.destroy();
    window.graficoFluxo = new Chart(ctxFluxo, {
      type: 'line',
      data: { labels: dias, datasets: [
        { label: 'Check-ins', data: checkinsFluxo, borderColor: 'rgba(54,162,235,1)', backgroundColor: 'rgba(54,162,235,0.2)', fill: true },
        { label: 'Check-outs', data: checkoutsFluxo, borderColor: 'rgba(255,99,132,1)', backgroundColor: 'rgba(255,99,132,0.2)', fill: true }
      ] },
      options: { responsive: true }
    });

    // Tabela dinâmica de funcionários
    const tabela = $('#tabelaMonitoramento');
    if ($.fn.DataTable.isDataTable(tabela)) tabela.DataTable().destroy();
    tabela.empty();
    tabela.append('<thead><tr><th>Nome</th><th>Status</th><th>Tempo Parado</th><th>Total Mov.</th><th>Última Movimentação</th><th>Ranking</th></tr></thead><tbody></tbody>');
    funcionarios.forEach((f, idx) => {
      const destaque = f.status === 'Parado' ? 'table-danger' : '';
      tabela.append(`<tr class="${destaque}"><td>${f.nome}</td><td>${f.status}</td><td>${f.tempoParadoMin ? f.tempoParadoMin + ' min' : '-'}${f.tempoParadoMin > 60 ? ' <span class=\'badge bg-danger\'>Alerta</span>' : ''}</td><td>${f.totalMovimentacoes}</td><td>${f.ultimaMov ? f.ultimaMov.replace('T',' ').slice(0,16) + ' ('+f.tipoUltimaMov+')' : '-'}</td><td>${ranking.findIndex(r => r.id === f.id) + 1}</td></tr>`);
    });
    tabela.DataTable({ responsive: true, order: [[5, 'asc']] });

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

    monitoramentoDiv.innerHTML = '';
    document.getElementById('tabelaMonitoramentoContainer').style.display = 'block';
    document.getElementById('justificativasContainer').style.display = 'block';
  } catch (err) {
    monitoramentoDiv.innerHTML = `<p class="erro">Erro ao carregar monitoramento: ${err.message}</p>`;
  }
}

async function carregarProprietarios(token) {
  const proprietariosDiv = document.getElementById('proprietariosTab');
  proprietariosDiv.innerHTML = '<p>Carregando proprietários...</p>';
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/proprietarios`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro ao buscar proprietários');
    const proprietarios = await res.json();
    let html = '<div class="lista-proprietarios">';
    proprietarios.forEach(p => {
      html += `<div class="proprietario-card"><h4>${p.nome_completo} (CPF: ${p.cpf})</h4>`;
      (p.bicicletas||[]).forEach(b => {
        html += `<div class="bicicleta-card"><b>Bicicleta:</b> ${b.numero_identificacao} - ${b.marca} ${b.modelo} (${b.tipo_bike})<br>`;
        html += '<b>Histórico:</b><ul>';
        (b.historico||[]).forEach(h => {
          html += `<li>Entrada: ${h.data_hora_entrada || '-'} (${h.funcionario_entrada || '-'})<br>Saída: ${h.data_hora_saida || '-'} (${h.funcionario_saida || '-'})</li>`;
        });
        html += '</ul></div>';
      });
      html += '</div>';
    });
    html += '</div>';
    proprietariosDiv.innerHTML = html;
  } catch (err) {
    proprietariosDiv.innerHTML = `<p class="erro">Erro ao carregar proprietários: ${err.message}</p>`;
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

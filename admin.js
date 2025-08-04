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
  // Chama API de login já existente
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome_usuario: login, senha })
    });
    if (!res.ok) throw new Error('Login ou senha incorretos.');
    const data = await res.json();
    // Verifica se o nome do usuário autenticado bate com o selecionado
    function capitalizeNome(str) {
      return str.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    }
    const nomeSelecionado = nome.trim();
    const nomeBanco = data.funcionario?.nome_completo?.trim() || data.nome_completo?.trim() || '';
    // Verificar se o nome selecionado está contido no nome do banco ou vice-versa
    const nomeB = nomeBanco.toLowerCase().trim();
    const nomeS = nomeSelecionado.toLowerCase().trim();
    
    if (
      nomeB.includes(nomeS) || nomeS.includes(nomeB) ||
      nomeB === nomeS
    ) {
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('admin_nome', nome);
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
        carregarMonitoramento();
      }
    } else {
      adminLoginMsg.textContent = 'Usuário autenticado não corresponde ao administrador selecionado.';
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
async function carregarMonitoramento() {
  // Chama API de relatório/monitoramento
  try {
    const token = sessionStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/api/admin/monitoramento`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Falha ao obter dados de monitoramento.');
    const monitoramento = await res.json();
    exibirMonitoramento(monitoramento);
  } catch (err) {
    document.getElementById('monitoramento').textContent = err.message;
  }
}

function exibirMonitoramento(dados) {
  const div = document.getElementById('monitoramento');
  
  // Verificar se é a nova estrutura com funcionarios/administradores
  let funcionarios = [];
  let administradores = [];
  
  if (dados && dados.funcionarios && dados.administradores) {
    // Nova estrutura
    funcionarios = dados.funcionarios || [];
    administradores = dados.administradores || [];
  } else if (Array.isArray(dados)) {
    // Estrutura antiga (compatibilidade)
    funcionarios = dados;
  } else {
    div.innerHTML = '<p>Nenhum registro encontrado para o período.</p>';
    return;
  }
  
  const todosFuncionarios = [...funcionarios, ...administradores];
  
  if (todosFuncionarios.length === 0) {
    div.innerHTML = '<p>Nenhum registro encontrado para o período.</p>';
    return;
  }
  // Criar seções separadas para administradores e funcionários
  let html = '';
  
  if (administradores.length > 0) {
    html += '<h3 style="color: #1976d2; margin-top: 20px;">👑 Administradores</h3>';
    html += administradores.map(item => criarCardFuncionario(item)).join('');
  }
  
  if (funcionarios.length > 0) {
    html += '<h3 style="color: #2e7d32; margin-top: 20px;">👥 Funcionários</h3>';
    html += funcionarios.map(item => criarCardFuncionario(item)).join('');
  }
  
  div.innerHTML = html;

  // Adiciona listeners aos botões Deslogar
  console.log('[ADMIN] Adicionando listeners aos botões Deslogar...');
  div.querySelectorAll('.btn-deslogar').forEach(btn => {
    btn.addEventListener('click', function() {
      console.log('[ADMIN] Clique detectado no botão Deslogar para:', this.getAttribute('data-nome'));
      deslogarFuncionario(this.getAttribute('data-nome'));
    });
  });
}

// Função helper para criar card de funcionário/admin
function criarCardFuncionario(item) {
  const isAdmin = item.tipo === 'admin' || item.observacoes.includes('ADMINISTRADOR');
  const cardClass = isAdmin ? 'registro-funcionario admin-card' : 'registro-funcionario';
  
  return `
    <div class="${cardClass}" data-funcionario="${item.nome}">
      <b>${item.nome}</b> — ${item.local} <br>
      <span>Turno: ${item.turno}</span><br>
      <span>Check-in: ${item.checkin} | Check-out: ${item.checkout}</span><br>
      <span>Status: <b>${item.status}</b></span>
      ${item.status === 'Trabalhando' ? `<button class="btn-deslogar" data-nome="${item.nome}">Deslogar</button>` : ''}<br>
      <span>Entradas/saídas corretas: <b>${item.entradasCorretas}</b></span> |
      <span>Pendentes: <b>${item.entradasPendentes}</b></span><br>
      <span>Edições de proprietários: <b>${item.edicoesProprietarios}</b></span><br>
      ${item.checkoutsPorOutro && item.checkoutsPorOutro.length > 0 ? `<span>Checkouts feitos por outros funcionários: <ul>${item.checkoutsPorOutro.map(c => `<li>Registro ${c.registro} por ${c.quemFez} em ${c.hora}</li>`).join('')}</ul></span>` : ''}
      ${item.checkoutsAtrasados && item.checkoutsAtrasados.length > 0 ? `<span>Checkouts feitos dois dias ou mais após o check-in: <ul>${item.checkoutsAtrasados.map(c => `<li>Registro ${c.registro} (${c.checkin} - ${c.checkout})</li>`).join('')}</ul></span>` : ''}
      <span>Observações: ${item.observacoes}</span>
    </div>
  `;
}

// Forçar logout de funcionário
async function deslogarFuncionario(nome) {
  console.log('[DEBUG] Entrou na função deslogarFuncionario para:', nome);
  const confirmed = confirm(`Deseja realmente deslogar ${nome}?`);
  console.log('[DEBUG] Resultado do confirm:', confirmed);
  if (!confirmed) return;
  try {
    console.log('[ADMIN] Tentando deslogar funcionário:', nome);
    const token = sessionStorage.getItem('token');
    console.log('[DEBUG] Token:', token);
    console.log('[DEBUG] Antes do fetch para /api/admin/forcar-logout');
    const res = await fetch(`${API_BASE_URL}/api/admin/forcar-logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ nome })
    });
    console.log('[DEBUG] Depois do fetch, status:', res.status);
    const resposta = await res.json().catch(() => ({}));
    console.log('[ADMIN] Resposta do backend:', resposta);
    if (!res.ok) {
      let msg = resposta.erro || resposta.detalhe || res.statusText || 'Falha ao deslogar funcionário';
      adminMsg.textContent = 'Erro ao deslogar funcionário: ' + msg;
      adminMsg.style.color = 'red';
      alert('Erro ao deslogar funcionário: ' + msg);
      return;
    }
    adminMsg.textContent = 'Funcionário deslogado com sucesso!';
    adminMsg.style.color = 'green';
    alert('Funcionário deslogado com sucesso!');
    carregarMonitoramento();
  } catch (e) {
    console.error('[DEBUG] Erro inesperado no catch:', e);
    adminMsg.textContent = 'Erro inesperado ao deslogar funcionário: ' + e.message;
    adminMsg.style.color = 'red';
    alert('Erro inesperado ao deslogar funcionário: ' + e.message);
  }
}

window.deslogarFuncionario = deslogarFuncionario;



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

// --- Gerenciamento de Proprietários ---
async function carregarProprietarios(termo = '') {
  try {
    const token = sessionStorage.getItem('token');
    const url = termo ? `${API_BASE_URL}/api/admin/proprietarios?termo=${encodeURIComponent(termo)}` : `${API_BASE_URL}/api/admin/proprietarios`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    if (!res.ok) throw new Error('Falha ao carregar proprietários.');
    
    const proprietarios = await res.json();
    exibirProprietarios(proprietarios);
  } catch (err) {
    document.getElementById('proprietariosList').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

function exibirProprietarios(proprietarios) {
  const container = document.getElementById('proprietariosList');
  
  if (proprietarios.length === 0) {
    container.innerHTML = '<p>Nenhum proprietário encontrado.</p>';
    return;
  }
  
  const html = proprietarios.map(prop => `
    <div class="proprietario-card">
      <div class="proprietario-info">
        <h3>${prop.nome_completo}</h3>
        <p><strong>CPF:</strong> ${prop.cpf}</p>
        <p><strong>E-mail:</strong> ${prop.email || 'Não informado'}</p>
        <p><strong>Contato:</strong> ${prop.contato || 'Não informado'}</p>
        <p><strong>Endereço:</strong> ${prop.endereco || 'Não informado'}</p>
        <p><strong>Cadastrado em:</strong> ${new Date(prop.data_cadastro).toLocaleDateString('pt-BR')}</p>
        <p><strong>Bicicletas:</strong> ${prop.total_bicicletas} | <strong>Acessos:</strong> ${prop.total_acessos}</p>
      </div>
      ${prop.foto_proprietario_url ? `<div class="proprietario-foto"><img src="${prop.foto_proprietario_url}" alt="Foto de ${prop.nome_completo}"></div>` : ''}
    </div>
  `).join('');
  
  container.innerHTML = html;
}

// Event listeners para busca de proprietários
document.getElementById('btnBuscarProprietarios').addEventListener('click', () => {
  const termo = document.getElementById('searchProprietarios').value.trim();
  carregarProprietarios(termo);
});

document.getElementById('btnListarTodos').addEventListener('click', () => {
  document.getElementById('searchProprietarios').value = '';
  carregarProprietarios();
});

document.getElementById('searchProprietarios').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const termo = e.target.value.trim();
    carregarProprietarios(termo);
  }
});

// Logout admin
const logoutAdmin = document.getElementById('logoutAdmin');
if (logoutAdmin) {
  logoutAdmin.onclick = () => {
    sessionStorage.clear();
    window.location.href = 'area-funcionario.html';
  };
}

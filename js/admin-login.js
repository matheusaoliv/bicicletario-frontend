// Inicializar Firebase - Credenciais REAIS do projeto
const firebaseConfig = {
  apiKey: "AIzaSyCNSGHAWr4ZuTuEl3xmMqGe0mfhSH4dheo",
  authDomain: "bicicletario-japeri-v3.firebaseapp.com",
  projectId: "bicicletario-japeri-v3",
  storageBucket: "bicicletario-japeri-v3.firebasestorage.app",
  messagingSenderId: "366886346323",
  appId: "1:366886346323:web:2a4a16e8a4d5faac8470a6",
  measurementId: "G-Q3L2V32QK1"
};

// Verificar se Firebase já foi inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

const container = document.querySelector('.container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

registerBtn?.addEventListener('click', () => {
  container?.classList.add('active');
});

loginBtn?.addEventListener('click', () => {
  container?.classList.remove('active');
});

// Login real contra backend
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userEl = document.getElementById('loginUser');
    const passEl = document.getElementById('loginPass');
    const login = (userEl?.value || '').trim();
    const senha = passEl?.value || '';
    if (!login || !senha) { alert('Preencha usuário e senha.'); return; }
    try {
      const API_BASE = ((window.API_BASE_URL && window.API_BASE_URL.trim()) ? window.API_BASE_URL : '/api').replace(/\/$/, '');
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_usuario: login, senha })
      });
      const data = await resp.json().catch(() => ({}));
      
      // Tratamento de erros específicos
      if (resp.status === 403) {
        alert('❌ Acesso negado!\n\nApenas funcionários da secretaria podem acessar o painel administrativo.\n\nSe você é funcionário do bicicletário, use o Painel de Controle.');
        return;
      }
      
      if (!resp.ok) { 
        throw new Error(data.erro || 'Login ou senha inválidos.'); 
      }
      
      const token = data.token;
      const isAdmin = data.isAdmin;
      
      if (!token) { 
        throw new Error('Token não recebido do backend.'); 
      }
      
      // ✅ Verificar se é admin
      if (!isAdmin) {
        alert('❌ Acesso negado!\n\nApenas funcionários da secretaria podem acessar o painel administrativo.');
        return;
      }
      
      // Salvar dados na sessão
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('admin_nome', login);
      sessionStorage.setItem('isAdmin', 'true');
      
      // Redirecionar para o painel admin
      console.log('✅ Login bem-sucedido! Redirecionando para admin.html...');
      window.location.href = 'admin.html';
    } catch (err) {
      alert(err.message || 'Falha no login.');
    }
  });
}

// Carregar lista de funcionários da secretaria para o select
async function carregarFuncionariosSecretaria() {
  const selectEl = document.getElementById('registerUserSelect');
  if (!selectEl) return;
  
  try {
    const API_BASE = ((window.API_BASE_URL && window.API_BASE_URL.trim()) ? window.API_BASE_URL : '/api').replace(/\/$/, '');
    
    // Buscar funcionários (endpoint público ou com token temporário)
    const resp = await fetch(`${API_BASE}/funcionarios/secretaria`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!resp.ok) {
      console.error('Erro ao carregar funcionários');
      return;
    }
    
    const funcionarios = await resp.json();
    
    // Limpar e popular o select
    selectEl.innerHTML = '<option value="">Selecione seu usuário...</option>';
    
    funcionarios.forEach(func => {
      const option = document.createElement('option');
      option.value = func.nome_usuario;
      option.textContent = `${func.nome_completo || func.nome} (${func.nome_usuario})`;
      selectEl.appendChild(option);
    });
    
    console.log(`✅ ${funcionarios.length} funcionários da secretaria carregados`);
  } catch (err) {
    console.error('Erro ao carregar funcionários:', err);
  }
}

// Processar formulário de seleção de usuário
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const selectEl = document.getElementById('registerUserSelect');
    const passEl = document.getElementById('registerPass');
    
    const nomeUsuario = selectEl?.value || '';
    const senha = passEl?.value || '';
    
    if (!nomeUsuario || !senha) {
      alert('Selecione um usuário e informe sua senha.');
      return;
    }
    
    // Usar a mesma lógica de login
    try {
      const API_BASE = ((window.API_BASE_URL && window.API_BASE_URL.trim()) ? window.API_BASE_URL : '/api').replace(/\/$/, '');
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_usuario: nomeUsuario, senha })
      });
      
      const data = await resp.json().catch(() => ({}));
      
      if (resp.status === 403) {
        alert('❌ Acesso negado!\n\nApenas funcionários da secretaria podem acessar o painel administrativo.');
        return;
      }
      
      if (!resp.ok) {
        throw new Error(data.erro || 'Login ou senha inválidos.');
      }
      
      const token = data.token;
      const isAdmin = data.isAdmin;
      
      if (!token || !isAdmin) {
        alert('❌ Acesso negado!\n\nApenas funcionários da secretaria podem acessar o painel administrativo.');
        return;
      }
      
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('admin_nome', nomeUsuario);
      sessionStorage.setItem('isAdmin', 'true');
      
      console.log('✅ Login bem-sucedido! Redirecionando para admin.html...');
      window.location.href = 'admin.html';
    } catch (err) {
      alert(err.message || 'Falha no login.');
    }
  });
}

// Função de login com Google
async function loginComGoogle() {
  try {
    console.log('🔐 Iniciando login com Google...');
    
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    // ✅ Usar redirect em vez de popup (mais confiável)
    await auth.signInWithRedirect(provider);
    console.log('🔄 Redirecionando para login do Google...');
    
  } catch (error) {
    console.error('❌ Erro no login Google:', error);
    
    if (error.code === 'auth/popup-closed-by-user') {
      return;
    }
    
    if (error.code === 'auth/popup-blocked') {
      alert('⚠️ Popup bloqueado!\n\nPermita popups para este site e tente novamente.');
      return;
    }
    
    alert('Erro no login com Google: ' + (error.message || 'Erro desconhecido'));
  }
}

// Processar resultado do redirect quando a página carregar
async function processarResultadoGoogle() {
  try {
    const result = await auth.getRedirectResult();
    
    if (!result || !result.user) {
      // Nenhum redirect pendente
      return;
    }
    
    const user = result.user;
    console.log('✅ Autenticado com Google:', user.email);
    
    // Pegar token do Firebase
    const firebaseToken = await user.getIdToken();
    
    // Enviar para backend validar
    const API_BASE = ((window.API_BASE_URL && window.API_BASE_URL.trim()) ? window.API_BASE_URL : '/api').replace(/\/$/, '');
    
    const resp = await fetch(`${API_BASE}/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        firebaseToken,
        email: user.email,
        nome: user.displayName,
        foto: user.photoURL
      })
    });
    
    const data = await resp.json().catch(() => ({}));
    
    if (resp.status === 404) {
      alert('❌ Email não cadastrado!\n\nSeu email não está cadastrado no sistema.\nContate o administrador para cadastrar seu email.');
      await auth.signOut();
      return;
    }
    
    if (resp.status === 403) {
      alert('❌ Acesso negado!\n\nApenas funcionários da secretaria podem acessar o painel administrativo.');
      await auth.signOut();
      return;
    }
    
    if (!resp.ok) {
      throw new Error(data.erro || 'Erro ao processar login com Google.');
    }
    
    const token = data.token;
    const isAdmin = data.isAdmin;
    
    if (!token || !isAdmin) {
      alert('❌ Acesso negado!\n\nApenas funcionários da secretaria podem acessar.');
      await auth.signOut();
      return;
    }
    
    // Salvar dados na sessão
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('admin_nome', user.displayName || user.email);
    sessionStorage.setItem('isAdmin', 'true');
    sessionStorage.setItem('loginMethod', 'google');
    
    console.log('✅ Login Google bem-sucedido! Redirecionando...');
    window.location.href = 'admin.html';
    
  } catch (error) {
    console.error('❌ Erro no login Google:', error);
    
    if (error.code === 'auth/popup-closed-by-user') {
      // Usuário fechou o popup, não mostrar erro
      return;
    }
    
    if (error.code === 'auth/popup-blocked') {
      alert('⚠️ Popup bloqueado!\n\nPermita popups para este site e tente novamente.');
      return;
    }
    
    alert('Erro no login com Google: ' + (error.message || 'Erro desconhecido'));
  }
}

// Adicionar eventos ao botão do Google
document.addEventListener('DOMContentLoaded', () => {
  // Processar resultado do redirect do Google (se houver)
  processarResultadoGoogle();
  
  // Adicionar evento ao botão do Google
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');
  
  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', (e) => {
      console.log('🔵 CLIQUE NO GOOGLE DETECTADO!');
      e.preventDefault();
      loginComGoogle();
    });
    console.log('✅ Botão de login com Google configurado');
  } else {
    console.error('❌ Botão btnGoogleLogin não encontrado!');
  }
  
  // Verificar se Firebase está disponível
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase não está carregado!');
  } else {
    console.log('✅ Firebase carregado:', firebase.SDK_VERSION);
  }
  
  if (typeof auth === 'undefined') {
    console.error('❌ Firebase Auth não está inicializado!');
  } else {
    console.log('✅ Firebase Auth inicializado');
  }
});

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
      if (!resp.ok) { throw new Error(data.erro || 'Login ou senha inválidos.'); }
      const token = data.token;
      if (!token) { throw new Error('Token não recebido do backend.'); }
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('admin_nome', login);
      window.location.href = 'admin.html';
    } catch (err) {
      alert(err.message || 'Falha no login.');
    }
  });
}

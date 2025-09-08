/* api-client.js
   Cliente centralizado para chamadas à API do Bicicletário.
   Uso básico:
     <script src="js/api-client.js"></script>
     api.get('/proprietarios/1/bicicletas').then(console.log)
*/
(function(global){
  const API_BASE_URL = global.API_BASE_URL || 'https://bicicletario-backend.onrender.com/api';
  const DEFAULT_TIMEOUT_MS = 20000;

  function getStoredToken(){
    return sessionStorage.getItem('token') || localStorage.getItem('token') || null;
  }
  function setStoredToken(token, persist){
    if(persist){ localStorage.setItem('token', token); } else { sessionStorage.setItem('token', token); }
  }
  function clearStoredToken(){
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
  }

  async function request(method, path, body, opts={}){
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), opts.timeout || DEFAULT_TIMEOUT_MS);
    const headers = opts.headers ? { ...opts.headers } : {};
    if(!(body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    const token = getStoredToken();
    if(token) headers['Authorization'] = 'Bearer ' + token;
    const url = path.startsWith('http') ? path : API_BASE_URL.replace(/\/$/,'') + path;
    let fetchBody = body;
    if(body && !(body instanceof FormData) && headers['Content-Type'].includes('application/json')){
      fetchBody = JSON.stringify(body);
    }
    try {
      const res = await fetch(url, { method, headers, body: fetchBody, signal: controller.signal });
      clearTimeout(timeout);
      const contentType = res.headers.get('Content-Type') || '';
      let data = null;
      if(contentType.includes('application/json')){
        data = await res.json().catch(()=>null);
      } else {
        data = await res.text().catch(()=>null);
      }
      if(!res.ok){
        if(res.status === 401 || res.status === 403){
          // Token inválido ou expirado
          clearStoredToken();
          if(!opts.silentAuthFail){
            console.warn('[api-client] Auth falhou, redirecionando para login.');
            if(!window.location.pathname.includes('login')){
              setTimeout(()=> window.location.href = 'login.html', 500);
            }
          }
        }
        const msg = (data && (data.erro || data.message)) || `Erro HTTP ${res.status}`;
        const error = new Error(msg);
        error.status = res.status;
        error.payload = data;
        throw error;
      }
      return data;
    } catch(err){
      if(err.name === 'AbortError'){
        throw new Error('Tempo excedido (timeout).');
      }
      throw err;
    }
  }

  function get(path, opts){ return request('GET', path, null, opts); }
  function post(path, body, opts){ return request('POST', path, body, opts); }
  function put(path, body, opts){ return request('PUT', path, body, opts); }
  function del(path, opts){ return request('DELETE', path, null, opts); }

  // Upload com FormData: api.upload('/proprietarios/1/foto', { fotoProprietario: File })
  async function upload(path, filesObj={}, extraFields={}, opts={}){
    const fd = new FormData();
    Object.entries(filesObj).forEach(([campo, valor])=>{
      if(Array.isArray(valor)) valor.forEach(f=> fd.append(campo, f)); else if(valor) fd.append(campo, valor);
    });
    Object.entries(extraFields).forEach(([k,v])=> fd.append(k, v==null? '' : v));
    return request('PUT', path, fd, opts); // padrão PUT; sobrescrever via opts.method se precisar
  }

  // Exemplo de endpoint helpers (opcional):
  const endpoints = {
    listarBicicletasProprietario: (id)=> get(`/proprietarios/${id}/bicicletas`),
    atualizarBicicleta: (id, dados)=> put(`/bicicletas/${id}`, dados),
    checkin: (dados)=> post('/controle-acesso/checkin', dados),
    checkout: (dados)=> post('/controle-acesso/checkout', dados)
  };

  global.api = { get, post, put, del, upload, request, setStoredToken, getStoredToken, clearStoredToken, endpoints };
  console.log('[api-client] Inicializado. Base:', API_BASE_URL);
})(window);


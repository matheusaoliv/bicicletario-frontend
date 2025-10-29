(function(){
  'use strict';
  const HEARTBEAT_MS = 2 * 60 * 1000; // 2 minutos
  let _hbTimer = null;

  function getToken(){
    try { return sessionStorage.getItem('token') || localStorage.getItem('token') || ''; } catch(_){ return ''; }
  }
  function getApiBase(){
    try {
      let base = (window.API_BASE_URL && window.API_BASE_URL.trim()) || 'https://southamerica-east1-bicicletario-japeri-v3.cloudfunctions.net/api';
      base = base.replace(/\/$/, '');
      if (!/\/api$/i.test(base)) base += '/api';
      return base;
    } catch(_){
      return 'https://southamerica-east1-bicicletario-japeri-v3.cloudfunctions.net/api';
    }
  }

  async function sendPing(){
    const token = getToken();
    if (!token) return;
    try {
      if (window.api && typeof window.api.request === 'function') {
        await window.api.request('POST', '/funcionarios/ping');
      } else {
        const resp = await fetch(getApiBase() + '/funcionarios/ping', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
      }
      // console.debug('[heartbeat] ping enviado');
    } catch(e){
      try { console.warn('[heartbeat] falha no ping:', e?.message || String(e)); } catch(_){ }
    }
  }

  function startHeartbeat(){
    if (_hbTimer) return;
    sendPing();
    _hbTimer = setInterval(sendPing, HEARTBEAT_MS);
  }
  function stopHeartbeat(){
    if (_hbTimer) { clearInterval(_hbTimer); _hbTimer = null; }
  }

  document.addEventListener('visibilitychange', ()=>{
    try { if (document.visibilityState === 'visible') startHeartbeat(); else stopHeartbeat(); } catch(_){ }
  });
  document.addEventListener('DOMContentLoaded', ()=>{
    try { if (document.visibilityState === 'visible') startHeartbeat(); } catch(_){ }
  });
})();


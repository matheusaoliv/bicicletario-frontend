// DEV-LOCAL: remover este arquivo e a tag <script src="js/config-local.js"></script> antes de commitar.
// Este arquivo apenas sobrescreve a base da API no ambiente local.
// Produção continuará usando a base padrão do api-client.js (Render) quando este arquivo não existir.

window.API_BASE_URL = 'http://localhost:5050/api';
console.log('[config-local] API_BASE_URL definido para ambiente local:', window.API_BASE_URL);

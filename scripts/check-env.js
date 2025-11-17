// checks for required environment variables on install/prepare
// This script is safe and non-blocking: it only logs warnings to help local setup.

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const envPath = path.join(root, '.env');

const requiredVars = [
  'PORT',
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Firebase (para nova infraestrutura)
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_SERVICE_ACCOUNT_JSON'
];

function parseEnv(content){
  const map = {};
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if(!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if(idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx+1).trim();
    map[key] = val;
  });
  return map;
}

function main(){
  let warningHeaderPrinted = false;
  function warn(msg){
    if(!warningHeaderPrinted){
      console.log('\n[prepare] Verificando .env e variáveis necessárias...');
      warningHeaderPrinted = true;
    }
    console.warn('[prepare]', msg);
  }

  if(!fs.existsSync(envPath)){
    warn('Arquivo .env não encontrado na raiz do projeto.');
    warn('Crie um .env com as variáveis:');
    requiredVars.forEach(v => warn(`  - ${v}`));
    warn('Exemplo rápido:\nPORT=5050\nJWT_SECRET=sua_chave' +
      '\nSUPABASE_URL=...' +
      '\nSUPABASE_ANON_KEY=...' +
      '\nSUPABASE_SERVICE_ROLE_KEY=...' +
      '\nFIREBASE_PROJECT_ID=seu-projeto' +
      '\nFIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com' +
      '\nFIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}');
    return; // não falhar a instalação
  }

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const envMap = parseEnv(content);
    const missing = requiredVars.filter(v => !envMap[v]);
    if(missing.length){
      warn('Variáveis ausentes no .env:');
      missing.forEach(v => warn(`  - ${v}`));
    } else {
      console.log('[prepare] .env OK.');
    }
  } catch (e){
    warn('Não foi possível ler o .env: ' + e.message);
  }
}

main();

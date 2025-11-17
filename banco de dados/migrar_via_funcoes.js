// Importador via Cloud Functions: lê CSVs e envia em lotes para /api/admin/import-batch
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function parseValue(v){
  if (v === '') return null;
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) {
    const num = Number(v);
    if (Number.isFinite(num)) return num;
  }
  return v;
}
function normalizeRecord(rec){
  const out = {};
  for (const [k,v] of Object.entries(rec)) out[k] = parseValue(v);
  if (out.id != null) out.id = String(out.id);
  return out;
}
async function readCsv(file){
  const full = path.resolve(__dirname, file);
  if (!fs.existsSync(full)) return [];
  const rows = [];
  await new Promise((resolve, reject)=>{
    fs.createReadStream(full).pipe(csv())
      .on('data', r=> rows.push(normalizeRecord(r)))
      .on('end', resolve)
      .on('error', reject);
  });
  return rows;
}

function getArg(name, alias){
  const i1 = process.argv.indexOf(`--${name}`);
  if (i1 >= 0 && i1+1 < process.argv.length) return process.argv[i1+1];
  const a1 = process.argv.find(a => a.startsWith(`--${name}=`));
  if (a1) return a1.split('=')[1];
  if (alias){
    const i2 = process.argv.indexOf(`-${alias}`);
    if (i2 >= 0 && i2+1 < process.argv.length) return process.argv[i2+1];
    const a2 = process.argv.find(a => a.startsWith(`-${alias}=`));
    if (a2) return a2.split('=')[1];
  }
  return null;
}

async function prompt(question){
  process.stdout.write(question);
  return await new Promise((resolve)=>{
    const chunks = [];
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d)=>{ chunks.push(d); if (d.includes('\n')) { process.stdin.pause(); resolve(chunks.join('').trim()); } });
  });
}

async function postBatch(baseUrl, token, collection, records, idField='id', merge=true){
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/import-batch?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-migration-token': token,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ collection, records, idField, merge })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return await res.json();
}

async function main(){
  const baseUrl = getArg('base') || process.env.MIGRATION_BASE_URL || 'https://southamerica-east1-bicicletario-japeri.cloudfunctions.net/api';
  let token = getArg('token','t') || process.env.MIGRATION_TOKEN;
  if (!token) token = await prompt('Digite o MIGRATION_TOKEN: ');
  if (!token) throw new Error('MIGRATION_TOKEN obrigatório');

  const plan = [
    { file: 'proprietarios_rows.csv', collection: 'proprietarios' },
    { file: 'bicicletas_rows.csv', collection: 'bicicletas' },
    { file: 'funcionarios_rows.csv', collection: 'funcionarios' },
    { file: 'controleacesso_rows.csv', collection: 'controleacesso' },
    { file: 'alert_actions_rows.csv', collection: 'alert_actions' },
  ];

  const BATCH = 400;
  for (const step of plan){
    const rows = await readCsv(step.file);
    console.log(`\n[migrar_via_funcoes] ${step.file}: ${rows.length} registros`);
    for (let i = 0; i < rows.length; i += BATCH){
      const slice = rows.slice(i, i+BATCH);
      const resp = await postBatch(baseUrl, token, step.collection, slice, 'id', true);
      console.log(`[migrar_via_funcoes] ${step.collection} lote ${(i/BATCH)+1} -> enviados=${resp.enviados}`);
    }
  }
  console.log('\n[migrar_via_funcoes] Concluído.');
}

main().catch(err=>{ console.error('[migrar_via_funcoes] Falhou:', err?.message || err); process.exit(1); });

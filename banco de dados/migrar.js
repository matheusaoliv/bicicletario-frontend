// Script de migração: CSV (Supabase) -> Firestore (Firebase)
// Requisitos: firebase-admin, csv-parser

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function resolveServiceAccountPath() {
  const candidates = [];
  if (process.env.SERVICE_ACCOUNT_JSON_PATH) candidates.push(process.env.SERVICE_ACCOUNT_JSON_PATH);
  candidates.push('serviceAccountKey.json');
  candidates.push('serviceAccountKey.json.json');
  for (const p of candidates) {
    const full = path.resolve(__dirname, p);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

const saPath = resolveServiceAccountPath();
if (!saPath) {
  console.error('[migrar] ERRO: Arquivo de credenciais (service account) não encontrado.');
  console.error('[migrar] Coloque o arquivo serviceAccountKey.json (ou defina SERVICE_ACCOUNT_JSON_PATH) dentro da pasta banco de dados/.');
  process.exit(1);
}

const serviceAccount = require(saPath);

// Permitir override por CLI: --project <id> ou --project=<id> ou -p <id> ou -p=<id>
function parseCliProject(){
  let p = null;
  for (let i = 2; i < process.argv.length; i++){
    const a = process.argv[i];
    if (a === '--project' || a === '-p') { if (i+1 < process.argv.length) { p = process.argv[i+1]; i++; } }
    else if (a.startsWith('--project=')) { p = a.split('=')[1]; }
    else if (a.startsWith('-p=')) { p = a.split('=')[1]; }
  }
  return (p && p.trim()) || null;
}

const cliProject = parseCliProject();
const projectId = cliProject || process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
console.log(`[migrar] Service account: ${saPath}`);
console.log(`[migrar] projectId efetivo: ${projectId} (cli=${cliProject || 'n/a'}, env=${process.env.FIREBASE_PROJECT_ID || 'n/a'}, sa=${serviceAccount.project_id})`);
console.log(`[migrar] service account email: ${serviceAccount.client_email || 'n/a'}`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId,
});

const db = admin.firestore();

function parseValue(v) {
  if (v === '') return null;
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) {
    // números inteiros ou decimais
    const num = Number(v);
    if (Number.isFinite(num)) return num;
  }
  return v;
}

function normalizeRecord(rec) {
  const out = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = parseValue(v);
  }
  // Se houver id, use string para compatibilidade de docRef e mantenha o campo
  if (out.id != null) out.id = String(out.id);
  return out;
}

async function migrarDados(arquivoCsv, nomeColecao, idField = 'id') {
  const fullPath = path.resolve(__dirname, arquivoCsv);
  console.log('\n----------------------------------------------------');
  console.log(`[migrar] Lendo CSV: ${fullPath}`);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[migrar] AVISO: Arquivo não encontrado, pulando: ${arquivoCsv}`);
    return;
  }

  const linhas = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(fullPath)
      .pipe(csv())
      .on('data', (row) => linhas.push(normalizeRecord(row)))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`[migrar] Registros lidos: ${linhas.length}`);
  if (!linhas.length) return;

  const BATCH_LIMIT = 450; // margem de segurança (<500)
  let enviados = 0;
  let batchIndex = 0;

  for (let i = 0; i < linhas.length; i += BATCH_LIMIT) {
    const lote = linhas.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const rec of lote) {
      const idVal = rec[idField];
      const col = db.collection(nomeColecao);
      const docRef = idVal ? col.doc(String(idVal)) : col.doc();
      batch.set(docRef, rec, { merge: true });
    }
    try {
      await batch.commit();
      // Pausa para não estourar a quota de escritas do Firestore
      if (i + BATCH_LIMIT < linhas.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (err) {
      const totalBatches = Math.ceil(linhas.length / BATCH_LIMIT);
      console.error(`[migrar] ERRO no commit do lote ${batchIndex + 1}/${totalBatches} da coleção '${nomeColecao}'.`);
      console.error('[migrar] Código:', err?.code, 'Mensagem:', err?.message || err);
      if (err?.details) console.error('[migrar] Detalhes:', err.details);
      try { console.error('[migrar] Erro bruto:', JSON.stringify(err)); } catch(_){}
      throw err;
    }
    enviados += lote.length;
    batchIndex++;
    console.log(`[migrar] Lote ${batchIndex} enviado. Total: ${enviados}/${linhas.length}`);
  }

  console.log(`[migrar] ✅ Concluído: ${arquivoCsv} -> coleção '${nomeColecao}'.`);
}

async function executarMigracaoCompleta() {
  try {
    // Preflight: teste de escrita simples para diagnosticar NOT_FOUND/PERMISSION
    console.log('[migrar] Preflight: teste de escrita em _diag/write_test ...');
    try {
      await db.collection('_diag').doc('write_test').set({ at: new Date().toISOString(), ok: true });
      console.log('[migrar] Preflight OK: escrita básica realizada com sucesso.');
    } catch (pfErr) {
      console.error('[migrar] Preflight FALHOU. Código:', pfErr?.code, 'Mensagem:', pfErr?.message || pfErr);
      try { console.error('[migrar] Preflight bruto:', JSON.stringify(pfErr)); } catch(_){}
      throw pfErr;
    }

    await migrarDados('proprietarios_rows.csv', 'proprietarios');
    await migrarDados('bicicletas_rows.csv', 'bicicletas');
    await migrarDados('funcionarios_rows.csv', 'funcionarios');
    await migrarDados('controleacesso_rows.csv', 'controleacesso');
    await migrarDados('alert_actions_rows.csv', 'alert_actions');

    console.log('\n✨ Todas as migrações concluídas! Confira no Console do Firebase (Firestore).');
  } catch (err) {
    console.error('[migrar] Falhou:', err?.message || err);
    console.error('[migrar] Código:', err?.code);
    try { console.error('[migrar] Bruto:', JSON.stringify(err)); } catch(_){ }
    process.exit(1);
  }
}

executarMigracaoCompleta();

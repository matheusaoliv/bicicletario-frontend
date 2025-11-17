const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function runTest() {
  console.log('[diag] Iniciando teste de escrita no Firestore...');

  const saPath = path.resolve(__dirname, 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) {
    console.error(`[diag] ERRO: Chave de serviço não encontrada em ${saPath}`);
    return;
  }
  console.log(`[diag] Usando chave: ${saPath}`);
  const serviceAccount = require(saPath);

  const projectId = process.argv.find(arg => arg.startsWith('--project='))?.split('=')[1] || serviceAccount.project_id;
  if (!projectId) {
    console.error('[diag] ERRO: project_id não encontrado na chave nem via --project=<id>.');
    return;
  }
  console.log(`[diag] Usando projectId: ${projectId}`);

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId,
    });
    console.log('[diag] Admin SDK inicializado.');
  } catch (err) {
    console.error('[diag] Falha ao inicializar o Admin SDK:', err.message);
    return;
  }

  const db = admin.firestore();
  const docRef = db.collection('_diag').doc('sdk_test');

  try {
    console.log(`[diag] Tentando escrever em: ${docRef.path}`);
    await docRef.set({ timestamp: new Date(), status: 'ok' });
    console.log('[diag] ✅ SUCESSO! Escrita no Firestore funcionou.');
  } catch (err) {
    console.error('\n[diag] ❌ FALHA na escrita.');
    console.error('[diag] Código do Erro:', err.code);
    console.error('[diag] Mensagem:', err.message);
    console.error('\n[diag] Este erro (5 NOT_FOUND) geralmente indica que a API do Firestore não está habilitada ou o banco de dados não foi provisionado corretamente para acesso via API. Verifique em https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=' + projectId);
  }
}

runTest();

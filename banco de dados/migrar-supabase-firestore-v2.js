// Script de migração Supabase -> Firestore (v2)
// Migração incremental com backup, dry-run, normalização de campos e logs detalhados
// Uso: node migrar-supabase-firestore-v2.js [--dry-run] [--backup] [--limit=N]

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// ===== CONFIGURAÇÃO =====
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, 'serviceAccountKey.json');
const BACKUP_DIR = path.resolve(__dirname, 'backup-firestore');
const LOG_DIR = path.resolve(__dirname, 'logs-migracao');

// Parse argumentos CLI
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DO_BACKUP = args.includes('--backup');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10) || null;

console.log('='.repeat(60));
console.log('MIGRAÇÃO SUPABASE → FIRESTORE v2');
console.log('='.repeat(60));
console.log(`Modo: ${DRY_RUN ? '🔍 DRY-RUN (sem escrita)' : '✍️  ESCRITA REAL'}`);
console.log(`Backup: ${DO_BACKUP ? '✅ SIM' : '❌ NÃO'}`);
console.log(`Limite: ${LIMIT ? `${LIMIT} registros por coleção` : 'SEM LIMITE'}`);
console.log('='.repeat(60));

// Inicializar Firebase Admin
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ ERRO: serviceAccountKey.json não encontrado!');
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
console.log(`✅ Firebase inicializado: ${serviceAccount.project_id}`);
console.log(`📧 Service Account: ${serviceAccount.client_email}\n`);

// ===== UTILITÁRIOS =====
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseValue(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  // Números: manter como number se válido
  if (/^-?\d+(\.\d+)?$/.test(v)) {
    const num = Number(v);
    if (Number.isFinite(num)) return num;
  }
  return v;
}

// Normalizar CPF e contato para String (conforme memória)
function normalizarCPF(cpf) {
  if (!cpf) return null;
  return String(cpf).trim();
}

function normalizarContato(contato) {
  if (!contato) return null;
  return String(contato).trim();
}

// Converter timestamps ISO para Firestore Timestamp
function parseTimestamp(isoString) {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return admin.firestore.Timestamp.fromDate(date);
  } catch {
    return null;
  }
}

// ===== TRANSFORMADORES POR COLEÇÃO =====
function transformFuncionario(rec) {
  return {
    id: rec.id ? String(rec.id) : null,
    nome_completo: rec.nome_completo || null,
    nome_usuario: rec.nome_usuario || null,
    senha_hash: rec.senha_hash || null,
    email: rec.email || null,
    data_cadastro: parseTimestamp(rec.data_cadastro),
    ativo: rec.ativo === true || rec.ativo === 'true',
    last_ping: parseTimestamp(rec.last_ping),
    local: rec.local || null, // inferir automaticamente se não existir
    cargo: rec.cargo || null,
    status: rec.status || 'ativo',
    fotoUrl: rec.fotoUrl || null,
  };
}

function transformProprietario(rec) {
  return {
    id: rec.id ? String(rec.id) : null,
    nome_completo: rec.nome_completo || null, // IMPORTANTE: nome_completo, não "nome"
    email: rec.email || null,
    cpf: normalizarCPF(rec.cpf), // SEMPRE String
    contato: normalizarContato(rec.contato), // SEMPRE String
    endereco: rec.endereco || null,
    foto_proprietario_url: rec.foto_proprietario_url || null,
    data_cadastro: parseTimestamp(rec.data_cadastro),
    fotoUrl: rec.foto_proprietario_url || null, // alias
  };
}

function transformBicicleta(rec) {
  return {
    id: rec.id ? String(rec.id) : null,
    proprietario_id: rec.proprietario_id ? String(rec.proprietario_id) : null,
    numero_identificacao: rec.numero_identificacao || null,
    numero_bike: rec.numero_identificacao || null, // compatibilidade
    tipo_bike: rec.tipo_bike || null,
    marca: rec.marca || null,
    modelo: rec.modelo || null,
    observacoes_bike: rec.observacoes_bike || null,
    foto_bicicleta_url: rec.foto_bicicleta_url || null,
    foto_dono_com_bicicleta_url: rec.foto_dono_com_bicicleta_url || null,
    data_cadastro_bike: parseTimestamp(rec.data_cadastro_bike),
    status: rec.status || 'FORA', // status padrão
  };
}

function transformControleAcesso(rec) {
  return {
    id: rec.id ? String(rec.id) : null,
    supabase_id: rec.id ? String(rec.id) : null, // manter referência original
    bicicleta_id: rec.bicicleta_id ? String(rec.bicicleta_id) : null,
    proprietario_id: rec.proprietario_id ? String(rec.proprietario_id) : null,
    funcionario_entrada_id: rec.funcionario_entrada_id ? String(rec.funcionario_entrada_id) : null,
    funcionario_saida_id: rec.funcionario_saida_id ? String(rec.funcionario_saida_id) : null,
    local: rec.local || null,
    data_hora_entrada: parseTimestamp(rec.data_hora_entrada),
    data_hora_saida: parseTimestamp(rec.data_hora_saida),
    observacoes_entrada: rec.observacoes_entrada || null,
    observacoes_saida: rec.observacoes_saida || null,
    observacao_geral: rec.observacao_geral || null,
    numero_lacre: rec.numero_lacre || null, // importante para check-ins
    alerta_resolvido: rec.alerta_resolvido || null,
    alerta_responsavel: rec.alerta_responsavel || null,
    alerta_status: rec.alerta_status || null,
  };
}

function transformAlertAction(rec) {
  return {
    id: rec.id ? String(rec.id) : null,
    alert_id: rec.alert_id ? String(rec.alert_id) : null,
    acao: rec.acao || null,
    autor: rec.autor || null,
    payload: rec.payload || null,
    created_at: parseTimestamp(rec.created_at),
  };
}

// ===== LEITURA DE CSV =====
async function lerCSV(arquivoCsv) {
  const fullPath = path.resolve(__dirname, arquivoCsv);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Arquivo não encontrado: ${arquivoCsv}`);
    return [];
  }

  const linhas = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(fullPath)
      .pipe(csv())
      .on('data', (row) => {
        const normalized = {};
        for (const [k, v] of Object.entries(row)) {
          normalized[k] = parseValue(v);
        }
        linhas.push(normalized);
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return linhas;
}

// ===== BACKUP =====
async function backupColecao(nomeColecao) {
  console.log(`📦 Fazendo backup de '${nomeColecao}'...`);
  ensureDir(BACKUP_DIR);
  
  const snapshot = await db.collection(nomeColecao).get();
  const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const backupFile = path.join(BACKUP_DIR, `${nomeColecao}_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(docs, null, 2));
  
  console.log(`✅ Backup salvo: ${backupFile} (${docs.length} docs)`);
  return docs.length;
}

// ===== MIGRAÇÃO =====
async function migrarColecao(arquivoCsv, nomeColecao, transformFn) {
  console.log('\n' + '='.repeat(60));
  console.log(`📂 COLEÇÃO: ${nomeColecao}`);
  console.log(`📄 Arquivo: ${arquivoCsv}`);
  console.log('='.repeat(60));

  // Backup (se solicitado)
  if (DO_BACKUP && !DRY_RUN) {
    await backupColecao(nomeColecao);
  }

  // Ler CSV
  let linhas = await lerCSV(arquivoCsv);
  console.log(`📊 Registros lidos do CSV: ${linhas.length}`);
  
  if (!linhas.length) {
    console.log('⏭️  Nenhum registro para processar.\n');
    return { total: 0, inseridos: 0, atualizados: 0, erros: 0 };
  }

  // Aplicar limite se definido
  if (LIMIT && linhas.length > LIMIT) {
    console.log(`⚠️  Aplicando limite: ${LIMIT} registros`);
    linhas = linhas.slice(0, LIMIT);
  }

  // Transformar dados
  const registros = linhas.map(transformFn).filter(r => r.id); // apenas com ID válido
  console.log(`✅ Registros transformados: ${registros.length}`);

  if (DRY_RUN) {
    console.log('🔍 DRY-RUN: Mostrando amostra (primeiros 3 registros):');
    console.log(JSON.stringify(registros.slice(0, 3), null, 2));
    console.log(`\n✅ DRY-RUN concluído para '${nomeColecao}'\n`);
    return { total: registros.length, inseridos: 0, atualizados: 0, erros: 0 };
  }

  // Migração real
  const BATCH_SIZE = 400; // margem de segurança
  let inseridos = 0;
  let atualizados = 0;
  let erros = 0;

  ensureDir(LOG_DIR);
  const logFile = path.join(LOG_DIR, `${nomeColecao}_${Date.now()}.log`);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  for (let i = 0; i < registros.length; i += BATCH_SIZE) {
    const lote = registros.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const rec of lote) {
      const docRef = db.collection(nomeColecao).doc(rec.id);
      
      // Verificar se já existe (para contagem)
      try {
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          atualizados++;
        } else {
          inseridos++;
        }
      } catch (err) {
        erros++;
        logStream.write(`ERRO ao verificar doc ${rec.id}: ${err.message}\n`);
      }

      batch.set(docRef, rec, { merge: true });
    }

    try {
      await batch.commit();
      console.log(`✅ Lote ${Math.floor(i / BATCH_SIZE) + 1} enviado (${lote.length} docs)`);
      
      // Pausa para respeitar limites do Firestore
      if (i + BATCH_SIZE < registros.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (err) {
      erros += lote.length;
      console.error(`❌ ERRO no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, err.message);
      logStream.write(`ERRO no lote: ${err.message}\n`);
    }
  }

  logStream.end();
  console.log(`\n📊 RESUMO '${nomeColecao}':`);
  console.log(`   Total: ${registros.length}`);
  console.log(`   Inseridos: ${inseridos}`);
  console.log(`   Atualizados: ${atualizados}`);
  console.log(`   Erros: ${erros}`);
  console.log(`   Log: ${logFile}\n`);

  return { total: registros.length, inseridos, atualizados, erros };
}

// ===== EXECUÇÃO PRINCIPAL =====
async function executarMigracao() {
  const inicio = Date.now();
  const resultados = {};

  try {
    // Teste de conectividade
    if (!DRY_RUN) {
      console.log('🔌 Testando conectividade com Firestore...');
      await db.collection('_diag').doc('migration_test').set({ 
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        test: true 
      });
      console.log('✅ Conectividade OK\n');
    }

    // Migrar coleções na ordem correta (dependências)
    resultados.funcionarios = await migrarColecao(
      'funcionarios_rows.csv', 
      'funcionarios', 
      transformFuncionario
    );

    resultados.proprietarios = await migrarColecao(
      'proprietarios_rows.csv', 
      'proprietarios', 
      transformProprietario
    );

    resultados.bicicletas = await migrarColecao(
      'bicicletas_rows.csv', 
      'bicicletas', 
      transformBicicleta
    );

    resultados.controleacesso = await migrarColecao(
      'controleacesso_rows.csv', 
      'controleacesso', 
      transformControleAcesso
    );

    resultados.alert_actions = await migrarColecao(
      'alert_actions_rows.csv', 
      'alert_actions', 
      transformAlertAction
    );

    // Relatório final
    const duracao = ((Date.now() - inicio) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(60));
    console.log('🎉 MIGRAÇÃO CONCLUÍDA!');
    console.log('='.repeat(60));
    console.log(`⏱️  Duração: ${duracao}s`);
    console.log('\n📊 RESUMO GERAL:');
    
    let totalGeral = 0;
    let inseridosGeral = 0;
    let atualizadosGeral = 0;
    let errosGeral = 0;

    for (const [colecao, stats] of Object.entries(resultados)) {
      console.log(`\n   ${colecao}:`);
      console.log(`      Total: ${stats.total}`);
      console.log(`      Inseridos: ${stats.inseridos}`);
      console.log(`      Atualizados: ${stats.atualizados}`);
      console.log(`      Erros: ${stats.erros}`);
      
      totalGeral += stats.total;
      inseridosGeral += stats.inseridos;
      atualizadosGeral += stats.atualizados;
      errosGeral += stats.erros;
    }

    console.log('\n   TOTAIS:');
    console.log(`      Registros: ${totalGeral}`);
    console.log(`      Inseridos: ${inseridosGeral}`);
    console.log(`      Atualizados: ${atualizadosGeral}`);
    console.log(`      Erros: ${errosGeral}`);
    console.log('\n' + '='.repeat(60));

    if (DRY_RUN) {
      console.log('\n⚠️  Este foi um DRY-RUN. Nenhum dado foi escrito.');
      console.log('   Execute sem --dry-run para realizar a migração real.\n');
    } else {
      console.log('\n✅ Dados migrados com sucesso para o Firestore!');
      console.log(`   Projeto: ${serviceAccount.project_id}`);
      console.log(`   Console: https://console.firebase.google.com/project/${serviceAccount.project_id}/firestore\n`);
    }

  } catch (err) {
    console.error('\n❌ ERRO FATAL:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

// Executar
executarMigracao().then(() => process.exit(0));

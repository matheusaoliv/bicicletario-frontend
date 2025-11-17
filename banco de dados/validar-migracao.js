// Script de validação pós-migração
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.resolve(__dirname, 'serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function validarMigracao() {
  console.log('🔍 VALIDAÇÃO PÓS-MIGRAÇÃO');
  console.log('='.repeat(50));

  try {
    // 1. Contagens por coleção
    const colecoes = ['funcionarios', 'proprietarios', 'bicicletas', 'controleacesso', 'alert_actions'];
    
    for (const col of colecoes) {
      const snapshot = await db.collection(col).count().get();
      console.log(`📊 ${col}: ${snapshot.data().count} documentos`);
    }

    console.log('\n🔍 AMOSTRAS:');
    console.log('='.repeat(50));

    // 2. Amostra de proprietário (verificar CPF como String)
    const propSample = await db.collection('proprietarios').limit(1).get();
    if (!propSample.empty) {
      const prop = propSample.docs[0].data();
      console.log('\n👤 PROPRIETÁRIO (amostra):');
      console.log(`   Nome: ${prop.nome_completo}`);
      console.log(`   CPF: "${prop.cpf}" (tipo: ${typeof prop.cpf})`);
      console.log(`   Contato: "${prop.contato}" (tipo: ${typeof prop.contato})`);
      console.log(`   Email: ${prop.email}`);
    }

    // 3. Amostra de bicicleta
    const bikeSample = await db.collection('bicicletas').limit(1).get();
    if (!bikeSample.empty) {
      const bike = bikeSample.docs[0].data();
      console.log('\n🚲 BICICLETA (amostra):');
      console.log(`   Número: ${bike.numero_identificacao}`);
      console.log(`   Número (compat): ${bike.numero_bike}`);
      console.log(`   Proprietário ID: ${bike.proprietario_id}`);
      console.log(`   Marca: ${bike.marca}`);
      console.log(`   Tipo: ${bike.tipo_bike}`);
    }

    // 4. Amostra de controle de acesso
    const acessoSample = await db.collection('controleacesso').limit(1).get();
    if (!acessoSample.empty) {
      const acesso = acessoSample.docs[0].data();
      console.log('\n🚪 CONTROLE ACESSO (amostra):');
      console.log(`   ID: ${acesso.id}`);
      console.log(`   Supabase ID: ${acesso.supabase_id}`);
      console.log(`   Local: ${acesso.local}`);
      console.log(`   Bicicleta ID: ${acesso.bicicleta_id}`);
      console.log(`   Proprietário ID: ${acesso.proprietario_id}`);
      console.log(`   Entrada: ${acesso.data_hora_entrada?.toDate()}`);
      console.log(`   Saída: ${acesso.data_hora_saida?.toDate() || 'null'}`);
    }

    // 5. Funcionário com último ping
    const funcSample = await db.collection('funcionarios')
      .where('last_ping', '!=', null)
      .limit(1).get();
    if (!funcSample.empty) {
      const func = funcSample.docs[0].data();
      console.log('\n👨‍💼 FUNCIONÁRIO (amostra):');
      console.log(`   Nome: ${func.nome_completo}`);
      console.log(`   Usuário: ${func.nome_usuario}`);
      console.log(`   Email: ${func.email}`);
      console.log(`   Ativo: ${func.ativo}`);
      console.log(`   Último ping: ${func.last_ping?.toDate()}`);
    }

    console.log('\n✅ VALIDAÇÃO CONCLUÍDA!');
    console.log('\n🎯 PRÓXIMOS PASSOS:');
    console.log('   1. Testar login no app');
    console.log('   2. Verificar dashboard');
    console.log('   3. Testar busca de proprietários');
    console.log('   4. Sistema pronto para inauguração! 🚀');

  } catch (err) {
    console.error('❌ ERRO na validação:', err.message);
  }
}

validarMigracao().then(() => process.exit(0));

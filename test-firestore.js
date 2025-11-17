// Script para testar leitura do Firestore
const admin = require('firebase-admin');
const serviceAccount = require('./bicicletario-japeri-v3-firebase-adminsdk-rkqw7-1e5c7c2f8d.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listarFuncionarios() {
  try {
    const snapshot = await db.collection('funcionarios').get();
    
    console.log(`\n📊 Total de funcionários: ${snapshot.size}\n`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`  Nome: ${data.nome || '(vazio)'}`);
      console.log(`  Email: ${data.email || '(vazio)'}`);
      console.log(`  Cargo: ${data.cargo || '(vazio)'}`);
      console.log(`  Local: ${data.local || '(vazio)'}`);
      console.log(`  Status: ${data.status || '(vazio)'}`);
      console.log('---');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

listarFuncionarios();

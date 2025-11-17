// Script para verificar collections existentes no Firestore
const admin = require('firebase-admin');
const serviceAccount = require('./bicicletario-japeri-v3-firebase-adminsdk-rkqw7-1e5c7c2f8d.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verificarCollections() {
  console.log('\n🔍 Verificando collections no Firestore...\n');
  
  const collections = ['checkins', 'checkouts', 'bloqueios_pendentes', 'logs_auditoria'];
  
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).limit(5).get();
      
      if (snapshot.empty) {
        console.log(`❌ ${collectionName}: Collection vazia ou não existe`);
      } else {
        console.log(`✅ ${collectionName}: ${snapshot.size} documentos encontrados (mostrando primeiros 5)`);
        snapshot.forEach(doc => {
          console.log(`   - ID: ${doc.id}`);
          console.log(`     Dados:`, JSON.stringify(doc.data(), null, 2));
        });
      }
      console.log('');
    } catch (error) {
      console.log(`❌ ${collectionName}: Erro ao acessar - ${error.message}\n`);
    }
  }
  
  process.exit(0);
}

verificarCollections();

// Script para verificar check-in do Thiago
const admin = require('firebase-admin');
const serviceAccount = require('./bicicletario-japeri-v3-firebase-adminsdk-rkqw7-1e5c7c2f8d.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'bicicletario-japeri-v3'
});

const db = admin.firestore();

async function verificarCheckin() {
  console.log('\n🔍 Verificando check-in do Thiago Rodrigues Souza...\n');
  
  try {
    // Buscar proprietário Thiago
    const propsSnapshot = await db.collection('proprietarios')
      .where('nome_completo', '>=', 'Thiago Rodrigues')
      .where('nome_completo', '<=', 'Thiago Rodrigues\uf8ff')
      .get();
    
    console.log(`📋 Proprietários encontrados: ${propsSnapshot.size}`);
    
    propsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n✅ Proprietário ID: ${doc.id}`);
      console.log(`   Nome: ${data.nome_completo}`);
      console.log(`   CPF: ${data.cpf}`);
    });
    
    // Buscar bicicleta JPR-TAZL3F7HOTQBS0
    const bikesSnapshot = await db.collection('bicicletas')
      .where('numero_identificacao', '==', 'JPR-TAZL3F7HOTQBS0')
      .get();
    
    console.log(`\n🚲 Bicicletas encontradas: ${bikesSnapshot.size}`);
    
    if (!bikesSnapshot.empty) {
      const bikeDoc = bikesSnapshot.docs[0];
      const bikeData = bikeDoc.data();
      console.log(`\n✅ Bicicleta ID: ${bikeDoc.id}`);
      console.log(`   Número: ${bikeData.numero_identificacao}`);
      console.log(`   Status: ${bikeData.status}`);
      console.log(`   Proprietário ID: ${bikeData.proprietario_id}`);
      console.log(`   Controle Acesso ID: ${bikeData.controle_acesso_id}`);
      console.log(`   Último Check-in: ${bikeData.ultimo_checkin}`);
      
      // Buscar check-ins desta bicicleta
      const checkinsSnapshot = await db.collection('checkins')
        .where('bicicleta_id', '==', bikeDoc.id)
        .get();
      
      console.log(`\n📝 Check-ins encontrados: ${checkinsSnapshot.size}`);
      
      checkinsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n   Check-in ID: ${doc.id}`);
        console.log(`   Data/Hora: ${data.data_hora}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Operador: ${data.operador}`);
        console.log(`   Lacre: ${data.numero_lacre}`);
      });
    } else {
      console.log('❌ Bicicleta não encontrada!');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  
  process.exit(0);
}

verificarCheckin();

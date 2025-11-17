// Importa todas as nossas ferramentas
const admin = require('firebase-admin');
const fs = require('fs');
const axios = require('axios'); // O "baixador"
const sharp = require('sharp'); // O "otimizador" (mini-Photoshop)

// --- CONFIGURAÇÕES DE OTIMIZAÇÃO ---
// Você pode mudar isso se quiser
const TAMANHO_MAXIMO_PX = 500; // As fotos não terão mais que 500px de altura ou largura
const QUALIDADE_WEBP = 80;   // De 0 a 100 (80 é ótimo e leve)
// ------------------------------------

// Carrega a nossa "chave mestra" (a mesma que funcionou no projeto v3)
const serviceAccount = require('./serviceAccountKey.json');

// Inicializa o Firebase com as nossas credenciais de administrador
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'bicicletario-japeri-v3.firebasestorage.app' // <-- CORRIGIDO!
  });
} catch (e) {
  console.warn("App já inicializado? Continuando...");
}

// Cria referências para o Banco de Dados (Firestore) e o Armazenamento (Storage)
const db = admin.firestore();
const storage = admin.storage().bucket(); // O bucket padrão do nosso projeto

console.log(`Conectado ao projeto ${serviceAccount.project_id}`);
console.log(`Armazenamento (Bucket): ${storage.name}`);
console.log(`Otimização: ${TAMANHO_MAXIMO_PX}px, Qualidade WebP ${QUALIDADE_WEBP}%`);

/**
 * Função principal para migrar e otimizar as imagens
 */
async function migrarFotos() {
  console.log('🚀 Iniciando migração de fotos...');
  console.log('Buscando todos os proprietários no Firestore...');

  // 1. Pega todos os documentos da coleção 'proprietarios'
  const snapshot = await db.collection('proprietarios').get();

  if (snapshot.empty) {
    console.log('❌ Coleção "proprietarios" está vazia. Nada a fazer.');
    return;
  }

  console.log(`✅ Encontrados ${snapshot.size} proprietários. Começando o processo...`);

  // Vamos processar cada um
  for (const doc of snapshot.docs) {
    const proprietario = doc.data();
    const docId = doc.id;

    // 2. Pega a URL da foto do campo que você me disse
    const urlOriginal = proprietario.foto_proprietario_url;

    // Verifica se a URL existe e se é uma URL válida do Supabase (para não processar de novo)
    if (!urlOriginal || !urlOriginal.includes('supabase.co')) {
      console.log(`- [${docId}]: Pulando. URL não é do Supabase ou já foi migrada.`);
      continue; // Pula para o próximo
    }

    try {
      console.log(`- [${docId}]: Baixando foto de: ${urlOriginal.substring(0, 50)}...`);
      
      // 3. Baixa a foto original como um "buffer" (dados brutos)
      const response = await axios.get(urlOriginal, { responseType: 'arraybuffer' });
      const bufferOriginal = Buffer.from(response.data, 'binary');

      console.log(`  ...Baixada. Otimizando (Redimensionando e convertendo para WebP)...`);

      // 4. OTIMIZAÇÃO: Usa o 'sharp' para fazer a mágica
      const bufferOtimizado = await sharp(bufferOriginal)
        .resize(TAMANHO_MAXIMO_PX, TAMANHO_MAXIMO_PX, {
          fit: 'inside', // Mantém a proporção, cabendo em 500x500
          withoutEnlargement: true // Não aumenta fotos que já são pequenas
        })
        .webp({ quality: QUALIDADE_WEBP }) // Converte para WebP com a qualidade definida
        .toBuffer();

      console.log(`  ...Otimizada. Tamanho novo: ${Math.round(bufferOtimizado.length / 1024)} KB.`);

      // 5. Define o novo nome e local da foto no Firebase Storage
      const novoCaminho = `fotos_proprietarios/${docId}.webp`; // Salva na pasta "fotos_proprietarios" com o ID do usuário
      const file = storage.file(novoCaminho);

      // 6. Faz o upload da foto otimizada
      await file.save(bufferOtimizado, {
        metadata: { contentType: 'image/webp' }
      });

      console.log(`  ...Upload concluído. Tornando o arquivo público...`);
      
      // 7. Torna o arquivo público para que o app possa lê-lo
      await file.makePublic();

      // 8. Pega a nova URL pública
      const novaUrlPublica = file.publicUrl();

      console.log(`  ...Link novo: ${novaUrlPublica}`);

      // 9. Atualiza o documento no Firestore com a NOVA URL
      await db.collection('proprietarios').doc(docId).update({
        foto_proprietario_url: novaUrlPublica // Substitui a URL antiga pela nova
      });

      console.log(`✅ [${docId}]: Migração concluída com sucesso!`);

    } catch (err) {
      console.error(`❌ [${docId}]: FALHA no processo.`, err.message);
      // Continua para o próximo mesmo se um falhar
    }
  }

  console.log('🎉🎉🎉 Migração de todas as fotos concluída! 🎉🎉🎉');
}

// Inicia o processo
migrarFotos();

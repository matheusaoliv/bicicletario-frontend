// Importa as ferramentas do Firebase
const functions = require("firebase-functions");
const { https } = functions;
const admin = require("firebase-admin");

// Importa as ferramentas do nosso servidor
const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser');

// Inicializa o Firebase (para podermos usar o Firestore)
admin.initializeApp();
const db = admin.firestore();

// Cria o aplicativo Express
const app = express();

// Permite que nosso site acesse a API
app.use(cors({ origin: true }));
// Middleware condicional: JSON para a maioria das rotas, raw para /bicicletas
app.use((req, res, next) => {
  if (req.path === '/bicicletas' && req.method === 'POST') {
    // Para POST /bicicletas, não processa o body (deixa raw para busboy)
    next();
  } else {
    // Para outras rotas, usa JSON
    express.json()(req, res, next);
  }
});
app.use(cookieParser());

// Importa as ferramentas de autenticação
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Middleware de autenticação
const autenticarToken = (req, res, next) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        console.error('❌ JWT_SECRET não configurado. Defina a variável de ambiente.');
        return res.sendStatus(500);
    }
    let token = null;
    // 1. Tenta pegar do cabeçalho Authorization
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // 2. Se não achou, tenta pegar do query parameter 'token'
    if (!token && req.query.token) {
        token = req.query.token;
    }

    // 3. Se ainda não achou, tenta pegar de um cookie 'token' (opcional)
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    if (!token) return res.sendStatus(401); // Unauthorized
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('❌ Erro na verificação do JWT:', err.message);
            return res.sendStatus(403); // Forbidden
        }
        req.user = user;
        next();
    });
};

// --- AQUI VÃO AS SUAS ROTAS ANTIGAS ---

// Rota de Cadastro de Funcionário
app.post("/funcionarios/cadastro", async (req, res) => {
  try {
    const { nome_completo, nome_usuario, senha, email } = req.body;

    if (!nome_completo || !nome_usuario || !senha) {
      return res.status(400).send({ erro: "Campos obrigatórios faltando." });
    }

    // Verifica se o usuário já existe
    const userQuery = await db.collection('funcionarios').where('nome_usuario', '==', nome_usuario).get();
    if (!userQuery.empty) {
      return res.status(400).send({ erro: "Nome de usuário já existe." });
    }

    // Criptografa a senha
    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(senha, salt);

    // Salva no Firestore
    const novoFuncionario = {
      nome_completo,
      nome_usuario,
      senha_hash,
      email: email || null,
      criado_em: new Date().toISOString(),
    };
    const docRef = await db.collection('funcionarios').add(novoFuncionario);

    res.status(201).send({ id: docRef.id, mensagem: "Funcionário cadastrado com sucesso!" });

  } catch (error) {
    console.error("Erro ao cadastrar funcionário:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Rota de Login
app.post("/auth/login", async (req, res) => {
  try {
    const { nome_usuario, senha } = req.body;

    if (!nome_usuario || !senha) {
      return res.status(400).send({ erro: "Usuário e senha são obrigatórios." });
    }

    // Busca o usuário no Firestore
    const userQuery = await db.collection('funcionarios').where('nome_usuario', '==', nome_usuario).limit(1).get();

    if (userQuery.empty) {
      return res.status(401).send({ erro: "Usuário ou senha inválidos." });
    }

    const funcionarioDoc = userQuery.docs[0];
    const funcionario = funcionarioDoc.data();

    // Verificação de senha com fallback de migração:
    // 1) Se houver senha_hash, usa bcrypt.compare normalmente
    // 2) Se NÃO houver senha_hash mas existir campo legado 'senha' (plaintext),
    //    compara diretamente; se bater, converte e salva senha_hash e remove 'senha'.
    let senhaValida = false;
    const hash = funcionario && typeof funcionario.senha_hash === 'string' ? funcionario.senha_hash : null;
    if (hash) {
      senhaValida = await bcrypt.compare(senha, hash);
    } else if (funcionario && typeof funcionario.senha === 'string') {
      if (funcionario.senha === senha) {
        const salt = await bcrypt.genSalt(10);
        const novoHash = await bcrypt.hash(senha, salt);
        await db.collection('funcionarios').doc(funcionarioDoc.id).update({
          senha_hash: novoHash,
          senha: admin.firestore.FieldValue.delete()
        });
        senhaValida = true;
      } else {
        senhaValida = false;
      }
    }

    if (!senhaValida) {
      return res.status(401).send({ erro: "Usuário ou senha inválidos." });
    }

    // ✅ VERIFICAR SE É FUNCIONÁRIO DA SECRETARIA (ADMIN)
    const local = (funcionario.local || '').toLowerCase();
    const cargo = (funcionario.cargo || '').toLowerCase();
    const nome = (funcionario.nome_completo || funcionario.nome || funcionario.nome_usuario || '').toLowerCase();
    
    // Lista de funcionários da secretaria (administradores)
    const funcSecretaria = [
      'administrador',
      'matheus oliveira',
      'marcelo da silva rocha',
      'wenderson da silva soares',
      'joice barbosa nascimento',
      'marcelo damasceno de oliveira'
    ];
    
    const isAdmin = local.includes('secretaria') || 
                    cargo.includes('secretaria') || 
                    cargo.includes('admin') ||
                    funcSecretaria.includes(nome);
    
    if (!isAdmin) {
      console.log(`❌ Acesso negado para ${nome_usuario} - Não é da secretaria`);
      return res.status(403).send({ 
        erro: "Acesso negado. Apenas funcionários da secretaria podem acessar o painel administrativo." 
      });
    }
    
    console.log(`✅ Acesso permitido para ${nome_usuario} - Funcionário da secretaria`);

    // Gera o token JWT
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        console.error('❌ JWT_SECRET não configurado no ambiente.');
        return res.status(500).send({ erro: 'Configuração do servidor incompleta.' });
    }
    const token = jwt.sign(
      { 
        id: funcionarioDoc.id, 
        nome_usuario: funcionario.nome_usuario,
        isAdmin: true,
        local: funcionario.local
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Remove o hash da senha da resposta
    delete funcionario.senha_hash;

    const cleanToken = token.replace(/[^A-Za-z0-9-_\.]/g, '');
    res.status(200).send({ 
      mensagem: "Login bem-sucedido!",
      token: cleanToken,
      isAdmin: true,
      funcionario: { id: funcionarioDoc.id, ...funcionario }
    });

  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Login com Google (Firebase Authentication)
app.post("/auth/google-login", async (req, res) => {
  try {
    const { firebaseToken, email, nome, foto } = req.body;
    
    if (!firebaseToken || !email) {
      return res.status(400).send({ erro: "Token e email são obrigatórios." });
    }
    
    console.log(`🔐 Login Google: ${email}`);
    
    // ✅ Verificar token do Firebase
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    } catch (error) {
      console.error('❌ Token Firebase inválido:', error);
      return res.status(401).send({ erro: "Token de autenticação inválido." });
    }
    
    const uid = decodedToken.uid;
    const emailVerificado = decodedToken.email;
    
    // Verificar se o email do token corresponde ao enviado
    if (emailVerificado !== email) {
      return res.status(401).send({ erro: "Email não corresponde ao token." });
    }
    
    console.log(`✅ Token Firebase válido para: ${emailVerificado}`);
    
    // ✅ Buscar funcionário por email
    const funcionarioQuery = await db.collection('funcionarios')
      .where('email', '==', emailVerificado)
      .limit(1)
      .get();
    
    if (funcionarioQuery.empty) {
      console.log(`❌ Email ${emailVerificado} não cadastrado no sistema`);
      return res.status(404).send({ 
        erro: "Email não cadastrado no sistema. Contate o administrador para cadastrar seu email." 
      });
    }
    
    const funcionarioDoc = funcionarioQuery.docs[0];
    const funcionario = funcionarioDoc.data();
    
    console.log(`✅ Funcionário encontrado: ${funcionario.nome_completo || funcionario.nome}`);
    
    // ✅ Verificar se é da secretaria
    const local = (funcionario.local || '').toLowerCase();
    const cargo = (funcionario.cargo || '').toLowerCase();
    const nomeFunc = (funcionario.nome_completo || funcionario.nome || '').toLowerCase();
    
    const funcSecretaria = [
      'administrador',
      'matheus oliveira',
      'marcelo da silva rocha',
      'wenderson da silva soares',
      'joice barbosa nascimento',
      'marcelo damasceno de oliveira'
    ];
    
    const isAdmin = local.includes('secretaria') || 
                    cargo.includes('secretaria') || 
                    cargo.includes('admin') ||
                    funcSecretaria.includes(nomeFunc);
    
    if (!isAdmin) {
      console.log(`❌ Acesso negado para ${emailVerificado} - Não é da secretaria`);
      return res.status(403).send({ 
        erro: "Acesso negado. Apenas funcionários da secretaria podem acessar o painel administrativo." 
      });
    }
    
    console.log(`✅ Acesso permitido para ${emailVerificado} - Funcionário da secretaria`);
    
    // ✅ Atualizar foto e último login do funcionário
    const updateData = {
      ultimo_login_google: new Date().toISOString(),
      ultimo_login: new Date().toISOString()
    };
    
    if (foto && foto !== funcionario.fotoUrl) {
      updateData.fotoUrl = foto;
      console.log(`📸 Atualizando foto do funcionário`);
    }
    
    await db.collection('funcionarios').doc(funcionarioDoc.id).update(updateData);
    
    // ✅ Gerar token JWT
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET não configurado no ambiente.');
      return res.status(500).send({ erro: 'Configuração do servidor incompleta.' });
    }
    
    const token = jwt.sign(
      { 
        id: funcionarioDoc.id,
        email: emailVerificado,
        nome_usuario: funcionario.nome_usuario || emailVerificado,
        isAdmin: true,
        loginMethod: 'google',
        uid: uid
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    const cleanToken = token.replace(/[^A-Za-z0-9-_\.]/g, '');
    
    console.log(`✅ Token JWT gerado para ${emailVerificado}`);
    
    res.status(200).send({
      mensagem: "Login Google bem-sucedido!",
      token: cleanToken,
      isAdmin: true,
      funcionario: {
        id: funcionarioDoc.id,
        nome: funcionario.nome_completo || funcionario.nome || nome,
        email: emailVerificado,
        foto: foto || funcionario.fotoUrl || '',
        cargo: funcionario.cargo || '',
        local: funcionario.local || ''
      }
    });
    
  } catch (error) {
    console.error("❌ Erro no login Google:", error);
    res.status(500).send({ erro: "Erro ao processar login com Google", detalhes: error.message });
  }
});

// Listar funcionários da secretaria (endpoint público para tela de login)
app.get("/funcionarios/secretaria", async (req, res) => {
  try {
    console.log('📋 Buscando funcionários da secretaria...');
    
    // Buscar todos os funcionários
    const funcionariosSnapshot = await db.collection('funcionarios').get();
    
    // Lista de funcionários da secretaria
    const funcSecretaria = [
      'administrador',
      'matheus oliveira',
      'marcelo da silva rocha',
      'wenderson da silva soares',
      'joice barbosa nascimento',
      'marcelo damasceno de oliveira'
    ];
    
    const funcionariosSecretaria = [];
    
    funcionariosSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const local = (data.local || '').toLowerCase();
      const cargo = (data.cargo || '').toLowerCase();
      const nome = (data.nome_completo || data.nome || data.nome_usuario || '').toLowerCase();
      
      // Verificar se é da secretaria
      const isSecretaria = local.includes('secretaria') || 
                          cargo.includes('secretaria') || 
                          cargo.includes('admin') ||
                          funcSecretaria.includes(nome);
      
      if (isSecretaria && data.nome_usuario) {
        funcionariosSecretaria.push({
          nome_usuario: data.nome_usuario,
          nome_completo: data.nome_completo || data.nome || '',
          nome: data.nome_completo || data.nome || '',
          cargo: data.cargo || '',
          local: data.local || ''
        });
      }
    });
    
    console.log(`✅ Encontrados ${funcionariosSecretaria.length} funcionários da secretaria`);
    res.status(200).json(funcionariosSecretaria);
  } catch (error) {
    console.error("Erro ao buscar funcionários da secretaria:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Exemplo de uma rota de teste
app.get("/hello", (req, res) => {
  res.status(200).send("Olá do Firebase!");
});

// Rota para cadastrar um proprietário (exemplo)
app.post("/proprietarios", async (req, res) => {
  try {
    const novoProprietario = req.body;
    // Agora usamos o Firestore, não o Supabase!
    const docRef = await db.collection("proprietarios").add(novoProprietario);

    res.status(201).send({ id: docRef.id, ...novoProprietario });
  } catch (error) {
    console.error("Erro ao cadastrar proprietário:", error);
    res.status(500).send("Erro interno no servidor");
  }
});

// --- ROTAS DE PROPRIETÁRIOS ---

// Listar todos os proprietários
app.get("/proprietarios", autenticarToken, async (req, res) => {
  try {
    const snapshot = await db.collection('proprietarios').get();
    const proprietarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(proprietarios);
  } catch (error) {
    console.error("Erro ao listar proprietários:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Buscar um proprietário pelo ID
app.get("/proprietarios/:id", autenticarToken, async (req, res) => {
  try {
    const docRef = db.collection('proprietarios').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ erro: 'Proprietário não encontrado' });
    }
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Erro ao buscar proprietário:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Criar um novo proprietário
app.post("/proprietarios", autenticarToken, async (req, res) => {
  try {
    const novoProprietario = req.body;
    // Validação básica
    if (!novoProprietario.nome_completo) {
      return res.status(400).send({ erro: 'Nome completo é obrigatório.' });
    }
    const docRef = await db.collection('proprietarios').add(novoProprietario);
    res.status(201).send({ id: docRef.id, ...novoProprietario });
  } catch (error) {
    console.error("Erro ao criar proprietário:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Atualizar um proprietário
app.put("/proprietarios/:id", autenticarToken, async (req, res) => {
  try {
    const docRef = db.collection('proprietarios').doc(req.params.id);
    await docRef.update(req.body);
    res.status(200).send({ mensagem: 'Proprietário atualizado com sucesso' });
  } catch (error) {
    console.error("Erro ao atualizar proprietário:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Deletar um proprietário
app.delete("/proprietarios/:id", autenticarToken, async (req, res) => {
  try {
    // Opcional: Verificar se o proprietário tem bicicletas associadas antes de deletar
    const bicicletasQuery = await db.collection('bicicletas').where('proprietario_id', '==', req.params.id).get();
    if (!bicicletasQuery.empty) {
      return res.status(400).send({ erro: 'Não é possível deletar proprietário com bicicletas associadas.' });
    }
    await db.collection('proprietarios').doc(req.params.id).delete();
    res.status(200).send({ mensagem: 'Proprietário deletado com sucesso' });
  } catch (error) {
    console.error("Erro ao deletar proprietário:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Listar bicicletas de um proprietário específico
app.get("/proprietarios/:id/bicicletas", autenticarToken, async (req, res) => {
  try {
    const propId = req.params.id;
    // Busca por proprietario_id como string ou número
    const bicicletasSnapshot = await db.collection('bicicletas')
      .where('proprietario_id', 'in', [propId, Number(propId)])
      .get();
    
    const bicicletas = [];
    
    for (const doc of bicicletasSnapshot.docs) {
      const bikeData = { id: doc.id, ...doc.data() };
      
      // Adicionar open_registro_id para compatibilidade com frontend
      if (bikeData.controle_acesso_id) {
        bikeData.open_registro_id = bikeData.controle_acesso_id;
        console.log(`✅ Bike ${bikeData.id}: open_registro_id = ${bikeData.open_registro_id}`);
      } else if (bikeData.status === 'DENTRO') {
        // Se está DENTRO mas não tem controle_acesso_id, buscar o último check-in ativo
        console.log(`⚠️ Bike ${bikeData.id} está DENTRO mas sem controle_acesso_id. Buscando...`);
        try {
          const checkinSnapshot = await db.collection('checkins')
            .where('bicicleta_id', '==', doc.id)
            .where('status', '==', 'ativo')
            .limit(1)
            .get();
          
          if (!checkinSnapshot.empty) {
            const checkinId = checkinSnapshot.docs[0].id;
            bikeData.open_registro_id = checkinId;
            bikeData.controle_acesso_id = checkinId;
            console.log(`✅ Check-in ativo encontrado: ${checkinId}`);
          }
        } catch (err) {
          console.error(`❌ Erro ao buscar check-in ativo:`, err.message);
        }
      }
      
      bicicletas.push(bikeData);
    }
    
    res.status(200).json(bicicletas);
  } catch (error) {
    console.error("Erro ao buscar bicicletas do proprietário:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// --- ROTAS DE BICICLETAS ---

// Listar todas as bicicletas
app.get("/bicicletas", autenticarToken, async (req, res) => {
  try {
    const snapshot = await db.collection('bicicletas').get();
    const bicicletas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(bicicletas);
  } catch (error) {
    console.error("Erro ao listar bicicletas:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Buscar uma bicicleta pelo ID
app.get("/bicicletas/:id", autenticarToken, async (req, res) => {
  try {
    const docRef = db.collection('bicicletas').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ erro: 'Bicicleta não encontrada' });
    }
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Erro ao buscar bicicleta:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Criar uma nova bicicleta (aceita JSON)
app.post("/bicicletas", autenticarToken, async (req, res) => {
  try {
    console.log('📝 Recebendo dados da bicicleta:', req.body);
    const { proprietario_id, numero_bike, tipo_bike, marca, modelo, observacoes, cor } = req.body;
    
    // Validação de campos obrigatórios
    if (!proprietario_id || !marca) {
      console.error('❌ Campos obrigatórios faltando:', { proprietario_id, marca });
      return res.status(400).send({ erro: 'Campos proprietario_id e marca são obrigatórios.' });
    }
    
    // Validar se o número da bicicleta já existe
    if (numero_bike) {
      const bicicletasExistentes = await db.collection('bicicletas')
        .where('numero_bike', '==', numero_bike)
        .get();
      
      if (!bicicletasExistentes.empty) {
        console.error('❌ Número de bicicleta já existe:', numero_bike);
        return res.status(409).send({ erro: `Número da bicicleta ${numero_bike} já está cadastrado.` });
      }
      
      // Verificar também pelo campo antigo
      const bicicletasExistentes2 = await db.collection('bicicletas')
        .where('numero_identificacao', '==', numero_bike)
        .get();
      
      if (!bicicletasExistentes2.empty) {
        console.error('❌ Número de bicicleta já existe (campo antigo):', numero_bike);
        return res.status(409).send({ erro: `Número da bicicleta ${numero_bike} já está cadastrado.` });
      }
    }
    
    const novaBicicleta = {
      proprietario_id: String(proprietario_id),
      numero_bike: numero_bike || '',  // ✅ Campo correto
      numero_identificacao: numero_bike || '',  // ✅ Mantém compatibilidade
      tipo_bike: tipo_bike || '',
      marca,
      modelo: modelo || '',
      cor: cor || '',
      observacoes: observacoes || '',
      data_cadastro: new Date().toISOString(),
      status: 'FORA'  // ✅ Status inicial
    };
    
    console.log('✅ Salvando bicicleta no Firestore:', novaBicicleta);
    const docRef = await db.collection('bicicletas').add(novaBicicleta);
    console.log('✅ Bicicleta salva com ID:', docRef.id);
    
    res.status(201).send({ 
      id: docRef.id, 
      mensagem: 'Bicicleta adicionada com sucesso!',
      ...novaBicicleta 
    });
  } catch (error) {
    console.error("❌ Erro ao criar bicicleta:", error);
    res.status(500).send({ erro: "Erro interno no servidor", detalhes: error.message });
  }
});

// Atualizar uma bicicleta
app.put("/bicicletas/:id", autenticarToken, async (req, res) => {
  try {
    const docRef = db.collection('bicicletas').doc(req.params.id);
    await docRef.update(req.body);
    res.status(200).send({ mensagem: 'Bicicleta atualizada com sucesso' });
  } catch (error) {
    console.error("Erro ao atualizar bicicleta:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Deletar uma bicicleta
app.delete("/bicicletas/:id", autenticarToken, async (req, res) => {
  try {
    // Opcional: Verificar se a bicicleta está em algum registro de acesso
    const acessosQuery = await db.collection('controleacesso').where('bicicleta_id', '==', req.params.id).get();
    if (!acessosQuery.empty) {
      return res.status(400).send({ erro: 'Não é possível deletar bicicleta com registros de acesso associados.' });
    }
    await db.collection('bicicletas').doc(req.params.id).delete();
    res.status(200).send({ mensagem: 'Bicicleta deletada com sucesso' });
  } catch (error) {
    console.error("Erro ao deletar bicicleta:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Buscar dependências de uma bicicleta (contagem de registros relacionados)
app.get("/bicicletas/:id/dependencias", autenticarToken, async (req, res) => {
  try {
    const bikeId = req.params.id;
    
    // Busca registros de controle de acesso (tanto string quanto número)
    const acessosSnapshot = await db.collection('controleacesso')
      .where('bicicleta_id', 'in', [bikeId, Number(bikeId)])
      .get();
    
    const totalAcessos = acessosSnapshot.size;
    const acessosAtivos = acessosSnapshot.docs.filter(doc => !doc.data().data_hora_saida).length;
    
    res.status(200).json({
      total_acessos: totalAcessos,
      acessos_ativos: acessosAtivos,
      pode_deletar: totalAcessos === 0
    });
  } catch (error) {
    console.error("Erro ao buscar dependências da bicicleta:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// --- ROTAS DE CONTROLE DE ACESSO ---

// Registrar entrada de bicicleta
app.post("/controleacesso/entrada", autenticarToken, async (req, res) => {
  try {
    const { bicicleta_id, proprietario_id, local } = req.body;
    if (!bicicleta_id || !proprietario_id || !local) {
      return res.status(400).send({ erro: 'Campos bicicleta_id, proprietario_id e local são obrigatórios.' });
    }

    const novoAcesso = {
      bicicleta_id,
      proprietario_id,
      local,
      data_hora_entrada: new Date().toISOString(),
      data_hora_saida: null, // Saída ainda não ocorreu
      funcionario_entrada_id: req.user.id, // ID do funcionário logado
    };

    const docRef = await db.collection('controleacesso').add(novoAcesso);
    res.status(201).send({ id: docRef.id, ...novoAcesso });

  } catch (error) {
    console.error("Erro ao registrar entrada:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Registrar saída de bicicleta
app.post("/controleacesso/saida", autenticarToken, async (req, res) => {
  try {
    const { registro_id } = req.body;
    if (!registro_id) {
      return res.status(400).send({ erro: 'O ID do registro de acesso é obrigatório.' });
    }

    const docRef = db.collection('controleacesso').doc(registro_id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send({ erro: 'Registro de acesso não encontrado.' });
    }

    if (doc.data().data_hora_saida) {
        return res.status(400).send({ erro: 'Esta bicicleta já teve sua saída registrada.' });
    }

    await docRef.update({
      data_hora_saida: new Date().toISOString(),
      funcionario_saida_id: req.user.id, // ID do funcionário logado
    });

    res.status(200).send({ mensagem: 'Saída registrada com sucesso' });

  } catch (error) {
    console.error("Erro ao registrar saída:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Buscar proprietários sem bicicleta (para adicionar-bicicleta.html)
app.get("/controle-acesso/buscar", autenticarToken, async (req, res) => {
  try {
    const termo = (req.query.termo || '').toLowerCase().trim();
    
    if (termo.length < 2) {
      return res.status(200).json([]);
    }
    
    console.log(`🔍 Buscando proprietários sem bicicleta: "${termo}"`);
    
    // Buscar todos os proprietários
    const proprietariosSnapshot = await db.collection('proprietarios').get();
    
    // Buscar todas as bicicletas
    const bicicletasSnapshot = await db.collection('bicicletas').get();
    
    // Criar set de proprietários que JÁ TÊM bicicleta
    const proprietariosComBike = new Set();
    bicicletasSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const propId = String(data.proprietario_id || '');
      if (propId) {
        proprietariosComBike.add(propId);
      }
    });
    
    // Filtrar proprietários SEM bicicleta e que correspondem ao termo
    const resultados = [];
    proprietariosSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const propId = doc.id;
      
      // Pula se já tem bicicleta
      if (proprietariosComBike.has(propId)) {
        return;
      }
      
      // Verifica se corresponde ao termo de busca
      const nome = (data.nome_completo || data.nome || '').toLowerCase();
      const cpf = String(data.cpf || '').toLowerCase();
      
      if (nome.includes(termo) || cpf.includes(termo)) {
        resultados.push({
          status: 'SEM_BICICLETA',
          proprietario: {
            id: propId,
            nome_completo: data.nome_completo || data.nome || '',
            cpf: String(data.cpf || ''),
            email: data.email || '',
            contato: String(data.contato || '')
          }
        });
      }
    });
    
    console.log(`✅ Encontrados ${resultados.length} proprietários sem bicicleta`);
    res.status(200).json(resultados);
  } catch (error) {
    console.error("Erro ao buscar proprietários sem bicicleta:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Listar registros de controle de acesso (com paginação simples)
app.get("/controleacesso", autenticarToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const snapshot = await db.collection('controleacesso')
                                 .orderBy('data_hora_entrada', 'desc')
                                 .limit(limit)
                                 .get();
        const acessos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(acessos);
    } catch (error) {
        console.error("Erro ao listar registros de acesso:", error);
        res.status(500).send({ erro: "Erro interno no servidor" });
    }
});

// --- ROTA DO DASHBOARD ---

app.get("/dashboard/stats", autenticarToken, async (req, res) => {
  try {
    const dias = Math.max(1, parseInt(req.query.dias || '7', 10));
    const dataRef = (req.query.data && String(req.query.data)) || new Date().toISOString().slice(0, 10);
    const tzOffsetMinutes = parseInt(req.query.tzOffsetMinutes || '0', 10);
    const localFiltro = req.query.local && req.query.local !== 'todos' ? String(req.query.local).trim() : null;

    const [Y, M, D] = dataRef.split('-').map(n => parseInt(n, 10));
    const endUTCms = Date.UTC(Y, (M || 1) - 1, D || 1, 23, 59, 59, 999) + (tzOffsetMinutes * 60000);
    const startBase = new Date(Date.UTC(Y, (M || 1) - 1, D || 1, 0, 0, 0, 0));
    startBase.setUTCDate(startBase.getUTCDate() - (dias - 1));
    const startUTCms = startBase.getTime() + (tzOffsetMinutes * 60000);

    const start = new Date(startUTCms).toISOString();
    const end = new Date(endUTCms).toISOString();
    
    console.log(`📊 Dashboard Stats - Período: ${start} até ${end}`);
    console.log(`📊 Data referência: ${dataRef}, Dias: ${dias}, TZ Offset: ${tzOffsetMinutes}min`);

    // 1. Bicicletas atualmente estacionadas (status ativo em checkins)
    let estQuery = db.collection('checkins').where('status', '==', 'ativo');
    if (localFiltro) estQuery = estQuery.where('local', '==', localFiltro);
    const estacionadasSnapshot = await estQuery.count().get();
    const estacionadasAgora = estacionadasSnapshot.data().count;
    console.log(`✅ Bicicletas estacionadas: ${estacionadasAgora}`);

    // 2. Entradas no período (checkins)
    let entQuery = db.collection('checkins').where('data_hora', '>=', start).where('data_hora', '<=', end);
    if (localFiltro) entQuery = entQuery.where('local', '==', localFiltro);
    const entradasSnapshot = await entQuery.count().get();
    const entradasHoje = entradasSnapshot.data().count;
    console.log(`✅ Entradas no período: ${entradasHoje}`);

    // 3. Saídas no período (checkouts)
    let saiQuery = db.collection('checkouts').where('data_hora', '>=', start).where('data_hora', '<=', end);
    if (localFiltro) saiQuery = saiQuery.where('local', '==', localFiltro);
    const saidasSnapshot = await saiQuery.count().get();
    const saidasHoje = saidasSnapshot.data().count;
    console.log(`✅ Saídas no período: ${saidasHoje}`);

    // 4. Atividades recentes (checkins e checkouts combinados)
    let checkinsQuery = db.collection('checkins')
      .where('data_hora', '>=', start)
      .where('data_hora', '<=', end)
      .orderBy('data_hora', 'desc')
      .limit(50);
    
    let checkoutsQuery = db.collection('checkouts')
      .where('data_hora', '>=', start)
      .where('data_hora', '<=', end)
      .orderBy('data_hora', 'desc')
      .limit(50);
    
    // Aplicar filtro de local se especificado
    if (localFiltro) {
      checkinsQuery = checkinsQuery.where('local', '==', localFiltro);
      checkoutsQuery = checkoutsQuery.where('local', '==', localFiltro);
    }
    
    const [checkinsRecentes, checkoutsRecentes] = await Promise.all([
      checkinsQuery.get(),
      checkoutsQuery.get()
    ]);
    
    // Marcar tipo de cada documento
    const checkinsComTipo = checkinsRecentes.docs.map(doc => ({ doc, tipo: 'entrada' }));
    const checkoutsComTipo = checkoutsRecentes.docs.map(doc => ({ doc, tipo: 'saida' }));
    
    const atividadesSnapshot = {
      docs: [...checkinsComTipo, ...checkoutsComTipo]
        .sort((a, b) => {
          const dateA = a.doc.data().data_hora || '';
          const dateB = b.doc.data().data_hora || '';
          return dateB.localeCompare(dateA);
        })
        .slice(0, 100)
    };
    
    // Populate: buscar dados de bicicletas e proprietários
    console.log(`🔍 Populando ${atividadesSnapshot.docs.length} atividades...`);
    const atividadesRecentes = await Promise.all(
      atividadesSnapshot.docs.map(async (item) => {
        const doc = item.doc;
        const atividade = { 
          id: doc.id, 
          ...doc.data(),
          tipo_atividade: item.tipo,
          data_hora_entrada: item.tipo === 'entrada' ? doc.data().data_hora : null,
          data_hora_saida: item.tipo === 'saida' ? doc.data().data_hora : null
        };
        
        // Buscar dados da bicicleta
        if (atividade.bicicleta_id && String(atividade.bicicleta_id).trim() !== '') {
          try {
            const bikeId = String(atividade.bicicleta_id).trim();
            const bikeDoc = await db.collection('bicicletas').doc(bikeId).get();
            if (bikeDoc.exists) {
              atividade.bicicleta = { id: bikeDoc.id, ...bikeDoc.data() };
              console.log(`✅ Bicicleta ${bikeId} encontrada:`, atividade.bicicleta.marca, atividade.bicicleta.modelo);
            } else {
              console.warn(`⚠️ Bicicleta ${bikeId} não encontrada no Firestore`);
            }
          } catch (e) {
            console.error('❌ Erro ao buscar bicicleta:', e);
          }
        }
        
        // Buscar dados do proprietário
        if (atividade.proprietario_id && String(atividade.proprietario_id).trim() !== '') {
          try {
            const propId = String(atividade.proprietario_id).trim();
            const propDoc = await db.collection('proprietarios').doc(propId).get();
            if (propDoc.exists) {
              atividade.proprietario = { id: propDoc.id, ...propDoc.data() };
              console.log(`✅ Proprietário ${propId} encontrado:`, atividade.proprietario.nome_completo);
            } else {
              console.warn(`⚠️ Proprietário ${propId} não encontrado no Firestore`);
            }
          } catch (e) {
            console.error('❌ Erro ao buscar proprietário:', e);
          }
        }
        
        return atividade;
      })
    );
    console.log(`✅ Populate concluído. Retornando ${atividadesRecentes.length} atividades.`);

    // 5. Ranking de proprietários (quem mais usa o bicicletário)
    const rankingMap = new Map();
    
    // Contar entradas por proprietário
    let rankingQuery = db.collection('checkins')
      .where('data_hora', '>=', start)
      .where('data_hora', '<=', end);
    
    if (localFiltro) {
      rankingQuery = rankingQuery.where('local', '==', localFiltro);
    }
    
    const todosCheckins = await rankingQuery.get();
    
    todosCheckins.forEach(doc => {
      const data = doc.data();
      const propId = data.proprietario_id;
      const propNome = data.proprietario_nome || 'Desconhecido';
      
      if (propId) {
        if (!rankingMap.has(propId)) {
          rankingMap.set(propId, { proprietario_id: propId, nome: propNome, entradas: 0 });
        }
        rankingMap.get(propId).entradas++;
      }
    });
    
    const rankingProprietarios = Array.from(rankingMap.values())
      .sort((a, b) => b.entradas - a.entradas)
      .slice(0, 10); // Top 10
    
    console.log(`📊 Ranking: ${rankingProprietarios.length} proprietários`);

    // 6. Distribuição de tipos de bicicleta estacionadas
    const tiposBicicletas = {};
    let tiposQuery = db.collection('checkins').where('status', '==', 'ativo');
    
    if (localFiltro) {
      tiposQuery = tiposQuery.where('local', '==', localFiltro);
    }
    
    const bikesEstacionadas = await tiposQuery.get();
    
    for (const doc of bikesEstacionadas.docs) {
      const checkin = doc.data();
      if (checkin.bicicleta_id) {
        try {
          const bikeDoc = await db.collection('bicicletas').doc(String(checkin.bicicleta_id)).get();
          if (bikeDoc.exists) {
            const tipo = bikeDoc.data().tipo_bike || 'Não especificado';
            tiposBicicletas[tipo] = (tiposBicicletas[tipo] || 0) + 1;
          }
        } catch (err) {
          console.error('Erro ao buscar tipo de bicicleta:', err);
        }
      }
    }
    
    const distribuicaoTipos = Object.entries(tiposBicicletas).map(([tipo, quantidade]) => ({
      tipo,
      quantidade
    }));
    
    console.log(`🚲 Distribuição de tipos: ${distribuicaoTipos.length} tipos`);

    // 7. Distribuição de atividades (entradas vs saídas por hora)
    const fluxoPorHora = {};
    
    // Processar check-ins
    todosCheckins.forEach(doc => {
      const data = doc.data();
      if (data.data_hora) {
        const hora = new Date(data.data_hora).getHours();
        if (!fluxoPorHora[hora]) {
          fluxoPorHora[hora] = { hora, entradas: 0, saidas: 0 };
        }
        fluxoPorHora[hora].entradas++;
      }
    });
    
    // Processar checkouts
    let checkoutsFluxoQuery = db.collection('checkouts')
      .where('data_hora', '>=', start)
      .where('data_hora', '<=', end);
    
    if (localFiltro) {
      checkoutsFluxoQuery = checkoutsFluxoQuery.where('local', '==', localFiltro);
    }
    
    const todosCheckouts = await checkoutsFluxoQuery.get();
    
    todosCheckouts.forEach(doc => {
      const data = doc.data();
      if (data.data_hora) {
        const hora = new Date(data.data_hora).getHours();
        if (!fluxoPorHora[hora]) {
          fluxoPorHora[hora] = { hora, entradas: 0, saidas: 0 };
        }
        fluxoPorHora[hora].saidas++;
      }
    });
    
    const fluxoHorario = Object.values(fluxoPorHora).sort((a, b) => a.hora - b.hora);
    
    console.log(`⏰ Fluxo por hora: ${fluxoHorario.length} horas com atividade`);

    // 8. Listas detalhadas para os modais
    console.log(`📋 Buscando listas detalhadas para modais...`);
    
    // Bicicletas estacionadas (detalhadas)
    const bicicletasEstacionadasDetalhadas = [];
    for (const doc of bikesEstacionadas.docs) {
      const checkin = doc.data();
      try {
        const bikeDoc = await db.collection('bicicletas').doc(String(checkin.bicicleta_id)).get();
        const propDoc = await db.collection('proprietarios').doc(String(checkin.proprietario_id)).get();
        
        if (bikeDoc.exists && propDoc.exists) {
          bicicletasEstacionadasDetalhadas.push({
            ...bikeDoc.data(),
            id: bikeDoc.id,
            nome_completo: propDoc.data().nome_completo,
            status_pessoa: 'Dentro',
            data_entrada: checkin.data_hora
          });
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes da bike estacionada:', err);
      }
    }
    
    // Entradas hoje (detalhadas)
    const entradasHojeDetalhadas = [];
    for (const doc of todosCheckins.docs) {
      const checkin = doc.data();
      try {
        const bikeDoc = checkin.bicicleta_id ? await db.collection('bicicletas').doc(String(checkin.bicicleta_id)).get() : null;
        const propDoc = checkin.proprietario_id ? await db.collection('proprietarios').doc(String(checkin.proprietario_id)).get() : null;
        
        entradasHojeDetalhadas.push({
          id: doc.id,
          data_hora: checkin.data_hora,
          local: checkin.local,
          nome_completo: propDoc?.exists ? propDoc.data().nome_completo : checkin.proprietario_nome || 'Desconhecido',
          numero_identificacao: bikeDoc?.exists ? bikeDoc.data().numero_identificacao : checkin.bicicleta_numero || '-',
          tipo_bike: bikeDoc?.exists ? bikeDoc.data().tipo_bike : '-',
          modelo: bikeDoc?.exists ? bikeDoc.data().modelo : '-'
        });
      } catch (err) {
        console.error('Erro ao buscar detalhes da entrada:', err);
      }
    }
    
    // Saídas hoje (detalhadas)
    const saidasHojeDetalhadas = [];
    for (const doc of todosCheckouts.docs) {
      const checkout = doc.data();
      try {
        const bikeDoc = checkout.bicicleta_id ? await db.collection('bicicletas').doc(String(checkout.bicicleta_id)).get() : null;
        const propDoc = checkout.proprietario_id ? await db.collection('proprietarios').doc(String(checkout.proprietario_id)).get() : null;
        
        saidasHojeDetalhadas.push({
          id: doc.id,
          data_hora: checkout.data_hora,
          local: checkout.local,
          nome_completo: propDoc?.exists ? propDoc.data().nome_completo : checkout.proprietario_nome || 'Desconhecido',
          numero_identificacao: bikeDoc?.exists ? bikeDoc.data().numero_identificacao : checkout.bicicleta_numero || '-',
          tipo_bike: bikeDoc?.exists ? bikeDoc.data().tipo_bike : '-',
          modelo: bikeDoc?.exists ? bikeDoc.data().modelo : '-'
        });
      } catch (err) {
        console.error('Erro ao buscar detalhes da saída:', err);
      }
    }
    
    console.log(`✅ Listas detalhadas: ${bicicletasEstacionadasDetalhadas.length} estacionadas, ${entradasHojeDetalhadas.length} entradas, ${saidasHojeDetalhadas.length} saídas`);

    // Compatibilidade com frontend antigo
    const response = {
        estacionadasAgora,
        entradasHoje,
        saidasHoje,
        atividadesRecentes,
        rankingProprietarios,
        distribuicaoTipos,
        fluxoHorario,
        // Listas detalhadas para modais
        bicicletasEstacionadas: bicicletasEstacionadasDetalhadas,
        entradasHojeDetalhadas,
        saidasHojeDetalhadas,
        // Aliases para compatibilidade
        bicicletasEstacionadasAgora: estacionadasAgora,
        ocorrenciasHoje: 0 // TODO: implementar ocorrências
    };
    
    res.status(200).json(response);

  } catch (error) {
    console.error("Erro ao gerar estatísticas do dashboard:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});


// --- ROTAS ADICIONAIS (ADMIN, ETC) ---

// Rota de cadastro completo (proprietário + bicicleta)
app.post("/cadastros", autenticarToken, async (req, res) => {
  try {
    console.log('📝 Recebendo cadastro completo:', req.body);
    const { nome, email, cpf, contato, endereco, numero_bike, tipo_bike, marca, modelo, observacoes } = req.body;
    
    // Validação básica
    if (!nome || !cpf) {
      return res.status(400).send({ erro: 'Nome e CPF são obrigatórios.' });
    }
    if (!numero_bike || !marca || !modelo) {
      return res.status(400).send({ erro: 'Número da bike, marca e modelo são obrigatórios.' });
    }
    
    // 1. Criar proprietário
    const novoProprietario = {
      nome: nome.trim(),
      email: email?.trim() || '',
      cpf: cpf.trim(),
      contato: contato?.trim() || '',
      endereco: endereco?.trim() || '',
      data_cadastro: new Date().toISOString()
    };
    
    console.log('✅ Salvando proprietário no Firestore:', novoProprietario);
    const propRef = await db.collection('proprietarios').add(novoProprietario);
    console.log('✅ Proprietário salvo com ID:', propRef.id);
    
    // 2. Criar bicicleta vinculada ao proprietário
    const novaBicicleta = {
      proprietario_id: propRef.id,
      numero_identificacao: numero_bike.trim(),
      tipo_bike: tipo_bike?.trim() || '',
      marca: marca.trim(),
      modelo: modelo.trim(),
      cor: '',
      observacoes: observacoes?.trim() || '',
      data_cadastro: new Date().toISOString()
    };
    
    console.log('✅ Salvando bicicleta no Firestore:', novaBicicleta);
    const bikeRef = await db.collection('bicicletas').add(novaBicicleta);
    console.log('✅ Bicicleta salva com ID:', bikeRef.id);
    
    res.status(201).send({
      mensagem: 'Cadastro realizado com sucesso!',
      proprietarioId: propRef.id,
      bicicletaId: bikeRef.id,
      proprietario: { id: propRef.id, ...novoProprietario },
      bicicleta: { id: bikeRef.id, ...novaBicicleta }
    });
  } catch (error) {
    console.error("❌ Erro ao criar cadastro:", error);
    res.status(500).send({ erro: "Erro interno no servidor", detalhes: error.message });
  }
});

// Rota de ping para heartbeat
app.post("/funcionarios/ping", autenticarToken, (req, res) => {
  res.status(200).send({ status: 'ok' });
});

// Rota de health check
app.get("/health", (req, res) => {
  res.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rota de busca para controle de acesso
app.get("/controle-acesso/buscar", autenticarToken, async (req, res) => {
  try {
    const termo = (req.query.termo || '').toLowerCase();
    if (!termo) {
      return res.status(400).send({ erro: 'Termo de busca é obrigatório.' });
    }

    // Esta é uma busca simples. Pode ser otimizada com indexação (e.g., Algolia) no futuro.
    const proprietariosSnapshot = await db.collection('proprietarios').get();
    const bicicletasSnapshot = await db.collection('bicicletas').get();

    const proprietarios = proprietariosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const bicicletas = bicicletasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const resultados = [];

    for (const p of proprietarios) {
        const nome = String(p.nome_completo || '').toLowerCase();
        const cpf = String(p.cpf || '').toLowerCase();
        if (nome.includes(termo) || cpf.includes(termo)) {
            // Converte IDs para string para comparação (podem ser string ou número no Firestore)
            const propId = String(p.id);
            const bike = bicicletas.find(b => String(b.proprietario_id) === propId);
            
            // Buscar check-in ativo se necessário
            if (bike) {
                console.log(`🔍 Bicicleta ${bike.id}:`, {
                    status: bike.status,
                    controle_acesso_id: bike.controle_acesso_id,
                    ultimo_checkin: bike.ultimo_checkin
                });
                
                // Adicionar open_registro_id para compatibilidade com frontend
                if (bike.controle_acesso_id) {
                    bike.open_registro_id = bike.controle_acesso_id;
                    console.log(`✅ open_registro_id adicionado: ${bike.open_registro_id}`);
                } else if (bike.status === 'DENTRO') {
                    // Se está DENTRO mas não tem controle_acesso_id, buscar o último check-in ativo
                    console.log(`⚠️ Bicicleta ${bike.id} está DENTRO mas sem controle_acesso_id. Buscando check-in ativo...`);
                    try {
                        const checkinSnapshot = await db.collection('checkins')
                            .where('bicicleta_id', '==', String(bike.id))
                            .where('status', '==', 'ativo')
                            .limit(1)
                            .get();
                        
                        if (!checkinSnapshot.empty) {
                            const checkinId = checkinSnapshot.docs[0].id;
                            bike.open_registro_id = checkinId;
                            bike.controle_acesso_id = checkinId;
                            console.log(`✅ Check-in ativo encontrado para bike ${bike.id}: ${checkinId}`);
                        } else {
                            console.log(`❌ Nenhum check-in ativo encontrado para bicicleta ${bike.id}`);
                        }
                    } catch (err) {
                        console.error(`❌ Erro ao buscar check-in ativo para bike ${bike.id}:`, err.message);
                    }
                }
            }
            
            // Adicionar campos no nível raiz para compatibilidade com frontend
            const resultado = { 
                proprietario: p, 
                bicicleta: bike || null,
                // Campos no nível raiz para compatibilidade
                id: p.id,
                nome_completo: p.nome_completo,
                cpf: p.cpf,
                numero_lacre: p.numero_lacre,
                bicicletas: bike ? [bike] : []
            };
            
            resultados.push(resultado);
        }
    }

    res.status(200).json(resultados);

  } catch (error) {
    console.error("Erro na busca:", error);
    res.status(500).send({ erro: 'Erro interno no servidor' });
  }
});

// DEBUG: Endpoint temporário para verificar check-in
app.get("/debug/checkin-thiago", autenticarToken, async (req, res) => {
  try {
    const resultado = {
      bicicleta: null,
      checkins: [],
      proprietario: null
    };
    
    // Buscar bicicleta JPR-TAZL3F7HOTQBS0
    const bikesSnapshot = await db.collection('bicicletas')
      .where('numero_identificacao', '==', 'JPR-TAZL3F7HOTQBS0')
      .get();
    
    if (!bikesSnapshot.empty) {
      const bikeDoc = bikesSnapshot.docs[0];
      resultado.bicicleta = {
        id: bikeDoc.id,
        ...bikeDoc.data()
      };
      
      // Buscar check-ins desta bicicleta
      const checkinsSnapshot = await db.collection('checkins')
        .where('bicicleta_id', '==', bikeDoc.id)
        .get();
      
      resultado.checkins = checkinsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Buscar proprietário
      if (resultado.bicicleta.proprietario_id) {
        const propDoc = await db.collection('proprietarios').doc(String(resultado.bicicleta.proprietario_id)).get();
        if (propDoc.exists) {
          resultado.proprietario = {
            id: propDoc.id,
            ...propDoc.data()
          };
        }
      }
    }
    
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// Rota para atualizar o lacre
app.put("/proprietarios/:id/lacre", autenticarToken, async (req, res) => {
    try {
        const { numero_lacre } = req.body;
        if (!numero_lacre) {
            return res.status(400).send({ erro: 'Número do lacre é obrigatório.' });
        }
        const docRef = db.collection('proprietarios').doc(req.params.id);
        await docRef.update({ numero_lacre });
        res.status(200).send({ mensagem: 'Lacre atualizado com sucesso.' });
    } catch (error) {
        console.error("Erro ao atualizar lacre:", error);
        res.status(500).send({ erro: "Erro interno no servidor" });
    }
});

// Rota de Check-in
app.post("/controle-acesso/checkin", autenticarToken, async (req, res) => {
  try {
    const { bicicleta_id, proprietario_id, local, observacoes_entrada, observacao_geral, numero_lacre } = req.body;
    
    if (!bicicleta_id || !proprietario_id) {
      return res.status(400).json({ erro: 'bicicleta_id e proprietario_id são obrigatórios' });
    }
    
    // Buscar dados do proprietário e bicicleta
    const [propDoc, bikeDoc] = await Promise.all([
      db.collection('proprietarios').doc(String(proprietario_id)).get(),
      db.collection('bicicletas').doc(String(bicicleta_id)).get()
    ]);
    
    if (!propDoc.exists || !bikeDoc.exists) {
      return res.status(404).json({ erro: 'Proprietário ou bicicleta não encontrado' });
    }
    
    const propData = propDoc.data();
    const bikeData = bikeDoc.data();
    const funcionarioNome = req.user?.nome || req.user?.email || 'Funcionário';
    
    // Criar registro de check-in
    const checkinData = {
      bicicleta_id: String(bicicleta_id),
      proprietario_id: String(proprietario_id),
      proprietario_nome: propData.nome_completo || propData.nome || '',
      bicicleta_numero: bikeData.numero_identificacao || bikeData.numero_bike || '',
      data_hora: new Date().toISOString(),
      operador: funcionarioNome,
      local: local || 'Japeri',
      numero_lacre: numero_lacre || '',
      observacoes: observacoes_entrada || '',
      observacao_geral: observacao_geral || '',
      status: 'ativo'
    };
    
    const checkinRef = await db.collection('checkins').add(checkinData);
    
    // Atualizar status da bicicleta para DENTRO
    await db.collection('bicicletas').doc(String(bicicleta_id)).update({
      status: 'DENTRO',
      ultimo_checkin: new Date().toISOString(),
      controle_acesso_id: checkinRef.id
    });
    
    res.json({ 
      sucesso: true, 
      mensagem: 'Check-in realizado com sucesso',
      controle_acesso_id: checkinRef.id
    });
    
  } catch (error) {
    console.error('Erro no check-in:', error);
    res.status(500).json({ erro: 'Erro ao realizar check-in', detalhes: error.message });
  }
});

// Rota de Checkout
app.post("/controle-acesso/checkout", autenticarToken, async (req, res) => {
  try {
    const { controle_acesso_id, local, observacoes_saida, observacao_geral } = req.body;
    
    if (!controle_acesso_id) {
      return res.status(400).json({ erro: 'controle_acesso_id é obrigatório' });
    }
    
    // Buscar registro de check-in
    const checkinDoc = await db.collection('checkins').doc(controle_acesso_id).get();
    
    if (!checkinDoc.exists) {
      return res.status(404).json({ erro: 'Registro de check-in não encontrado' });
    }
    
    const checkinData = checkinDoc.data();
    const funcionarioNome = req.user?.nome || req.user?.email || 'Funcionário';
    
    // Criar registro de checkout
    const checkoutData = {
      checkin_id: controle_acesso_id,
      bicicleta_id: checkinData.bicicleta_id,
      proprietario_id: checkinData.proprietario_id,
      proprietario_nome: checkinData.proprietario_nome,
      bicicleta_numero: checkinData.bicicleta_numero,
      data_hora: new Date().toISOString(),
      operador: funcionarioNome,
      local: local || checkinData.local || 'Japeri',
      observacoes: observacoes_saida || '',
      observacao_geral: observacao_geral || ''
    };
    
    await db.collection('checkouts').add(checkoutData);
    
    // Atualizar status do check-in para concluído
    await db.collection('checkins').doc(controle_acesso_id).update({
      status: 'concluido',
      data_checkout: new Date().toISOString()
    });
    
    // Atualizar status da bicicleta para FORA
    await db.collection('bicicletas').doc(checkinData.bicicleta_id).update({
      status: 'FORA',
      ultimo_checkout: new Date().toISOString()
    });
    
    res.json({ 
      sucesso: true, 
      mensagem: 'Checkout realizado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro no checkout:', error);
    res.status(500).json({ erro: 'Erro ao realizar checkout', detalhes: error.message });
  }
});

// Rotas de Admin (placeholders)
app.get("/admin/tarefas", autenticarToken, (req, res) => res.json([]));
app.get("/admin/tarefas/stream", autenticarToken, (req, res) => {
  // Configura headers para Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Desabilita buffering do nginx/proxy
  res.flushHeaders();

  // Envia comentário inicial para manter conexão aberta
  res.write(': connected\n\n');

  // Keep-alive: envia comentário a cada 30s para evitar timeout
  const keepAliveInterval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);

  // Cleanup ao fechar conexão
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    res.end();
  });
});
// ENDPOINT REMOVIDO - Substituído pelo endpoint completo na linha ~2124
app.get("/admin/monitoramento", autenticarToken, async (req, res) => {
  try {
    // Ler filtros da query string
    const filtroLocal = req.query.local_ilike ? String(req.query.local_ilike).trim() : null;
    const filtroStatus = req.query.status ? String(req.query.status).trim() : null;
    const filtroDataInicio = req.query.start ? String(req.query.start) : null;
    const filtroDataFim = req.query.end ? String(req.query.end) : null;
    
    console.log('🔍 Filtros recebidos:', {
      local: filtroLocal,
      status: filtroStatus,
      dataInicio: filtroDataInicio,
      dataFim: filtroDataFim
    });
    
    // Buscar todos os funcionários
    const funcionariosSnapshot = await db.collection('funcionarios').get();
    const funcionarios = [];
    
    const updatePromises = [];
    
    funcionariosSnapshot.forEach(doc => {
      const data = doc.data();
      const nome = data.nome_completo || data.nome || data.nome_usuario || '';
      
      console.log(`📋 Funcionário ${doc.id}:`, {
        nome_completo: data.nome_completo,
        nome_usuario: data.nome_usuario,
        nome: nome,
        cargo: data.cargo,
        local: data.local,
        status: data.status
      });
      
      let local = data.local || '';
      
      // Se não tem campo 'local', inferir automaticamente
      if (!local) {
        const nomeLower = nome.toLowerCase();
        const cargoLower = (data.cargo || '').toLowerCase();
        
        // Lista de funcionários conhecidos (nomes completos exatos do Firestore)
        const funcBicicletario = [
          'raiane carvalho de souza',
          'ana paula',
          'ana paula dos santos',
          'deniesth vidal duarte',
          'alan pereira fiorani',
          'eloa cristina marques do nascimento',
          'eloá cristina marques do nascimento',
          'ludmila de oliveira',
          'elisangela freitas dos santos'
        ];
        const funcSecretaria = [
          'administrador',
          'matheus oliveira',
          'marcelo da silva rocha',
          'wenderson da silva soares',
          'joice barbosa nascimento',
          'marcelo damasceno de oliveira'
        ];
        
        // Inferir local baseado no nome ou cargo
        if (funcBicicletario.includes(nomeLower) && funcSecretaria.includes(nomeLower)) {
          local = 'Secretaria/Bicicletário';
        } else if (funcBicicletario.includes(nomeLower) || cargoLower.includes('bicicletário') || cargoLower.includes('bicicletario')) {
          local = 'Bicicletário';
        } else if (funcSecretaria.includes(nomeLower) || cargoLower.includes('secretaria')) {
          local = 'Secretaria';
        } else if (cargoLower) {
          local = data.cargo; // Usa o cargo como local
        } else {
          local = 'Outro';
        }
        
        // Atualizar o documento no Firestore com o campo 'local'
        updatePromises.push(
          db.collection('funcionarios').doc(doc.id).update({ local })
        );
      }
      
      // Aplicar filtro de local
      if (filtroLocal && local.toLowerCase() !== filtroLocal.toLowerCase()) {
        return; // Pula este funcionário
      }
      
      // Aplicar filtro de status
      const statusFunc = data.status || 'inativo';
      if (filtroStatus && statusFunc.toLowerCase() !== filtroStatus.toLowerCase()) {
        return; // Pula este funcionário
      }
      
      funcionarios.push({
        id: doc.id,
        nome: nome,
        email: data.email || '',
        cargo: data.cargo || '',
        local: local,
        status: statusFunc,
        ultimo_ping: data.ultimo_ping || data.last_ping || null,
        last_ping: data.ultimo_ping || data.last_ping || null,
        fotoUrl: data.fotoUrl || '',
        checkinsPorDia: {},
        totalMovimentacoes: 0,
        ultimaMovimentacao: null,
        tempoParadoMin: 0
      });
    });
    
    // Aguardar todas as atualizações
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`✅ ${updatePromises.length} funcionários atualizados com campo 'local'`);
    }
    
    // Determinar período de busca (filtro de data ou últimos 30 dias)
    const now = new Date();
    let dataInicio, dataFim;
    
    if (filtroDataInicio) {
      dataInicio = new Date(filtroDataInicio);
    } else {
      dataInicio = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    }
    
    if (filtroDataFim) {
      dataFim = new Date(filtroDataFim);
    } else {
      dataFim = now;
    }
    
    const dataInicioISO = dataInicio.toISOString();
    const dataFimISO = dataFim.toISOString();
    
    console.log('📅 Período de busca:', {
      inicio: dataInicioISO,
      fim: dataFimISO
    });
    
    // Buscar check-ins e checkouts no período especificado
    const [checkinsSnapshot, checkoutsSnapshot] = await Promise.all([
      db.collection('checkins')
        .where('data_hora', '>=', dataInicioISO)
        .where('data_hora', '<=', dataFimISO)
        .get(),
      db.collection('checkouts')
        .where('data_hora', '>=', dataInicioISO)
        .where('data_hora', '<=', dataFimISO)
        .get()
    ]);
    
    // Mapas para cálculos
    const rankingMap = new Map();
    const fluxoPorDia = {};
    const funcMovMap = new Map(); // Mapa de movimentações por funcionário
    
    // Processar check-ins
    checkinsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const funcNome = data.funcionario_nome || 'Sistema';
      const dataHora = data.data_hora || '';
      const dia = dataHora.split('T')[0]; // YYYY-MM-DD
      
      // Ranking (últimos 7 dias)
      const dataCheckin = new Date(dataHora);
      if (dataCheckin >= new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))) {
        if (!rankingMap.has(funcNome)) {
          rankingMap.set(funcNome, { nome: funcNome, total: 0 });
        }
        rankingMap.get(funcNome).total++;
      }
      
      // Fluxo por dia
      if (!fluxoPorDia[dia]) {
        fluxoPorDia[dia] = { checkins: 0, checkouts: 0 };
      }
      fluxoPorDia[dia].checkins++;
      
      // Movimentações por funcionário
      if (!funcMovMap.has(funcNome)) {
        funcMovMap.set(funcNome, { total: 0, ultima: null, tipo: null, porDia: {} });
      }
      const funcMov = funcMovMap.get(funcNome);
      funcMov.total++;
      if (!funcMov.ultima || new Date(dataHora) > new Date(funcMov.ultima)) {
        funcMov.ultima = dataHora;
        funcMov.tipo = 'check-in';
      }
      if (!funcMov.porDia[dia]) {
        funcMov.porDia[dia] = { checkins: 0, checkouts: 0 };
      }
      funcMov.porDia[dia].checkins++;
    });
    
    // Processar checkouts
    checkoutsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const funcNome = data.funcionario_nome || 'Sistema';
      const dataHora = data.data_hora || '';
      const dia = dataHora.split('T')[0];
      
      // Fluxo por dia
      if (!fluxoPorDia[dia]) {
        fluxoPorDia[dia] = { checkins: 0, checkouts: 0 };
      }
      fluxoPorDia[dia].checkouts++;
      
      // Movimentações por funcionário
      if (!funcMovMap.has(funcNome)) {
        funcMovMap.set(funcNome, { total: 0, ultima: null, tipo: null, porDia: {} });
      }
      const funcMov = funcMovMap.get(funcNome);
      funcMov.total++;
      if (!funcMov.ultima || new Date(dataHora) > new Date(funcMov.ultima)) {
        funcMov.ultima = dataHora;
        funcMov.tipo = 'check-out';
      }
      if (!funcMov.porDia[dia]) {
        funcMov.porDia[dia] = { checkins: 0, checkouts: 0 };
      }
      funcMov.porDia[dia].checkouts++;
    });
    
    // Atualizar dados dos funcionários
    funcionarios.forEach(func => {
      const movData = funcMovMap.get(func.nome);
      if (movData) {
        func.totalMovimentacoes = movData.total;
        func.ultimaMov = movData.ultima;
        func.tipoUltimaMov = movData.tipo;
        func.checkinsPorDia = movData.porDia;
        
        // Calcular tempo parado
        if (movData.ultima) {
          const ultimaMov = new Date(movData.ultima);
          const tempoParadoMs = now - ultimaMov;
          func.tempoParadoMin = Math.floor(tempoParadoMs / (1000 * 60));
          func.tempoParadoSec = Math.floor(tempoParadoMs / 1000);
        }
      }
    });
    
    const ranking = Array.from(rankingMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    console.log(`📊 Monitoramento: ${funcionarios.length} funcionários, ${Object.keys(fluxoPorDia).length} dias de dados, Top ${ranking.length} ranking`);
    
    res.json({
      funcionarios,
      ranking,
      fluxoPorDia,
      fluxoPorFuncionarioPorDia: {},
      thresholds: { amarelo: 24, vermelho: 48, ATIVO_MOV_MIN: 60 },
      server_now: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao buscar monitoramento:', error);
    res.status(500).json({ 
      erro: 'Erro ao buscar dados de monitoramento',
      funcionarios: [],
      ranking: [],
      fluxoPorDia: {},
      fluxoPorFuncionarioPorDia: {},
      thresholds: {},
      server_now: new Date().toISOString()
    });
  }
});
app.get("/admin/proprietarios/:id/historico", autenticarToken, async (req, res) => {
  try {
    const proprietarioId = req.params.id;
    const sortDesc = req.query.sortDesc === '1';
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;
    
    // Buscar todos os check-ins e checkouts deste proprietário
    const [checkinsSnapshot, checkoutsSnapshot] = await Promise.all([
      db.collection('checkins')
        .where('proprietario_id', '==', proprietarioId)
        .get(),
      db.collection('checkouts')
        .where('proprietario_id', '==', proprietarioId)
        .get()
    ]);
    
    const historico = [];
    
    // Adicionar check-ins
    checkinsSnapshot.forEach(doc => {
      const data = doc.data();
      historico.push({
        id: doc.id,
        tipo: 'checkin',
        data_hora: data.data_hora || null,
        operador: data.operador || data.funcionario || '',
        numero_lacre: data.numero_lacre || '',
        observacoes: data.observacoes || ''
      });
    });
    
    // Adicionar checkouts
    checkoutsSnapshot.forEach(doc => {
      const data = doc.data();
      historico.push({
        id: doc.id,
        tipo: 'checkout',
        data_hora: data.data_hora || null,
        operador: data.operador || data.funcionario || '',
        observacoes: data.observacoes || ''
      });
    });
    
    // Ordenar por data_hora
    historico.sort((a, b) => {
      const dateA = new Date(a.data_hora || 0);
      const dateB = new Date(b.data_hora || 0);
      return sortDesc ? dateB - dateA : dateA - dateB;
    });
    
    res.json({
      historico: historico.slice(0, pageSize),
      total: historico.length,
      page,
      pageSize
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ erro: 'Erro ao buscar histórico', historico: [], total: 0 });
  }
});
app.get("/admin/proprietarios/resumo", autenticarToken, async (req, res) => {
  try {
    const idsParam = req.query.ids || '';
    const ids = idsParam.split(',').filter(id => id.trim());
    
    if (ids.length === 0) {
      return res.json({ itens: [] });
    }
    
    const itens = [];
    
    // Buscar cada proprietário e suas bicicletas
    for (const id of ids) {
      try {
        const propDoc = await db.collection('proprietarios').doc(id).get();
        
        if (!propDoc.exists) {
          continue;
        }
        
        const propData = propDoc.data();
        const nome = propData.nome_completo || propData.nome || propData.nome_usuario || '';
        
        // Buscar bicicletas deste proprietário
        const bicicletasSnapshot = await db.collection('bicicletas')
          .where('proprietario_id', '==', id)
          .get();
        
        const bicicletas = [];
        bicicletasSnapshot.forEach(biciDoc => {
          const biciData = biciDoc.data();
          bicicletas.push({
            numero_bike: biciData.numero_bike || biciData.numero || '',
            marca: biciData.marca || '',
            modelo: biciData.modelo || ''
          });
        });
        
        itens.push({
          proprietario_id: id,
          nome: nome,
          fotoUrl: propData.fotoUrl || propData.foto_url || '',
          bicicletas: bicicletas
        });
      } catch (err) {
        console.error(`Erro ao buscar proprietário ${id}:`, err);
      }
    }
    
    res.json({ itens });
  } catch (error) {
    console.error('Erro ao buscar resumo de proprietários:', error);
    res.status(500).json({ erro: 'Erro ao buscar resumo', itens: [] });
  }
});
// Rota: Logs de Check-in/Check-out (Funcionários)
app.get("/admin/logs-controle", autenticarToken, async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    
    // Buscar check-ins e checkouts dos últimos N dias
    const [checkinsSnapshot, checkoutsSnapshot] = await Promise.all([
      db.collection('checkins')
        .where('data_hora', '>=', dataLimite.toISOString())
        .orderBy('data_hora', 'desc')
        .get(),
      db.collection('checkouts')
        .where('data_hora', '>=', dataLimite.toISOString())
        .orderBy('data_hora', 'desc')
        .get()
    ]);
    
    const logs = [];
    
    // Adicionar check-ins
    checkinsSnapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        tipo: 'entrada',
        data_hora: data.data_hora || null,
        funcionario: data.funcionario_nome || data.operador || data.funcionario || 'Sistema',
        proprietario_nome: data.proprietario_nome || '',
        proprietario_id: data.proprietario_id || '',
        bicicleta_numero: data.bicicleta_numero || data.numero_bike || '',
        local: data.local || '',
        numero_lacre: data.numero_lacre || '',
        observacoes: data.observacoes || '',
        descricao: `Check-in de ${data.proprietario_nome || 'Desconhecido'}`
      });
    });
    
    // Adicionar checkouts
    checkoutsSnapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        tipo: 'saida',
        data_hora: data.data_hora || null,
        funcionario: data.funcionario_nome || data.operador || data.funcionario || 'Sistema',
        proprietario_nome: data.proprietario_nome || '',
        proprietario_id: data.proprietario_id || '',
        bicicleta_numero: data.bicicleta_numero || data.numero_bike || '',
        local: data.local || '',
        observacoes: data.observacoes || '',
        descricao: `Check-out de ${data.proprietario_nome || 'Desconhecido'}`
      });
    });
    
    // Ordenar por data_hora (mais recente primeiro)
    logs.sort((a, b) => new Date(b.data_hora || 0) - new Date(a.data_hora || 0));
    
    res.json({
      dias,
      total: logs.length,
      logs
    });
  } catch (error) {
    console.error('Erro ao buscar logs de controle:', error);
    res.json({ dias: 7, total: 0, logs: [] });
  }
});

// Rota: Bloqueios Pendentes
app.get("/admin/bloqueios/pendentes", autenticarToken, async (req, res) => {
  try {
    const snapshot = await db.collection('bloqueios_pendentes')
      .where('status', '==', 'pendente')
      .orderBy('data_solicitacao', 'desc')
      .get();
    
    const pendentes = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      pendentes.push({
        id: doc.id,
        proprietario_id: data.proprietario_id || '',
        proprietario_nome: data.proprietario_nome || '',
        motivo: data.motivo || '',
        solicitante: data.solicitante || '',
        data_solicitacao: data.data_solicitacao || null
      });
    });
    
    res.json(pendentes);
  } catch (error) {
    console.error('Erro ao buscar bloqueios pendentes:', error);
    res.json([]);
  }
});

// Rota: Proprietários Bloqueados
app.get("/admin/bloqueios/ativos", autenticarToken, async (req, res) => {
  try {
    const snapshot = await db.collection('proprietarios')
      .where('bloqueado', '==', true)
      .orderBy('data_bloqueio', 'desc')
      .get();
    
    const bloqueados = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      bloqueados.push({
        id: doc.id,
        nome: data.nome_completo || data.nome || '',
        cpf: String(data.cpf || ''),
        motivo_bloqueio: data.motivo_bloqueio || '',
        data_bloqueio: data.data_bloqueio || null,
        bloqueado_por: data.bloqueado_por || ''
      });
    });
    
    res.json(bloqueados);
  } catch (error) {
    console.error('Erro ao buscar proprietários bloqueados:', error);
    res.json([]);
  }
});

// Rota: Confirmar Bloqueio
app.post("/admin/bloqueios/confirmar", autenticarToken, async (req, res) => {
  try {
    const { bloqueio_id } = req.body;
    const adminNome = req.user?.nome || req.user?.email || 'Admin';
    
    // Buscar bloqueio pendente
    const bloqueioDoc = await db.collection('bloqueios_pendentes').doc(bloqueio_id).get();
    if (!bloqueioDoc.exists) {
      return res.status(404).json({ erro: 'Bloqueio não encontrado' });
    }
    
    const bloqueioData = bloqueioDoc.data();
    
    // Atualizar proprietário para bloqueado
    await db.collection('proprietarios').doc(bloqueioData.proprietario_id).update({
      bloqueado: true,
      data_bloqueio: new Date().toISOString(),
      bloqueado_por: adminNome,
      motivo_bloqueio: bloqueioData.motivo || 'Bloqueio confirmado pelo administrador'
    });
    
    // Atualizar status do bloqueio pendente
    await db.collection('bloqueios_pendentes').doc(bloqueio_id).update({
      status: 'confirmado',
      confirmado_por: adminNome,
      data_confirmacao: new Date().toISOString()
    });
    
    // Adicionar log de auditoria
    await db.collection('logs_auditoria').add({
      data_hora: new Date().toISOString(),
      admin: adminNome,
      acao: 'Bloqueio Confirmado',
      detalhes: `Proprietário "${bloqueioData.proprietario_nome}" foi bloqueado`,
      ip: req.ip || req.connection?.remoteAddress || ''
    });
    
    res.json({ sucesso: true, mensagem: 'Bloqueio confirmado com sucesso' });
  } catch (error) {
    console.error('Erro ao confirmar bloqueio:', error);
    res.status(500).json({ erro: 'Erro ao confirmar bloqueio' });
  }
});

// Rota: Rejeitar Bloqueio
app.post("/admin/bloqueios/rejeitar", autenticarToken, async (req, res) => {
  try {
    const { bloqueio_id } = req.body;
    const adminNome = req.user?.nome || req.user?.email || 'Admin';
    
    // Buscar bloqueio pendente
    const bloqueioDoc = await db.collection('bloqueios_pendentes').doc(bloqueio_id).get();
    if (!bloqueioDoc.exists) {
      return res.status(404).json({ erro: 'Bloqueio não encontrado' });
    }
    
    const bloqueioData = bloqueioDoc.data();
    
    // Atualizar status do bloqueio pendente
    await db.collection('bloqueios_pendentes').doc(bloqueio_id).update({
      status: 'rejeitado',
      rejeitado_por: adminNome,
      data_rejeicao: new Date().toISOString()
    });
    
    // Adicionar log de auditoria
    await db.collection('logs_auditoria').add({
      data_hora: new Date().toISOString(),
      admin: adminNome,
      acao: 'Bloqueio Rejeitado',
      detalhes: `Solicitação de bloqueio do proprietário "${bloqueioData.proprietario_nome}" foi rejeitada`,
      ip: req.ip || req.connection?.remoteAddress || ''
    });
    
    res.json({ sucesso: true, mensagem: 'Bloqueio rejeitado com sucesso' });
  } catch (error) {
    console.error('Erro ao rejeitar bloqueio:', error);
    res.status(500).json({ erro: 'Erro ao rejeitar bloqueio' });
  }
});

// Rota: Desbloquear Proprietário
app.post("/admin/bloqueios/desbloquear", autenticarToken, async (req, res) => {
  try {
    const { proprietario_id } = req.body;
    const adminNome = req.user?.nome || req.user?.email || 'Admin';
    
    // Buscar proprietário
    const propDoc = await db.collection('proprietarios').doc(proprietario_id).get();
    if (!propDoc.exists) {
      return res.status(404).json({ erro: 'Proprietário não encontrado' });
    }
    
    const propData = propDoc.data();
    const nomeProprietario = propData.nome_completo || propData.nome || 'Proprietário';
    
    // Desbloquear proprietário
    await db.collection('proprietarios').doc(proprietario_id).update({
      bloqueado: false,
      data_desbloqueio: new Date().toISOString(),
      desbloqueado_por: adminNome
    });
    
    // Adicionar log de auditoria
    await db.collection('logs_auditoria').add({
      data_hora: new Date().toISOString(),
      admin: adminNome,
      acao: 'Proprietário Desbloqueado',
      detalhes: `Proprietário "${nomeProprietario}" foi desbloqueado`,
      ip: req.ip || req.connection?.remoteAddress || ''
    });
    
    res.json({ sucesso: true, mensagem: 'Proprietário desbloqueado com sucesso' });
  } catch (error) {
    console.error('Erro ao desbloquear proprietário:', error);
    res.status(500).json({ erro: 'Erro ao desbloquear proprietário' });
  }
});

// Rota: Logs de Auditoria do Sistema
app.get("/admin/auditoria", autenticarToken, async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 30;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    
    const snapshot = await db.collection('logs_auditoria')
      .where('data_hora', '>=', dataLimite.toISOString())
      .orderBy('data_hora', 'desc')
      .limit(500)
      .get();
    
    const logs = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        data_hora: data.data_hora || null,
        admin: data.admin || data.usuario || '',
        acao: data.acao || '',
        detalhes: data.detalhes || '',
        ip: data.ip || ''
      });
    });
    
    res.json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs de auditoria:', error);
    res.json([]);
  }
});

// Rota de Catálogo - retorna catálogo de bicicletas (do arquivo JSON local)
app.get("/catalogo-bikes", (req, res) => {
  try {
    // Carrega o catálogo do arquivo JSON local (copiado pelo sync.js)
    const catalogoPath = require('path').join(__dirname, 'BicicletarioMunicipaldeJaperi', 'data', 'catalogo-bikes.json');
    const fs = require('fs');
    
    if (fs.existsSync(catalogoPath)) {
      const catalogo = JSON.parse(fs.readFileSync(catalogoPath, 'utf8'));
      console.log(`📚 Catálogo carregado do arquivo JSON local`);
      res.status(200).json(catalogo);
    } else {
      console.warn(`⚠️ Arquivo catalogo-bikes.json não encontrado em: ${catalogoPath}`);
      // Fallback: retorna catálogo básico
      res.status(200).json({
        'Mountain Bike': {'Caloi': ['Elite'], 'Oggi': ['Big Wheel 7.3 2025']},
        'Speed': {'Specialized': ['Tarmac']},
        'Urbana': {'Caloi': ['SUPRA']}
      });
    }
  } catch (error) {
    console.error("Erro ao carregar catálogo de bicicletas:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});


// --- ROTAS DO PAINEL DE ADMINISTRADOR ---

// Lista de proprietários com busca
app.get("/admin/proprietarios", autenticarToken, async (req, res) => {
  try {
    const termo = (req.query.termo || '').toLowerCase().trim();
    console.log(`🔍 Backend - Busca de proprietários. Query recebida:`, req.query);
    console.log(`🔍 Backend - Termo de busca: "${termo}"`);
    
    // Buscar proprietários e bicicletas em paralelo
    const [proprietariosSnapshot, bicicletasSnapshot] = await Promise.all([
      db.collection('proprietarios').get(),
      db.collection('bicicletas').get()
    ]);
    
    // Criar mapa de bicicletas por proprietario_id
    const bicicletasPorProprietario = new Map();
    bicicletasSnapshot.forEach(biciDoc => {
      const biciData = biciDoc.data();
      const propId = String(biciData.proprietario_id || '');
      
      if (!bicicletasPorProprietario.has(propId)) {
        bicicletasPorProprietario.set(propId, []);
      }
      
      bicicletasPorProprietario.get(propId).push({
        id: biciDoc.id,
        numero_bike: biciData.numero_bike || biciData.numero || biciData.numeroIdentificacao || biciData.numero_identificacao || '',
        marca: biciData.marca || '',
        modelo: biciData.modelo || '',
        tipo_bike: biciData.tipo_bike || biciData.tipo || ''
      });
    });
    
    // Montar array de proprietários com bicicletas
    let proprietarios = proprietariosSnapshot.docs.map(doc => {
      const data = doc.data();
      const bicicletas = bicicletasPorProprietario.get(doc.id) || [];
      
      return {
        id: doc.id,
        nome: data.nome_completo || data.nome || data.nome_usuario || '',
        email: data.email || '',
        cpf: String(data.cpf || ''),
        contato: String(data.contato || ''),
        endereco: data.endereco || '',
        data_cadastro: data.data_cadastro || null,
        fotoUrl: data.fotoUrl || data.foto_url || data.foto_proprietario_url || '',
        bicicletas: bicicletas
      };
    });
    
    // Filtrar por termo se fornecido
    if (termo) {
      proprietarios = proprietarios.filter(p => {
        const nome = String(p.nome || '').toLowerCase();
        const cpf = String(p.cpf || '').toLowerCase();
        return nome.includes(termo) || cpf.includes(termo);
      });
    }
    
    console.log(`📋 Admin - Proprietários: ${proprietarios.length} encontrados (termo: "${termo}")`);
    res.status(200).json(proprietarios);
  } catch (error) {
    console.error("Erro ao listar proprietários:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Resumo de proprietários (bicicletas e check-ins)
app.get("/admin/proprietarios/resumo", autenticarToken, async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    
    const itens = [];
    for (const propId of ids) {
      // Buscar bicicletas do proprietário
      const bikesSnapshot = await db.collection('bicicletas')
        .where('proprietario_id', '==', propId)
        .get();
      
      const totalBikes = bikesSnapshot.size;
      
      // Buscar total de check-ins
      const checkinsSnapshot = await db.collection('checkins')
        .where('proprietario_id', '==', propId)
        .get();
      
      const totalCheckins = checkinsSnapshot.size;
      
      itens.push({
        proprietario_id: propId,
        total_bicicletas: totalBikes,
        total_checkins: totalCheckins
      });
    }
    
    res.status(200).json({ itens });
  } catch (error) {
    console.error("Erro ao buscar resumo de proprietários:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Histórico de um proprietário
app.get("/admin/proprietarios/:id/historico", autenticarToken, async (req, res) => {
  try {
    const propId = req.params.id;
    const numero = req.query.numero || '';
    const sortDesc = req.query.sortDesc === '1';
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '20', 10);
    
    // Buscar proprietário
    const propDoc = await db.collection('proprietarios').doc(propId).get();
    if (!propDoc.exists) {
      return res.status(404).send({ erro: 'Proprietário não encontrado' });
    }
    
    // Buscar check-ins do proprietário
    let query = db.collection('checkins').where('proprietario_id', '==', propId);
    
    if (numero) {
      query = query.where('bicicleta_numero', '==', numero);
    }
    
    const checkinsSnapshot = await query.get();
    let itens = checkinsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Ordenar
    itens.sort((a, b) => {
      const dateA = a.data_hora || '';
      const dateB = b.data_hora || '';
      return sortDesc ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    });
    
    // Paginar
    const total = itens.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    itens = itens.slice(start, end);
    
    res.status(200).json({
      proprietario: { id: propDoc.id, ...propDoc.data() },
      itens,
      total,
      page,
      pageSize,
      filtroNumero: numero || null
    });
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// ENDPOINTS REMOVIDOS - Substituídos pelos endpoints completos nas linhas ~1547, ~1611, ~1639 e ~1787

// Alertas de inatividade (Monitoramento de Ativos)
app.get("/admin/alertas", autenticarToken, async (req, res) => {
  try {
    const dias = Math.min(30, Math.max(1, parseInt(req.query.dias || '7', 10)));
    const limiarDias = parseInt(req.query.limiar_dias || '2', 10);
    const localFiltro = req.query.local_ilike ? String(req.query.local_ilike).trim().toLowerCase() : null;
    
    // Buscar check-ins ativos (bicicletas estacionadas)
    let query = db.collection('checkins').where('status', '==', 'ativo');
    const checkinsSnapshot = await query.get();
    
    const alertas = [];
    const now = new Date();
    
    for (const doc of checkinsSnapshot.docs) {
      const checkin = doc.data();
      
      // Filtrar por local se especificado
      if (localFiltro && !String(checkin.local || '').toLowerCase().includes(localFiltro)) {
        continue;
      }
      
      // Calcular tempo de inatividade
      const dataEntrada = new Date(checkin.data_hora);
      const horasInativo = (now - dataEntrada) / (1000 * 60 * 60);
      const diasInativo = horasInativo / 24;
      
      // Determinar severidade
      let severidade = 'baixa';
      if (diasInativo >= limiarDias * 2) {
        severidade = 'alta'; // Crítico (vermelho)
      } else if (diasInativo >= limiarDias) {
        severidade = 'media'; // Atenção (amarelo)
      }
      
      // Buscar dados do proprietário e bicicleta
      let proprietarioNome = checkin.proprietario_nome || 'Desconhecido';
      let proprietarioEmail = '';
      let proprietarioContato = '';
      let bicicletaNumero = checkin.bicicleta_numero || '-';
      let bicicletaMarca = '';
      let bicicletaModelo = '';
      
      try {
        if (checkin.proprietario_id) {
          const propDoc = await db.collection('proprietarios').doc(String(checkin.proprietario_id)).get();
          if (propDoc.exists) {
            const propData = propDoc.data();
            proprietarioNome = propData.nome_completo || proprietarioNome;
            proprietarioEmail = propData.email || '';
            proprietarioContato = String(propData.contato || '');
          }
        }
        
        if (checkin.bicicleta_id) {
          const bikeDoc = await db.collection('bicicletas').doc(String(checkin.bicicleta_id)).get();
          if (bikeDoc.exists) {
            const bikeData = bikeDoc.data();
            bicicletaNumero = bikeData.numero_bike || bikeData.numero_identificacao || bikeData.numero || bicicletaNumero;
            bicicletaMarca = bikeData.marca || '';
            bicicletaModelo = bikeData.modelo || '';
          }
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes do alerta:', err);
      }
      
      // Calcular minutos de inatividade
      const minutosInativo = Math.floor(horasInativo * 60);
      
      alertas.push({
        id: doc.id,
        controle_id: doc.id,
        proprietario_nome: proprietarioNome,
        proprietario_id: checkin.proprietario_id,
        proprietario_email: proprietarioEmail,
        proprietario_contato: proprietarioContato,
        numero_identificacao: bicicletaNumero,  // ✅ Nome correto
        marca: bicicletaMarca,  // ✅ Adicionado
        modelo: bicicletaModelo,  // ✅ Adicionado
        bicicleta_id: checkin.bicicleta_id,
        data_hora_entrada: checkin.data_hora,  // ✅ Nome correto
        local: checkin.local || 'Não especificado',
        horas_inatividade: Math.round(horasInativo * 10) / 10,  // ✅ Nome correto
        dias_inatividade: Math.round(diasInativo * 10) / 10,  // ✅ Nome correto
        minutos_inatividade: minutosInativo,  // ✅ Adicionado
        severidade,
        status: 'ativo'
      });
    }
    
    // Ordenar por severidade e tempo de inatividade
    alertas.sort((a, b) => {
      const sevOrder = { alta: 3, media: 2, baixa: 1 };
      if (sevOrder[b.severidade] !== sevOrder[a.severidade]) {
        return sevOrder[b.severidade] - sevOrder[a.severidade];
      }
      return b.horas_inativo - a.horas_inativo;
    });
    
    // Calcular estatísticas
    const total = alertas.length;
    const alta = alertas.filter(a => a.severidade === 'alta').length;
    const media = alertas.filter(a => a.severidade === 'media').length;
    const baixa = alertas.filter(a => a.severidade === 'baixa').length;
    
    console.log(`🚨 Alertas: ${total} total (${alta} críticos, ${media} atenção, ${baixa} normais)`);
    
    res.status(200).json({
      alertas,
      total,
      alta,
      media,
      baixa,
      limiar_dias: limiarDias
    });
  } catch (error) {
    console.error("Erro ao buscar alertas:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Dar saída em um alerta
app.post("/admin/alertas/:id/dar-saida", autenticarToken, async (req, res) => {
  try {
    const checkinId = req.params.id;
    
    // Buscar check-in
    const checkinDoc = await db.collection('checkins').doc(checkinId).get();
    if (!checkinDoc.exists) {
      return res.status(404).send({ erro: 'Check-in não encontrado' });
    }
    
    const checkin = checkinDoc.data();
    
    // Criar checkout
    const checkout = {
      bicicleta_id: checkin.bicicleta_id,
      proprietario_id: checkin.proprietario_id,
      proprietario_nome: checkin.proprietario_nome,
      bicicleta_numero: checkin.bicicleta_numero,
      local: checkin.local,
      data_hora: new Date().toISOString(),
      funcionario_nome: 'Sistema (Admin)',
      observacao: 'Saída registrada pelo administrador via alerta de inatividade'
    };
    
    await db.collection('checkouts').add(checkout);
    
    // Atualizar status do check-in
    await db.collection('checkins').doc(checkinId).update({
      status: 'finalizado',
      data_saida: new Date().toISOString()
    });
    
    // Atualizar status da bicicleta
    if (checkin.bicicleta_id) {
      await db.collection('bicicletas').doc(String(checkin.bicicleta_id)).update({
        status: 'FORA',
        controle_acesso_id: null,
        open_registro_id: null
      });
    }
    
    console.log(`✅ Saída registrada via admin para check-in ${checkinId}`);
    res.status(200).json({ sucesso: true, mensagem: 'Saída registrada com sucesso' });
  } catch (error) {
    console.error("Erro ao dar saída:", error);
    res.status(500).send({ erro: "Erro interno no servidor" });
  }
});

// Login com Google para funcionários (qualquer tipo)
app.post("/auth/google-login-funcionario", async (req, res) => {
  try {
    const { firebaseToken, email, nome, foto } = req.body;
    
    if (!firebaseToken || !email) {
      return res.status(400).send({ erro: "Token e email são obrigatórios." });
    }
    
    console.log(`🔐 Login Google (Funcionário): ${email}`);
    
    // Verificar token do Firebase
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    } catch (error) {
      console.error('❌ Token Firebase inválido:', error);
      return res.status(401).send({ erro: "Token de autenticação inválido." });
    }
    
    const uid = decodedToken.uid;
    const emailVerificado = decodedToken.email;
    
    // Verificar se o email do token corresponde ao enviado
    if (emailVerificado !== email) {
      return res.status(401).send({ erro: "Email não corresponde ao token." });
    }
    
    console.log(`✅ Token Firebase válido para: ${emailVerificado}`);
    
    // Buscar funcionário por email
    const funcionarioQuery = await db.collection('funcionarios')
      .where('email', '==', emailVerificado)
      .limit(1)
      .get();
    
    if (funcionarioQuery.empty) {
      console.log(`❌ Email ${emailVerificado} não cadastrado no sistema`);
      return res.status(404).send({ 
        erro: "Email não cadastrado no sistema. Cadastre-se primeiro." 
      });
    }
    
    const funcionarioDoc = funcionarioQuery.docs[0];
    const funcionario = funcionarioDoc.data();
    
    console.log(`✅ Funcionário encontrado: ${funcionario.nome_completo || funcionario.nome}`);
    
    // Atualizar foto e último login
    const updateData = {
      ultimo_login_google: new Date().toISOString(),
      ultimo_login: new Date().toISOString()
    };
    
    if (foto && foto !== funcionario.fotoUrl) {
      updateData.fotoUrl = foto;
      console.log(`📸 Atualizando foto do funcionário`);
    }
    
    await db.collection('funcionarios').doc(funcionarioDoc.id).update(updateData);
    
    // Gerar token JWT
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET não configurado no ambiente.');
      return res.status(500).send({ erro: 'Configuração do servidor incompleta.' });
    }
    
    const token = jwt.sign(
      { 
        id: funcionarioDoc.id,
        email: emailVerificado,
        nome_usuario: funcionario.nome_usuario || emailVerificado,
        loginMethod: 'google',
        uid: uid
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    const cleanToken = token.replace(/[^A-Za-z0-9-_\.]/g, '');
    
    console.log(`✅ Token JWT gerado para ${emailVerificado}`);
    
    res.status(200).send({
      mensagem: "Login Google bem-sucedido!",
      token: cleanToken,
      funcionario: {
        id: funcionarioDoc.id,
        nome: funcionario.nome_completo || funcionario.nome || nome,
        email: emailVerificado,
        foto: foto || funcionario.fotoUrl || '',
        cargo: funcionario.cargo || '',
        local: funcionario.local || ''
      }
    });
    
  } catch (error) {
    console.error("❌ Erro no login Google (funcionário):", error);
    res.status(500).send({ erro: "Erro ao processar login com Google", detalhes: error.message });
  }
});

// Séries temporais de alertas (para gráficos do Assistente de Alertas)
app.get("/admin/alertas/series", autenticarToken, async (req, res) => {
  try {
    const dias = Math.min(30, Math.max(1, parseInt(req.query.dias || '14', 10)));
    const limiarDias = parseInt(req.query.limiar_dias || '3', 10);
    const tzOffsetMinutes = parseInt(req.query.tzOffsetMinutes || '0', 10);
    
    console.log(`📊 Buscando séries de alertas: ${dias} dias, limiar ${limiarDias} dias`);
    
    // Calcular período
    const now = new Date();
    const dataInicio = new Date(now.getTime() - (dias * 24 * 60 * 60 * 1000));
    
    // Buscar todos os check-ins do período
    const checkinsSnapshot = await db.collection('checkins')
      .where('data_hora', '>=', dataInicio.toISOString())
      .orderBy('data_hora', 'asc')
      .get();
    
    // Buscar todos os checkouts do período
    const checkoutsSnapshot = await db.collection('checkouts')
      .where('data_hora', '>=', dataInicio.toISOString())
      .orderBy('data_hora', 'asc')
      .get();
    
    // Criar mapa de dias
    const seriesPorDia = {};
    for (let i = 0; i < dias; i++) {
      const data = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      const dataStr = data.toISOString().split('T')[0];
      seriesPorDia[dataStr] = {
        data: dataStr,
        total_checkins: 0,
        total_checkouts: 0,
        alertas_criticos: 0,
        alertas_atencao: 0,
        alertas_normais: 0,
        tempo_medio_estacionamento_horas: 0
      };
    }
    
    // Processar check-ins
    const checkinsAtivos = new Map();
    checkinsSnapshot.docs.forEach(doc => {
      const checkin = doc.data();
      const dataCheckin = checkin.data_hora.split('T')[0];
      
      if (seriesPorDia[dataCheckin]) {
        seriesPorDia[dataCheckin].total_checkins++;
      }
      
      // Guardar check-ins ativos para calcular alertas
      if (checkin.status === 'ativo') {
        checkinsAtivos.set(doc.id, {
          id: doc.id,
          data_hora: checkin.data_hora,
          local: checkin.local
        });
      }
    });
    
    // Processar checkouts
    const temposEstacionamento = [];
    checkoutsSnapshot.docs.forEach(doc => {
      const checkout = doc.data();
      const dataCheckout = checkout.data_hora.split('T')[0];
      
      if (seriesPorDia[dataCheckout]) {
        seriesPorDia[dataCheckout].total_checkouts++;
      }
      
      // Calcular tempo de estacionamento se houver data de entrada
      if (checkout.data_entrada || checkout.data_hora_entrada) {
        const entrada = new Date(checkout.data_entrada || checkout.data_hora_entrada);
        const saida = new Date(checkout.data_hora);
        const horasEstacionado = (saida - entrada) / (1000 * 60 * 60);
        if (horasEstacionado > 0 && horasEstacionado < 720) { // Máximo 30 dias
          temposEstacionamento.push(horasEstacionado);
        }
      }
    });
    
    // Calcular alertas por dia baseado em check-ins ativos
    checkinsAtivos.forEach(checkin => {
      const dataEntrada = new Date(checkin.data_hora);
      const horasInativo = (now - dataEntrada) / (1000 * 60 * 60);
      const diasInativo = horasInativo / 24;
      
      const dataStr = dataEntrada.toISOString().split('T')[0];
      
      if (seriesPorDia[dataStr]) {
        if (diasInativo >= limiarDias * 2) {
          seriesPorDia[dataStr].alertas_criticos++;
        } else if (diasInativo >= limiarDias) {
          seriesPorDia[dataStr].alertas_atencao++;
        } else {
          seriesPorDia[dataStr].alertas_normais++;
        }
      }
    });
    
    // Calcular tempo médio de estacionamento
    const tempoMedio = temposEstacionamento.length > 0
      ? temposEstacionamento.reduce((a, b) => a + b, 0) / temposEstacionamento.length
      : 0;
    
    // Converter para array e ordenar
    const series = Object.values(seriesPorDia).sort((a, b) => 
      new Date(a.data) - new Date(b.data)
    );
    
    // Adicionar tempo médio a cada dia
    series.forEach(dia => {
      dia.tempo_medio_estacionamento_horas = Math.round(tempoMedio * 10) / 10;
    });
    
    console.log(`✅ Séries geradas: ${series.length} dias`);
    
    res.status(200).json({
      series,
      resumo: {
        total_checkins: checkinsSnapshot.size,
        total_checkouts: checkoutsSnapshot.size,
        checkins_ativos: checkinsAtivos.size,
        tempo_medio_estacionamento_horas: Math.round(tempoMedio * 10) / 10,
        periodo_dias: dias,
        limiar_dias: limiarDias
      }
    });
  } catch (error) {
    console.error("Erro ao buscar séries de alertas:", error);
    res.status(500).send({ erro: "Erro interno no servidor", detalhes: error.message });
  }
});

// ENDPOINT REMOVIDO - Substituído pelo endpoint completo na linha ~1210

// --- FIM DAS ROTAS ---

// Esta linha mágica exporta seu app Express como UMA ÚNICA Cloud Function
// O nome 'api' será o prefixo da sua URL 
// (ex: https://.../api/hello)
exports.api = https.onRequest({ region: "southamerica-east1" }, app);

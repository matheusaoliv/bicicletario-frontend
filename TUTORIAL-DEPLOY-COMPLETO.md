# 🚀 TUTORIAL COMPLETO - Deploy do Sistema Bicicletário

## 📋 O QUE VOCÊ VAI FAZER

Este tutorial vai te ensinar a publicar:
- **Backend** → Render.com (API do sistema)
- **Frontend** → GitHub Pages (Interface do usuário)
- **Banco de Dados** → Supabase (Armazenamento)

---

## ⚠️ PASSO CRÍTICO - EXECUTE PRIMEIRO!

### 🗄️ 1. CONFIGURAR SUPABASE (BANCO DE DADOS)

#### 1.1 Criar Projeto Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Clique em **"New project"**
3. Preencha:
   - **Name**: `bicicletario-municipal`
   - **Database Password**: `SuaSenh4Forte123!` (anote essa senha!)
   - **Region**: `South America (São Paulo)`
4. Clique em **"Create new project"**
5. Aguarde a criação (2-3 minutos)

#### 1.2 Executar Script SQL
1. No painel do Supabase, vá em **SQL Editor** (menu lateral)
2. Clique em **"New query"**
3. Abra o arquivo `supabase-setup.sql` da sua pasta
4. Copie TODO o conteúdo e cole no editor
5. Clique em **"Run"**
6. ✅ Deve aparecer "Success. No rows returned"

#### 1.3 COMANDO SQL EXTRA (MUITO IMPORTANTE!)
Execute este comando adicional no SQL Editor:
```sql
ALTER TABLE proprietarios ADD COLUMN foto_proprietario_extra_url TEXT;
```

#### 1.4 Configurar Storage para Fotos
1. Vá em **Storage** (menu lateral)
2. Clique em **"Create Bucket"**
3. Preencha:
   - **Name**: `bicicletario-fotos`
   - **Public bucket**: ✅ **MARQUE ESTA OPÇÃO**
4. Clique em **"Create bucket"**

#### 1.5 Anotar Credenciais do Supabase
1. Vá em **Settings** → **API**
2. Anote estas informações:
   - **Project URL**: `https://xxxxxxxxx.supabase.co`
   - **Project API Key (anon public)**: `eyJhbGciOiJIUzI1NiI...`

---

## 🖥️ 2. DEPLOY DO BACKEND (RENDER)

### 2.1 Criar Repositório GitHub para Backend
1. Acesse [github.com](https://github.com)
2. Clique em **"New repository"**
3. Preencha:
   - **Repository name**: `bicicletario-backend`
   - **Description**: `API do Sistema Bicicletário Municipal`
   - **Visibility**: `Public`
4. Clique em **"Create repository"**

### 2.2 Upload dos Arquivos Backend
Faça upload destes arquivos para o repositório:
- ✅ `server.js`
- ✅ `package.json`
- ✅ `README.md` (opcional)

**Como fazer upload:**
1. No GitHub, clique em **"uploading an existing file"**
2. Arraste os arquivos ou clique **"choose your files"**
3. Escreva na mensagem: `Initial commit - Backend files`
4. Clique em **"Commit changes"**

### 2.3 Deploy no Render
1. Acesse [render.com](https://render.com)
2. Clique em **"Get Started for Free"**
3. Conecte com sua conta GitHub
4. No dashboard, clique em **"New +"** → **"Web Service"**
5. Conecte ao repositório `bicicletario-backend`
6. Configure:

**Configurações Básicas:**
- **Name**: `bicicletario-api`
- **Environment**: `Node`
- **Region**: `Oregon (US West)`
- **Branch**: `main`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 2.4 Configurar Variáveis de Ambiente no Render
Na seção **"Environment Variables"**, adicione:

```
SUPABASE_URL=https://xxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...
JWT_SECRET=sua_chave_secreta_super_forte_123456789
PORT=5050
```

**Onde encontrar as chaves:**
- `SUPABASE_URL` e `SUPABASE_ANON_KEY`: Supabase → Settings → API
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Settings → API (service_role key)
- `JWT_SECRET`: Crie uma senha forte qualquer

### 2.5 Finalizar Deploy Backend
1. Clique em **"Create Web Service"**
2. Aguarde o deploy (5-10 minutos)
3. ✅ Se aparecer "Live", seu backend está funcionando!
4. **ANOTE A URL**: `https://bicicletario-api.onrender.com`

---

## 🌐 3. DEPLOY DO FRONTEND (GITHUB PAGES)

### 3.1 Criar Repositório GitHub para Frontend
1. No GitHub, clique em **"New repository"**
2. Preencha:
   - **Repository name**: `bicicletario-frontend`
   - **Description**: `Interface do Sistema Bicicletário Municipal`
   - **Visibility**: `Public`
   - ✅ **Initialize with README**
3. Clique em **"Create repository"**

### 3.2 Upload dos Arquivos Frontend
Faça upload de TODA a pasta `BicicletarioMunicipaldeJaperi/`:

**Arquivos principais:**
- ✅ `*.html` (todos os arquivos HTML)
- ✅ `*.js` (arquivos JavaScript)
- ✅ `css/` (pasta completa)
- ✅ `js/` (pasta completa)
- ✅ `imagens/` (pasta completa)
- ✅ `components/` (pasta completa)
- ✅ `CNAME` (se existir)

### 3.3 Atualizar URLs do Backend
Antes de fazer upload, abra estes arquivos e atualize a URL da API:

**Arquivos para editar:**
1. `js/api-client.js`
2. `js/detalhe-registro.js`
3. `admin.js`

**Procure por:**
```javascript
const API_BASE_URL = 'https://bicicletario-backend.onrender.com';
```

**Substitua por sua URL do Render:**
```javascript
const API_BASE_URL = 'https://SEU-NOME-APP.onrender.com';
```

### 3.4 Ativar GitHub Pages
1. No repositório frontend, vá em **Settings**
2. Role até **"Pages"** (menu lateral)
3. Em **"Source"**, selecione:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Clique em **"Save"**
5. Aguarde 2-5 minutos
6. ✅ Aparecerá: **"Your site is live at..."**

---

## 🔧 4. CONFIGURAÇÕES FINAIS

### 4.1 Configurar CORS no Backend
Se der erro de CORS, no arquivo `server.js`, verifique se tem:

```javascript
app.use(cors({
  origin: ['https://SEU-USUARIO.github.io', 'https://bicicletariodejaperi.online'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
```

### 4.2 Testar o Sistema
1. Acesse sua URL do GitHub Pages
2. Teste:
   - ✅ Login de admin
   - ✅ Cadastro de proprietário
   - ✅ Upload de foto
   - ✅ Check-in/Check-out

---

## 📋 5. CHECKLIST FINAL

### Backend (Render):
- [ ] Repositório criado no GitHub
- [ ] Arquivos `server.js` e `package.json` enviados
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy finalizado (status "Live")
- [ ] URL anotada

### Frontend (GitHub Pages):
- [ ] Repositório criado no GitHub
- [ ] Todos os arquivos HTML/CSS/JS enviados
- [ ] URLs da API atualizadas nos arquivos JS
- [ ] GitHub Pages ativado
- [ ] Site acessível

### Supabase:
- [ ] Projeto criado
- [ ] SQL executado
- [ ] Coluna `foto_proprietario_extra_url` adicionada
- [ ] Bucket de storage criado
- [ ] Credenciais anotadas

---

## 🆘 RESOLUÇÃO DE PROBLEMAS

### ❌ Backend não conecta com Supabase
- Verifique as variáveis de ambiente no Render
- Confirme que executou o SQL no Supabase

### ❌ Frontend não carrega
- Verifique se as URLs da API estão corretas
- Aguarde alguns minutos para GitHub Pages atualizar

### ❌ Fotos não carregam
- Confirme que o bucket está público
- Verifique se o nome do bucket está correto

### ❌ Erro de CORS
- Adicione sua URL do GitHub Pages no CORS do backend
- Faça redeploy no Render

---

## 🎉 PARABÉNS!

Se chegou até aqui, seu sistema está funcionando! 

**URLs finais:**
- **Frontend**: `https://SEU-USUARIO.github.io/bicicletario-frontend`
- **Backend**: `https://SEU-APP.onrender.com`
- **Admin**: `https://SEU-USUARIO.github.io/bicicletario-frontend/admin.html`

**Primeiro acesso:**
1. Vá para `/admin.html`
2. Faça login com um admin cadastrado
3. Comece a usar o sistema!

---

**📞 Suporte:** Se algo não funcionar, verifique o checklist e tente novamente.

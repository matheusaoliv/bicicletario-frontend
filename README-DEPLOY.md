# 🚀 Deploy do Bicicletário - Guia Completo

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com)
- Conta no [Render](https://render.com)
- Conta no [GitHub](https://github.com)

## 🗄️ 1. Configurar Supabase (Banco de Dados)

### 1.1 Criar Projeto
1. Acesse [supabase.com](https://supabase.com)
2. Clique em "Start your project"
3. Crie um novo projeto:
   - **Name**: `bicicletario-municipal`
   - **Database Password**: Anote a senha!
   - **Region**: South America (São Paulo)

### 1.2 Configurar Banco
1. No painel do Supabase, vá em **SQL Editor**
2. Cole e execute o conteúdo do arquivo `supabase-setup.sql`
3. Verifique se as tabelas foram criadas em **Table Editor**

### 1.3 Configurar Storage
1. Vá em **Storage** → **Create Bucket**
2. Nome: `bicicletario-fotos`
3. **Public bucket**: ✅ Marque como público
4. Clique em **Create bucket**

### 1.4 Anotar Credenciais
Vá em **Settings** → **API** e anote:
- **Project URL**: `https://xxx.supabase.co`
- **anon public key**: `eyJhbGc...`

## 🖥️ 2. Deploy no Render (Backend)

### 2.1 Preparar Repositório
1. Crie um repositório no GitHub
2. Faça upload dos arquivos:
   - `server.js`
   - `package.json`
   - `.env.example` (renomeie para `.env` localmente)

### 2.2 Deploy no Render
1. Acesse [render.com](https://render.com)
2. Conecte sua conta GitHub
3. Clique em **New** → **Web Service**
4. Selecione seu repositório
5. Configure:
   - **Name**: `bicicletario-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 2.3 Variáveis de Ambiente
No Render, vá em **Environment** e adicione:

```
PORT=10000
NODE_ENV=production
JWT_SECRET=sua_chave_jwt_super_secreta_aqui_123456789
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
# Limiares de severidade de alertas (opcional)
ALERT_MED_DAYS=3
ALERT_HI_DAYS=7
# Thresholds de atividade de funcionários (opcional)
FUNC_ATIVO_PING_MIN=15
FUNC_ATIVO_MOV_MIN=60
```
Se não definir os limiares, o backend usará 3 (médio) e 7 (alto). Ajuste conforme o ritmo de uso do bicicletário.

### 2.4 Deploy
1. Clique em **Create Web Service**
2. Aguarde o deploy (5-10 minutos)
3. Teste: `https://seu-app.onrender.com/health`

## 🌐 3. Frontend no GitHub Pages

### 3.1 Preparar Frontend
1. Crie repositório: `seu-usuario.github.io`
2. Faça upload dos arquivos HTML/CSS/JS
3. Atualize as URLs da API nos arquivos JS:

```javascript
// Trocar de:
const API_URL = 'http://localhost:5050';

// Para:
const API_URL = 'https://seu-app.onrender.com';
```

### 3.2 Ativar GitHub Pages
1. Vá em **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: main
4. Clique em **Save**

### 3.3 Atualizar CORS
No `server.js`, atualize o CORS:

```javascript
app.use(cors({
  origin: ['https://seu-usuario.github.io', 'http://localhost:3000'],
  // ...
}));
```

## ✅ 4. Teste Final

### 4.1 URLs Finais
- **Frontend**: `https://seu-usuario.github.io`
- **Backend**: `https://seu-app.onrender.com`
- **Banco**: Supabase (automático)

### 4.2 Teste de Login
1. Acesse o frontend
2. Use: `admin` / `admin123`
3. Teste cadastro de proprietário
4. Teste upload de foto

## 🛠 Manutenção

### Logs do Render
- Acesse o painel do Render
- Vá em **Logs** para ver erros

### Banco Supabase
- Monitore uso em **Settings** → **Usage**
- Limite gratuito: 500MB, 50k requisições/mês

### Atualizações
1. Faça push no GitHub
2. Render fará deploy automático
3. GitHub Pages atualiza automaticamente

### Ajustar sensibilidade de alertas
Altere `ALERT_MED_DAYS` / `ALERT_HI_DAYS` e redeploy. Para diagnóstico rápido você pode usar o botão "Manual Deploy" no Render após editar as variáveis.

### Ajustar detecção de atividade de funcionários
Se muitos aparecem como “Parado”, reduza `FUNC_ATIVO_PING_MIN` (ex.: 5) e/ou `FUNC_ATIVO_MOV_MIN` (ex.: 30) e redeploy.

## 🆘 Troubleshooting

### Erro de CORS
- Verifique se o frontend está na lista de origins permitidas
- Teste com `*` temporariamente

### Erro 500 no Backend
- Verifique logs no Render
- Confirme variáveis de ambiente

### Fotos não carregam
- Verifique se o bucket está público
- Confirme permissões no Supabase

### Banco não conecta
- Verifique URL e chave do Supabase
- Confirme se as tabelas existem

## 📞 Suporte

Em caso de problemas:
1. Verifique os logs do Render
2. Teste endpoints individualmente
3. Confirme configurações do Supabase
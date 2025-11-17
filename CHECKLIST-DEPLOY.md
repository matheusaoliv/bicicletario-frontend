# ✅ CHECKLIST RÁPIDO - Deploy em 30 Minutos

## 🕐 CRONOGRAMA DE DEPLOY

### Fase 1: Supabase (10 min)
- [ ] **5 min**: Criar projeto no Supabase
- [ ] **3 min**: Executar SQL (incluindo coluna extra)
- [ ] **2 min**: Criar bucket de storage público

### Fase 2: Backend no Render (10 min)
- [ ] **3 min**: Criar repositório GitHub backend
- [ ] **2 min**: Upload de `server.js` e `package.json`
- [ ] **5 min**: Deploy no Render + configurar variáveis

### Fase 3: Frontend no GitHub Pages (10 min)
- [ ] **2 min**: Atualizar URLs da API nos 3 arquivos JS
- [ ] **3 min**: Criar repositório GitHub frontend
- [ ] **3 min**: Upload de todos os arquivos
- [ ] **2 min**: Ativar GitHub Pages

---

## 📋 DADOS PARA ANOTAR

### Supabase:
```
Project URL: https://_____________.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiI...
Service Key: eyJhbGciOiJIUzI1NiI...
```

### Render:
```
App Name: _________________
URL Backend: https://_________.onrender.com
```

### GitHub Pages:
```
Repo Frontend: _________________
URL Frontend: https://________.github.io/_______
```

---

## 🚨 COMANDOS SQL OBRIGATÓRIOS

Execute no Supabase SQL Editor:

1. Script principal (conteúdo do `supabase-setup.sql`)
2. Script extra (se aplicável):
```sql
ALTER TABLE proprietarios ADD COLUMN foto_proprietario_extra_url TEXT;
```
3. Campo obrigatório para Check-in: número do lacre
```sql
ALTER TABLE controleacesso ADD COLUMN IF NOT EXISTS numero_lacre TEXT;
CREATE INDEX IF NOT EXISTS idx_controle_numero_lacre ON controleacesso(numero_lacre);
```

Se ao fazer check-in aparecer erro de coluna ausente, significa que o passo (3) não foi aplicado.

---

## 🔧 VARIÁVEIS DO RENDER

⚠️ ATENÇÃO: Use PORT=10000 para Render (não 5050)

```env
PORT=10000
NODE_ENV=production
SUPABASE_URL=https://_____________.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...
JWT_SECRET=MinhaChaveSecreta123456789
```

---

## 📁 ARQUIVOS PARA UPLOAD

### Backend (repositório 1):
- `server.js`
- `package.json`
- `supabase-setup.sql` (documentação)
- pasta `migrations/` (rodar conteúdos conforme necessário)

### Frontend (repositório 2):
- Pasta `BicicletarioMunicipaldeJaperi/` completa
- Antes do upload: Editar URLs em 3 arquivos JS

---

## 🧪 TESTE FINAL

Após deploy completo, teste:
1. [ ] Frontend carrega (GitHub Pages)
2. [ ] Backend health check: `https://seu-app.onrender.com/health`
3. [ ] Login admin funciona
4. [ ] Cadastro de proprietário
5. [ ] Upload de foto
6. [ ] Check-in/check-out (check-in exige número do lacre)
7. [ ] Select de bicicletas
8. [ ] Segunda foto do proprietário (galeria)

---

## 🆘 SE ALGO DER ERRADO

### Backend não conecta:
- Verifique variáveis de ambiente no Render
- Confirme SQL executado no Supabase
- Teste: `https://seu-app.onrender.com/health`

### Frontend não carrega:
- Aguarde 5 minutos (GitHub Pages demora)
- Verifique URLs da API nos arquivos JS
- Limpe cache do navegador (Ctrl+F5)

### Fotos não aparecem:
- Bucket deve estar público no Supabase
- Nome do bucket: `bicicletario-fotos`
- Verifique permissões de storage

### Erro 500 na API:
- Verifique logs no Render
- Confirme que todas as variáveis estão corretas
- Teste se Supabase está acessível

### CORS Error:
- Atualize CORS no server.js com sua URL do GitHub Pages
- Redeploy no Render após mudança

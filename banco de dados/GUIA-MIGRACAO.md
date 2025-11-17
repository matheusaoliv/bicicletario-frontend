# 🚀 GUIA DE MIGRAÇÃO SUPABASE → FIRESTORE

## 📋 Pré-requisitos
✅ Arquivos CSV exportados do Supabase (já estão na pasta)
✅ serviceAccountKey.json (já está na pasta)
✅ Node.js instalado
✅ Dependências instaladas (firebase-admin, csv-parser)

## 🔧 Instalação das Dependências

```bash
cd "D:\firebase\repositorio do github do sistema\banco de dados"
npm install
```

## 🎯 Execução da Migração

### 1️⃣ DRY-RUN (Teste sem escrever dados)
**RECOMENDADO FAZER PRIMEIRO!**

```bash
node migrar-supabase-firestore-v2.js --dry-run
```

Isso vai:
- ✅ Ler todos os CSVs
- ✅ Transformar os dados
- ✅ Mostrar amostras
- ✅ Contar quantos registros serão migrados
- ❌ NÃO escreve nada no Firestore

### 2️⃣ DRY-RUN com Limite (testar com poucos registros)

```bash
node migrar-supabase-firestore-v2.js --dry-run --limit=10
```

### 3️⃣ Migração REAL com Backup

```bash
node migrar-supabase-firestore-v2.js --backup
```

Isso vai:
- 📦 Fazer backup de todas as coleções existentes
- ✍️  Migrar todos os dados
- 📊 Gerar logs detalhados
- ✅ Fazer upsert (merge) para não perder dados existentes

### 4️⃣ Migração REAL sem Backup (mais rápido)

```bash
node migrar-supabase-firestore-v2.js
```

## 📊 Coleções que serão migradas

1. **funcionarios** (16 registros)
   - Campos: nome_completo, email, senha_hash, ativo, last_ping
   - ⚠️ CPF e contato convertidos para String

2. **proprietarios** (~1.263 registros)
   - Campos: nome_completo, cpf, contato, email, endereco, foto_proprietario_url
   - ⚠️ CPF e contato SEMPRE como String

3. **bicicletas** (~1.265 registros)
   - Campos: numero_identificacao, numero_bike, marca, modelo, tipo_bike
   - Vínculo: proprietario_id

4. **controleacesso** (~25.567 registros)
   - Campos: data_hora_entrada, data_hora_saida, local, numero_lacre
   - Vínculos: bicicleta_id, proprietario_id, funcionario_entrada_id

5. **alert_actions** (~75 registros)
   - Campos: alert_id, acao, autor, payload

## 🔍 Verificação Pós-Migração

Após a migração, verifique no Firebase Console:
https://console.firebase.google.com/project/bicicletario-japeri-v3/firestore

### Contagens esperadas:
- funcionarios: 16 docs
- proprietarios: ~1.263 docs
- bicicletas: ~1.265 docs
- controleacesso: ~25.567 docs
- alert_actions: ~75 docs

### Campos importantes para verificar:

**Proprietários:**
```javascript
{
  "nome_completo": "Thiago Rodrigues Souza",  // ✅ nome_completo (não "nome")
  "cpf": "901.234.567-89",                     // ✅ String
  "contato": "21954321098",                    // ✅ String
  "email": "thiago.souza@exemplo.org"
}
```

**Bicicletas:**
```javascript
{
  "numero_identificacao": "JPR-NIN0F9BLTQ4550",
  "numero_bike": "JPR-NIN0F9BLTQ4550",  // ✅ compatibilidade
  "proprietario_id": "1",                // ✅ String
  "marca": "caloi",
  "tipo_bike": "Mountain Bike"
}
```

**Controle de Acesso:**
```javascript
{
  "bicicleta_id": "1",           // ✅ String
  "proprietario_id": "1",        // ✅ String
  "data_hora_entrada": Timestamp,
  "data_hora_saida": Timestamp,
  "local": "Japeri",
  "numero_lacre": "..."          // importante para check-ins
}
```

## 📁 Arquivos Gerados

### Backups (se usar --backup):
```
backup-firestore/
  funcionarios_1731801234567.json
  proprietarios_1731801234567.json
  bicicletas_1731801234567.json
  controleacesso_1731801234567.json
  alert_actions_1731801234567.json
```

### Logs:
```
logs-migracao/
  funcionarios_1731801234567.log
  proprietarios_1731801234567.log
  bicicletas_1731801234567.log
  controleacesso_1731801234567.log
  alert_actions_1731801234567.log
```

## ⚠️ IMPORTANTE

1. **Backup Manual (Recomendado)**
   - Antes de rodar, faça export manual no Firebase Console
   - Settings → Service accounts → Generate new private key

2. **Tempo de Execução**
   - ~25.000 registros levam aproximadamente 5-10 minutos
   - O script faz pausas de 1.5s entre lotes para respeitar limites

3. **Merge Mode**
   - O script usa `{ merge: true }`
   - Dados existentes NÃO serão apagados
   - Apenas campos novos/atualizados serão modificados

4. **Erros Comuns**
   - "Permission denied": verificar permissões do service account
   - "Not found": verificar se o projeto está correto
   - "Quota exceeded": aguardar alguns minutos e tentar novamente

## 🧪 Teste no App

Após a migração, teste:

1. **Login de funcionário**
   ```
   http://localhost:3000/login.html
   Usuário: matheusaoliv
   ```

2. **Dashboard**
   ```
   http://localhost:3000/area-funcionario.html
   - Verificar estatísticas
   - Verificar feed de atividades
   - Verificar gráficos
   ```

3. **Busca de proprietário**
   ```
   - Buscar por CPF: 901.234.567-89
   - Buscar por nome: Thiago
   ```

4. **Cadastro de bicicleta**
   ```
   - Verificar se proprietários aparecem
   - Verificar se marcas/modelos carregam
   ```

## 🆘 Suporte

Se algo der errado:

1. Verifique os logs em `logs-migracao/`
2. Verifique o backup em `backup-firestore/`
3. Consulte o Firebase Console para ver os dados
4. Execute novamente com `--dry-run` para diagnosticar

## ✅ Checklist Final

- [ ] Executei `npm install`
- [ ] Executei dry-run e verifiquei as amostras
- [ ] Fiz backup manual no Firebase Console (opcional mas recomendado)
- [ ] Executei a migração real com `--backup`
- [ ] Verifiquei as contagens no Firestore
- [ ] Testei login no app
- [ ] Testei busca de proprietário
- [ ] Testei dashboard e gráficos
- [ ] Sistema pronto para inauguração! 🎉

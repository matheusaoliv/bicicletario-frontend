# Execução Local - Bicicletário Municipal

Este guia explica como rodar API (backend) e Frontend localmente, sem alterar referências usadas em produção (GitHub Pages / Render / Supabase).

## Pré-requisitos
- Node.js 18+
- Conta e projeto no Supabase com:
  - Banco com tabelas esperadas (ver `supabase-setup.sql`)
  - Bucket de storage `bicicletario-fotos`
  - Chaves: `anon` e `service_role`

## 1) Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto (mesmo nível de `server.js`):

```
PORT=5050
JWT_SECRET=sua_chave_secreta_forte
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
# Limiares de severidade (dias de inatividade para alertas)
ALERT_MED_DAYS=3   # a partir deste número de dias passa de 'baixa' para 'média'
ALERT_HI_DAYS=7    # a partir deste número de dias passa de 'média' para 'alta'
# Thresholds de atividade de funcionários (minutos)
FUNC_ATIVO_PING_MIN=15  # ativo se último ping < 15 min
FUNC_ATIVO_MOV_MIN=60   # ativo se última movimentação < 60 min
```

Se não definir, os valores padrão são 3 e 7. Se `ALERT_HI_DAYS` for menor que `ALERT_MED_DAYS`, o backend ajusta automaticamente para evitar inconsistências.

Dica: ao rodar `npm install`/`npm run prepare`, o script `scripts/check-env.js` checa a existência do `.env` e alerta se faltar alguma variável.

## 2) Backend (API local)
Instale dependências e inicie a API local:

```
npm install
npm run dev
```

A API ficará exposta em: `http://localhost:5050/api`

Observações:
- O CORS já permite chamadas a partir de `http://localhost:3000`.
- Uploads de fotos usam o Supabase Storage configurado no `.env`.

## 3) Frontend (arquivos estáticos)
Para servir o frontend localmente (pasta `BicicletarioMunicipaldeJaperi/`):

```
npm run serve:front
```

Acesse:
- `http://localhost:3000/area-funcionario.html`
- `http://localhost:3000/ficha_proprietario.html`

## 4) Subir Backend e Frontend juntos
Use o comando que inicia API e Frontend em paralelo:

```
npm run dev:all
```

Isso vai rodar:
- API em `http://localhost:5050/api` (nodemon)
- Front em `http://localhost:3000` (http-server)

## 5) Roteamento da API no Front (sem afetar produção)
Foi criado o arquivo local `BicicletarioMunicipaldeJaperi/js/config-local.js` com:

```html
<script>
  window.API_BASE_URL = 'http://localhost:5050/api';
</script>
```

Ele é carregado ANTES do `js/api-client.js` nas páginas principais (apenas no ambiente local). Em produção este arquivo não existe e está listado no `.gitignore`:

```
BicicletarioMunicipaldeJaperi/js/config-local.js
```

Assim, a base da API aponta para o backend local somente durante seus testes.

## 6) Fluxos para testar
- Login de funcionário (gera token e guarda no storage)
- Busca Rápida (rota GET `/api/controle-acesso/buscar`)
- "Ver Detalhes" abre `ficha_proprietario.html?id=...&bike=...` e carrega dados do cache + fallback de API
- Modais (Estacionadas/Entradas/Saídas) e gráficos
- Uploads (se desejar): exigem bucket e permissões no Supabase
- Check-in exige informar o Número do lacre

## 6.1) Migração obrigatória: Número do lacre
O check-in agora exige salvar o campo `numero_lacre` em `controleacesso`.

- Em instalações novas: `supabase-setup.sql` já cria a coluna e o índice.
- Em bancos existentes: rode no SQL Editor do Supabase:

```sql
ALTER TABLE controleacesso ADD COLUMN IF NOT EXISTS numero_lacre TEXT;
CREATE INDEX IF NOT EXISTS idx_controle_numero_lacre ON controleacesso(numero_lacre);
```

Sintoma se faltar: ao fazer check-in, a API retorna 500 com mensagem indicando coluna ausente e a dica de `ALTER TABLE ... numero_lacre`.

## 7) Troubleshooting
- 401/403 ao chamar API:
  - Faça login novamente; o token pode ter expirado.
  - Verifique `JWT_SECRET` no `.env` (API) e limpe `localStorage/sessionStorage` no navegador.
- CORS:
  - O backend já libera `http://localhost:3000`. Se mudar a porta do front, atualize a origem permitida no `server.js`.
- Upload falhando:
  - Confirme as chaves do Supabase, existência do bucket `bicicletario-fotos` e permissões.
- API não sobe:
  - Cheque se o `.env` existe e possui as variáveis exigidas (script `prepare` mostrará avisos no console).

### 7.1 Limiares de severidade
Use as variáveis para calibrar sensibilidade dos gráficos e listagens de alertas:
- `ALERT_MED_DAYS`: dias de inatividade para classificar como severidade média (default 3)
- `ALERT_HI_DAYS`: dias de inatividade para severidade alta (default 7)

Exemplo rápido de alteração temporária (Windows CMD):
```
set ALERT_MED_DAYS=2 && set ALERT_HI_DAYS=5 && npm run dev
```

### 7.2 Atividade de Funcionários
- `FUNC_ATIVO_PING_MIN`: minutos para considerar Ativo com base no último ping do navegador.
- `FUNC_ATIVO_MOV_MIN`: minutos para considerar Ativo com base na última movimentação (check-in/check-out/justificativa).
Use valores menores se quiser uma detecção mais sensível.

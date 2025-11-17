# bicicletario-backend

API Express + Supabase para gestão do Bicicletário Municipal.

## Visão Geral
- Autenticação JWT para funcionários
- Tabelas: funcionarios, proprietarios, bicicletas, controleacesso
- Alertas de inatividade com severidade dinâmica (baixa, média, alta)
- Auditoria de ações de alerta em `alert_actions`

## Schema / Migrações
Schema base: `supabase-setup.sql` (idempotente). Migrações incrementais em `migrations/`.

Migração recente:
- `20251008_indices_controleacesso.sql`: adiciona índices compostos `(data_hora_entrada, data_hora_saida)` e por `local`.

## Variáveis de Ambiente Principais
Obrigatórias:
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Opcionais (limiares de severidade de alertas):
- `ALERT_MED_DAYS` (default 3)
- `ALERT_HI_DAYS` (default 7; ajustado para >= médio se menor)

Exemplo completo: ver `.env.example`.

## Execução Rápida Local
```
npm install
cp .env.example .env  # Ajuste valores
npm run dev
```
API: http://localhost:5050/api

## Frontend
Arquivos estáticos em `BicicletarioMunicipaldeJaperi/`. Servir local: `npm run serve:front` (porta 3000).

## Ajustando Severidade de Alertas
Modifique os dias de inatividade:
```
set ALERT_MED_DAYS=2 && set ALERT_HI_DAYS=5 && npm run dev
```

## Licença
MIT

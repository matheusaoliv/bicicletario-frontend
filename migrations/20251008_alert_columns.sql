-- Migração 2025-10-08: colunas de estado de alertas em controleacesso
-- Estas colunas já podem existir; usamos IF NOT EXISTS para idempotência
ALTER TABLE controleacesso ADD COLUMN IF NOT EXISTS alerta_resolvido BOOLEAN;
ALTER TABLE controleacesso ADD COLUMN IF NOT EXISTS alerta_responsavel TEXT;
ALTER TABLE controleacesso ADD COLUMN IF NOT EXISTS alerta_status TEXT;

-- Índices auxiliares já definidos no script base, repetidos aqui para segurança
CREATE INDEX IF NOT EXISTS idx_controle_alerta_resolvido ON controleacesso(alerta_resolvido);
CREATE INDEX IF NOT EXISTS idx_controle_alerta_status ON controleacesso(alerta_status);


-- Migração 2025-10-15: campo número do lacre em controleacesso
-- Adiciona a coluna usada para registrar o lacre no momento do check-in

ALTER TABLE controleacesso
  ADD COLUMN IF NOT EXISTS numero_lacre TEXT;

-- Índice simples para pesquisas futuras por lacre (opcional, mas barato)
CREATE INDEX IF NOT EXISTS idx_controle_numero_lacre ON controleacesso(numero_lacre);


-- Migração 2025-10-08: índices adicionais em controleacesso
-- Objetivo: melhorar filtros por período e local
CREATE INDEX IF NOT EXISTS idx_controle_entrada_saida ON controleacesso(data_hora_entrada, data_hora_saida);
CREATE INDEX IF NOT EXISTS idx_controle_local ON controleacesso(local);


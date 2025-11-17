-- Script para criar as tabelas no Supabase
-- Execute este script no SQL Editor do Supabase

-- Tabela de Funcionários
CREATE TABLE IF NOT EXISTS funcionarios (
    id BIGSERIAL PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    nome_usuario TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    email TEXT UNIQUE,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ativo BOOLEAN DEFAULT true
);

-- Tabela de Proprietários
CREATE TABLE IF NOT EXISTS proprietarios (
    id BIGSERIAL PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    email TEXT,
    cpf TEXT NOT NULL UNIQUE,
    contato TEXT,
    endereco TEXT,
    foto_proprietario_url TEXT,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Bicicletas
CREATE TABLE IF NOT EXISTS bicicletas (
    id BIGSERIAL PRIMARY KEY,
    proprietario_id BIGINT NOT NULL REFERENCES proprietarios(id) ON DELETE CASCADE,
    numero_identificacao TEXT NOT NULL UNIQUE,
    tipo_bike TEXT,
    marca TEXT,
    modelo TEXT,
    observacoes_bike TEXT,
    foto_bicicleta_url TEXT,
    foto_dono_com_bicicleta_url TEXT,
    data_cadastro_bike TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Controle de Acesso
CREATE TABLE IF NOT EXISTS controleacesso (
    id BIGSERIAL PRIMARY KEY,
    bicicleta_id BIGINT NOT NULL REFERENCES bicicletas(id) ON DELETE RESTRICT,
    proprietario_id BIGINT NOT NULL REFERENCES proprietarios(id) ON DELETE RESTRICT,
    funcionario_entrada_id BIGINT NOT NULL REFERENCES funcionarios(id) ON DELETE RESTRICT,
    funcionario_saida_id BIGINT REFERENCES funcionarios(id) ON DELETE RESTRICT,
    local TEXT NOT NULL,
    data_hora_entrada TIMESTAMP WITH TIME ZONE NOT NULL,
    data_hora_saida TIMESTAMP WITH TIME ZONE,
    observacoes_entrada TEXT,
    observacoes_saida TEXT,
    observacao_geral TEXT,
    numero_lacre TEXT
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_proprietarios_cpf ON proprietarios(cpf);
CREATE INDEX IF NOT EXISTS idx_funcionarios_nome_usuario ON funcionarios(nome_usuario);
CREATE INDEX IF NOT EXISTS idx_bicicletas_numero ON bicicletas(numero_identificacao);
CREATE INDEX IF NOT EXISTS idx_controle_entrada ON controleacesso(data_hora_entrada);
CREATE INDEX IF NOT EXISTS idx_controle_saida ON controleacesso(data_hora_saida);
-- Índices adicionais para consultas combinadas e por local (adicionados em 2025-10-08)
CREATE INDEX IF NOT EXISTS idx_controle_entrada_saida ON controleacesso(data_hora_entrada, data_hora_saida);
CREATE INDEX IF NOT EXISTS idx_controle_local ON controleacesso(local);
-- Índice para o número do lacre (adicionado em 2025-10-15)
CREATE INDEX IF NOT EXISTS idx_controle_numero_lacre ON controleacesso(numero_lacre);

-- Habilitar RLS (Row Level Security) - opcional
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE proprietarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicicletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE controleacesso ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (permitir tudo para usuários autenticados)
CREATE POLICY "Permitir tudo para usuários autenticados" ON funcionarios
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir tudo para usuários autenticados" ON proprietarios
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir tudo para usuários autenticados" ON bicicletas
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir tudo para usuários autenticados" ON controleacesso
    FOR ALL USING (auth.role() = 'authenticated');

-- Inserir usuário admin padrão (senha: admin123)
INSERT INTO funcionarios (nome_completo, nome_usuario, senha_hash, email) 
VALUES (
    'Administrador', 
    'admin', 
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
    'admin@bicicletario.com'
) ON CONFLICT (nome_usuario) DO NOTHING;
-- Tabela de ações de alertas (auditoria)
CREATE TABLE IF NOT EXISTS alert_actions (
    id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL,
    acao TEXT NOT NULL CHECK (acao IN ('resolver','atribuir','comentar','silenciar')),
    autor TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_actions_alert_id ON alert_actions(alert_id);

-- Habilitar RLS e políticas
ALTER TABLE alert_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo para usuários autenticados" ON alert_actions
    FOR ALL USING (auth.role() = 'authenticated');

-- Materialização de estado dos alertas em controleacesso
ALTER TABLE controleacesso ADD COLUMN IF NOT EXISTS alerta_resolvido BOOLEAN;
ALTER TABLE controleacesso ADD COLUMN IF NOT EXISTS alerta_responsavel TEXT;
ALTER TABLE controleacesso ADD COLUMN IF NOT EXISTS alerta_status TEXT;

CREATE INDEX IF NOT EXISTS idx_controle_alerta_resolvido ON controleacesso(alerta_resolvido);
CREATE INDEX IF NOT EXISTS idx_controle_alerta_status ON controleacesso(alerta_status);

ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS last_ping TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_funcionarios_last_ping ON funcionarios(last_ping);

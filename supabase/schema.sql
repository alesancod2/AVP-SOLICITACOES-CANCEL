-- =============================================
-- AVP System - Schema PostgreSQL (Supabase)
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABELA: usuarios
-- =============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'User' CHECK (perfil IN ('Admin', 'User')),
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  permissoes JSONB NOT NULL DEFAULT '{"cancelamentos": true, "suspensos": true, "dashboard": true}'::jsonb,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acesso TIMESTAMPTZ,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON usuarios(auth_user_id);

-- =============================================
-- TABELA: cancelamentos
-- =============================================
CREATE TABLE IF NOT EXISTS cancelamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_associado TEXT NOT NULL,
  placa TEXT NOT NULL,
  valor_parcela TEXT DEFAULT '',
  valor_pago TEXT DEFAULT '',
  consultor TEXT DEFAULT '',
  motivo_cancelamento TEXT DEFAULT '',
  status_atual TEXT NOT NULL DEFAULT 'Ativo' CHECK (
    status_atual IN ('Ativo', 'Inadimplente', 'Cancelado', 'Retido', 'Pendente', 'Em negociacao')
  ),
  observacao TEXT DEFAULT '',
  atendente TEXT DEFAULT '',
  mes_referencia TEXT DEFAULT '',
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_cancelamentos_status ON cancelamentos(status_atual);
CREATE INDEX IF NOT EXISTS idx_cancelamentos_atendente ON cancelamentos(atendente);
CREATE INDEX IF NOT EXISTS idx_cancelamentos_placa ON cancelamentos(placa);
CREATE INDEX IF NOT EXISTS idx_cancelamentos_mes_ref ON cancelamentos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_cancelamentos_data_criacao ON cancelamentos(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_cancelamentos_nome ON cancelamentos(nome_associado);

-- =============================================
-- TABELA: suspensos
-- =============================================
CREATE TABLE IF NOT EXISTS suspensos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  associado TEXT NOT NULL,
  dt_recebimento TEXT DEFAULT '',
  dt_vencimento TEXT DEFAULT '',
  placa TEXT NOT NULL,
  situacao TEXT DEFAULT '' CHECK (
    situacao IN ('Pendente', 'Pago', 'Parcial', 'Nao localizado', 'Recusa', '')
  ),
  forma_pagamento TEXT DEFAULT '' CHECK (
    forma_pagamento IN ('PIX', 'Boleto', 'Cartao', 'Transferencia', 'Dinheiro', '')
  ),
  valor_recebido TEXT DEFAULT '',
  valor_original TEXT DEFAULT '',
  atendente TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  conferencia TEXT DEFAULT '' CHECK (
    conferencia IN ('OK', 'Verificar', '')
  ),
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_suspensos_situacao ON suspensos(situacao);
CREATE INDEX IF NOT EXISTS idx_suspensos_atendente ON suspensos(atendente);
CREATE INDEX IF NOT EXISTS idx_suspensos_placa ON suspensos(placa);
CREATE INDEX IF NOT EXISTS idx_suspensos_conferencia ON suspensos(conferencia);
CREATE INDEX IF NOT EXISTS idx_suspensos_data_criacao ON suspensos(data_criacao DESC);

-- =============================================
-- TABELA: logs (auditoria)
-- =============================================
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario TEXT DEFAULT '',
  email TEXT DEFAULT '',
  perfil TEXT DEFAULT '',
  acao TEXT NOT NULL,
  registro_id TEXT DEFAULT '',
  campo TEXT DEFAULT '',
  antes TEXT DEFAULT '',
  depois TEXT DEFAULT ''
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_logs_data ON logs(data DESC);
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs(usuario);
CREATE INDEX IF NOT EXISTS idx_logs_acao ON logs(acao);

-- =============================================
-- TRIGGER: atualizado_em automatico
-- =============================================
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cancelamentos_updated
  BEFORE UPDATE ON cancelamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();

CREATE TRIGGER trigger_suspensos_updated
  BEFORE UPDATE ON suspensos
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();

-- =============================================
-- RLS (Row Level Security)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspensos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Policy: service_role bypasses RLS by default
-- Policy for authenticated users (through API routes using service_role, 
-- so RLS is effectively bypassed; these policies are for direct access)

CREATE POLICY "Service role full access on usuarios"
  ON usuarios FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on cancelamentos"
  ON cancelamentos FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on suspensos"
  ON suspensos FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on logs"
  ON logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- PRIMEIRO USUARIO ADMIN (placeholder)
-- Altere o email abaixo para o email do administrador
-- =============================================
-- INSERT INTO usuarios (nome, email, perfil, status, permissoes)
-- VALUES (
--   'Administrador',
--   'admin@empresa.com',
--   'Admin',
--   'Ativo',
--   '{"cancelamentos": true, "suspensos": true, "dashboard": true}'::jsonb
-- )
-- ON CONFLICT (email) DO NOTHING;

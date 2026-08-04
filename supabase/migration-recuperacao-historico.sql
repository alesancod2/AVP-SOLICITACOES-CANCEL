-- =============================================
-- TABELA: recuperacao_historico
-- Registra cada tentativa de contato/abordagem
-- Preserva dados mesmo quando cliente sai da fila ativa
-- ESCOPO: apenas modulo Recuperacao
-- =============================================

CREATE TABLE IF NOT EXISTS recuperacao_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recuperacao_id UUID NOT NULL,
  aeasy_venda_id TEXT,
  associado TEXT,
  placa TEXT,
  telefone TEXT,
  plano TEXT,
  atendente TEXT NOT NULL,
  status_anterior TEXT DEFAULT '',
  status_novo TEXT NOT NULL,
  observacoes TEXT DEFAULT '',
  data_tentativa TIMESTAMPTZ DEFAULT now()
);

-- Index para busca rapida por registro e por atendente
CREATE INDEX IF NOT EXISTS idx_recuperacao_hist_registro ON recuperacao_historico(recuperacao_id);
CREATE INDEX IF NOT EXISTS idx_recuperacao_hist_atendente ON recuperacao_historico(atendente);
CREATE INDEX IF NOT EXISTS idx_recuperacao_hist_aeasy ON recuperacao_historico(aeasy_venda_id);

-- Desabilitar RLS (service_role key ja bypassa)
ALTER TABLE recuperacao_historico DISABLE ROW LEVEL SECURITY;

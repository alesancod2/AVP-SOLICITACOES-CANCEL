-- =============================================
-- MIGRACAO: Adicionar campo 'chassi' e mudar chave de deduplicacao
-- Chave unica: chassi + associado (ao inves de aeasy_venda_id)
-- =============================================

-- 1. Adicionar coluna chassi
ALTER TABLE recuperacao ADD COLUMN IF NOT EXISTS chassi TEXT DEFAULT '';

-- 2. Remover UNIQUE INDEX antigo (aeasy_venda_id)
DROP INDEX IF EXISTS idx_recuperacao_aeasy_venda_id;

-- 3. Criar novo UNIQUE INDEX composto (chassi + associado)
-- Mesmo chassi + associado diferente = registro valido
-- Mesmo chassi + mesmo associado = duplicado (bloqueado pelo index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_recuperacao_chassi_associado
  ON recuperacao(chassi, associado);

-- 4. Index para busca por chassi
CREATE INDEX IF NOT EXISTS idx_recuperacao_chassi ON recuperacao(chassi);

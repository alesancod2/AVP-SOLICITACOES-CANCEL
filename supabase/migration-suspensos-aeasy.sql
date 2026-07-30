-- =============================================
-- MIGRATION: Suspensos - Campos AEasy + Unique Constraint
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. Adicionar colunas extras vindas do AEasy (se nao existirem)
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS aeasy_venda_id TEXT;
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS dia_vencimento TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS dias_atraso INTEGER DEFAULT 0;
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS data_suspensao TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS tipo_suspensao TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS consultor TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS sede TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS documento TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS telefone TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS modelo TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS marca TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS valor_contribuicao TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS faturas_pagas INTEGER DEFAULT 0;
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS faturas_atraso INTEGER DEFAULT 0;
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS sincronizado_em TIMESTAMPTZ;
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS situacao_aeasy TEXT DEFAULT 'Suspenso';

-- 2. Criar UNIQUE constraint em aeasy_venda_id (necessario para upsert/merge-duplicates)
-- Primeiro, remover duplicatas existentes (manter mais recente)
DELETE FROM suspensos a
USING suspensos b
WHERE a.aeasy_venda_id = b.aeasy_venda_id
  AND a.aeasy_venda_id IS NOT NULL
  AND a.data_criacao < b.data_criacao;

-- Criar indice unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_suspensos_aeasy_venda_id
  ON suspensos(aeasy_venda_id)
  WHERE aeasy_venda_id IS NOT NULL;

-- 3. Remover CHECK constraint antigo de situacao (que nao inclui 'Suspenso')
-- e adicionar novo que inclui os valores da AEasy
ALTER TABLE suspensos DROP CONSTRAINT IF EXISTS suspensos_situacao_check;

-- Nota: A coluna 'situacao' agora e usada apenas para atendimento interno
-- A coluna 'situacao_aeasy' contem o status real vindo da AEasy
-- Nao precisa mais de CHECK constraint em situacao pois eh campo livre do atendimento

-- 4. Indice para dia_vencimento (usado nas abas do frontend)
CREATE INDEX IF NOT EXISTS idx_suspensos_dia_vencimento ON suspensos(dia_vencimento);

-- 5. Indice para aeasy_venda_id
CREATE INDEX IF NOT EXISTS idx_suspensos_aeasy_id ON suspensos(aeasy_venda_id);

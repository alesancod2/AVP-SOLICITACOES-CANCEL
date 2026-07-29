# Edge Function: sync-aeasy

Sincroniza dados de associados suspensos da API AEasy (South Tecnologia) para a tabela `suspensos` no Supabase.

## Regra de Negocio

**Valor de contribuicao = Valor original**

O campo `valor_contribuicao` recebe exatamente o valor retornado pelo campo `VendasValor` da AEasy.

## Fluxo

1. Login na AEasy via `POST /conta/login` (recebe PHPSESSID)
2. Busca associados suspensos via `POST /vendas/listagem` (paginado)
3. Mapeia campos AEasy -> Supabase
4. Upsert na tabela `suspensos` (sem duplicatas, baseado em `aeasy_venda_id`)
5. Registra log da sincronizacao

## Deploy

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Login no Supabase

```bash
supabase login
```

### 3. Linkar com seu projeto

```bash
supabase link --project-ref SEU_PROJECT_REF
```

### 4. Configurar variaveis de ambiente

No painel do Supabase: **Settings > Edge Functions > Add Secret**

| Variavel | Valor | Descricao |
|----------|-------|-----------|
| `AEASY_BASE_URL` | `https://aeasy.autovaleprevencoes.org` | URL base da AEasy |
| `AEASY_LOGIN` | `08730776449` | CPF de acesso |
| `AEASY_PASSWORD` | `Avp@2026` | Senha de acesso |
| `SUPABASE_URL` | (automatico) | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | (automatico) | Service role key |

**Nota:** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ja estao disponiveis automaticamente em Edge Functions.

### 5. Deploy

```bash
supabase functions deploy sync-aeasy --no-verify-jwt
```

O `--no-verify-jwt` permite chamar a funcao sem autenticacao (util para cron). Se quiser proteger, remova essa flag e passe o token no header `Authorization: Bearer <anon_key>`.

### 6. Adicionar coluna aeasy_venda_id (se nao existir)

Execute no SQL Editor do Supabase:

```sql
-- Adicionar coluna para evitar duplicatas
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS aeasy_venda_id TEXT UNIQUE;

-- Adicionar colunas extras da AEasy
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS documento TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS telefone TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS modelo TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS marca TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS valor_contribuicao TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS dia_vencimento TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS data_suspensao TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS dias_atraso INTEGER DEFAULT 0;
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS faturas_pagas INTEGER DEFAULT 0;
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS faturas_atraso INTEGER DEFAULT 0;
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS tipo_suspensao TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS consultor TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS sede TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT '';
ALTER TABLE suspensos ADD COLUMN IF NOT EXISTS sincronizado_em TIMESTAMPTZ;

-- Index para upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_suspensos_aeasy_venda_id ON suspensos(aeasy_venda_id);
```

## Chamar a funcao

### Via curl (manual)

```bash
curl -X POST https://SEU_PROJECT_REF.supabase.co/functions/v1/sync-aeasy \
  -H "Content-Type: application/json"
```

### Via cron (automatico, a cada 6 horas)

No Supabase Dashboard: **Database > Extensions > pg_cron**

```sql
-- Habilitar extensao
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar sync a cada 6 horas
SELECT cron.schedule(
  'sync-aeasy-job',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/sync-aeasy',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

### Via frontend (botao "Sincronizar")

```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-aeasy`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
  }
);
const result = await response.json();
console.log(result); // { success: true, synced: 1502, ... }
```

## Mapeamento de Campos

| AEasy (origem) | Supabase (destino) | Regra |
|---|---|---|
| `VendasId` | `aeasy_venda_id` | Chave unica (upsert) |
| `ClientesIndividuosNome` | `associado` | Direto |
| `ClientesIndividuosDocumento` | `documento` | Direto |
| `VendasCarrosPlaca` | `placa` | Direto |
| **`VendasValor`** | **`valor_original`** | Direto |
| **`VendasValor`** | **`valor_contribuicao`** | **= valor_original** |
| `VendasVencimento` | `dia_vencimento` | Dia do mes |
| `VendasDataSuspensao` | `data_suspensao` | dd/mm/aaaa |
| `VendasDiasAtraso` | `dias_atraso` | Integer |
| `ConsultoresNome` | `consultor` | Direto |
| `ConsultoresCentroCustoNome` | `sede` | Direto |
| `VendasCarrosCategoriasPlanosNome` | `plano` | Direto |
| `VendasFormaPagamentoEnum` | `forma_pagamento` | 1=Boleto, 2=Cartao |

## Troubleshooting

| Erro | Causa | Solucao |
|------|-------|---------|
| "Falha no login AEasy" | Credenciais erradas ou sessao bloqueada | Verificar AEASY_LOGIN e AEASY_PASSWORD |
| "Erro ao gravar no Supabase" | Coluna faltando ou tipo errado | Executar SQL de migracao acima |
| Timeout (>25s) | Muitos registros para buscar | Reduzir periodo ou aumentar pageSize |
| "Sessao expirada" | PHPSESSID expirou durante paginacao | Funcao re-loga automaticamente em caso de erro |

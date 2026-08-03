// =============================================
// CONSTANTES GLOBAIS DA APLICACAO - AVP System
// Centraliza magic numbers e opcoes repetidas
// =============================================

// ---- POLLING & CACHE ----
/** Intervalo de polling para sync real-time entre operadores (ms) */
export const POLLING_INTERVAL_MS = 3_000;

/** TTL do cache em memoria de suspensos (ms) */
export const SUSPENSOS_CACHE_TTL_MS = 3_000;

/** Timeout para aguardar GitHub Actions apos disparar sync (ms) */
export const SYNC_AEASY_WAIT_MS = 30_000;

/** Tempo para auto-dismiss de notificacoes (ms) */
export const NOTIFICATION_DISMISS_MS = 10_000;

// ---- PAGINACAO ----
/** Registros por pagina na tabela de Cancelamentos */
export const CANCELAMENTOS_PAGE_SIZE = 20;

/** Maximo de registros por request (cap de seguranca) */
export const MAX_PAGE_SIZE = 1000;

/** Maximo de registros buscados para client-side filtering */
export const CANCELAMENTOS_FETCH_SIZE = 5000;

/** Batch size do Supabase na busca de suspensos */
export const SUSPENSOS_BATCH_SIZE = 10_000;

/** Registros visiveis iniciais na tabela de Suspensos (progressive rendering) */
export const SUSPENSOS_INITIAL_VISIBLE = 100;

// ---- DASHBOARD ----
/** Dias de evolucao mostrados no grafico */
export const DASHBOARD_EVOLUTION_DAYS = 30;

// ---- LIMITES ----
/** Limite de logs retornados por default */
export const LOGS_DEFAULT_LIMIT = 200;

/** Tamanho maximo de arquivo para import (bytes) */
export const IMPORT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ---- FORMAS DE PAGAMENTO ----
/** Opcoes de forma de pagamento (usadas em filtros e formularios) */
export const FORMA_PAGAMENTO_OPTIONS = [
  "PIX",
  "Boleto",
  "Cartao",
  "Transferencia",
  "Dinheiro",
] as const;

// ---- SITUACOES AEASY ----
/** Opcoes de situacao vindas da AEasy (read-only) */
export const SITUACAO_AEASY_OPTIONS = [
  "Suspenso",
  "Inadimplente",
  "Cancelado",
] as const;

// ---- CONFERENCIA ----
/** Opcoes de status de conferencia */
export const CONFERENCIA_OPTIONS = ["OK", "Verificar"] as const;

// ---- VALOR SEGMENTO ----
/** Faixas de segmentacao por valor */
export const VALOR_SEGMENTO_OPTIONS = [
  { value: "alto", label: "Alto Valor (>R$200)", min: 200, max: Infinity },
  { value: "medio", label: "Medio (R$100-200)", min: 100, max: 200 },
  { value: "baixo", label: "Baixo (<R$100)", min: 0, max: 100 },
] as const;

// ---- VENCIMENTOS ----
/** Dias de vencimento disponiveis (abas) */
export const DIAS_VENCIMENTO = ["5", "10", "15", "20", "25", "30"] as const;

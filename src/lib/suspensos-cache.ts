// =============================================
// CACHE EM MEMORIA PARA SUSPENSOS (TTL 3s)
// Compartilhado entre /api/suspensos e /api/suspensos/atendimento
// para garantir invalidacao apos mutacoes
// =============================================

interface CacheEntry {
  data: any[];
  totalReal: number;
  timestamp: number;
}

let suspensosCache: CacheEntry | null = null;
const CACHE_TTL_MS = 3_000; // 3 segundos

export function getCachedSuspensos(): CacheEntry | null {
  if (suspensosCache && Date.now() - suspensosCache.timestamp < CACHE_TTL_MS) {
    return suspensosCache;
  }
  suspensosCache = null;
  return null;
}

export function setCachedSuspensos(data: any[], totalReal: number): void {
  suspensosCache = { data, totalReal, timestamp: Date.now() };
}

export function invalidateSuspensosCache(): void {
  suspensosCache = null;
}

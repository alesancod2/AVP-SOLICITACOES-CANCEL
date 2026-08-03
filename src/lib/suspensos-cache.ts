// Cache em memoria para suspensos (TTL 3s)

interface CacheEntry {
  data: any[];
  totalReal: number;
  timestamp: number;
}

let suspensosCache: CacheEntry | null = null;
const CACHE_TTL_MS = 3_000;

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

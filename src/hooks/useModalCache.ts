import { useState, useCallback, useRef, useEffect } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
}

interface ModalCacheConfig {
  maxSize?: number;
  ttlMinutes?: number;
}

const DEFAULT_MAX_SIZE = 5;
const DEFAULT_TTL_MINUTES = 30;

/**
 * Hook for caching modal data with LRU eviction and TTL
 */
export function useModalCache<T>(config?: ModalCacheConfig) {
  const maxSize = config?.maxSize ?? DEFAULT_MAX_SIZE;
  const ttlMs = (config?.ttlMinutes ?? DEFAULT_TTL_MINUTES) * 60 * 1000;
  
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  // Cleanup expired entries periodically
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      const cache = cacheRef.current;
      
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > ttlMs) {
          cache.delete(key);
        }
      }
    };

    const interval = setInterval(cleanup, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [ttlMs]);

  const get = useCallback((key: string): T | null => {
    const entry = cacheRef.current.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > ttlMs) {
      cacheRef.current.delete(key);
      return null;
    }
    
    // Update access count for LRU
    entry.accessCount++;
    return entry.data;
  }, [ttlMs]);

  const set = useCallback((key: string, data: T) => {
    const cache = cacheRef.current;
    
    // Evict least recently used if at capacity
    if (cache.size >= maxSize && !cache.has(key)) {
      let lruKey: string | null = null;
      let lruCount = Infinity;
      let lruTimestamp = Infinity;
      
      for (const [k, entry] of cache.entries()) {
        if (entry.accessCount < lruCount || 
            (entry.accessCount === lruCount && entry.timestamp < lruTimestamp)) {
          lruKey = k;
          lruCount = entry.accessCount;
          lruTimestamp = entry.timestamp;
        }
      }
      
      if (lruKey) {
        cache.delete(lruKey);
      }
    }
    
    cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
    });
    
    setCacheVersion(v => v + 1);
  }, [maxSize]);

  const invalidate = useCallback((key: string) => {
    cacheRef.current.delete(key);
    setCacheVersion(v => v + 1);
  }, []);

  const clear = useCallback(() => {
    cacheRef.current.clear();
    setCacheVersion(v => v + 1);
  }, []);

  const has = useCallback((key: string): boolean => {
    const entry = cacheRef.current.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() - entry.timestamp > ttlMs) {
      cacheRef.current.delete(key);
      return false;
    }
    
    return true;
  }, [ttlMs]);

  return {
    get,
    set,
    invalidate,
    clear,
    has,
    size: cacheRef.current.size,
  };
}

/**
 * Hook for lazy loading images with intersection observer
 */
export function useLazyImage(src: string | undefined) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    imgRef.current = img;

    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { loaded, error };
}

/**
 * Hook for deferred loading of secondary data
 */
export function useDeferredData<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = [],
  delay: number = 300
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await fetchFn();
        if (!cancelled) {
          setData(result);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, deps);

  return { data, loading, error };
}

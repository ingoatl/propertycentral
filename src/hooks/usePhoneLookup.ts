import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PhoneLookupResult {
  phone: string;
  name?: string;
  carrier?: string;
  lineType?: string;
  callerName?: string;
  valid: boolean;
  cached: boolean;
}

interface PhoneLookupCache {
  [phone: string]: PhoneLookupResult;
}

export function usePhoneLookup() {
  const [lookupCache, setLookupCache] = useState<PhoneLookupCache>({});
  const [pendingLookups, setPendingLookups] = useState<Set<string>>(new Set());
  const [failedLookups, setFailedLookups] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch cached lookups from database
  const { data: dbCache } = useQuery({
    queryKey: ["phone-lookups-cache"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_lookups")
        .select("phone, caller_name, carrier, line_type, valid");
      
      if (error) {
        console.error("Error fetching phone lookup cache:", error);
        return {};
      }

      const cache: PhoneLookupCache = {};
      data?.forEach((item) => {
        cache[item.phone] = {
          phone: item.phone,
          name: item.caller_name || undefined,
          callerName: item.caller_name || undefined,
          carrier: item.carrier || undefined,
          lineType: item.line_type || undefined,
          valid: item.valid ?? true,
          cached: true,
        };
      });
      return cache;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - refresh more often
    refetchOnWindowFocus: true,
  });

  // Merge db cache into local cache
  useEffect(() => {
    if (dbCache) {
      setLookupCache((prev) => ({ ...prev, ...dbCache }));
    }
  }, [dbCache]);

  // Normalize phone to 10 digits
  const normalizePhone = useCallback((phone: string): string => {
    return phone.replace(/[^\d]/g, "").slice(-10);
  }, []);

  // Lookup a single phone number
  const lookupPhone = useCallback(async (phone: string): Promise<PhoneLookupResult | null> => {
    const normalized = normalizePhone(phone);
    
    if (normalized.length < 10) {
      return null;
    }

    // Check local cache first
    if (lookupCache[normalized]) {
      return lookupCache[normalized];
    }

    // Mark as pending
    if (pendingLookups.has(normalized)) {
      return null;
    }

    setPendingLookups((prev) => new Set(prev).add(normalized));

    try {
      const { data, error } = await supabase.functions.invoke("twilio-phone-lookup", {
        body: { phones: [normalized] },
      });

      if (error) {
        console.error("Phone lookup error:", error);
        return null;
      }

      const result = data?.results?.[0];
      if (result) {
        setLookupCache((prev) => ({ ...prev, [normalized]: result }));
        return result;
      }
    } catch (err) {
      console.error("Phone lookup failed:", err);
    } finally {
      setPendingLookups((prev) => {
        const next = new Set(prev);
        next.delete(normalized);
        return next;
      });
    }

    return null;
  }, [lookupCache, pendingLookups, normalizePhone]);

  // Batch lookup multiple phones - more aggressive
  const lookupPhones = useCallback(async (phones: string[]): Promise<PhoneLookupCache> => {
    const normalizedPhones = phones.map(normalizePhone).filter((p) => p.length >= 10);
    
    // Filter out already cached, pending, or previously failed
    const phonesToLookup = normalizedPhones.filter(
      (p) => !lookupCache[p] && !pendingLookups.has(p) && !failedLookups.has(p)
    );

    if (phonesToLookup.length === 0) {
      return lookupCache;
    }

    console.log(`[PhoneLookup] Looking up ${phonesToLookup.length} phones:`, phonesToLookup);

    // Mark as pending
    setPendingLookups((prev) => {
      const next = new Set(prev);
      phonesToLookup.forEach((p) => next.add(p));
      return next;
    });

    try {
      const { data, error } = await supabase.functions.invoke("twilio-phone-lookup", {
        body: { phones: phonesToLookup.slice(0, 10) }, // Max 10 at a time
      });

      if (error) {
        console.error("Batch phone lookup error:", error);
        // Mark as failed to avoid retrying immediately
        setFailedLookups((prev) => {
          const next = new Set(prev);
          phonesToLookup.forEach((p) => next.add(p));
          return next;
        });
        return lookupCache;
      }

      const results = data?.results || [];
      console.log(`[PhoneLookup] Got ${results.length} results`);
      
      const newCache: PhoneLookupCache = { ...lookupCache };
      
      results.forEach((result: PhoneLookupResult) => {
        const normalized = normalizePhone(result.phone);
        newCache[normalized] = result;
        console.log(`[PhoneLookup] ${normalized} -> ${result.callerName || result.name || "No name found"}`);
      });

      setLookupCache(newCache);
      queryClient.invalidateQueries({ queryKey: ["phone-lookups-cache"] });
      
      return newCache;
    } catch (err) {
      console.error("Batch phone lookup failed:", err);
      // Mark as failed
      setFailedLookups((prev) => {
        const next = new Set(prev);
        phonesToLookup.forEach((p) => next.add(p));
        return next;
      });
    } finally {
      setPendingLookups((prev) => {
        const next = new Set(prev);
        phonesToLookup.forEach((p) => next.delete(p));
        return next;
      });
    }

    return lookupCache;
  }, [lookupCache, pendingLookups, failedLookups, normalizePhone, queryClient]);

  // Get name for a phone number from cache
  const getNameForPhone = useCallback((phone: string): string | undefined => {
    const normalized = normalizePhone(phone);
    return lookupCache[normalized]?.name || lookupCache[normalized]?.callerName;
  }, [lookupCache, normalizePhone]);

  return {
    lookupCache,
    lookupPhone,
    lookupPhones,
    getNameForPhone,
    normalizePhone,
    isPending: (phone: string) => pendingLookups.has(normalizePhone(phone)),
  };
}

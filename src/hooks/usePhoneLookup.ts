import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PhoneLookupResult {
  phone: string;
  name?: string;
  email?: string;
  carrier?: string;
  lineType?: string;
  callerName?: string;
  valid: boolean;
  cached: boolean;
  source?: "twilio" | "ghl" | "lead" | "owner" | "tenant" | "communication";
}

interface PhoneLookupCache {
  [phone: string]: PhoneLookupResult;
}

// Normalize phone to 10 digits
const normalizePhoneStatic = (phone: string): string => {
  return phone.replace(/[^\d]/g, "").slice(-10);
};

export function usePhoneLookup() {
  const [lookupCache, setLookupCache] = useState<PhoneLookupCache>({});
  const [pendingLookups, setPendingLookups] = useState<Set<string>>(new Set());
  const [failedLookups, setFailedLookups] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch cached lookups from database AND from lead_communications metadata
  const { data: dbCache } = useQuery({
    queryKey: ["phone-lookups-cache-enhanced"],
    queryFn: async () => {
      const cache: PhoneLookupCache = {};
      
      // 1. Get from phone_lookups table (Twilio CNAM)
      const { data: twilioLookups } = await supabase
        .from("phone_lookups")
        .select("phone, caller_name, carrier, line_type, valid");
      
      twilioLookups?.forEach((item) => {
        const normalized = normalizePhoneStatic(item.phone);
        if (item.caller_name && !item.caller_name.match(/^[\d\s\-\(\)\+\.]+$/)) {
          cache[normalized] = {
            phone: normalized,
            name: item.caller_name,
            callerName: item.caller_name,
            carrier: item.carrier || undefined,
            lineType: item.line_type || undefined,
            valid: item.valid ?? true,
            cached: true,
            source: "twilio",
          };
        }
      });
      
      // 2. Get names AND emails from lead_communications metadata (GHL sync data)
      const { data: commMetadata } = await supabase
        .from("lead_communications")
        .select("metadata, body")
        .not("metadata", "is", null)
        .limit(500);
      
      commMetadata?.forEach((comm) => {
        const metadata = comm.metadata as { 
          contact_name?: string; 
          unmatched_phone?: string;
          ghl_data?: { 
            contactName?: string; 
            contactPhone?: string; 
            contactEmail?: string;
            matchedName?: string;
            fromNumber?: string;
          };
        } | null;
        
        if (!metadata) return;
        
        const phone = metadata.unmatched_phone || metadata.ghl_data?.contactPhone || metadata.ghl_data?.fromNumber;
        // Priority: matchedName > contact_name > contactName
        let name = metadata.ghl_data?.matchedName || metadata.contact_name || metadata.ghl_data?.contactName;
        const email = metadata.ghl_data?.contactEmail;
        
        // If name is invalid, try extracting from transcript body
        if (phone && (!name || name === "Unknown" || name === "Contact" || 
            name?.match(/^[\d\s\-\(\)\+\.]+$/) || 
            name?.toLowerCase() === "just connect" || 
            name?.toLowerCase() === "sure")) {
          // Try extracting from transcript using human: pattern
          const body = comm.body || "";
          if (body.includes("human:")) {
            // Simple extraction - look for name introductions
            const nameMatch = body.match(/human:\s*(?:My name is|I'm|This is|I am|It's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
            if (nameMatch && nameMatch[1]) {
              name = nameMatch[1].trim();
            }
          }
        }
        
        if (phone && name) {
          const normalized = normalizePhoneStatic(phone);
          // Only add if name is not a phone number and not already in cache with better source
          const isValidName = name && 
            name !== "Unknown" && 
            name !== "Contact" &&
            !name.match(/^[\d\s\-\(\)\+\.]+$/) && 
            !name.startsWith("+") &&
            name.toLowerCase() !== "just connect" &&
            name.toLowerCase() !== "sure";
          
          if (isValidName && (!cache[normalized] || cache[normalized].source !== "twilio")) {
            cache[normalized] = {
              phone: normalized,
              name: name,
              email: email || cache[normalized]?.email,
              callerName: name,
              valid: true,
              cached: true,
              source: "ghl",
            };
          }
        }
      });
      
      // 3. Get from leads table
      const { data: leads } = await supabase
        .from("leads")
        .select("name, phone")
        .not("phone", "is", null);
      
      leads?.forEach((lead) => {
        if (lead.phone && lead.name) {
          const normalized = normalizePhoneStatic(lead.phone);
          // Lead names are high priority
          cache[normalized] = {
            phone: normalized,
            name: lead.name,
            callerName: lead.name,
            valid: true,
            cached: true,
            source: "lead",
          };
        }
      });
      
      // 4. Get from property_owners table
      const { data: owners } = await supabase
        .from("property_owners")
        .select("name, phone")
        .not("phone", "is", null);
      
      owners?.forEach((owner) => {
        if (owner.phone && owner.name) {
          const normalized = normalizePhoneStatic(owner.phone);
          cache[normalized] = {
            phone: normalized,
            name: owner.name,
            callerName: owner.name,
            valid: true,
            cached: true,
            source: "owner",
          };
        }
      });
      
      // 5. Get from mid_term_bookings (tenants)
      const { data: tenants } = await supabase
        .from("mid_term_bookings")
        .select("tenant_name, tenant_phone")
        .not("tenant_phone", "is", null);
      
      tenants?.forEach((tenant) => {
        if (tenant.tenant_phone && tenant.tenant_name) {
          const normalized = normalizePhoneStatic(tenant.tenant_phone);
          if (!cache[normalized]) {
            cache[normalized] = {
              phone: normalized,
              name: tenant.tenant_name,
              callerName: tenant.tenant_name,
              valid: true,
              cached: true,
              source: "tenant",
            };
          }
        }
      });
      
      console.log(`[PhoneLookup] Loaded ${Object.keys(cache).length} phone->name mappings`);
      return cache;
    },
    staleTime: 1000 * 30, // 30 seconds - refresh very often to catch new names
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Merge db cache into local cache
  useEffect(() => {
    if (dbCache) {
      setLookupCache((prev) => ({ ...prev, ...dbCache }));
    }
  }, [dbCache]);

  // Normalize phone to 10 digits
  const normalizePhone = useCallback((phone: string): string => {
    return normalizePhoneStatic(phone);
  }, []);

  // Lookup a single phone number
  const lookupPhone = useCallback(async (phone: string): Promise<PhoneLookupResult | null> => {
    const normalized = normalizePhoneStatic(phone);
    
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
  }, [lookupCache, pendingLookups]);

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
        // Mark as failed to avoid retrying immediately
        setFailedLookups((prev) => {
          const next = new Set(prev);
          phonesToLookup.forEach((p) => next.add(p));
          return next;
        });
        return lookupCache;
      }

      const results = data?.results || [];
      
      const newCache: PhoneLookupCache = { ...lookupCache };
      
      results.forEach((result: PhoneLookupResult) => {
        const normalized = normalizePhone(result.phone);
        newCache[normalized] = result;
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

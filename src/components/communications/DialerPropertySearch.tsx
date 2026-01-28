import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Building2, User, Phone, MapPin, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface PropertyOwnerResult {
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string | null;
  ownerEmail: string | null;
  secondOwnerName?: string | null;
  secondOwnerPhone?: string | null;
  source?: "property" | "onboarding"; // Track data source
}

interface DialerPropertySearchProps {
  onSelectContact: (contact: {
    name: string;
    phone: string;
    type: "owner";
    ownerId: string;
    propertyName?: string;
    propertyAddress?: string;
  }) => void;
  onClose?: () => void;
}

export function DialerPropertySearch({ onSelectContact, onClose }: DialerPropertySearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<PropertyOwnerResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchProperties = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const searchTerm = `%${query}%`;
      const resultMap = new Map<string, PropertyOwnerResult>();
      
      console.log("[DialerSearch] Searching for:", query);
      
      // Search 1: Properties with owner join - search by address AND name
      const { data: propertiesData, error: propError } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          address,
          owner_id,
          property_owners (
            id,
            name,
            phone,
            email,
            second_owner_name,
            second_owner_email
          )
        `)
        .or(`address.ilike.${searchTerm},name.ilike.${searchTerm}`)
        .limit(50);

      if (propError) {
        console.error("[DialerSearch] Property search error:", propError);
      } else {
        console.log("[DialerSearch] Found properties:", propertiesData?.length || 0);
        
        (propertiesData || []).forEach((p: any) => {
          if (p.property_owners) {
            resultMap.set(p.id, {
              propertyId: p.id,
              propertyName: p.name || "Unknown Property",
              propertyAddress: p.address || "",
              ownerId: p.property_owners.id || p.owner_id,
              ownerName: p.property_owners.name || "Unknown Owner",
              ownerPhone: p.property_owners.phone,
              ownerEmail: p.property_owners.email,
              secondOwnerName: p.property_owners.second_owner_name,
              secondOwnerPhone: null,
            });
          }
        });
      }

      // Search 2: Property owners by name/phone/email
      const { data: ownersData, error: ownerError } = await supabase
        .from("property_owners")
        .select(`
          id,
          name,
          phone,
          email,
          second_owner_name,
          second_owner_email,
          properties (
            id,
            name,
            address
          )
        `)
        .or(`name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm},second_owner_name.ilike.${searchTerm}`)
        .limit(50);

      if (ownerError) {
        console.error("[DialerSearch] Owner search error:", ownerError);
      } else {
        console.log("[DialerSearch] Found owners:", ownersData?.length || 0);
        
        (ownersData || []).forEach((owner: any) => {
          if (owner.properties && Array.isArray(owner.properties)) {
            owner.properties.forEach((prop: any) => {
              if (!resultMap.has(prop.id)) {
                resultMap.set(prop.id, {
                  propertyId: prop.id,
                  propertyName: prop.name || "Unknown Property",
                  propertyAddress: prop.address || "",
                  ownerId: owner.id,
                  ownerName: owner.name || "Unknown Owner",
                  ownerPhone: owner.phone,
                  ownerEmail: owner.email,
                  secondOwnerName: owner.second_owner_name,
                  secondOwnerPhone: null,
                });
              }
            });
          }
        });
      }

      // Search 3: Onboarding projects with owner data (for imported/midterm nation owners like Dakun Sun)
      const { data: onboardingData, error: onboardingError } = await supabase
        .from("onboarding_projects")
        .select(`
          id,
          property_id,
          status,
          onboarding_tasks (
            title,
            field_value
          )
        `)
        .limit(100);

      if (onboardingError) {
        console.error("[DialerSearch] Onboarding search error:", onboardingError);
      } else {
        // Process onboarding data to find matching owner info
        (onboardingData || []).forEach((project: any) => {
          const tasks = project.onboarding_tasks || [];
          let ownerName = "";
          let ownerPhone = "";
          let ownerEmail = "";
          let propertyAddress = "";
          
          tasks.forEach((t: any) => {
            const title = (t.title || "").toLowerCase();
            const value = t.field_value || "";
            if (title === "owner name" && value) ownerName = value;
            if (title === "owner phone" && value) ownerPhone = value;
            if (title === "owner email" && value) ownerEmail = value;
            if ((title.includes("address") || title.includes("property")) && value && value.length > 10) propertyAddress = value;
          });
          
          // Check if this project matches the search query
          const lowerQuery = query.toLowerCase();
          const matches = 
            ownerName.toLowerCase().includes(lowerQuery) ||
            ownerPhone.includes(query) ||
            ownerEmail.toLowerCase().includes(lowerQuery) ||
            propertyAddress.toLowerCase().includes(lowerQuery);
          
          if (matches && ownerName && ownerPhone) {
            const key = `onboarding-${project.id}`;
            if (!resultMap.has(key)) {
              console.log("[DialerSearch] Found onboarding match:", ownerName, ownerPhone);
              resultMap.set(key, {
                propertyId: project.property_id || project.id,
                propertyName: propertyAddress || "New Onboarding",
                propertyAddress: propertyAddress || "Address pending",
                ownerId: project.id,
                ownerName: ownerName,
                ownerPhone: ownerPhone,
                ownerEmail: ownerEmail,
              });
            }
          }
        });
      }

      // Sort results - prioritize owner name matches, then address matches
      const resultsArray = Array.from(resultMap.values());
      const lowerQuery = query.toLowerCase();
      resultsArray.sort((a, b) => {
        const aOwnerMatch = a.ownerName.toLowerCase().includes(lowerQuery) ? 0 : 1;
        const bOwnerMatch = b.ownerName.toLowerCase().includes(lowerQuery) ? 0 : 1;
        if (aOwnerMatch !== bOwnerMatch) return aOwnerMatch - bOwnerMatch;
        
        const aAddressMatch = a.propertyAddress.toLowerCase().includes(lowerQuery) ? 0 : 1;
        const bAddressMatch = b.propertyAddress.toLowerCase().includes(lowerQuery) ? 0 : 1;
        return aAddressMatch - bAddressMatch;
      });

      console.log("[DialerSearch] Total results:", resultsArray.length);
      setResults(resultsArray.slice(0, 30));
    } catch (err) {
      console.error("[DialerSearch] Search error:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    searchProperties(debouncedQuery);
  }, [debouncedQuery, searchProperties]);

  const handleSelectOwner = (result: PropertyOwnerResult, isSecondOwner = false) => {
    const phone = isSecondOwner ? result.secondOwnerPhone : result.ownerPhone;
    const name = isSecondOwner ? result.secondOwnerName : result.ownerName;
    
    if (!phone) {
      return; // Can't call without a phone number
    }

    onSelectContact({
      name: name || "Unknown",
      phone,
      type: "owner",
      ownerId: result.ownerId,
      propertyName: result.propertyName,
      propertyAddress: result.propertyAddress,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by city, street, or property name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {results.map((result) => (
              <div
                key={result.propertyId}
                className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                {/* Property Info */}
                <div className="flex items-start gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{result.propertyName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {result.propertyAddress}
                    </p>
                  </div>
                </div>

                {/* Primary Owner */}
                <button
                  onClick={() => handleSelectOwner(result, false)}
                  disabled={!result.ownerPhone}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded-md transition-colors",
                    result.ownerPhone 
                      ? "hover:bg-primary/10 cursor-pointer" 
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{result.ownerName}</p>
                  </div>
                  {result.ownerPhone ? (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Phone className="h-3 w-3" />
                      Call
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">No phone</Badge>
                  )}
                </button>

                {/* Second Owner (if exists) */}
                {result.secondOwnerName && (
                  <button
                    onClick={() => handleSelectOwner(result, true)}
                    disabled={!result.secondOwnerPhone}
                    className={cn(
                      "w-full flex items-center gap-2 p-2 rounded-md transition-colors mt-1",
                      result.secondOwnerPhone 
                        ? "hover:bg-primary/10 cursor-pointer" 
                        : "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium truncate">{result.secondOwnerName}</p>
                      <p className="text-xs text-muted-foreground">Co-owner</p>
                    </div>
                    {result.secondOwnerPhone ? (
                      <Badge variant="outline" className="flex items-center gap-1 text-xs">
                        <Phone className="h-3 w-3" />
                        Call
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No phone</Badge>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {!isLoading && debouncedQuery.length >= 2 && results.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No properties found for "{debouncedQuery}"</p>
          <p className="text-xs">Try searching by city, street name, or property name</p>
        </div>
      )}

      {!isLoading && debouncedQuery.length < 2 && (
        <div className="text-center py-6 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Search for property owners</p>
          <p className="text-xs">Enter a city, street, or property name</p>
        </div>
      )}
    </div>
  );
}

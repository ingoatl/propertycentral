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
      // Search properties by address, name, city, or street
      const { data: properties, error } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          address,
          owner_id,
          property_owners!inner (
            id,
            name,
            phone,
            email,
            second_owner_name,
            second_owner_phone
          )
        `)
        .or(`address.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;

      const formattedResults: PropertyOwnerResult[] = (properties || []).map((p: any) => ({
        propertyId: p.id,
        propertyName: p.name || "Unknown Property",
        propertyAddress: p.address || "",
        ownerId: p.property_owners?.id || p.owner_id,
        ownerName: p.property_owners?.name || "Unknown Owner",
        ownerPhone: p.property_owners?.phone,
        ownerEmail: p.property_owners?.email,
        secondOwnerName: p.property_owners?.second_owner_name,
        secondOwnerPhone: p.property_owners?.second_owner_phone,
      }));

      setResults(formattedResults);
    } catch (err) {
      console.error("Property search error:", err);
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

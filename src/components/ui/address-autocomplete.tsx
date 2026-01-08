import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter an address",
  className,
  disabled,
  required,
  id,
}: AddressAutocompleteProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search Nominatim API - try multiple query strategies for better results
  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      let allResults: NominatimResult[] = [];
      
      // Strategy 1: Direct search with street type hints
      const searchQueries = [
        query,
        `${query}, USA`,
        // Add common street suffixes if user typed partial
        ...(query.match(/\d+/) && !query.match(/(st|street|rd|road|ave|avenue|dr|drive|ln|lane|ct|court|way|blvd|cir|circle)/i) 
          ? [`${query} road`, `${query} drive`, `${query} street`] 
          : [])
      ];
      
      for (const searchQuery of searchQueries) {
        if (allResults.length >= 5) break;
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          new URLSearchParams({
            q: searchQuery,
            format: "json",
            addressdetails: "1",
            limit: "5",
            countrycodes: "us",
          }),
          {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "PropertyManagementApp/1.0",
            },
          }
        );
        
        if (response.ok) {
          const data: NominatimResult[] = await response.json();
          // Deduplicate by place_id
          data.forEach(item => {
            if (!allResults.find(r => r.place_id === item.place_id)) {
              allResults.push(item);
            }
          });
        }
        
        // Small delay to respect Nominatim rate limits
        if (allResults.length === 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
      
      // Sort results to prioritize those with house numbers (actual addresses)
      allResults.sort((a, b) => {
        const aHasNumber = a.address?.house_number ? 1 : 0;
        const bHasNumber = b.address?.house_number ? 1 : 0;
        return bHasNumber - aHasNumber;
      });
      
      setSuggestions(allResults.slice(0, 8));
      setShowSuggestions(allResults.length > 0);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error("[AddressAutocomplete] Search error:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchAddress(newValue);
    }, 300);
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: NominatimResult) => {
    onChange(suggestion.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          selectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(className, "pr-10")}
          disabled={disabled}
          required={required}
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-start gap-2",
                highlightedIndex === index && "bg-accent"
              )}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{suggestion.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

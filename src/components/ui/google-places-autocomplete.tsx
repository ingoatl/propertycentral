import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Prediction {
  place_id: string;
  description: string;
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  onPlaceSelect?: (place: { formattedAddress: string; location?: { lat: number; lng: number } }) => void;
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  placeholder = "Enter an address",
  className,
  disabled,
  id,
  onPlaceSelect,
}: GooglePlacesAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch predictions from edge function (silent fallback on error)
  const fetchPredictions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-places-autocomplete", {
        body: { query, country: "us" }
      });

      if (error || !data?.predictions) {
        // Silent fallback - just don't show predictions
        setPredictions([]);
        return;
      }

      setPredictions(data.predictions);
      setShowDropdown(data.predictions.length > 0);
    } catch (err) {
      // Silent fallback - allow manual entry
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setSelectedIndex(-1);

    // Debounce the API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  };

  // Handle prediction selection
  const selectPrediction = async (prediction: Prediction) => {
    setInputValue(prediction.description);
    onChange(prediction.description);
    setPredictions([]);
    setShowDropdown(false);
    
    if (onPlaceSelect) {
      onPlaceSelect({
        formattedAddress: prediction.description,
      });
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      selectPrediction(predictions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => predictions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={cn("pr-10", className)}
        disabled={disabled}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <MapPin className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Predictions dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden"
        >
          {predictions.map((prediction, index) => (
            <div
              key={prediction.place_id}
              onClick={() => selectPrediction(prediction)}
              className={cn(
                "px-3 py-2.5 cursor-pointer text-sm transition-colors",
                index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{prediction.description}</span>
              </div>
            </div>
          ))}
          <div className="px-3 py-1.5 text-xs text-muted-foreground border-t bg-muted/30">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  placeholder = "Enter an address",
  className,
  disabled,
  required,
  id,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initAttempted = useRef(false);

  // Fetch API key from edge function with retry
  const fetchApiKey = useCallback(async (retryCount = 0) => {
    try {
      console.log("[GooglePlaces] Fetching API key, attempt:", retryCount + 1);
      const { data, error } = await supabase.functions.invoke("get-google-places-key");
      
      if (error) {
        console.error("[GooglePlaces] Edge function error:", error);
        throw error;
      }
      
      if (data?.apiKey) {
        console.log("[GooglePlaces] API key received successfully");
        setApiKey(data.apiKey);
        setError(null);
        return true;
      } else if (data?.error) {
        console.error("[GooglePlaces] API returned error:", data.error);
        setError(data.error);
        return false;
      }
      
      return false;
    } catch (err) {
      console.error("[GooglePlaces] Failed to fetch API key:", err);
      if (retryCount < 2) {
        console.log("[GooglePlaces] Retrying in 1 second...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchApiKey(retryCount + 1);
      }
      setError("Could not load address autocomplete");
      return false;
    }
  }, []);

  useEffect(() => {
    fetchApiKey().finally(() => setIsLoading(false));
  }, [fetchApiKey]);

  useEffect(() => {
    if (!apiKey) return;

    // Check if already loaded
    if (window.google?.maps?.places) {
      console.log("[GooglePlaces] Google Maps already loaded");
      setIsLoaded(true);
      return;
    }

    // Check if script is already loading
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existingScript) {
      console.log("[GooglePlaces] Script already exists, waiting for load");
      const handleLoad = () => {
        console.log("[GooglePlaces] Existing script loaded");
        setIsLoaded(true);
      };
      existingScript.addEventListener("load", handleLoad);
      // Check if it's already loaded
      if (window.google?.maps?.places) {
        setIsLoaded(true);
      }
      return () => existingScript.removeEventListener("load", handleLoad);
    }

    // Load the script
    console.log("[GooglePlaces] Loading Google Maps script");
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log("[GooglePlaces] Script loaded successfully");
      setIsLoaded(true);
    };
    script.onerror = (e) => {
      console.error("[GooglePlaces] Failed to load Google Places API", e);
      setError("Could not load address suggestions");
    };
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || initAttempted.current) return;

    initAttempted.current = true;
    console.log("[GooglePlaces] Initializing autocomplete");

    try {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["formatted_address", "address_components", "geometry"],
        }
      );

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        console.log("[GooglePlaces] Place selected:", place?.formatted_address);
        if (place?.formatted_address) {
          onChange(place.formatted_address);
        }
      });
      
      console.log("[GooglePlaces] Autocomplete initialized successfully");
    } catch (err) {
      console.error("[GooglePlaces] Failed to initialize autocomplete:", err);
      setError("Address autocomplete not available");
    }
  }, [isLoaded, onChange]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isLoading ? "Loading address search..." : placeholder}
        className={cn(className, isLoading && "pr-10")}
        disabled={disabled || isLoading}
        required={required}
        autoComplete="off"
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && !isLoading && (
        <p className="text-xs text-amber-600 mt-1">
          {error} - you can still type manually
        </p>
      )}
    </div>
  );
}

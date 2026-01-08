/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin } from "lucide-react";

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  onPlaceSelect?: (place: { formattedAddress: string; location?: { lat: number; lng: number } }) => void;
}

// Global flag to track script loading status
declare global {
  interface Window {
    __googlePlacesScriptLoaded?: boolean;
    __googlePlacesScriptLoading?: boolean;
    __googlePlacesApiKey?: string;
  }
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
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElementRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initAttemptedRef = useRef(false);
  const [inputValue, setInputValue] = useState(value);

  // Keep inputValue in sync with external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Fetch API key from edge function
  const fetchApiKey = useCallback(async (retryCount = 0): Promise<string | null> => {
    try {
      console.log("[GooglePlaces] Fetching API key, attempt:", retryCount + 1);
      const { data, error } = await supabase.functions.invoke("get-google-places-key");
      
      if (error) {
        console.error("[GooglePlaces] Edge function error:", error);
        throw error;
      }
      
      if (data?.apiKey) {
        console.log("[GooglePlaces] API key received successfully");
        window.__googlePlacesApiKey = data.apiKey;
        return data.apiKey;
      } else if (data?.error) {
        console.error("[GooglePlaces] API returned error:", data.error);
        setError(data.error);
        return null;
      }
      
      return null;
    } catch (err) {
      console.error("[GooglePlaces] Failed to fetch API key:", err);
      if (retryCount < 2) {
        console.log("[GooglePlaces] Retrying in 1 second...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchApiKey(retryCount + 1);
      }
      setError("Could not load address autocomplete");
      return null;
    }
  }, []);

  // Load Google Maps script using the new dynamic import method
  const loadGoogleMapsScript = useCallback(async (apiKey: string): Promise<boolean> => {
    // Check if already loaded
    if (window.google?.maps?.importLibrary) {
      console.log("[GooglePlaces] Google Maps already loaded");
      return true;
    }

    // Check if already loading
    if (window.__googlePlacesScriptLoading) {
      console.log("[GooglePlaces] Script already loading, waiting...");
      // Wait for it to load
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (window.google?.maps?.importLibrary) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 10000);
      });
    }

    console.log("[GooglePlaces] Loading Google Maps script...");
    window.__googlePlacesScriptLoading = true;

    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
      script.async = true;

      script.onload = () => {
        console.log("[GooglePlaces] Script loaded successfully");
        window.__googlePlacesScriptLoaded = true;
        window.__googlePlacesScriptLoading = false;
        resolve(true);
      };

      script.onerror = () => {
        console.error("[GooglePlaces] Script failed to load");
        window.__googlePlacesScriptLoading = false;
        setError("Could not load address suggestions");
        resolve(false);
      };

      document.head.appendChild(script);
    });
  }, []);

  // Initialize the new PlaceAutocompleteElement
  const initializeAutocomplete = useCallback(async () => {
    if (!containerRef.current || initAttemptedRef.current) {
      return false;
    }

    try {
      console.log("[GooglePlaces] Importing places library...");
      initAttemptedRef.current = true;

      // Import the places library using the new method
      await window.google.maps.importLibrary("places");
      
      console.log("[GooglePlaces] Creating PlaceAutocompleteElement...");
      
      // Create the new PlaceAutocompleteElement
      const placeAutocomplete = new (window.google.maps.places as any).PlaceAutocompleteElement({
        componentRestrictions: { country: "us" },
      });

      autocompleteElementRef.current = placeAutocomplete;

      // Style the element
      placeAutocomplete.style.width = "100%";
      
      // Clear container and append the element
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(placeAutocomplete);

      // Listen for place selection using the new event
      placeAutocomplete.addEventListener("gmp-select", async (event: any) => {
        const placePrediction = event.placePrediction;
        if (placePrediction) {
          const place = placePrediction.toPlace();
          await place.fetchFields({ fields: ["formattedAddress", "location"] });
          
          const formattedAddress = place.formattedAddress || "";
          console.log("[GooglePlaces] Place selected:", formattedAddress);
          
          setInputValue(formattedAddress);
          onChange(formattedAddress);
          
          if (onPlaceSelect && place.location) {
            onPlaceSelect({
              formattedAddress,
              location: {
                lat: place.location.lat(),
                lng: place.location.lng(),
              },
            });
          }
        }
      });

      setIsInitialized(true);
      console.log("[GooglePlaces] PlaceAutocompleteElement initialized successfully");
      return true;
    } catch (err) {
      console.error("[GooglePlaces] Failed to initialize autocomplete:", err);
      setError("Address autocomplete not available");
      return false;
    }
  }, [onChange, onPlaceSelect]);

  // Main initialization effect
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Check if already initialized
      if (initAttemptedRef.current) {
        setIsLoading(false);
        return;
      }

      // If Google Maps is already loaded, just initialize
      if (window.google?.maps?.importLibrary) {
        console.log("[GooglePlaces] API already available, initializing");
        await initializeAutocomplete();
        if (mounted) setIsLoading(false);
        return;
      }

      // Fetch API key
      let apiKey = window.__googlePlacesApiKey;
      if (!apiKey) {
        apiKey = await fetchApiKey();
      }
      
      if (!apiKey || !mounted) {
        if (mounted) setIsLoading(false);
        return;
      }

      // Load script
      const loaded = await loadGoogleMapsScript(apiKey);
      if (!loaded || !mounted) {
        if (mounted) setIsLoading(false);
        return;
      }

      // Initialize autocomplete
      await initializeAutocomplete();
      if (mounted) setIsLoading(false);
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchApiKey, loadGoogleMapsScript, initializeAutocomplete]);

  // Fallback to manual input if autocomplete fails
  if (error || (!isLoading && !isInitialized)) {
    return (
      <div className="relative">
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10",
            className
          )}
          disabled={disabled}
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </div>
        {error && (
          <p className="text-xs text-amber-600 mt-1">
            {error} - you can still type manually
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={cn(
          "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground",
          className
        )}>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading address search...
        </div>
      )}
      <div 
        ref={containerRef} 
        id={id}
        className={cn(
          "google-places-container",
          isLoading && "hidden",
          className
        )}
      />
    </div>
  );
}
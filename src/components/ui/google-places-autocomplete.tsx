/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin } from "lucide-react";

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  onPlaceSelect?: (place: google.maps.places.PlaceResult) => void;
}

// Global flag to track script loading status
declare global {
  interface Window {
    __googlePlacesScriptLoaded?: boolean;
    __googlePlacesScriptLoading?: boolean;
  }
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  placeholder = "Enter an address",
  className,
  disabled,
  required,
  id,
  onPlaceSelect,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initAttemptedRef = useRef(false);

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

  // Dispatch custom event when Google Maps is loaded
  const dispatchLoadedEvent = useCallback(() => {
    console.log("[GooglePlaces] Dispatching google-maps-loaded event");
    const event = new Event("google-maps-loaded");
    window.dispatchEvent(event);
    window.__googlePlacesScriptLoaded = true;
    window.__googlePlacesScriptLoading = false;
  }, []);

  // Load the Google Maps script
  const loadScript = useCallback((apiKey: string) => {
    // Check if already loaded
    if (window.google?.maps?.places) {
      console.log("[GooglePlaces] Google Maps already loaded");
      if (!window.__googlePlacesScriptLoaded) {
        dispatchLoadedEvent();
      }
      return;
    }

    // Check if already loading
    if (window.__googlePlacesScriptLoading) {
      console.log("[GooglePlaces] Script already loading, waiting...");
      return;
    }

    // Check for existing script
    const existingScript = document.getElementById("google-places-script");
    if (existingScript) {
      console.log("[GooglePlaces] Script element already exists");
      return;
    }

    console.log("[GooglePlaces] Loading Google Maps script");
    window.__googlePlacesScriptLoading = true;

    const script = document.createElement("script");
    script.id = "google-places-script";
    // Use loading=async for better performance
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;

    script.onload = () => {
      console.log("[GooglePlaces] Script element loaded");
      // Wait for places library to be fully available
      const checkPlaces = (attempts = 0) => {
        if (window.google?.maps?.places) {
          console.log("[GooglePlaces] Places library ready");
          dispatchLoadedEvent();
        } else if (attempts < 50) {
          setTimeout(() => checkPlaces(attempts + 1), 100);
        } else {
          console.error("[GooglePlaces] Places library not available after waiting");
          setError("Address autocomplete failed to load");
          window.__googlePlacesScriptLoading = false;
        }
      };
      checkPlaces();
    };

    script.onerror = () => {
      console.error("[GooglePlaces] Script failed to load");
      setError("Could not load address suggestions");
      window.__googlePlacesScriptLoading = false;
    };

    document.body.appendChild(script);
  }, [dispatchLoadedEvent]);

  // Initialize autocomplete
  const initializeAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) {
      console.log("[GooglePlaces] Cannot init - missing input or API");
      return false;
    }

    if (initAttemptedRef.current) {
      console.log("[GooglePlaces] Already initialized");
      return true;
    }

    try {
      console.log("[GooglePlaces] Initializing autocomplete...");
      initAttemptedRef.current = true;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["formatted_address", "geometry", "address_components", "place_id"],
        }
      );

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        console.log("[GooglePlaces] Place selected:", place?.formatted_address);
        
        if (place?.formatted_address) {
          // Update the input value directly
          if (inputRef.current) {
            inputRef.current.value = place.formatted_address;
          }
          onChange(place.formatted_address);
          onPlaceSelect?.(place);
        }
      });

      setIsInitialized(true);
      console.log("[GooglePlaces] Autocomplete initialized successfully");
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
      // If already loaded, just initialize
      if (window.google?.maps?.places) {
        console.log("[GooglePlaces] API already available, initializing");
        initializeAutocomplete();
        if (mounted) setIsLoading(false);
        return;
      }

      // Fetch API key
      const apiKey = await fetchApiKey();
      if (!apiKey || !mounted) {
        if (mounted) setIsLoading(false);
        return;
      }

      // Load script
      loadScript(apiKey);

      // Listen for loaded event
      const handleLoaded = () => {
        console.log("[GooglePlaces] Received google-maps-loaded event");
        setTimeout(() => {
          initializeAutocomplete();
          if (mounted) setIsLoading(false);
        }, 100);
      };

      window.addEventListener("google-maps-loaded", handleLoaded);

      // Also check periodically in case event was missed
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places && !initAttemptedRef.current) {
          console.log("[GooglePlaces] Found API via polling");
          initializeAutocomplete();
          if (mounted) setIsLoading(false);
          clearInterval(checkInterval);
        }
      }, 500);

      // Timeout fallback
      setTimeout(() => {
        if (mounted && isLoading) {
          console.log("[GooglePlaces] Timeout - falling back to basic input");
          setIsLoading(false);
        }
        clearInterval(checkInterval);
      }, 10000);

      return () => {
        window.removeEventListener("google-maps-loaded", handleLoaded);
        clearInterval(checkInterval);
      };
    };

    init();

    return () => {
      mounted = false;
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [fetchApiKey, loadScript, initializeAutocomplete]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isLoading ? "Loading address search..." : placeholder}
        className={cn(className, "pr-10")}
        disabled={disabled || isLoading}
        required={required}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <MapPin className={cn(
            "h-4 w-4",
            isInitialized ? "text-primary" : "text-muted-foreground"
          )} />
        )}
      </div>
      {error && !isLoading && (
        <p className="text-xs text-amber-600 mt-1">
          {error} - you can still type manually
        </p>
      )}
    </div>
  );
}

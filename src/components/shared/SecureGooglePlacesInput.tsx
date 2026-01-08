import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";

interface SecureGooglePlacesInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  onPlaceSelect?: (place: google.maps.places.PlaceResult) => void;
}

export function SecureGooglePlacesInput({
  value,
  onChange,
  placeholder = "Enter address",
  className = "",
  disabled,
  required,
  id,
  onPlaceSelect,
}: SecureGooglePlacesInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const initAttemptedRef = useRef(false);

  useEffect(() => {
    const initializeAutocomplete = () => {
      if (!inputRef.current || !window.google?.maps?.places) {
        console.log("[SecureGooglePlacesInput] Cannot init - missing input or API");
        return false;
      }

      if (initAttemptedRef.current) {
        console.log("[SecureGooglePlacesInput] Already initialized");
        return true;
      }

      try {
        console.log("[SecureGooglePlacesInput] Initializing autocomplete...");
        initAttemptedRef.current = true;

        const autocompleteInstance = new window.google.maps.places.Autocomplete(
          inputRef.current,
          {
            types: ["address"],
            componentRestrictions: { country: "us" },
            fields: ["formatted_address", "geometry", "address_components", "place_id"],
          }
        );

        autocompleteInstance.addListener("place_changed", () => {
          const place = autocompleteInstance.getPlace();
          console.log("[SecureGooglePlacesInput] Place selected:", place?.formatted_address);
          
          if (place?.formatted_address) {
            // Update both the input value and the React state
            if (inputRef.current) {
              inputRef.current.value = place.formatted_address;
            }
            onChange(place.formatted_address);
            onPlaceSelect?.(place);
          }
        });

        autocompleteRef.current = autocompleteInstance;
        setIsInitialized(true);
        setIsWaiting(false);
        console.log("[SecureGooglePlacesInput] Autocomplete initialized successfully");
        return true;
      } catch (error) {
        console.error("[SecureGooglePlacesInput] Failed to initialize:", error);
        setIsWaiting(false);
        return false;
      }
    };

    // Try to initialize immediately if API is ready
    if (window.google?.maps?.places) {
      console.log("[SecureGooglePlacesInput] API already available");
      initializeAutocomplete();
    } else {
      console.log("[SecureGooglePlacesInput] Waiting for google-maps-loaded event");
      const handleGoogleMapsLoaded = () => {
        console.log("[SecureGooglePlacesInput] Received google-maps-loaded event");
        // Small delay to ensure places library is fully ready
        setTimeout(() => {
          initializeAutocomplete();
        }, 100);
      };

      window.addEventListener("google-maps-loaded", handleGoogleMapsLoaded);

      // Timeout fallback
      const timeout = setTimeout(() => {
        console.log("[SecureGooglePlacesInput] Timeout - falling back to basic input");
        setIsWaiting(false);
      }, 10000);

      return () => {
        window.removeEventListener("google-maps-loaded", handleGoogleMapsLoaded);
        clearTimeout(timeout);
      };
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onChange, onPlaceSelect]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(className, "pr-10")}
        disabled={disabled}
        required={required}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {isWaiting && !isInitialized ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <MapPin className={cn(
            "h-4 w-4",
            isInitialized ? "text-primary" : "text-muted-foreground"
          )} />
        )}
      </div>
    </div>
  );
}

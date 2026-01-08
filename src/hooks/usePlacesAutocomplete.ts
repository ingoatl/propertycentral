import { useEffect, useRef, useState } from "react";

interface UsePlacesAutocompleteProps {
  inputRef: React.RefObject<HTMLInputElement>;
  onPlaceSelect: (address: string, placeId: string, lat?: number, lng?: number) => void;
}

export function usePlacesAutocomplete({ inputRef, onPlaceSelect }: UsePlacesAutocompleteProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const initializedRef = useRef(false);

  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places || initializedRef.current) {
      return;
    }

    try {
      console.log("[usePlacesAutocomplete] Initializing...");
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ["formatted_address", "place_id", "geometry"],
        types: ["address"],
        componentRestrictions: { country: "us" },
      });

      autocompleteRef.current = autocomplete;
      initializedRef.current = true;
      setIsInitialized(true);

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address && place.place_id) {
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();
          console.log("[usePlacesAutocomplete] Place selected:", place.formatted_address);
          onPlaceSelect(place.formatted_address, place.place_id, lat, lng);
        }
      });

      console.log("[usePlacesAutocomplete] Initialized successfully");
    } catch (error) {
      console.error("[usePlacesAutocomplete] Initialization error:", error);
    }
  };

  useEffect(() => {
    if (window.google?.maps?.places) {
      initializeAutocomplete();
    } else {
      const handleGoogleMapsLoaded = () => {
        setTimeout(() => initializeAutocomplete(), 100);
      };
      window.addEventListener("google-maps-loaded", handleGoogleMapsLoaded);
      return () => {
        window.removeEventListener("google-maps-loaded", handleGoogleMapsLoaded);
      };
    }
  }, []);

  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  return { isInitialized };
}

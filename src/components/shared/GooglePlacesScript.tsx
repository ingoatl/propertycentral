import { useEffect, useRef } from "react";

interface GooglePlacesScriptProps {
  apiKey: string;
}

export function GooglePlacesScript({ apiKey }: GooglePlacesScriptProps) {
  const scriptLoadedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    // Global flag to prevent multiple loads
    if ((window as any).__googlePlacesScriptLoaded) {
      console.log("[GooglePlacesScript] Already loaded globally");
      return;
    }

    const dispatchLoadedEvent = () => {
      console.log("[GooglePlacesScript] Dispatching google-maps-loaded event");
      const event = new Event("google-maps-loaded");
      window.dispatchEvent(event);
      scriptLoadedRef.current = true;
      (window as any).__googlePlacesScriptLoaded = true;
    };

    const loadScript = () => {
      const existingScript = document.getElementById("google-places-script");
      if (existingScript) {
        console.log("[GooglePlacesScript] Script element exists");
        if (window.google?.maps?.places) {
          if (!scriptLoadedRef.current) {
            dispatchLoadedEvent();
          }
        }
        return;
      }

      console.log("[GooglePlacesScript] Loading Google Maps script with key");
      const script = document.createElement("script");
      script.id = "google-places-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;

      script.onload = () => {
        console.log("[GooglePlacesScript] Script loaded successfully");
        // Wait for the places library to be available
        const checkPlaces = () => {
          if (window.google?.maps?.places) {
            dispatchLoadedEvent();
          } else {
            setTimeout(checkPlaces, 100);
          }
        };
        checkPlaces();
      };

      script.onerror = () => {
        console.error("[GooglePlacesScript] Script failed to load");
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          console.log(`[GooglePlacesScript] Retrying (${retryCountRef.current}/${maxRetries})...`);
          document.getElementById("google-places-script")?.remove();
          setTimeout(loadScript, 1000);
        }
      };

      document.body.appendChild(script);
    };

    if (window.google?.maps?.places) {
      console.log("[GooglePlacesScript] Google Maps already available");
      if (!scriptLoadedRef.current) {
        dispatchLoadedEvent();
      }
    } else {
      loadScript();
    }
  }, [apiKey]);

  return null;
}

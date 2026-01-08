import { useEffect, useState } from "react";
import { MapPin, Building2, Store } from "lucide-react";

interface OSMMapProps {
  address: string;
  className?: string;
  height?: string;
  zoom?: number;
  mapStyle?: "standard" | "detailed" | "satellite";
}

interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Different map tile providers for variety
const MAP_STYLES = {
  // Standard OSM - good general purpose
  standard: (lat: number, lon: number) => 
    `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.008}%2C${lat - 0.006}%2C${lon + 0.008}%2C${lat + 0.006}&layer=mapnik&marker=${lat}%2C${lon}`,
  
  // CyclOSM - shows more POIs, bike lanes, detailed streets
  detailed: (lat: number, lon: number) =>
    `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.008}%2C${lat - 0.006}%2C${lon + 0.008}%2C${lat + 0.006}&layer=cyclemap&marker=${lat}%2C${lon}`,
  
  // Hot/Humanitarian - very clean, shows buildings clearly
  satellite: (lat: number, lon: number) =>
    `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.008}%2C${lat - 0.006}%2C${lon + 0.008}%2C${lat + 0.006}&layer=hot&marker=${lat}%2C${lon}`,
};

export function OSMMap({ 
  address, 
  className = "", 
  height = "300px",
  zoom = 17,
  mapStyle = "standard"
}: OSMMapProps) {
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<string[]>([]);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      setError("No address provided");
      return;
    }

    const geocodeAddress = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          new URLSearchParams({
            q: address,
            format: "json",
            limit: "1",
            addressdetails: "1",
          }),
          {
            headers: {
              "Accept-Language": "en",
            },
          }
        );

        if (!response.ok) throw new Error("Geocoding failed");

        const data: GeocodingResult[] = await response.json();
        
        if (data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          setCoordinates({ lat, lon });
          
          // Fetch nearby places for context
          fetchNearbyPlaces(lat, lon);
        } else {
          setError("Address not found");
        }
      } catch (err) {
        console.error("[OSMMap] Geocoding error:", err);
        setError("Could not load map");
      } finally {
        setLoading(false);
      }
    };

    geocodeAddress();
  }, [address]);

  const fetchNearbyPlaces = async (lat: number, lon: number) => {
    try {
      // Use Overpass API to find nearby POIs
      const overpassQuery = `
        [out:json][timeout:10];
        (
          node["amenity"~"restaurant|cafe|supermarket|hospital|school"](around:500,${lat},${lon});
          node["shop"~"supermarket|mall"](around:500,${lat},${lon});
        );
        out body 5;
      `;
      
      const response = await fetch(
        `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const places = data.elements
          ?.slice(0, 4)
          .map((el: any) => el.tags?.name)
          .filter(Boolean) || [];
        setNearbyPlaces(places);
      }
    } catch (err) {
      // Silently fail - nearby places are optional
      console.log("[OSMMap] Could not fetch nearby places");
    }
  };

  if (loading) {
    return (
      <div 
        className={`bg-muted rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-2">
          <MapPin className="h-6 w-6 animate-pulse text-muted-foreground" />
          <span className="text-muted-foreground text-sm">Loading map...</span>
        </div>
      </div>
    );
  }

  if (error || !coordinates) {
    return (
      <div 
        className={`bg-muted rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-muted-foreground text-sm">{error || "No location"}</div>
      </div>
    );
  }

  const mapUrl = MAP_STYLES[mapStyle](coordinates.lat, coordinates.lon);

  return (
    <div className="space-y-2">
      <div className={className} style={{ height }}>
        <iframe
          src={mapUrl}
          width="100%"
          height="100%"
          style={{ border: 0, borderRadius: "0.5rem" }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Property location map"
        />
      </div>
      
      {/* Nearby places indicator */}
      {nearbyPlaces.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Store className="h-3 w-3" /> Nearby:
          </span>
          {nearbyPlaces.map((place, i) => (
            <span 
              key={i} 
              className="text-xs bg-muted px-2 py-0.5 rounded-full"
            >
              {place}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Component to show property street view placeholder
// Note: Actual street view requires Google API key
export function PropertyStreetViewPlaceholder({ 
  address,
  className = "",
  height = "200px"
}: { address: string; className?: string; height?: string }) {
  return (
    <div 
      className={`bg-gradient-to-br from-muted to-muted/50 rounded-lg flex flex-col items-center justify-center gap-2 border border-dashed ${className}`}
      style={{ height }}
    >
      <Building2 className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center px-4">
        Street view coming soon
      </p>
      <p className="text-xs text-muted-foreground/70">
        Add Google Street View API key for property images
      </p>
    </div>
  );
}

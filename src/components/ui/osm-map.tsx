import { useEffect, useState } from "react";

interface OSMMapProps {
  address: string;
  className?: string;
  height?: string;
  zoom?: number;
}

interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
}

export function OSMMap({ 
  address, 
  className = "", 
  height = "300px",
  zoom = 15 
}: OSMMapProps) {
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setCoordinates({
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
          });
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

  if (loading) {
    return (
      <div 
        className={`bg-muted rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-muted-foreground text-sm">Loading map...</div>
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

  // Use OpenStreetMap iframe embed
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lon - 0.01}%2C${coordinates.lat - 0.01}%2C${coordinates.lon + 0.01}%2C${coordinates.lat + 0.01}&layer=mapnik&marker=${coordinates.lat}%2C${coordinates.lon}`;

  return (
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
  );
}

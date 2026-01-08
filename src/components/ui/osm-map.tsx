import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Leaflet with bundlers
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

interface OSMMapProps {
  address: string;
  className?: string;
  height?: string;
  zoom?: number;
}

interface GeocodingResult {
  lat: number;
  lon: number;
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
            lat: parseFloat(String(data[0].lat)),
            lon: parseFloat(String(data[0].lon)),
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

  return (
    <div className={className} style={{ height }}>
      <MapContainer
        center={[coordinates.lat, coordinates.lon]}
        zoom={zoom}
        style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[coordinates.lat, coordinates.lon]}>
          <Popup>{address}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

// Static map fallback using OSM static image service
export function OSMStaticMap({ 
  address, 
  className = "", 
  height = "300px" 
}: OSMMapProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const geocodeAndGenerateUrl = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          new URLSearchParams({
            q: address,
            format: "json",
            limit: "1",
          })
        );

        const data = await response.json();
        
        if (data.length > 0) {
          const { lat, lon } = data[0];
          // Using OpenStreetMap static map service
          const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=400x300&maptype=mapnik&markers=${lat},${lon},red-pushpin`;
          setImageUrl(url);
        }
      } catch (err) {
        console.error("[OSMStaticMap] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    geocodeAndGenerateUrl();
  }, [address]);

  if (loading) {
    return (
      <div 
        className={`bg-muted rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div 
        className={`bg-muted rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-muted-foreground text-sm">No location</div>
      </div>
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt="Property location" 
      className={`rounded-lg object-cover ${className}`}
      style={{ height, width: "100%" }}
    />
  );
}

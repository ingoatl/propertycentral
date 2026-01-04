import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Home,
  Users,
  Bed,
  Bath,
  Maximize,
  UserCircle,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface PropertyData {
  id: string;
  name: string;
  address: string;
  rental_type: string | null;
  image_path: string | null;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  max_guests?: number;
  amenities?: string[];
}

interface OwnerInfo {
  name: string;
  email: string;
  secondOwnerName?: string | null;
  secondOwnerEmail?: string | null;
}

interface OwnerPropertyTabProps {
  property: PropertyData;
  owner: OwnerInfo;
}

export function OwnerPropertyTab({ property, owner }: OwnerPropertyTabProps) {
  const hasSecondOwner = owner.secondOwnerName || owner.secondOwnerEmail;

  return (
    <div className="grid gap-6">
      {/* Property Overview Card */}
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Property Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Address */}
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Property Address</p>
              <p className="font-semibold text-lg">{property.address}</p>
            </div>

            {/* Property Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {property.bedrooms && (
                <div className="p-4 bg-muted/30 rounded-xl text-center">
                  <Bed className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{property.bedrooms}</p>
                  <p className="text-sm text-muted-foreground">Bedrooms</p>
                </div>
              )}
              {property.bathrooms && (
                <div className="p-4 bg-muted/30 rounded-xl text-center">
                  <Bath className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{property.bathrooms}</p>
                  <p className="text-sm text-muted-foreground">Bathrooms</p>
                </div>
              )}
              {property.square_feet && (
                <div className="p-4 bg-muted/30 rounded-xl text-center">
                  <Maximize className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{property.square_feet.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Sq. Ft.</p>
                </div>
              )}
              {property.max_guests && (
                <div className="p-4 bg-muted/30 rounded-xl text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{property.max_guests}</p>
                  <p className="text-sm text-muted-foreground">Max Guests</p>
                </div>
              )}
            </div>

            {/* Rental Type */}
            {property.rental_type && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Rental Strategy:</span>
                <Badge variant="secondary" className="text-sm">
                  {property.rental_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Owners Card */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-amber-500/5 to-amber-500/10 border-b">
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Property Owners
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Primary Owner */}
            <div className="p-4 border rounded-xl bg-background">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg truncate">{owner.name}</p>
                  <p className="text-sm text-muted-foreground">Primary Owner</p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{owner.email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Second Owner */}
            {hasSecondOwner && (
              <div className="p-4 border rounded-xl bg-background">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <UserCircle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg truncate">
                      {owner.secondOwnerName || "Co-Owner"}
                    </p>
                    <p className="text-sm text-muted-foreground">Co-Owner</p>
                    {owner.secondOwnerEmail && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{owner.secondOwnerEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PeachHaus Contact Card */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-500/5 to-emerald-500/10 border-b">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Your Property Management Team
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-primary-foreground">PH</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">PeachHaus Group</h3>
              <p className="text-muted-foreground text-sm mb-3">Your dedicated property management partner</p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href="mailto:info@peachhausgroup.com" className="text-primary hover:underline">
                    info@peachhausgroup.com
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>(770) 800-0000</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What We Handle Card */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            What PeachHaus Handles For You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              "Guest communications & bookings",
              "Pricing optimization & revenue management",
              "Professional cleaning coordination",
              "Maintenance & repairs management",
              "24/7 guest support",
              "Financial reporting & statements",
              "Listing optimization across platforms",
              "Insurance & corporate housing placements",
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
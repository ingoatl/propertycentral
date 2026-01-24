import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Sparkles,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Car,
  Layers,
  PawPrint,
  GraduationCap,
  Globe,
  Share2,
  MessageSquare,
  Star,
  Calendar,
  Shield,
  Fence,
  Accessibility,
  Gauge,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

interface PlatformListing {
  platform_name: string;
  listing_url?: string;
  is_active: boolean;
}

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
  // Extended fields
  brand_name?: string;
  property_type_detail?: string;
  stories?: string;
  parking_type?: string;
  parking_spaces?: string;
  basement?: boolean;
  fenced_yard?: string;
  ada_compliant?: boolean;
  monthly_rent?: number;
  nightly_rate?: number;
  security_deposit?: number;
  cleaning_fee?: number;
  pet_fee?: number;
  monthly_pet_rent?: number;
  pets_allowed?: boolean;
  pet_rules?: string;
  max_pets?: number;
  max_pet_weight?: number;
  school_district?: string;
  elementary_school?: string;
  middle_school?: string;
  high_school?: string;
  website_url?: string;
  platforms?: PlatformListing[];
}

interface OwnerInfo {
  name: string;
  email: string;
  secondOwnerName?: string | null;
  secondOwnerEmail?: string | null;
}

interface PeachHausData {
  listing_health?: { score: number; status: string; summary: string };
  listingHealth?: { score: number; status: string; summary: string };
  pricing_intelligence?: { current_base_rate: number; recommended_rate: number; rate_change_percent: number; market_adr: number; mpi_7_day: number; occupancy_rate: number; competitiveness_score: number };
  pricingIntelligence?: { current_base_rate: number; recommended_rate: number; rate_change_percent: number; market_adr: number; mpi_7_day: number; occupancy_rate: number; competitiveness_score: number };
  recent_optimizations?: Array<{ type: string; date: string; description: string; expected_impact: string }>;
  recentOptimizations?: Array<{ type: string; date: string; description: string; expected_impact: string }>;
  revenue_alerts?: Array<{ type: string; severity: string; title: string; description: string; action_taken: string }>;
  revenueAlerts?: Array<{ type: string; severity: string; title: string; description: string; action_taken: string }>;
  performance_trends?: { booking_velocity_trend: string; ctr_trend: string; conversion_trend: string };
  performanceTrends?: { booking_velocity_trend: string; ctr_trend: string; conversion_trend: string };
  synced_at?: string;
  syncedAt?: string;
}

interface OwnerPropertyTabProps {
  property: PropertyData;
  owner: OwnerInfo;
  peachHausData?: PeachHausData | null;
}

const getPlatformColor = (platform: string) => {
  const colors: Record<string, string> = {
    'airbnb': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    'vrbo': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'direct': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'furnished_finder': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'booking': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'corporate': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };
  const key = platform.toLowerCase().replace(/[\s.]+/g, '_');
  return colors[key] || 'bg-muted text-muted-foreground';
};

export function OwnerPropertyTab({ property, owner, peachHausData }: OwnerPropertyTabProps) {
  const hasSecondOwner = owner.secondOwnerName || owner.secondOwnerEmail;
  const hasSchoolInfo = property.school_district || property.elementary_school || property.middle_school || property.high_school;
  const hasPetPolicy = property.pets_allowed !== undefined;
  const hasPricing = property.nightly_rate || property.monthly_rent || property.cleaning_fee;
  const hasFeatures = property.parking_type || property.fenced_yard || property.basement || property.ada_compliant;
  const showPeachHaus = (property.rental_type === 'hybrid' || property.rental_type === 'str' || !property.rental_type) && peachHausData;

  // Normalize PeachHaus data to handle both snake_case and camelCase
  const listingHealth = peachHausData?.listingHealth || peachHausData?.listing_health;
  const pricingIntelligence = peachHausData?.pricingIntelligence || peachHausData?.pricing_intelligence;
  const recentOptimizations = peachHausData?.recentOptimizations || peachHausData?.recent_optimizations || [];
  const revenueAlerts = peachHausData?.revenueAlerts || peachHausData?.revenue_alerts || [];

  const formatCurrency = (amount?: number) => {
    if (!amount) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="grid gap-6">
      {/* Property Hero Section */}
      <Card className="border-none shadow-lg overflow-hidden">
        <div className="relative">
          {/* Hero Image or Gradient Background */}
          <div className="h-40 md:h-56 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 relative overflow-hidden">
            {property.image_path ? (
              <img 
                src={property.image_path} 
                alt={property.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Home className="w-20 h-20 text-primary/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>
          
          {/* Property Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                {property.brand_name && (
                  <Badge className="mb-2 bg-white/20 backdrop-blur-sm text-white border-white/30">
                    {property.brand_name}
                  </Badge>
                )}
                <h1 className="text-2xl md:text-3xl font-bold mb-1">{property.name}</h1>
                <p className="text-white/90 text-sm md:text-base">{property.address}</p>
              </div>
              {property.rental_type && (
                <Badge variant="secondary" className="bg-white/20 backdrop-blur-sm text-white border-white/30 shrink-0">
                  {property.rental_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {/* Property Specifications Grid */}
        <CardContent className="p-6">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {property.bedrooms && (
              <div className="text-center p-3 bg-muted/30 rounded-xl">
                <Bed className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{property.bedrooms}</p>
                <p className="text-xs text-muted-foreground">Beds</p>
              </div>
            )}
            {property.bathrooms && (
              <div className="text-center p-3 bg-muted/30 rounded-xl">
                <Bath className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{property.bathrooms}</p>
                <p className="text-xs text-muted-foreground">Baths</p>
              </div>
            )}
            {property.square_feet && (
              <div className="text-center p-3 bg-muted/30 rounded-xl">
                <Maximize className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{property.square_feet.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Sq Ft</p>
              </div>
            )}
            {property.max_guests && (
              <div className="text-center p-3 bg-muted/30 rounded-xl">
                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{property.max_guests}</p>
                <p className="text-xs text-muted-foreground">Guests</p>
              </div>
            )}
            {property.parking_spaces && (
              <div className="text-center p-3 bg-muted/30 rounded-xl">
                <Car className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{property.parking_spaces}</p>
                <p className="text-xs text-muted-foreground">Parking</p>
              </div>
            )}
            {property.stories && (
              <div className="text-center p-3 bg-muted/30 rounded-xl">
                <Layers className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{property.stories}</p>
                <p className="text-xs text-muted-foreground">Stories</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PeachHaus Listing Optimization - Only for hybrid properties with data */}
      {showPeachHaus && (
        <Card className="border-none shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-amber-500/5 border-b">
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-amber-600" />
              Listing Optimization by PeachHaus
            </CardTitle>
            <CardDescription>AI-powered performance insights and revenue optimization</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Health & Pricing Grid */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Health Score */}
              {listingHealth && (
                <div className="p-4 rounded-xl bg-muted/30 text-center">
                  <div className={`text-4xl font-bold mb-1 ${
                    listingHealth.status === 'healthy' ? 'text-emerald-600' :
                    listingHealth.status === 'warning' ? 'text-amber-600' : 'text-destructive'
                  }`}>
                    {listingHealth.score}
                  </div>
                  <Badge className={
                    listingHealth.status === 'healthy' ? 'bg-emerald-100 text-emerald-700' :
                    listingHealth.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }>
                    {listingHealth.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">Health Score</p>
                </div>
              )}

              {/* Pricing Intelligence */}
              {pricingIntelligence && (
                <div className="p-4 rounded-xl bg-muted/30 text-center">
                  <div className="text-2xl font-bold">${pricingIntelligence.current_base_rate}</div>
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <span className="text-muted-foreground">→</span>
                    <span className="text-emerald-600 font-medium">${pricingIntelligence.recommended_rate}</span>
                    {pricingIntelligence.rate_change_percent > 0 && (
                      <Badge variant="outline" className="text-emerald-600 text-xs">
                        +{pricingIntelligence.rate_change_percent}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Current → Recommended Rate</p>
                </div>
              )}

              {/* MPI Score */}
              {pricingIntelligence?.mpi_7_day && (
                <div className="p-4 rounded-xl bg-muted/30 text-center">
                  <div className={`text-4xl font-bold mb-1 ${
                    pricingIntelligence.mpi_7_day >= 1 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {pricingIntelligence.mpi_7_day.toFixed(1)}x
                  </div>
                  <Badge variant="outline" className={
                    pricingIntelligence.mpi_7_day >= 1 ? 'text-emerald-600' : 'text-amber-600'
                  }>
                    {pricingIntelligence.mpi_7_day >= 1 ? 'Beating Market' : 'Below Market'}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">Market Performance Index</p>
                </div>
              )}
            </div>

            {/* Recent Optimizations */}
            {recentOptimizations.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Recent Optimizations
                </h4>
                <div className="space-y-2">
                  {recentOptimizations.slice(0, 3).map((opt, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{opt.description}</p>
                        <p className="text-xs text-muted-foreground">{opt.expected_impact}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{opt.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revenue Alerts */}
            {revenueAlerts.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Revenue Alerts
                </h4>
                <div className="space-y-2">
                  {revenueAlerts.slice(0, 3).map((alert, idx) => (
                    <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg ${
                      alert.severity === 'critical' ? 'bg-red-50 dark:bg-red-950/20' :
                      alert.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-blue-50 dark:bg-blue-950/20'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                        alert.severity === 'critical' ? 'text-red-500' :
                        alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-xs text-muted-foreground">{alert.description}</p>
                        {alert.action_taken && (
                          <p className="text-xs text-emerald-600 mt-1">✓ {alert.action_taken}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* How PeachHaus Markets Your Property */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            How We Market Your Property
          </CardTitle>
          <CardDescription>
            Our multi-channel approach to maximize your property's visibility and bookings
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Platform Distribution */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              Listed On These Platforms
            </h4>
            <div className="flex flex-wrap gap-2">
              {property.platforms && property.platforms.length > 0 ? (
                property.platforms.map((platform, idx) => (
                  <Badge 
                    key={idx} 
                    variant="secondary"
                    className={`${getPlatformColor(platform.platform_name)} flex items-center gap-1.5`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {platform.platform_name}
                    {platform.listing_url && (
                      <a 
                        href={platform.listing_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                  </Badge>
                ))
              ) : (
                <>
                  <Badge variant="secondary" className={getPlatformColor('airbnb')}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Airbnb
                  </Badge>
                  <Badge variant="secondary" className={getPlatformColor('vrbo')}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> VRBO
                  </Badge>
                  <Badge variant="secondary" className={getPlatformColor('furnished_finder')}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Furnished Finder
                  </Badge>
                  <Badge variant="secondary" className={getPlatformColor('corporate')}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Corporate Housing
                  </Badge>
                </>
              )}
              {property.website_url && (
                <Badge variant="secondary" className={`${getPlatformColor('direct')} flex items-center gap-1.5`}>
                  <Globe className="w-3 h-3" />
                  Direct Booking
                  <a 
                    href={property.website_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Badge>
              )}
            </div>
          </div>

          {/* Marketing Strategy Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-muted/30 rounded-xl p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Pricing Strategy
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Dynamic pricing adjusts based on demand</span>
                </li>
                {property.nightly_rate && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Base nightly rate: <strong>{formatCurrency(property.nightly_rate)}/night</strong></span>
                  </li>
                )}
                {property.monthly_rent && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Monthly rate: <strong>{formatCurrency(property.monthly_rent)}/month</strong></span>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Seasonal & event-based optimization</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-muted/30 rounded-xl p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Guest Communication Flow
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">1</span>
                  <span>Instant booking confirmation</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">2</span>
                  <span>Pre-arrival email (3 days before)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">3</span>
                  <span>Check-in day instructions</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">4</span>
                  <span>Mid-stay check-in</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">5</span>
                  <span>Post-stay thank you + review request</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Details Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pricing Structure */}
        {hasPricing && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {property.nightly_rate && (
                  <>
                    <span className="text-muted-foreground">Nightly Rate:</span>
                    <span className="font-medium">{formatCurrency(property.nightly_rate)}</span>
                  </>
                )}
                {property.monthly_rent && (
                  <>
                    <span className="text-muted-foreground">Monthly Rate:</span>
                    <span className="font-medium">{formatCurrency(property.monthly_rent)}</span>
                  </>
                )}
                {property.cleaning_fee && (
                  <>
                    <span className="text-muted-foreground">Cleaning Fee:</span>
                    <span className="font-medium">{formatCurrency(property.cleaning_fee)}</span>
                  </>
                )}
                {property.security_deposit && (
                  <>
                    <span className="text-muted-foreground">Security Deposit:</span>
                    <span className="font-medium">{formatCurrency(property.security_deposit)}</span>
                  </>
                )}
                {property.pet_fee && (
                  <>
                    <span className="text-muted-foreground">Pet Fee:</span>
                    <span className="font-medium">{formatCurrency(property.pet_fee)}</span>
                  </>
                )}
                {property.monthly_pet_rent && (
                  <>
                    <span className="text-muted-foreground">Monthly Pet Rent:</span>
                    <span className="font-medium">{formatCurrency(property.monthly_pet_rent)}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pet Policy */}
        {hasPetPolicy && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PawPrint className="h-5 w-5" />
                Pet Policy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge 
                variant={property.pets_allowed ? "default" : "secondary"}
                className={property.pets_allowed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : ""}
              >
                {property.pets_allowed ? "Pet Friendly" : "No Pets Allowed"}
              </Badge>
              {property.pets_allowed && (
                <div className="mt-3 space-y-2 text-sm">
                  {(property.max_pets || property.max_pet_weight) && (
                    <p className="text-muted-foreground">
                      {property.max_pets && `Max ${property.max_pets} pet${property.max_pets > 1 ? 's' : ''}`}
                      {property.max_pets && property.max_pet_weight && ', '}
                      {property.max_pet_weight && `up to ${property.max_pet_weight} lbs each`}
                    </p>
                  )}
                  {property.pet_rules && (
                    <p className="text-muted-foreground italic">"{property.pet_rules}"</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* School District - for MTR guests */}
        {hasSchoolInfo && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                School Information
              </CardTitle>
              <CardDescription>Helpful for mid-term rental guests with families</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {property.school_district && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">District:</span>
                  <span className="font-medium">{property.school_district}</span>
                </div>
              )}
              {property.elementary_school && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">Elementary:</span>
                  <span>{property.elementary_school}</span>
                </div>
              )}
              {property.middle_school && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">Middle:</span>
                  <span>{property.middle_school}</span>
                </div>
              )}
              {property.high_school && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">High:</span>
                  <span>{property.high_school}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Property Features */}
        {hasFeatures && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Home className="h-5 w-5" />
                Property Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {property.parking_type && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    {property.parking_type}
                  </Badge>
                )}
                {property.fenced_yard && property.fenced_yard.toLowerCase() === 'yes' && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Fence className="w-3 h-3" />
                    Fenced Yard
                  </Badge>
                )}
                {property.basement && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Basement
                  </Badge>
                )}
                {property.ada_compliant && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Accessibility className="w-3 h-3" />
                    ADA Compliant
                  </Badge>
                )}
                {property.property_type_detail && (
                  <Badge variant="outline">
                    {property.property_type_detail}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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

      {/* PeachHaus Contact Card with Signature */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-500/5 to-emerald-500/10 border-b">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Your Property Management Team
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Hosts Photo */}
            <div className="flex-shrink-0">
              <img 
                src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png" 
                alt="Anja & Ingo Schaer" 
                className="w-24 h-24 rounded-full object-cover border-4 border-primary/20 shadow-lg"
              />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              {/* Signature Image */}
              <img 
                src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-signature.png" 
                alt="Anja & Ingo Signature" 
                className="h-12 mx-auto md:mx-0 mb-2"
              />
              <p className="text-muted-foreground text-sm mb-3">Your dedicated property management partners</p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-center md:justify-start gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href="mailto:info@peachhausgroup.com" className="text-primary hover:underline">
                    info@peachhausgroup.com
                  </a>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>(404) 800-5932</span>
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
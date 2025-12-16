import { NewSTROnboardingFormData, LISTING_PLATFORM_OPTIONS, PHOTOGRAPHY_NEEDS_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Camera, Sparkles, Link2 } from "lucide-react";

interface ListingPreferencesStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const ListingPreferencesStep = ({ formData, updateFormData }: ListingPreferencesStepProps) => {
  const togglePlatform = (platform: string) => {
    const current = formData.listingPlatforms || [];
    const updated = current.includes(platform)
      ? current.filter(p => p !== platform)
      : [...current, platform];
    updateFormData({ listingPlatforms: updated });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Listing Preferences</h2>
        <p className="text-muted-foreground mt-2">Where and how would you like to list your property?</p>
      </div>

      {/* Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="w-5 h-5 text-primary" />
            Listing Platforms
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Select all platforms you'd like us to list on</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {LISTING_PLATFORM_OPTIONS.map((platform) => (
              <div key={platform} className="flex items-center space-x-2">
                <Checkbox
                  id={`platform-${platform}`}
                  checked={formData.listingPlatforms?.includes(platform)}
                  onCheckedChange={() => togglePlatform(platform)}
                />
                <Label htmlFor={`platform-${platform}`} className="text-sm cursor-pointer">
                  {platform}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Photography */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Camera className="w-5 h-5 text-primary" />
            Photography
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="photographyNeeds">Photography Status</Label>
            <Select
              value={formData.photographyNeeds}
              onValueChange={(value) => updateFormData({ photographyNeeds: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="What's your photography situation?" />
              </SelectTrigger>
              <SelectContent>
                {PHOTOGRAPHY_NEEDS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="photographyNotes">Photography Notes</Label>
            <Textarea
              id="photographyNotes"
              value={formData.photographyNotes}
              onChange={(e) => updateFormData({ photographyNotes: e.target.value })}
              placeholder="Any specific shots you want? Areas to highlight or avoid?"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Listing Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Listing Content Ideas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listingTitleIdeas">Listing Title Ideas</Label>
            <Textarea
              id="listingTitleIdeas"
              value={formData.listingTitleIdeas}
              onChange={(e) => updateFormData({ listingTitleIdeas: e.target.value })}
              placeholder="Any ideas for your listing title? e.g., 'Cozy Midtown Retreat', 'Modern Buckhead Hideaway'"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uniqueSellingPoints">What makes your property special?</Label>
            <Textarea
              id="uniqueSellingPoints"
              value={formData.uniqueSellingPoints}
              onChange={(e) => updateFormData({ uniqueSellingPoints: e.target.value })}
              placeholder="Unique features, location benefits, views, amenities that stand out..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Competitor Research */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="w-5 h-5 text-primary" />
            Competitor Listings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="competitorLinks">Links to listings you like</Label>
            <Textarea
              id="competitorLinks"
              value={formData.competitorLinks}
              onChange={(e) => updateFormData({ competitorLinks: e.target.value })}
              placeholder="Paste Airbnb/VRBO links to listings you admire (one per line)"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This helps us understand the style and positioning you're aiming for
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

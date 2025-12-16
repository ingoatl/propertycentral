import { NewSTROnboardingFormData, PHOTOGRAPHY_NEEDS_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Camera, Sparkles, Palette } from "lucide-react";

interface ListingPreferencesStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const ListingPreferencesStep = ({ formData, updateFormData }: ListingPreferencesStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[hsl(25,40%,25%)]">Listing Preferences</h2>
        <p className="text-[hsl(25,20%,50%)] mt-2">Help us create the perfect listing for your property</p>
      </div>

      {/* Photography */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Camera className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Photography
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="photographyNeeds" className="text-[hsl(25,30%,30%)]">Photography Status</Label>
            <Select
              value={formData.photographyNeeds}
              onValueChange={(value) => updateFormData({ photographyNeeds: value })}
            >
              <SelectTrigger className="h-12 rounded-xl border-[hsl(25,30%,85%)]">
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
            <Label htmlFor="photographyNotes" className="text-[hsl(25,30%,30%)]">Photography Notes</Label>
            <Textarea
              id="photographyNotes"
              value={formData.photographyNotes}
              onChange={(e) => updateFormData({ photographyNotes: e.target.value })}
              placeholder="Any specific shots you want? Areas to highlight or avoid?"
              rows={2}
              className="rounded-xl border-[hsl(25,30%,85%)]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Design Consultation */}
      <Card className="rounded-2xl border-[hsl(25,50%,85%)] shadow-sm bg-gradient-to-r from-[hsl(25,100%,97%)] to-[hsl(30,100%,96%)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Palette className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Design Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label htmlFor="needsDesignConsultation" className="text-[hsl(25,30%,30%)]">Would you like a design consultation?</Label>
              <p className="text-sm text-[hsl(25,20%,55%)] mt-1">
                Our professional designers can help style your property for maximum guest appeal and higher bookings.
              </p>
              <p className="text-sm font-medium text-[hsl(25,80%,45%)] mt-2">
                (Additional fee applies)
              </p>
            </div>
            <Switch
              id="needsDesignConsultation"
              checked={formData.needsDesignConsultation}
              onCheckedChange={(checked) => updateFormData({ needsDesignConsultation: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Listing Content */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Sparkles className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Listing Content Ideas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listingTitleIdeas" className="text-[hsl(25,30%,30%)]">Listing Title Ideas</Label>
            <Textarea
              id="listingTitleIdeas"
              value={formData.listingTitleIdeas}
              onChange={(e) => updateFormData({ listingTitleIdeas: e.target.value })}
              placeholder="Any ideas for your listing title? e.g., 'Cozy Midtown Retreat', 'Modern Buckhead Hideaway'"
              rows={2}
              className="rounded-xl border-[hsl(25,30%,85%)]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uniqueSellingPoints" className="text-[hsl(25,30%,30%)]">What makes your property special?</Label>
            <Textarea
              id="uniqueSellingPoints"
              value={formData.uniqueSellingPoints}
              onChange={(e) => updateFormData({ uniqueSellingPoints: e.target.value })}
              placeholder="Unique features, location benefits, views, amenities that stand out..."
              rows={3}
              className="rounded-xl border-[hsl(25,30%,85%)]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

import { NewSTROnboardingFormData, SETUP_STATUS_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sofa, ChefHat, Bed, Palette, TreePine, SprayCan } from "lucide-react";

interface SetupStatusStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const SetupStatusStep = ({ formData, updateFormData }: SetupStatusStepProps) => {
  const setupItems = [
    {
      icon: Sofa,
      title: 'Furniture',
      statusField: 'furnitureStatus' as const,
      notesField: 'furnitureNotes' as const,
      description: 'Living room, bedroom, dining furniture',
    },
    {
      icon: ChefHat,
      title: 'Kitchen Items',
      statusField: 'kitchenStatus' as const,
      notesField: 'kitchenNotes' as const,
      description: 'Cookware, dishes, appliances, utensils',
    },
    {
      icon: Bed,
      title: 'Linens & Bedding',
      statusField: 'linensStatus' as const,
      notesField: 'linensNotes' as const,
      description: 'Sheets, towels, pillows, blankets',
    },
    {
      icon: Palette,
      title: 'Decor & Styling',
      statusField: 'decorStatus' as const,
      notesField: 'decorNotes' as const,
      description: 'Art, plants, accessories, staging',
    },
    {
      icon: TreePine,
      title: 'Outdoor Space',
      statusField: 'outdoorStatus' as const,
      notesField: 'outdoorNotes' as const,
      description: 'Patio furniture, grill, yard items',
    },
    {
      icon: SprayCan,
      title: 'Cleaning Supplies',
      statusField: 'cleaningSuppliesStatus' as const,
      notesField: 'cleaningSuppliesNotes' as const,
      description: 'Starter supplies for cleaning crew',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Setup Status</h2>
        <p className="text-muted-foreground mt-2">What's already ready vs. what needs to be set up?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {setupItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.statusField}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="w-5 h-5 text-primary" />
                  {item.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData[item.statusField]}
                    onValueChange={(value) => updateFormData({ [item.statusField]: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {SETUP_STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={formData[item.notesField]}
                    onChange={(e) => updateFormData({ [item.notesField]: e.target.value })}
                    placeholder="Any specific details or needs?"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> PeachHaus can help with furniture procurement, staging, and 
            professional setup if needed. We'll discuss options during onboarding based on your 
            selections above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

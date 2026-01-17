import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BedroomConfiguration, BED_TYPE_OPTIONS } from '@/types/owner-onboarding';
import { Plus, Trash2, Bed } from 'lucide-react';

interface BedroomConfigBuilderProps {
  configurations: BedroomConfiguration[];
  onChange: (configurations: BedroomConfiguration[]) => void;
}

export function BedroomConfigBuilder({ configurations, onChange }: BedroomConfigBuilderProps) {
  const addBedroom = () => {
    const newBedroom: BedroomConfiguration = {
      bedroom_number: configurations.length + 1,
      bed_type: 'Queen',
      bed_count: 1,
      is_primary: configurations.length === 0,
    };
    onChange([...configurations, newBedroom]);
  };

  const removeBedroom = (index: number) => {
    const updated = configurations.filter((_, i) => i !== index);
    // Renumber bedrooms
    const renumbered = updated.map((config, i) => ({
      ...config,
      bedroom_number: i + 1,
    }));
    onChange(renumbered);
  };

  const updateBedroom = (index: number, updates: Partial<BedroomConfiguration>) => {
    const updated = configurations.map((config, i) => {
      if (i === index) {
        return { ...config, ...updates };
      }
      // If setting this one as primary, unset others
      if (updates.is_primary && config.is_primary) {
        return { ...config, is_primary: false };
      }
      return config;
    });
    onChange(updated);
  };

  const getBedroomSummary = () => {
    if (configurations.length === 0) return 'No bedrooms configured';
    return configurations.map(c => 
      `${c.bed_count} ${c.bed_type}${c.bed_count > 1 ? 's' : ''}`
    ).join(' • ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bed className="h-5 w-5" />
          Bedroom Configuration
        </CardTitle>
        <CardDescription>
          Configure each bedroom with bed types and counts for accurate Airbnb listings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {configurations.length > 0 && (
          <div className="p-3 bg-primary/5 rounded-lg text-sm">
            <span className="font-medium">Summary:</span> {getBedroomSummary()}
          </div>
        )}

        {configurations.map((config, index) => (
          <div 
            key={index} 
            className={`p-4 border rounded-xl space-y-4 ${config.is_primary ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Bed className="h-4 w-4" />
                Bedroom {config.bedroom_number}
                {config.is_primary && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Primary
                  </span>
                )}
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeBedroom(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Bed Type</Label>
                <Select
                  value={config.bed_type}
                  onValueChange={(value) => updateBedroom(index, { bed_type: value })}
                >
                  <SelectTrigger className="h-12 mt-1">
                    <SelectValue placeholder="Select bed type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BED_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Number of Beds</Label>
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={config.bed_count}
                  onChange={(e) => updateBedroom(index, { bed_count: parseInt(e.target.value) || 1 })}
                  className="h-12 mt-1"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mt-6">
                <Label className="text-sm font-medium">Primary Bedroom?</Label>
                <Switch
                  checked={config.is_primary}
                  onCheckedChange={(checked) => updateBedroom(index, { is_primary: checked })}
                />
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addBedroom}
          className="w-full h-12 border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Bedroom
        </Button>
      </CardContent>
    </Card>
  );
}

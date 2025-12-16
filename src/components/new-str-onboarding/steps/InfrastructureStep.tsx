import { NewSTROnboardingFormData } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Wifi, Lock, Zap, Flame, Droplets, Trash2, Globe } from "lucide-react";

interface InfrastructureStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const InfrastructureStep = ({ formData, updateFormData }: InfrastructureStepProps) => {
  const updateUtility = (
    utilityType: keyof typeof formData.utilities,
    field: 'provider' | 'accountNumber',
    value: string
  ) => {
    updateFormData({
      utilities: {
        ...formData.utilities,
        [utilityType]: {
          ...formData.utilities[utilityType],
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Infrastructure & Utilities</h2>
        <p className="text-muted-foreground mt-2">Tell us about your property's connectivity and utilities</p>
      </div>

      {/* WiFi Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wifi className="w-5 h-5 text-primary" />
            WiFi Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="wifiReady">WiFi Ready for Guests?</Label>
              <p className="text-sm text-muted-foreground">Is high-speed internet already installed?</p>
            </div>
            <Switch
              id="wifiReady"
              checked={formData.wifiReady}
              onCheckedChange={(checked) => updateFormData({ wifiReady: checked })}
            />
          </div>

          {formData.wifiReady && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="wifiSsid">Network Name (SSID)</Label>
                <Input
                  id="wifiSsid"
                  value={formData.wifiSsid}
                  onChange={(e) => updateFormData({ wifiSsid: e.target.value })}
                  placeholder="MyHomeWiFi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wifiPassword">WiFi Password</Label>
                <Input
                  id="wifiPassword"
                  type="password"
                  value={formData.wifiPassword}
                  onChange={(e) => updateFormData({ wifiPassword: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Lock */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="w-5 h-5 text-primary" />
            Smart Lock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="smartLockInstalled">Smart Lock Installed?</Label>
              <p className="text-sm text-muted-foreground">For keyless guest entry</p>
            </div>
            <Switch
              id="smartLockInstalled"
              checked={formData.smartLockInstalled}
              onCheckedChange={(checked) => updateFormData({ smartLockInstalled: checked })}
            />
          </div>

          {formData.smartLockInstalled && (
            <div className="pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="smartLockBrand">Smart Lock Brand/Model</Label>
                <Input
                  id="smartLockBrand"
                  value={formData.smartLockBrand}
                  onChange={(e) => updateFormData({ smartLockBrand: e.target.value })}
                  placeholder="e.g., Schlage Encode, August, Yale"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Utilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-primary" />
            Utility Providers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label htmlFor="utilitiesSetup">Utilities Already Set Up?</Label>
              <p className="text-sm text-muted-foreground">Are all utilities active in your name?</p>
            </div>
            <Switch
              id="utilitiesSetup"
              checked={formData.utilitiesSetup}
              onCheckedChange={(checked) => updateFormData({ utilitiesSetup: checked })}
            />
          </div>

          {formData.utilitiesSetup && (
            <div className="space-y-4 pt-4 border-t">
              {/* Electric */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium">Electric</span>
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input
                    value={formData.utilities.electric.provider}
                    onChange={(e) => updateUtility('electric', 'provider', e.target.value)}
                    placeholder="e.g., Georgia Power"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={formData.utilities.electric.accountNumber}
                    onChange={(e) => updateUtility('electric', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                  />
                </div>
              </div>

              {/* Gas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="font-medium">Gas</span>
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input
                    value={formData.utilities.gas.provider}
                    onChange={(e) => updateUtility('gas', 'provider', e.target.value)}
                    placeholder="e.g., Gas South"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={formData.utilities.gas.accountNumber}
                    onChange={(e) => updateUtility('gas', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                  />
                </div>
              </div>

              {/* Water */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Water</span>
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input
                    value={formData.utilities.water.provider}
                    onChange={(e) => updateUtility('water', 'provider', e.target.value)}
                    placeholder="e.g., DeKalb County Water"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={formData.utilities.water.accountNumber}
                    onChange={(e) => updateUtility('water', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                  />
                </div>
              </div>

              {/* Trash */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Trash2 className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Trash</span>
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input
                    value={formData.utilities.trash.provider}
                    onChange={(e) => updateUtility('trash', 'provider', e.target.value)}
                    placeholder="e.g., City Services"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={formData.utilities.trash.accountNumber}
                    onChange={(e) => updateUtility('trash', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                  />
                </div>
              </div>

              {/* Internet */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Globe className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">Internet</span>
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input
                    value={formData.utilities.internet.provider}
                    onChange={(e) => updateUtility('internet', 'provider', e.target.value)}
                    placeholder="e.g., AT&T, Xfinity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={formData.utilities.internet.accountNumber}
                    onChange={(e) => updateUtility('internet', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

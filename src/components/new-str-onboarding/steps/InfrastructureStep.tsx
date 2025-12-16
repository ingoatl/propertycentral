import { NewSTROnboardingFormData } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Wifi, Lock, Zap, Flame, Droplets, Trash2, Globe, AlertCircle } from "lucide-react";

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
        <h2 className="text-2xl font-bold text-[hsl(25,40%,25%)]">Infrastructure & Utilities</h2>
        <p className="text-[hsl(25,20%,50%)] mt-2">Tell us about your property's connectivity and utilities</p>
      </div>

      {/* WiFi Setup */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Wifi className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            WiFi Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="wifiReady" className="text-[hsl(25,30%,30%)]">WiFi Ready for Guests?</Label>
              <p className="text-sm text-[hsl(25,20%,55%)]">Is high-speed internet already installed?</p>
            </div>
            <Switch
              id="wifiReady"
              checked={formData.wifiReady}
              onCheckedChange={(checked) => updateFormData({ wifiReady: checked })}
            />
          </div>

          {formData.wifiReady && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[hsl(25,30%,90%)]">
              <div className="space-y-2">
                <Label htmlFor="wifiSsid" className="text-[hsl(25,30%,30%)]">Network Name (SSID)</Label>
                <Input
                  id="wifiSsid"
                  value={formData.wifiSsid}
                  onChange={(e) => updateFormData({ wifiSsid: e.target.value })}
                  placeholder="MyHomeWiFi"
                  className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wifiPassword" className="text-[hsl(25,30%,30%)]">WiFi Password</Label>
                <Input
                  id="wifiPassword"
                  type="password"
                  value={formData.wifiPassword}
                  onChange={(e) => updateFormData({ wifiPassword: e.target.value })}
                  placeholder="••••••••"
                  className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Lock */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Lock className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Smart Lock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="smartLockInstalled" className="text-[hsl(25,30%,30%)]">Smart Lock Installed?</Label>
              <p className="text-sm text-[hsl(25,20%,55%)]">For keyless guest entry</p>
            </div>
            <Switch
              id="smartLockInstalled"
              checked={formData.smartLockInstalled}
              onCheckedChange={(checked) => updateFormData({ smartLockInstalled: checked })}
            />
          </div>

          {formData.smartLockInstalled && (
            <div className="pt-4 border-t border-[hsl(25,30%,90%)]">
              <div className="space-y-2">
                <Label htmlFor="smartLockBrand" className="text-[hsl(25,30%,30%)]">Smart Lock Brand/Model</Label>
                <Input
                  id="smartLockBrand"
                  value={formData.smartLockBrand}
                  onChange={(e) => updateFormData({ smartLockBrand: e.target.value })}
                  placeholder="e.g., Schlage Encode, August, Yale"
                  className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Utilities */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Zap className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Utility Providers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label htmlFor="utilitiesSetup" className="text-[hsl(25,30%,30%)]">Utilities Already Set Up?</Label>
              <p className="text-sm text-[hsl(25,20%,55%)]">Are all utilities active in your name?</p>
            </div>
            <Switch
              id="utilitiesSetup"
              checked={formData.utilitiesSetup}
              onCheckedChange={(checked) => updateFormData({ utilitiesSetup: checked })}
            />
          </div>

          {formData.utilitiesSetup && (
            <div className="space-y-4 pt-4 border-t border-[hsl(25,30%,90%)]">
              <div className="flex items-center gap-2 p-3 bg-[hsl(25,100%,97%)] rounded-xl border border-[hsl(25,50%,85%)]">
                <AlertCircle className="w-4 h-4 text-[hsl(25,95%,50%)]" />
                <p className="text-sm text-[hsl(25,40%,35%)]">
                  Provider names are required for all utilities
                </p>
              </div>

              {/* Electric */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium text-[hsl(25,40%,25%)]">Electric</span>
                  <span className="text-[hsl(25,95%,50%)]">*</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Provider <span className="text-[hsl(25,95%,50%)]">*</span></Label>
                  <Input
                    value={formData.utilities.electric.provider}
                    onChange={(e) => updateUtility('electric', 'provider', e.target.value)}
                    placeholder="e.g., Georgia Power"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Account Number</Label>
                  <Input
                    value={formData.utilities.electric.accountNumber}
                    onChange={(e) => updateUtility('electric', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                  />
                </div>
              </div>

              {/* Gas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="font-medium text-[hsl(25,40%,25%)]">Gas</span>
                  <span className="text-[hsl(25,95%,50%)]">*</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Provider <span className="text-[hsl(25,95%,50%)]">*</span></Label>
                  <Input
                    value={formData.utilities.gas.provider}
                    onChange={(e) => updateUtility('gas', 'provider', e.target.value)}
                    placeholder="e.g., Gas South"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Account Number</Label>
                  <Input
                    value={formData.utilities.gas.accountNumber}
                    onChange={(e) => updateUtility('gas', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                  />
                </div>
              </div>

              {/* Water */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-[hsl(25,40%,25%)]">Water</span>
                  <span className="text-[hsl(25,95%,50%)]">*</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Provider <span className="text-[hsl(25,95%,50%)]">*</span></Label>
                  <Input
                    value={formData.utilities.water.provider}
                    onChange={(e) => updateUtility('water', 'provider', e.target.value)}
                    placeholder="e.g., DeKalb County Water"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Account Number</Label>
                  <Input
                    value={formData.utilities.water.accountNumber}
                    onChange={(e) => updateUtility('water', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                  />
                </div>
              </div>

              {/* Trash */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Trash2 className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-[hsl(25,40%,25%)]">Trash</span>
                  <span className="text-[hsl(25,95%,50%)]">*</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Provider <span className="text-[hsl(25,95%,50%)]">*</span></Label>
                  <Input
                    value={formData.utilities.trash.provider}
                    onChange={(e) => updateUtility('trash', 'provider', e.target.value)}
                    placeholder="e.g., City Services"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Account Number</Label>
                  <Input
                    value={formData.utilities.trash.accountNumber}
                    onChange={(e) => updateUtility('trash', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                  />
                </div>
              </div>

              {/* Internet */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 md:col-span-2">
                  <Globe className="w-4 h-4 text-purple-500" />
                  <span className="font-medium text-[hsl(25,40%,25%)]">Internet</span>
                  <span className="text-[hsl(25,95%,50%)]">*</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Provider <span className="text-[hsl(25,95%,50%)]">*</span></Label>
                  <Input
                    value={formData.utilities.internet.provider}
                    onChange={(e) => updateUtility('internet', 'provider', e.target.value)}
                    placeholder="e.g., AT&T, Xfinity"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(25,30%,30%)]">Account Number</Label>
                  <Input
                    value={formData.utilities.internet.accountNumber}
                    onChange={(e) => updateUtility('internet', 'accountNumber', e.target.value)}
                    placeholder="Account #"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Septic Tank */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Droplets className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Septic System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hasSepticTank" className="text-[hsl(25,30%,30%)]">Does the property have a septic tank?</Label>
              <p className="text-sm text-[hsl(25,20%,55%)]">Important for maintenance scheduling</p>
            </div>
            <Switch
              id="hasSepticTank"
              checked={formData.hasSepticTank}
              onCheckedChange={(checked) => updateFormData({ hasSepticTank: checked })}
            />
          </div>

          {formData.hasSepticTank && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[hsl(25,30%,90%)]">
              <div className="space-y-2">
                <Label htmlFor="septicLastFlushed" className="text-[hsl(25,30%,30%)]">When was it last flushed?</Label>
                <Input
                  id="septicLastFlushed"
                  value={formData.septicLastFlushed}
                  onChange={(e) => updateFormData({ septicLastFlushed: e.target.value })}
                  placeholder="e.g., March 2024"
                  className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="septicServiceCompany" className="text-[hsl(25,30%,30%)]">Service Company</Label>
                <Input
                  id="septicServiceCompany"
                  value={formData.septicServiceCompany}
                  onChange={(e) => updateFormData({ septicServiceCompany: e.target.value })}
                  placeholder="e.g., ABC Septic Services"
                  className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

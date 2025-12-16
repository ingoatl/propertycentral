import { NewSTROnboardingFormData } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Home, Target, Zap, Package, Wrench, FileText, Upload, Globe, ScrollText, Lightbulb, CheckCircle } from "lucide-react";

interface ReviewStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const ReviewStep = ({ formData, updateFormData }: ReviewStepProps) => {
  const formatList = (items: string[] | undefined) => {
    if (!items || items.length === 0) return 'None selected';
    return items.join(', ');
  };

  const formatBoolean = (value: boolean | undefined) => value ? 'Yes' : 'No';

  const sections = [
    {
      icon: User,
      title: 'Owner & Property',
      items: [
        { label: 'Owner Name', value: formData.ownerName },
        { label: 'Email', value: formData.ownerEmail },
        { label: 'Phone', value: formData.ownerPhone },
        { label: 'Property Address', value: formData.propertyAddress },
        { label: 'Property Type', value: formData.propertyType },
        { label: 'Bedrooms', value: formData.bedrooms },
        { label: 'Bathrooms', value: formData.bathrooms },
        { label: 'Square Footage', value: formData.squareFootage },
      ],
    },
    {
      icon: Target,
      title: 'Rental Strategy',
      items: [
        { label: 'Strategy', value: formData.rentalStrategy },
        { label: 'Target Guest', value: formData.targetGuestAvatar },
        { label: 'Pricing Goal', value: formData.pricingGoal },
        { label: 'Expected ADR', value: formData.expectedAdr ? `$${formData.expectedAdr}` : null },
        { label: 'Minimum Stay', value: formData.minimumStay ? `${formData.minimumStay} nights` : null },
        { label: 'Max Guests', value: formData.maxGuests },
        { label: 'Peak Months', value: formatList(formData.peakSeasonMonths) },
      ],
    },
    {
      icon: Zap,
      title: 'Infrastructure',
      items: [
        { label: 'WiFi Ready', value: formatBoolean(formData.wifiReady) },
        { label: 'Smart Lock', value: formatBoolean(formData.smartLockInstalled) },
        { label: 'Smart Lock Brand', value: formData.smartLockBrand },
        { label: 'Utilities Setup', value: formatBoolean(formData.utilitiesSetup) },
      ],
    },
    {
      icon: Package,
      title: 'Setup Status',
      items: [
        { label: 'Furniture', value: formData.furnitureStatus },
        { label: 'Kitchen', value: formData.kitchenStatus },
        { label: 'Linens', value: formData.linensStatus },
        { label: 'Decor', value: formData.decorStatus },
        { label: 'Outdoor', value: formData.outdoorStatus },
        { label: 'Cleaning Supplies', value: formData.cleaningSuppliesStatus },
      ],
    },
    {
      icon: Wrench,
      title: 'Operations',
      items: [
        { label: 'Has Cleaner', value: formatBoolean(formData.hasExistingCleaner) },
        { label: 'Cleaner Name', value: formData.cleanerName },
        { label: 'Needs Referral', value: formatBoolean(formData.needsCleanerReferral) },
        { label: 'Laundry Setup', value: formData.laundrySetup },
        { label: 'Turnover Time', value: formData.preferredTurnoverTime },
      ],
    },
    {
      icon: FileText,
      title: 'Legal & Compliance',
      items: [
        { label: 'STR Permit Status', value: formData.strPermitStatus },
        { label: 'Permit Number', value: formData.permitNumber },
        { label: 'HOA Restrictions', value: formatBoolean(formData.hoaRestrictions) },
        { label: 'Insurance Provider', value: formData.insuranceProvider },
        { label: 'STR Insurance', value: formatBoolean(formData.hasStrInsurance) },
        { label: 'Entity Type', value: formData.entityOwnership },
        { label: 'Entity Name', value: formData.entityName },
      ],
    },
    {
      icon: Upload,
      title: 'Documents Uploaded',
      items: [
        { label: 'Government ID', value: formData.governmentIdFile?.name || 'Not uploaded' },
        { label: 'Property Deed', value: formData.propertyDeedFile?.name || 'Not uploaded' },
        { label: 'Mortgage Statement', value: formData.mortgageStatementFile?.name || 'Not uploaded' },
        { label: 'Entity Documents', value: formData.entityDocumentsFile?.name || 'Not uploaded' },
        { label: 'Insurance Certificate', value: formData.insuranceCertificateFile?.name || 'Not uploaded' },
        { label: 'HOA Rules', value: formData.hoaRulesFile?.name || 'Not uploaded' },
      ],
    },
    {
      icon: Globe,
      title: 'Listing Preferences',
      items: [
        { label: 'Platforms', value: formatList(formData.listingPlatforms) },
        { label: 'Photography', value: formData.photographyNeeds },
        { label: 'Title Ideas', value: formData.listingTitleIdeas },
        { label: 'Unique Features', value: formData.uniqueSellingPoints },
      ],
    },
    {
      icon: ScrollText,
      title: 'House Rules',
      items: [
        { label: 'Pet Policy', value: formData.petPolicy },
        { label: 'Pet Fee', value: formData.petDeposit ? `$${formData.petDeposit}` : null },
        { label: 'Noise Policy', value: formData.noisePolicy },
        { label: 'Smoking Policy', value: formData.smokingPolicy },
        { label: 'Party Policy', value: formData.partyPolicy },
      ],
    },
    {
      icon: Lightbulb,
      title: 'Property Details',
      items: [
        { label: 'Features', value: formatList(formData.propertyFeatures) },
        { label: 'Max Vehicles', value: formData.maxVehicles },
        { label: 'Emergency Contact', value: formData.emergencyContact },
        { label: 'Maintenance Contact', value: formData.maintenanceContact },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[hsl(25,40%,25%)]">Review Your Information</h2>
        <p className="text-[hsl(25,20%,50%)] mt-2">Please review all details before submitting</p>
      </div>

      <Card className="bg-gradient-to-r from-[hsl(25,100%,97%)] to-[hsl(30,100%,96%)] rounded-2xl border-[hsl(25,50%,85%)]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-[hsl(25,95%,50%)]" />
            <div>
              <p className="font-medium text-[hsl(25,40%,25%)]">Almost Done!</p>
              <p className="text-sm text-[hsl(25,20%,50%)]">
                Review your information below. You can go back to any step to make changes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const filledItems = section.items.filter(item => 
            item.value && item.value !== 'None selected' && item.value !== 'Not uploaded'
          );

          return (
            <Card key={section.title} className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2 text-[hsl(25,40%,25%)]">
                    <Icon className="w-4 h-4 text-[hsl(25,95%,50%)]" />
                    {section.title}
                  </span>
                  <Badge variant="secondary" className="text-xs bg-[hsl(25,100%,95%)] text-[hsl(25,70%,40%)]">
                    {filledItems.length}/{section.items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {section.items.map((item) => (
                    item.value && item.value !== 'None selected' && item.value !== 'Not uploaded' && (
                      <div key={item.label} className="flex justify-between gap-2">
                        <span className="text-[hsl(25,20%,50%)]">{item.label}:</span>
                        <span className="font-medium text-[hsl(25,40%,30%)] text-right truncate max-w-[60%]">
                          {item.value}
                        </span>
                      </div>
                    )
                  ))}
                  {filledItems.length === 0 && (
                    <p className="text-[hsl(25,20%,55%)] italic">No information provided</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

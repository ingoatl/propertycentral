import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NewSTROnboardingFormData, initialNewSTRFormData } from "@/types/new-str-onboarding";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Send, Check } from "lucide-react";
import { PropertyBasicsStep } from "./steps/PropertyBasicsStep";
import { RentalStrategyStep } from "./steps/RentalStrategyStep";
import { InfrastructureStep } from "./steps/InfrastructureStep";
import { SetupStatusStep } from "./steps/SetupStatusStep";
import { OperationsPlanningStep } from "./steps/OperationsPlanningStep";
import { LegalComplianceStep } from "./steps/LegalComplianceStep";
import { DocumentsStep } from "./steps/DocumentsStep";
import { ListingPreferencesStep } from "./steps/ListingPreferencesStep";
import { HouseQuirksStep } from "./steps/HouseQuirksStep";
import { ReviewStep } from "./steps/ReviewStep";
import { NewSTRSuccessScreen } from "./NewSTRSuccessScreen";

const STEPS = [
  { number: 1, title: "Basics" },
  { number: 2, title: "Strategy" },
  { number: 3, title: "Infrastructure" },
  { number: 4, title: "Setup" },
  { number: 5, title: "Operations" },
  { number: 6, title: "Legal" },
  { number: 7, title: "Documents" },
  { number: 8, title: "Listings" },
  { number: 9, title: "Details" },
  { number: 10, title: "Review" },
];

export const NewSTROnboardingForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<NewSTROnboardingFormData>(initialNewSTRFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const updateFormData = (updates: Partial<NewSTROnboardingFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.ownerName || !formData.ownerEmail || !formData.ownerPhone || !formData.propertyAddress || !formData.propertyType) {
          toast.error("Please fill in all required fields");
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
          toast.error("Please enter a valid email address");
          return false;
        }
        return true;
      case 2:
        if (!formData.rentalStrategy) {
          toast.error("Please select a rental strategy");
          return false;
        }
        return true;
      case 6:
        if (!formData.strPermitStatus) {
          toast.error("Please select your STR permit status");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadFile = async (file: File, fieldName: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `new-str/${Date.now()}-${fieldName}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('onboarding-documents')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('onboarding-documents')
        .getPublicUrl(fileName);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error(`Error uploading ${fieldName}:`, error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    try {
      // Upload files
      const fileFields = [
        'governmentIdFile',
        'propertyDeedFile',
        'mortgageStatementFile',
        'entityDocumentsFile',
        'insuranceCertificateFile',
        'hoaRulesFile',
      ] as const;

      const fileUrls: Record<string, string | null> = {};
      for (const field of fileFields) {
        const file = formData[field];
        if (file) {
          fileUrls[field.replace('File', '_url')] = await uploadFile(file, field);
        }
      }

      // Prepare submission data
      const submissionData = {
        // Owner info
        owner_name: formData.ownerName,
        owner_email: formData.ownerEmail,
        owner_phone: formData.ownerPhone,
        property_address: formData.propertyAddress,
        
        // Property basics
        property_type: formData.propertyType,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        square_footage: formData.squareFootage,
        
        // Rental strategy
        rental_strategy: formData.rentalStrategy,
        target_guest_avatar: formData.targetGuestAvatar,
        pricing_goal: formData.pricingGoal,
        expected_adr: formData.expectedAdr,
        minimum_stay: formData.minimumStay,
        max_guests: formData.maxGuests,
        
        // Infrastructure
        wifi_ready: formData.wifiReady,
        wifi_ssid: formData.wifiSsid,
        wifi_password: formData.wifiPassword,
        smart_lock_installed: formData.smartLockInstalled,
        smart_lock_brand: formData.smartLockBrand,
        utilities_setup: formData.utilitiesSetup,
        utilities: formData.utilities,
        has_septic_tank: formData.hasSepticTank,
        septic_last_flushed: formData.septicLastFlushed,
        septic_service_company: formData.septicServiceCompany,
        has_gas_kitchen: formData.hasGasKitchen,
        natural_gas_detector_installed: formData.naturalGasDetectorInstalled,
        water_shutoff_location: formData.waterShutoffLocation,
        breaker_panel_location: formData.breakerPanelLocation,
        gas_shutoff_location: formData.gasShutoffLocation,
        hvac_type: formData.hvacType,
        hvac_service_needs: formData.hvacServiceNeeds,
        
        // Setup status
        setup_status: {
          furniture: { status: formData.furnitureStatus, notes: formData.furnitureNotes },
          kitchen: { status: formData.kitchenStatus, notes: formData.kitchenNotes },
          linens: { status: formData.linensStatus, notes: formData.linensNotes },
          decor: { status: formData.decorStatus, notes: formData.decorNotes },
          outdoor: { status: formData.outdoorStatus, notes: formData.outdoorNotes },
          cleaning_supplies: { status: formData.cleaningSuppliesStatus, notes: formData.cleaningSuppliesNotes },
        },
        
        // Operations
        has_existing_cleaner: formData.hasExistingCleaner,
        cleaner_name: formData.cleanerName,
        cleaner_phone: formData.cleanerPhone,
        cleaner_rate: formData.cleanerRate,
        needs_cleaner_referral: formData.needsCleanerReferral,
        laundry_setup: formData.laundrySetup,
        laundry_notes: formData.laundryNotes,
        supply_storage_location: formData.supplyStorageLocation,
        immediate_repairs: formData.immediateRepairs,
        existing_vendor_relationships: formData.existingVendorRelationships,
        
        // Legal
        str_permit_status: formData.strPermitStatus,
        permit_number: formData.permitNumber,
        hoa_restrictions: formData.hoaRestrictions,
        hoa_notes: formData.hoaNotes,
        hoa_contact_name: formData.hoaContactName,
        hoa_contact_phone: formData.hoaContactPhone,
        insurance_provider: formData.insuranceProvider,
        insurance_policy_number: formData.insurancePolicyNumber,
        has_str_insurance: formData.hasStrInsurance,
        entity_ownership: formData.entityOwnership,
        entity_name: formData.entityName,
        tax_id: formData.taxId,
        insurance_status: formData.insuranceStatus,
        hoa_approval_status: formData.hoaApprovalStatus,
        hoa_rules: formData.hoaRules,
        
        // File URLs
        ...fileUrls,
        
        // Listing preferences
        photography_needs: formData.photographyNeeds,
        photography_notes: formData.photographyNotes,
        listing_title_ideas: formData.listingTitleIdeas,
        unique_selling_points: formData.uniqueSellingPoints,
        needs_design_consultation: formData.needsDesignConsultation,
        
        // House rules & pets
        house_rules: formData.houseRules,
        pet_policy: formData.petPolicy,
        pet_deposit: formData.petDeposit,
        pet_size_restrictions: formData.petSizeRestrictions,
        pets_allowed: formData.petsAllowed,
        pet_deposit_rules: formData.petDepositRules,
        
        // Property details
        property_features: formData.propertyFeatures,
        known_issues: formData.knownIssues,
        neighbor_notes: formData.neighborNotes,
        parking_instructions: formData.parkingInstructions,
        max_vehicles: formData.maxVehicles,
        maintenance_contact: formData.maintenanceContact,
        emergency_contact: formData.emergencyContact,
        emergency_contact_phone: formData.emergencyContactPhone,
        pool_hot_tub_info: formData.poolHotTubInfo,
        special_instructions: formData.specialInstructions,
        
        // Access codes
        alarm_system_code: formData.alarmSystemCode,
        gate_code: formData.gateCode,
        garage_code: formData.garageCode,
        lockbox_location: formData.lockboxLocation,
        lockbox_code: formData.lockboxCode,
        backup_entry_method: formData.backupEntryMethod,
        security_system_status: formData.securitySystemStatus,
        
        // Parking details
        parking_spaces: formData.parkingSpaces,
        parking_type: formData.parkingType,
        parking_hoa_rules: formData.parkingHoaRules,
        
        // Trash
        trash_bin_location: formData.trashBinLocation,
        trash_pickup_day: formData.trashPickupDay,
        
        // Safety
        smoke_detector_status: formData.smokeDetectorStatus,
        fire_extinguisher_present: formData.fireExtinguisherPresent,
        fire_extinguisher_location: formData.fireExtinguisherLocation,
        pool_hot_tub_present: formData.poolHotTubPresent,
      };

      // Call edge function
      const { data, error } = await supabase.functions.invoke('process-new-str-onboarding', {
        body: submissionData,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success("Your property information has been submitted successfully!");
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast.error("Failed to submit form: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return <NewSTRSuccessScreen />;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <PropertyBasicsStep formData={formData} updateFormData={updateFormData} />;
      case 2:
        return <RentalStrategyStep formData={formData} updateFormData={updateFormData} />;
      case 3:
        return <InfrastructureStep formData={formData} updateFormData={updateFormData} />;
      case 4:
        return <SetupStatusStep formData={formData} updateFormData={updateFormData} />;
      case 5:
        return <OperationsPlanningStep formData={formData} updateFormData={updateFormData} />;
      case 6:
        return <LegalComplianceStep formData={formData} updateFormData={updateFormData} />;
      case 7:
        return <DocumentsStep formData={formData} updateFormData={updateFormData} />;
      case 8:
        return <ListingPreferencesStep formData={formData} updateFormData={updateFormData} />;
      case 9:
        return <HouseQuirksStep formData={formData} updateFormData={updateFormData} />;
      case 10:
        return <ReviewStep formData={formData} updateFormData={updateFormData} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(25,100%,98%)] via-[hsl(30,100%,97%)] to-[hsl(20,100%,96%)]">
      {/* Premium Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[hsl(25,40%,90%)] shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {/* Logo and Title */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <img 
                src="/peachhaus-logo.png" 
                alt="PeachHaus" 
                className="h-10 w-auto"
              />
              <div>
                <h1 className="text-lg font-semibold text-[hsl(25,40%,25%)]">New Property Onboarding</h1>
                <p className="text-xs font-medium text-[hsl(25,95%,50%)]">Brand New STR/MTR Properties</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-[hsl(25,40%,35%)]">Step {currentStep} of {STEPS.length}</p>
              <p className="text-xs text-[hsl(25,20%,55%)]">{STEPS[currentStep - 1]?.title}</p>
            </div>
          </div>

          {/* Circular Step Indicators */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto pb-2">
            {STEPS.map((step, index) => {
              const isCompleted = currentStep > step.number;
              const isCurrent = currentStep === step.number;
              const isPending = currentStep < step.number;

              return (
                <div key={step.number} className="flex items-center">
                  {/* Step Circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-300
                        ${isCompleted 
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
                          : isCurrent 
                            ? 'bg-gradient-to-br from-[hsl(25,95%,60%)] to-[hsl(20,90%,50%)] text-white shadow-lg shadow-orange-200 ring-4 ring-orange-100' 
                            : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                        }
                      `}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : step.number}
                    </div>
                    <span className={`
                      text-[10px] mt-1 hidden sm:block font-medium
                      ${isCurrent ? 'text-[hsl(25,95%,45%)]' : isCompleted ? 'text-emerald-600' : 'text-gray-400'}
                    `}>
                      {step.title}
                    </span>
                  </div>
                  
                  {/* Connector Line */}
                  {index < STEPS.length - 1 && (
                    <div className={`
                      w-3 sm:w-6 h-0.5 mx-0.5 sm:mx-1 transition-all duration-300
                      ${currentStep > step.number ? 'bg-emerald-400' : 'bg-gray-200'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-[hsl(25,30%,85%)]/30 border border-[hsl(25,30%,94%)] p-6 sm:p-10">
          {renderStep()}
        </div>
      </div>

      {/* Premium Navigation */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-[hsl(25,40%,90%)] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="gap-2 h-12 px-6 rounded-xl border-2 border-[hsl(25,30%,85%)] hover:bg-[hsl(25,100%,97%)] hover:border-[hsl(25,60%,70%)] transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {currentStep < STEPS.length ? (
            <Button 
              onClick={handleNext} 
              className="gap-2 h-12 px-8 rounded-xl bg-gradient-to-r from-[hsl(25,95%,60%)] to-[hsl(20,90%,50%)] hover:from-[hsl(25,95%,55%)] hover:to-[hsl(20,90%,45%)] shadow-lg shadow-orange-200/50 transition-all duration-200 hover:shadow-xl hover:shadow-orange-200/60"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="gap-2 h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-200/50 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-200/60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Application
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

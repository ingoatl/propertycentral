import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { OwnerOnboardingFormData, initialFormData } from '@/types/owner-onboarding';
import { OwnerInfoStep } from './steps/OwnerInfoStep';
import { AccessDetailsStep } from './steps/AccessDetailsStep';
import { UtilitiesStep } from './steps/UtilitiesStep';
import { OperationsStep } from './steps/OperationsStep';
import { VendorsStep } from './steps/VendorsStep';
import { SafetySecurityStep } from './steps/SafetySecurityStep';
import { DocumentsStep } from './steps/DocumentsStep';
import { FinancialStep } from './steps/FinancialStep';
import { ReviewStep } from './steps/ReviewStep';
import { OnboardingSuccessScreen } from './OnboardingSuccessScreen';

const STEPS = [
  { number: 1, title: 'Owner Info' },
  { number: 2, title: 'Access' },
  { number: 3, title: 'Utilities' },
  { number: 4, title: 'Operations' },
  { number: 5, title: 'Vendors' },
  { number: 6, title: 'Safety' },
  { number: 7, title: 'Documents' },
  { number: 8, title: 'Financial' },
  { number: 9, title: 'Review' },
];

export function OwnerOnboardingForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OwnerOnboardingFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const updateFormData = (updates: Partial<OwnerOnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.owner_name && formData.owner_email && formData.property_address);
      case 2:
        return !!(formData.wifi_ssid && formData.wifi_password && formData.smart_lock_brand && formData.smart_lock_code);
      case 3:
        return !!(formData.wastewater_system && formData.utilities.every(u => u.provider && u.account_number));
      case 4:
        return !!(formData.primary_cleaner && formData.house_quirks);
      case 5:
        return !!(formData.lawncare_provider && formData.pest_control_provider && formData.hvac_service && formData.maintenance_contact && formData.emergency_contact_24_7);
      case 6:
        return !!(formData.fire_extinguisher_locations && formData.water_shutoff_location && formData.breaker_panel_location);
      case 7:
        return !!(formData.government_id_file && formData.property_deed_file && formData.property_tax_statement_file && formData.insurance_provider && formData.insurance_policy_number);
      case 8:
        return !!(formData.average_daily_rate && formData.occupancy_rate && formData.average_monthly_revenue && formData.pricing_revenue_goals);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      toast.error('Please fill in all required fields before continuing');
      return;
    }
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    setCurrentStep((prev) => Math.min(prev + 1, 9));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStepClick = (step: number) => {
    if (step <= currentStep || completedSteps.includes(step - 1)) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const uploadFile = async (file: File, fieldName: string): Promise<string | null> => {
    if (!file) return null;
    
    const sanitizedAddress = formData.property_address.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const timestamp = Date.now();
    const filePath = `${sanitizedAddress}-${timestamp}/${fieldName}-${file.name}`;
    
    const { error } = await supabase.storage
      .from('onboarding-documents')
      .upload(filePath, file);
    
    if (error) {
      console.error(`Error uploading ${fieldName}:`, error);
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from('onboarding-documents')
      .getPublicUrl(filePath);
    
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Upload all files
      const fileUploads: Record<string, string | null> = {};
      
      const fileFields = [
        'government_id_file', 'property_deed_file', 'property_tax_statement_file',
        'mortgage_statement_file', 'entity_documents_file', 'hoa_rules_file',
        'guide_book_file', 'house_manual_file', 'parking_map_file',
        'airbnb_revenue_export_file', 'vrbo_revenue_export_file', 'ownerrez_revenue_export_file',
        'revenue_statement_file', 'expense_report_file'
      ];
      
      for (const field of fileFields) {
        const file = formData[field as keyof OwnerOnboardingFormData] as File | null;
        if (file) {
          const url = await uploadFile(file, field.replace('_file', ''));
          fileUploads[field.replace('_file', '_url')] = url;
        }
      }
      
      // Call edge function to process submission
      const { error } = await supabase.functions.invoke('process-owner-onboarding', {
        body: {
          ...formData,
          ...fileUploads,
          utilities: formData.utilities,
        },
      });
      
      if (error) throw error;
      
      setIsSubmitted(true);
      toast.success('Onboarding form submitted successfully!');
    } catch (error: any) {
      console.error('Submission error:', error);
      toast.error(error.message || 'Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return <OnboardingSuccessScreen />;
  }

  const renderStep = () => {
    const props = { formData, updateFormData };
    
    switch (currentStep) {
      case 1: return <OwnerInfoStep {...props} />;
      case 2: return <AccessDetailsStep {...props} />;
      case 3: return <UtilitiesStep {...props} />;
      case 4: return <OperationsStep {...props} />;
      case 5: return <VendorsStep {...props} />;
      case 6: return <SafetySecurityStep {...props} />;
      case 7: return <DocumentsStep {...props} />;
      case 8: return <FinancialStep {...props} />;
      case 9: return <ReviewStep formData={formData} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(25,100%,98%)] via-[hsl(30,100%,97%)] to-[hsl(20,100%,96%)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[hsl(25,40%,90%)]">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/peachhaus-logo.png" alt="PeachHaus" className="h-12" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-[hsl(25,40%,25%)]">Property Onboarding</h1>
                <p className="text-xs text-[hsl(25,20%,50%)]">Existing STR/MTR Properties</p>
              </div>
            </div>
            {formData.property_address && (
              <div className="text-right">
                <p className="text-xs text-[hsl(25,20%,60%)]">Property</p>
                <p className="text-sm font-medium text-[hsl(25,30%,35%)] truncate max-w-[180px] sm:max-w-[280px]">
                  {formData.property_address}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="sticky top-[85px] z-40 bg-white/95 backdrop-blur-lg border-b border-[hsl(25,30%,92%)] py-4 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex justify-between items-center overflow-x-auto pb-2 gap-1">
            {STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <button
                  onClick={() => handleStepClick(step.number)}
                  className={`flex flex-col items-center min-w-[56px] transition-all duration-300 ${
                    step.number <= currentStep || completedSteps.includes(step.number)
                      ? 'cursor-pointer'
                      : 'cursor-not-allowed opacity-40'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 shadow-sm ${
                      completedSteps.includes(step.number)
                        ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-emerald-200'
                        : step.number === currentStep
                        ? 'bg-gradient-to-br from-[hsl(25,95%,65%)] to-[hsl(20,90%,55%)] text-white shadow-orange-200'
                        : 'bg-[hsl(25,20%,94%)] text-[hsl(25,15%,50%)]'
                    }`}
                  >
                    {completedSteps.includes(step.number) ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span className={`text-[10px] mt-1.5 text-center font-medium hidden sm:block transition-colors ${
                    step.number === currentStep ? 'text-[hsl(25,60%,45%)]' : 'text-[hsl(25,15%,55%)]'
                  }`}>
                    {step.title}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`w-4 sm:w-8 h-0.5 mx-1 rounded-full transition-colors ${
                    completedSteps.includes(step.number) ? 'bg-emerald-400' : 'bg-[hsl(25,20%,90%)]'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 pb-36">
        <div className="bg-white rounded-3xl shadow-xl shadow-[hsl(25,30%,85%)]/30 p-6 sm:p-10 border border-[hsl(25,30%,94%)]">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(25,35%,25%)] mb-2">
              {STEPS[currentStep - 1].title}
            </h2>
            <p className="text-[hsl(25,15%,55%)]">
              Step {currentStep} of {STEPS.length}
            </p>
          </div>
          {renderStep()}
        </div>
      </main>

      {/* Fixed Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-[hsl(25,30%,92%)] p-4 shadow-2xl shadow-black/5">
        <div className="max-w-4xl mx-auto flex justify-between gap-4">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-6 py-3.5 rounded-2xl font-semibold transition-all duration-300 ${
              currentStep === 1
                ? 'bg-[hsl(25,15%,95%)] text-[hsl(25,10%,70%)] cursor-not-allowed'
                : 'bg-[hsl(25,15%,94%)] text-[hsl(25,25%,40%)] hover:bg-[hsl(25,20%,90%)] active:scale-[0.98]'
            }`}
          >
            Back
          </button>
          
          {currentStep === 9 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3.5 bg-gradient-to-r from-[hsl(25,95%,65%)] to-[hsl(20,90%,55%)] text-white rounded-2xl font-semibold hover:from-[hsl(25,95%,60%)] hover:to-[hsl(20,90%,50%)] transition-all duration-300 disabled:opacity-50 shadow-lg shadow-orange-200/50 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Submit Onboarding'
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3.5 bg-gradient-to-r from-[hsl(25,95%,65%)] to-[hsl(20,90%,55%)] text-white rounded-2xl font-semibold hover:from-[hsl(25,95%,60%)] hover:to-[hsl(20,90%,50%)] transition-all duration-300 shadow-lg shadow-orange-200/50 active:scale-[0.98]"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

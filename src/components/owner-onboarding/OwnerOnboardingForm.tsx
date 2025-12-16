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
    <div className="min-h-screen bg-[hsl(25,100%,98%)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[hsl(25,30%,90%)] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <img src="/peachhaus-logo.png" alt="PeachHaus" className="h-10" />
            {formData.property_address && (
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                {formData.property_address}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="sticky top-[73px] z-40 bg-white/90 backdrop-blur-sm border-b border-[hsl(25,30%,90%)] py-3">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex justify-between items-center overflow-x-auto pb-2">
            {STEPS.map((step) => (
              <button
                key={step.number}
                onClick={() => handleStepClick(step.number)}
                className={`flex flex-col items-center min-w-[60px] transition-all ${
                  step.number <= currentStep || completedSteps.includes(step.number)
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed opacity-50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    completedSteps.includes(step.number)
                      ? 'bg-green-500 text-white'
                      : step.number === currentStep
                      ? 'bg-[hsl(25,95%,65%)] text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {completedSteps.includes(step.number) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step.number
                  )}
                </div>
                <span className="text-xs mt-1 text-center hidden sm:block">{step.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {renderStep()}
        </div>
      </main>

      {/* Fixed Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between gap-4">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              currentStep === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Back
          </button>
          
          {currentStep === 9 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-[hsl(25,95%,65%)] text-white rounded-xl font-medium hover:bg-[hsl(25,95%,55%)] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Onboarding'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-[hsl(25,95%,65%)] text-white rounded-xl font-medium hover:bg-[hsl(25,95%,55%)] transition-all"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

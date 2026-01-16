import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, FileText, User, Edit, CheckCircle, Send } from "lucide-react";
import TemplateSelectStep from "./wizard/TemplateSelectStep";
import GuestInfoStep from "./wizard/GuestInfoStep";
import FillDocumentStep from "./wizard/FillDocumentStep";
import CreateAndSendStep from "./wizard/CreateAndSendStep";

export interface DetectedField {
  api_id: string;
  label: string;
  type: "text" | "number" | "date" | "email" | "phone" | "textarea" | "checkbox" | "signature";
  filled_by: "admin" | "guest" | "tenant";
  category: "property" | "financial" | "dates" | "occupancy" | "contact" | "identification" | "vehicle" | "emergency" | "acknowledgment" | "signature" | "other";
  description?: string;
  required?: boolean;
  // Position data from field_mappings
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  page?: number;
}

interface CustomClause {
  id: string;
  title: string;
  content: string;
}

export interface WizardData {
  templateId: string | null;
  templateName: string | null;
  propertyId: string | null;
  propertyName: string | null;
  bookingId: string | null;
  guestName: string;
  guestEmail: string;
  documentName: string;
  detectedFields: DetectedField[];
  fieldValues: Record<string, string | boolean>;
  // Native signing URLs
  guestSigningUrl: string | null;
  hostSigningUrl: string | null;
  // Edit document content
  documentContent: string;
  // Import source tracking
  importSource: string | null;
  importedFields: string[];
}

// Streamlined 4-step wizard
const STEPS = [
  { id: 1, title: "Select Template", icon: FileText },
  { id: 2, title: "Guest Info", icon: User },
  { id: 3, title: "Fill & Review", icon: Edit },
  { id: 4, title: "Create & Send", icon: Send },
];

const DocumentCreateWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    templateId: null,
    templateName: null,
    propertyId: null,
    propertyName: null,
    bookingId: null,
    guestName: "",
    guestEmail: "",
    documentName: "",
    detectedFields: [],
    fieldValues: {},
    guestSigningUrl: null,
    hostSigningUrl: null,
    documentContent: "",
    importSource: null,
    importedFields: [],
  });

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  };

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!wizardData.templateId;
      case 2:
        return wizardData.guestName.trim() !== "" && wizardData.guestEmail.trim() !== "";
      case 3:
        return true; // Fill & Review - always can proceed
      case 4:
        return true; // Create & Send step - handled internally
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <TemplateSelectStep data={wizardData} updateData={updateWizardData} />;
      case 2:
        return <GuestInfoStep data={wizardData} updateData={updateWizardData} />;
      case 3:
        return <FillDocumentStep data={wizardData} updateData={updateWizardData} />;
      case 4:
        return <CreateAndSendStep data={wizardData} updateData={updateWizardData} onComplete={() => setCurrentStep(1)} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-lg">Create New Document</CardTitle>
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {STEPS.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex justify-between">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center gap-1 ${
                    isActive
                      ? "text-primary"
                      : isCompleted
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                        ? "bg-green-100 text-green-600"
                        : "bg-muted"
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-xs hidden sm:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">{renderStep()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {currentStep < STEPS.length && (
          <Button onClick={() => setCurrentStep((prev) => prev + 1)} disabled={!canProceed()}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default DocumentCreateWizard;

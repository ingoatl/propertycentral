import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, FileText, Building, User, Edit, CheckCircle, PenTool, FileEdit, ToggleLeft } from "lucide-react";
import TemplateSelectStep from "./wizard/TemplateSelectStep";
import PropertyLinkStep from "./wizard/PropertyLinkStep";
import GuestInfoStep from "./wizard/GuestInfoStep";
import EditDocumentStep from "./wizard/EditDocumentStep";
import AssignFieldsStep from "./wizard/AssignFieldsStep";
import PreFillFieldsStep from "./wizard/PreFillFieldsStep";
import VisualEditorStep from "./wizard/VisualEditorStep";
import ReviewCreateStep from "./wizard/ReviewCreateStep";

export interface DetectedField {
  api_id: string;
  label: string;
  type: "text" | "number" | "date" | "email" | "phone" | "textarea" | "checkbox" | "signature";
  filled_by: "admin" | "guest";
  category: "property" | "financial" | "dates" | "occupancy" | "contact" | "identification" | "vehicle" | "emergency" | "acknowledgment" | "signature" | "other";
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
  fieldAssignments: Record<string, "admin" | "guest">;
  signwellDocumentId: string | null;
  embeddedEditUrl: string | null;
  guestSigningUrl: string | null;
  hostSigningUrl: string | null;
}

const STEPS = [
  { id: 1, title: "Select Template", icon: FileText },
  { id: 2, title: "Link Property", icon: Building },
  { id: 3, title: "Guest Info", icon: User },
  { id: 4, title: "Edit Document", icon: FileEdit },
  { id: 5, title: "Assign Fields", icon: ToggleLeft },
  { id: 6, title: "Fill Values", icon: Edit },
  { id: 7, title: "Place Fields", icon: PenTool },
  { id: 8, title: "Review & Send", icon: CheckCircle },
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
    fieldAssignments: {},
    signwellDocumentId: null,
    embeddedEditUrl: null,
    guestSigningUrl: null,
    hostSigningUrl: null,
  });

  const updateWizardData = useCallback((updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  }, []);

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!wizardData.templateId;
      case 2:
        return true; // Property link is optional
      case 3:
        return wizardData.guestName.trim() !== "" && wizardData.guestEmail.trim() !== "";
      case 4:
        return !!wizardData.signwellDocumentId; // Must create draft to edit
      case 5:
        return Object.keys(wizardData.fieldAssignments).length > 0 || wizardData.detectedFields.length === 0;
      case 6:
        return true; // Fill values is optional
      case 7:
        return !!wizardData.signwellDocumentId; // Document must exist
      case 8:
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <TemplateSelectStep data={wizardData} updateData={updateWizardData} />;
      case 2:
        return <PropertyLinkStep data={wizardData} updateData={updateWizardData} />;
      case 3:
        return <GuestInfoStep data={wizardData} updateData={updateWizardData} />;
      case 4:
        return <EditDocumentStep data={wizardData} updateData={updateWizardData} />;
      case 5:
        return <AssignFieldsStep data={wizardData} updateData={updateWizardData} />;
      case 6:
        return <PreFillFieldsStep data={wizardData} updateData={updateWizardData} />;
      case 7:
        return <VisualEditorStep data={wizardData} updateData={updateWizardData} />;
      case 8:
        return <ReviewCreateStep data={wizardData} updateData={updateWizardData} onComplete={() => setCurrentStep(1)} />;
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

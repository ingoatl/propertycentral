import { NewSTROnboardingFormData } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileText, Upload, CheckCircle } from "lucide-react";

interface DocumentsStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const DocumentsStep = ({ formData, updateFormData }: DocumentsStepProps) => {
  const handleFileChange = (field: keyof NewSTROnboardingFormData, file: File | null) => {
    updateFormData({ [field]: file });
  };

  const documents = [
    {
      field: 'governmentIdFile' as const,
      title: 'Government ID',
      description: "Driver's license or passport",
      required: true,
    },
    {
      field: 'propertyDeedFile' as const,
      title: 'Property Deed',
      description: 'Proof of property ownership',
      required: false,
    },
    {
      field: 'mortgageStatementFile' as const,
      title: 'Mortgage Statement',
      description: 'Recent mortgage statement (if applicable)',
      required: false,
    },
    {
      field: 'entityDocumentsFile' as const,
      title: 'Entity Documents',
      description: 'LLC/Corp formation documents (if applicable)',
      required: false,
    },
    {
      field: 'insuranceCertificateFile' as const,
      title: 'Insurance Certificate',
      description: 'Proof of property insurance',
      required: false,
    },
    {
      field: 'hoaRulesFile' as const,
      title: 'HOA Rules/CC&Rs',
      description: 'HOA governing documents (if applicable)',
      required: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Documents & Ownership</h2>
        <p className="text-muted-foreground mt-2">Upload important documents for your property file</p>
      </div>

      <Card className="bg-muted/50 mb-6">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Privacy Note:</strong> All documents are securely stored and only accessible 
            to authorized PeachHaus team members. We use bank-level encryption to protect your information.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documents.map((doc) => {
          const file = formData[doc.field] as File | null;
          const hasFile = !!file;

          return (
            <Card key={doc.field} className={hasFile ? 'border-primary/50 bg-primary/5' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {hasFile ? (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  ) : (
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  )}
                  {doc.title}
                  {doc.required && <span className="text-destructive">*</span>}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{doc.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor={doc.field} className="sr-only">
                    Upload {doc.title}
                  </Label>
                  <div className="relative">
                    <Input
                      id={doc.field}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleFileChange(doc.field, file);
                      }}
                      className="cursor-pointer file:cursor-pointer file:bg-primary file:text-primary-foreground file:border-0 file:rounded file:px-3 file:py-1 file:mr-3 file:text-sm"
                    />
                  </div>
                  {hasFile && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      {file.name}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Accepted formats:</strong> PDF, JPG, PNG, DOC, DOCX (max 10MB per file)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

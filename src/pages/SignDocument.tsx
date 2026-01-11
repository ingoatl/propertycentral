import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp, ArrowRight, Check, FileText, List, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Document, Page, pdfjs } from "react-pdf";
import { InlineField, FieldData } from "@/components/signing/InlineField";
import { InlineSignature } from "@/components/signing/InlineSignature";
import { FireworksEffect } from "@/components/signing/FireworksEffect";
import { GooglePlacesAutocomplete } from "@/components/ui/google-places-autocomplete";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SigningData {
  valid: boolean;
  tokenId: string;
  documentId: string;
  documentName: string;
  contractType: string;
  signerName: string;
  signerEmail: string;
  signerType: string;
  pdfUrl: string | null;
  signers: {
    name: string;
    email: string;
    type: string;
    order: number;
    signed: boolean;
    signedAt: string | null;
  }[];
  expiresAt: string;
  fields: FieldData[];
  savedFieldValues: Record<string, string | boolean>;
}

// Hook to detect mobile device
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  return isMobile;
};

const SignDocument = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isMobile = useIsMobile();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SigningData | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(true); // Signing is consent
  const [isComplete, setIsComplete] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  
  // PDF states
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.0);
  const [pageWidth, setPageWidth] = useState(800);
  const [pdfPageHeights, setPdfPageHeights] = useState<Map<number, number>>(new Map());
  
  // Field interaction states
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [showSignatureFor, setShowSignatureFor] = useState<string | null>(null);
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());
  const [showFieldList, setShowFieldList] = useState(false);
  
  // Mobile-specific: Toggle between PDF view and Mobile Focus (field list) view
  const [mobileViewMode, setMobileViewMode] = useState<"pdf" | "fields">("pdf"); // Default to PDF view

  // Company logo URL
  const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";

  // Show branded loading immediately to prevent flash
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-center">
          <img 
            src={LOGO_URL} 
            alt="PeachHaus" 
            className="h-16 mx-auto mb-4"
            onError={(e) => {
              // Fallback to P icon if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden w-16 h-16 mx-auto mb-4 rounded-lg bg-[#fae052] flex items-center justify-center">
            <span className="text-[#1a1a2e] font-bold text-2xl">P</span>
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-[#fae052] mx-auto mb-3" />
          <p className="text-white/80 text-sm">Loading your document...</p>
        </div>
      </div>
    );
  }

  // Filter fields for current signer
  // Owner 2 fields are NOT mandatory - they become active only when clicked
  const allGuestFields = (data?.fields || []).filter(f => f.filled_by === "guest");
  const adminFields = (data?.fields || []).filter(f => f.filled_by === "admin");
  
  // Determine if a field belongs to Owner 2 (secondary signer) based on label, api_id, or group
  const isOwner2Field = (f: FieldData) => {
    const label = f.label.toLowerCase();
    const apiId = f.api_id.toLowerCase();
    // Check both label and api_id for owner 2 patterns
    return label.includes("owner 2") || label.includes("owner2") || label.includes("second owner") ||
           apiId.includes("owner2") || apiId.includes("owner_2") || apiId.includes("second_owner");
  };
  
  // Determine if a field belongs to Manager based on label, api_id
  const isManagerField = (f: FieldData) => {
    const label = f.label.toLowerCase();
    const apiId = f.api_id.toLowerCase();
    return label.includes("manager") || apiId.includes("manager") || 
           label.includes("peachhaus") || apiId.includes("peachhaus") ||
           f.filled_by === "admin";
  };
  
  // Determine if a field is an address field (for Google Places autocomplete)
  const isAddressField = (f: FieldData) => {
    const label = f.label.toLowerCase();
    const apiId = f.api_id.toLowerCase();
    return label.includes("address") || apiId.includes("address") ||
           label.includes("property location") || apiId.includes("property_location");
  };
  
  // Determine if current signer is admin/manager
  const isAdminSigner = data?.signerType === "manager" || data?.signerType === "host";
  
  // Determine if current signer is Owner 2 (second_owner)
  const isOwner2Signer = data?.signerType === "second_owner";
  
  // Required fields are: Owner 1 fields that are marked required + radio groups (one selection per group)
  // Admin signers see admin fields, guest signers see guest fields
  const signerFields = isAdminSigner ? adminFields : allGuestFields;
  
  // Debug: Log field detection
  useEffect(() => {
    if (signerFields.length > 0) {
      const signatureFields = signerFields.filter(f => f.type === "signature");
      console.log("All signature fields:", signatureFields.map(f => ({ api_id: f.api_id, label: f.label })));
      console.log("Owner 1 signature fields:", signatureFields.filter(f => !isOwner2Field(f)).map(f => f.api_id));
      console.log("Owner 2 signature fields:", signatureFields.filter(f => isOwner2Field(f)).map(f => f.api_id));
    }
  }, [signerFields.length]);
  
  // Get all unique radio groups
  const radioGroups = new Set<string>();
  signerFields.filter(f => f.type === "radio" && f.group_name).forEach(f => radioGroups.add(f.group_name!));
  
  // Check if a radio group is complete (at least one selected)
  const isRadioGroupComplete = (groupName: string) => {
    const groupFields = signerFields.filter(f => f.type === "radio" && f.group_name === groupName);
    return groupFields.some(f => fieldValues[f.api_id] === true);
  };
  
  // Helper to detect date fields
  const isDateField = (f: FieldData) => {
    return f.type === "date" || 
           f.label.toLowerCase().includes("date") ||
           f.api_id.toLowerCase().includes("date");
  };
  
  // Calculate required fields for current signer
  const requiredFields = signerFields.filter(f => {
    if (isAdminSigner) {
      // For admin: only signature fields are required
      return f.type === "signature";
    }
    // For guests: exclude Owner 2 fields, radio groups, date fields
    if (isOwner2Field(f)) return false; // Owner 2 fields are optional
    if (f.type === "radio") return false; // Radio handled separately by group
    if (isDateField(f)) return false; // Date fields are auto-filled by admin
    return f.required;
  });
  
  // Count completed required fields
  const completedRequired = requiredFields.filter(f => {
    if (f.type === "signature") {
      // Owner 2 signature fields don't count against Owner 1's progress
      if (isOwner2Field(f)) return true;
      return !!signatureData;
    }
    return completedFields.has(f.api_id);
  }).length;
  
  // Total required = required fields + radio groups (each group counts as 1)
  const totalRequired = requiredFields.length + radioGroups.size;
  
  // Completed radio groups
  const completedRadioGroups = Array.from(radioGroups).filter(g => isRadioGroupComplete(g)).length;
  
  // Total completed
  const totalCompleted = completedRequired + completedRadioGroups;
  
  // Remaining fields to complete
  const remainingCount = totalRequired - totalCompleted;

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth - 32, 900);
        setPageWidth(width);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const validateToken = async () => {
    console.log("validateToken called with token:", token?.substring(0, 8) + "...");
    try {
      const { data: result, error } = await supabase.functions.invoke("validate-signing-token", {
        body: { token },
      });

      console.log("validateToken response:", { result, error });

      if (error) throw error;
      
      if (result?.error) {
        console.log("Server returned error:", result.error);
        setError(result.error);
      } else if (!result) {
        console.log("No result returned from server");
        setError("No response from server");
      } else {
        setData(result);
        
        // Initialize field values
        const initialValues: Record<string, string | boolean> = {};
        const completed = new Set<string>();
        
        // Determine if current signer is admin (last signer)
        const isAdminSignerFromResult = result.signerType === "manager" || result.signerType === "host";
        
        // Helper to detect Owner 2 fields
        const isOwner2FieldCheck = (f: FieldData) => {
          const label = f.label.toLowerCase();
          const apiId = f.api_id.toLowerCase();
          return label.includes("owner 2") || label.includes("owner2") || label.includes("second owner") ||
                 apiId.includes("owner2") || apiId.includes("owner_2") || apiId.includes("second_owner");
        };
        
        // Helper to detect Manager fields
        const isManagerFieldCheck = (f: FieldData) => {
          const label = f.label.toLowerCase();
          const apiId = f.api_id.toLowerCase();
          return label.includes("manager") || apiId.includes("manager");
        };
        
        // Helper to detect date fields
        const isDateFieldCheck = (f: FieldData) => {
          return f.type === "date" || 
                 f.label.toLowerCase().includes("date") ||
                 f.api_id.toLowerCase().includes("date");
        };
        
        // Get current EST date in YYYY-MM-DD format
        const getESTDate = () => {
          const now = new Date();
          return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // en-CA gives YYYY-MM-DD
        };
        const estDate = getESTDate();
        
        result.fields?.forEach((field: FieldData) => {
          // Always load saved values from previous signers (like Owner 1 name, signature, etc.)
          if (result.savedFieldValues?.[field.api_id] !== undefined) {
            const savedValue = result.savedFieldValues[field.api_id];
            
            // Don't load saved signatures for admin/manager - they sign fresh
            if (field.type === "signature" && isAdminSignerFromResult) {
              initialValues[field.api_id] = "";
              // Don't add to completed - manager needs to sign
            } else {
              initialValues[field.api_id] = savedValue;
              if (savedValue) {
                completed.add(field.api_id);
              }
            }
          } else if (field.type === "checkbox") {
            initialValues[field.api_id] = false;
          } else if (isDateFieldCheck(field)) {
            // Date fields: Only auto-fill for the CURRENT signer's date fields
            // Owner 1 sees Owner 1 date auto-filled, NOT Owner 2 or Manager dates
            // Owner 2 sees Owner 2 date auto-filled (if they're signing)
            // Manager sees Manager date auto-filled
            const isOwner2Date = isOwner2FieldCheck(field);
            const isManagerDate = isManagerFieldCheck(field);
            const isSecondOwnerSigner = result.signerType === "second_owner";
            
            // Determine if this date field belongs to current signer
            const shouldAutoFill = 
              (isAdminSignerFromResult && isManagerDate) || // Manager fills manager dates
              (isSecondOwnerSigner && isOwner2Date) || // Second owner fills owner 2 dates
              (result.signerType === "owner" && !isOwner2Date && !isManagerDate); // Owner 1 fills owner 1 dates
            
            if (shouldAutoFill) {
              initialValues[field.api_id] = estDate;
              completed.add(field.api_id);
            } else {
              // Leave other signers' date fields empty - they'll fill when they sign
              initialValues[field.api_id] = "";
            }
          } else {
            initialValues[field.api_id] = "";
          }
        });
        setFieldValues(initialValues);
        setCompletedFields(completed);
      }
    } catch (err: any) {
      console.error("Error validating token:", err);
      setError(err.message || "Failed to validate signing link");
    } finally {
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = useCallback((pageNum: number, page: any) => {
    setPdfPageHeights(prev => {
      const next = new Map(prev);
      next.set(pageNum, page.height);
      return next;
    });
  }, []);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true;
    const digitsOnly = phone.replace(/\D/g, "");
    return digitsOnly.length >= 10 && digitsOnly.length <= 11;
  };

  const handleFieldChange = (fieldId: string, value: string | boolean, field?: FieldData) => {
    // For radio fields, clear other selections in the same group
    if (field?.type === "radio" && field.group_name && value === true) {
      const groupFields = [...signerFields, ...adminFields].filter(
        f => f.type === "radio" && f.group_name === field.group_name && f.api_id !== fieldId
      );
      
      setFieldValues(prev => {
        const next = { ...prev, [fieldId]: value };
        groupFields.forEach(f => {
          next[f.api_id] = false;
        });
        return next;
      });
      
      setCompletedFields(prev => {
        const next = new Set(prev);
        next.add(fieldId);
        // Don't remove group fields from completed - the group itself is complete
        return next;
      });
      return;
    }
    
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
    
    if (value || value === false) {
      setCompletedFields(prev => new Set([...prev, fieldId]));
    } else {
      setCompletedFields(prev => {
        const next = new Set(prev);
        next.delete(fieldId);
        return next;
      });
    }
  };

  // Track separate signatures for Owner 1 and Owner 2
  const [owner2SignatureData, setOwner2SignatureData] = useState<string | null>(null);
  
  const handleSignatureAdopt = (sigData: string) => {
    const currentSignatureField = signerFields.find(f => f.api_id === showSignatureFor);
    
    console.log("Adopting signature for field:", showSignatureFor, "isAdminSigner:", isAdminSigner);
    console.log("Current signature field:", currentSignatureField);
    
    if (isAdminSigner) {
      // Admin is signing - apply to admin signature fields
      console.log("Setting Admin signature data");
      setSignatureData(sigData);
      const adminSigFields = signerFields.filter(f => f.type === "signature");
      adminSigFields.forEach(f => {
        setCompletedFields(prev => new Set([...prev, f.api_id]));
      });
      toast.success("Signature adopted!");
    } else if (currentSignatureField && isOwner2Field(currentSignatureField)) {
      // Owner 2 is signing - only apply to Owner 2 fields
      console.log("Setting Owner 2 signature data");
      setOwner2SignatureData(sigData);
      setCompletedFields(prev => new Set([...prev, currentSignatureField.api_id]));
      toast.success("Owner 2 signature adopted!");
    } else {
      // Owner 1 is signing - only apply to Owner 1 signature fields
      console.log("Setting Owner 1 signature data");
      setSignatureData(sigData);
      const owner1SigFields = signerFields.filter(f => f.type === "signature" && !isOwner2Field(f));
      console.log("Owner 1 signature fields to mark complete:", owner1SigFields.map(f => f.api_id));
      owner1SigFields.forEach(f => {
        setCompletedFields(prev => new Set([...prev, f.api_id]));
      });
      toast.success("Signature adopted!");
    }
    
    setShowSignatureFor(null);
  };

  const handleSubmitSignature = async () => {
    console.log("handleSubmitSignature called - signatureData:", !!signatureData, "agreedToTerms:", agreedToTerms);
    
    if (!signatureData) {
      console.log("ERROR: No signature data found!");
      toast.error("Please add your signature");
      return;
    }

    // Removed terms agreement check - signing IS consent

    // Check required fields for current signer (Owner 2 fields are optional for guests)
    const missingFields: FieldData[] = [];
    const checkedRadioGroups = new Set<string>();
    
    for (const f of signerFields) {
      // Skip Owner 2 fields for guest signers - they're optional
      if (!isAdminSigner && isOwner2Field(f)) {
        console.log(`Skipping Owner 2 field: ${f.api_id}`);
        continue;
      }
      
      // Skip date fields - they are auto-filled for admin
      if (isDateField(f)) {
        continue;
      }
      
      // Handle radio groups - only check once per group
      if (f.type === "radio" && f.group_name) {
        if (checkedRadioGroups.has(f.group_name)) continue;
        checkedRadioGroups.add(f.group_name);
        
        if (!isRadioGroupComplete(f.group_name)) {
          console.log(`Missing radio group: ${f.group_name}`);
          missingFields.push(f);
        }
        continue;
      }
      
      // Skip non-required and checkboxes
      if (!f.required) continue;
      if (f.type === "checkbox") continue;
      
      // Check signature - but we already verified signatureData exists above
      if (f.type === "signature") {
        console.log(`Checking signature field ${f.api_id}: signatureData=${!!signatureData}`);
        // Skip - signature is already verified at the top
        continue;
      }
      
      // Check other fields
      if (!fieldValues[f.api_id]) {
        console.log(`Missing field: ${f.api_id} (${f.label}), value:`, fieldValues[f.api_id]);
        missingFields.push(f);
      }
      
      // Validate email format
      if (f.type === "email" && fieldValues[f.api_id] && !validateEmail(fieldValues[f.api_id] as string)) {
        toast.error(`Invalid email format for: ${f.label}`);
        navigateToField(f);
        return;
      }
      
      // Validate phone format
      if (f.type === "phone" && fieldValues[f.api_id] && !validatePhone(fieldValues[f.api_id] as string)) {
        toast.error(`Invalid phone number for: ${f.label}. Please enter 10-11 digits.`);
        navigateToField(f);
        return;
      }
    }
    
    console.log("Missing fields count:", missingFields.length);
    console.log("Missing fields:", missingFields.map(f => ({ api_id: f.api_id, label: f.label, type: f.type })));

    if (missingFields.length > 0) {
      const firstMissing = missingFields[0];
      const label = firstMissing.type === "radio" && firstMissing.group_name 
        ? `Select a ${firstMissing.group_name.replace(/_/g, ' ')}`
        : firstMissing.label;
      toast.error(`Please complete: ${label}`);
      navigateToField(firstMissing);
      return;
    }

    setSubmitting(true);

    try {
      const { data: result, error } = await supabase.functions.invoke("submit-signature", {
        body: {
          token,
          signatureData,
          agreedToTerms,
          fieldValues,
        },
      });

      if (error) throw error;

      if (result.error) {
        toast.error(result.error);
      } else {
        setIsComplete(true);
        toast.success(result.message);
      }
    } catch (err: any) {
      console.error("Error submitting signature:", err);
      toast.error(err.message || "Failed to submit signature");
    } finally {
      setSubmitting(false);
    }
  };

  const navigateToField = (field: FieldData) => {
    const pageEl = pageRefs.current.get(field.page);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    
    setActiveFieldId(null);
    setShowSignatureFor(null);
    
    setTimeout(() => {
      if (field.type === "signature") {
        setShowSignatureFor(field.api_id);
      } else {
        setActiveFieldId(field.api_id);
      }
    }, 300);
  };

  // Sort fields STRICTLY by page, then Y (top to bottom), then X (left to right)
  // Using a smaller threshold to ensure proper ordering
  const sortedSignerFields = [...signerFields].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    // Primary sort by Y - round to nearest integer for comparison
    const yA = Math.round(a.y);
    const yB = Math.round(b.y);
    if (yA !== yB) return yA - yB;
    // Same Y level, sort by X
    return a.x - b.x;
  });

  // Check if a field is incomplete - Owner 2 fields and date fields are considered complete
  const isFieldIncomplete = (f: FieldData) => {
    // Admin signer - don't apply Owner 2 field logic
    if (isAdminSigner) {
      if (f.type === "signature") return !signatureData;
      if (f.type === "radio" && f.group_name) return !isRadioGroupComplete(f.group_name);
      if (f.type === "checkbox") return false;
      if (isDateField(f)) return false; // Date fields auto-filled
      const val = fieldValues[f.api_id];
      return val === undefined || val === null || val === "" || val === false;
    }
    
    // Owner 2 fields are optional, never considered incomplete for navigation
    if (isOwner2Field(f)) return false;
    
    // Date fields are auto-filled, never incomplete
    if (isDateField(f)) return false;
    
    if (f.type === "signature") {
      const incomplete = !signatureData;
      console.log(`Checking signature field ${f.api_id}: signatureData=${!!signatureData}, incomplete=${incomplete}`);
      return incomplete;
    }
    if (f.type === "radio" && f.group_name) {
      // For radio groups, check if ANY field in the group is selected
      return !isRadioGroupComplete(f.group_name);
    }
    if (f.type === "checkbox") return false; // Checkboxes are never required for navigation
    
    // For text, email, phone fields - check if value exists and is not empty
    const val = fieldValues[f.api_id];
    return val === undefined || val === null || val === "" || val === false;
  };

  // Get fields that need to be completed in document order
  const getRequiredIncompleteFields = () => {
    const seenGroups = new Set<string>();
    const result: FieldData[] = [];
    
    for (const f of sortedSignerFields) {
      // Skip Owner 2 fields entirely (only for guest signers)
      if (!isAdminSigner && isOwner2Field(f)) continue;
      
      // For radio groups - only add ONE field per incomplete group
      if (f.type === "radio" && f.group_name) {
        // Skip if we've already handled this group
        if (seenGroups.has(f.group_name)) continue;
        seenGroups.add(f.group_name);
        
        // If group is complete, skip it
        if (isRadioGroupComplete(f.group_name)) continue;
        
        // Group is incomplete - add the first radio of this group
        result.push(f);
        continue;
      }
      
      // For non-radio fields, add if incomplete
      if (isFieldIncomplete(f)) {
        result.push(f);
      }
    }
    
    return result;
  };

  const findNextIncompleteField = () => {
    return getRequiredIncompleteFields()[0];
  };

  const handleStart = () => {
    const firstIncomplete = findNextIncompleteField();
    if (firstIncomplete) {
      navigateToField(firstIncomplete);
    }
  };

  const handleNext = () => {
    const incompleteFields = getRequiredIncompleteFields();
    
    if (incompleteFields.length === 0) {
      toast.success("All fields complete! Click FINISH to submit.");
      return;
    }
    
    const currentId = activeFieldId || showSignatureFor;
    
    // If no current field, go to first incomplete
    if (!currentId) {
      navigateToField(incompleteFields[0]);
      return;
    }
    
    // Find current field's position in document order
    const currentField = sortedSignerFields.find(f => f.api_id === currentId);
    if (!currentField) {
      navigateToField(incompleteFields[0]);
      return;
    }
    
    // Find current field index in the sorted incomplete list
    const currentIdx = sortedSignerFields.findIndex(f => f.api_id === currentId);
    
    // Find the next incomplete field after current position in sorted order
    for (let i = currentIdx + 1; i < sortedSignerFields.length; i++) {
      const f = sortedSignerFields[i];
      if (!isAdminSigner && isOwner2Field(f)) continue;
      
      // Check if this field is in our incomplete list
      const isIncomplete = incompleteFields.some(inc => inc.api_id === f.api_id);
      if (isIncomplete) {
        navigateToField(f);
        return;
      }
    }
    
    // If no field after current, wrap to first incomplete
    navigateToField(incompleteFields[0]);
  };

  // Check if all required fields are complete (excluding Owner 2 fields)
  const radioGroupsComplete = Array.from(radioGroups).every(groupName => isRadioGroupComplete(groupName));
  
  const nonRadioFieldsComplete = requiredFields.every(f => {
    if (f.type === "signature") {
      // Owner 2 signature fields should not block Owner 1 from completing
      if (isOwner2Field(f)) return true;
      const complete = !!signatureData;
      console.log(`Validation - signature field ${f.api_id}: signatureData=${!!signatureData}, complete=${complete}`);
      return complete;
    }
    if (f.type === "checkbox") return true;
    return !!fieldValues[f.api_id];
  });
  
  // Log overall completion status
  console.log(`Completion status: radioGroupsComplete=${radioGroupsComplete}, nonRadioFieldsComplete=${nonRadioFieldsComplete}, signatureData=${!!signatureData}, agreedToTerms=${agreedToTerms}`);
  
  
  const allRequiredComplete = radioGroupsComplete && nonRadioFieldsComplete;
  const canFinish = signatureData && allRequiredComplete; // Removed agreedToTerms requirement

  // For admin: show ALL fields (guest + admin) so they can see owner-filled data
  // For guest: show only signerFields (guest fields) + admin fields as read-only
  const getFieldsForPage = (pageNum: number) => {
    const allFields = data?.fields || [];
    return allFields.filter(f => f.page === pageNum);
  };

  // Loading state is now handled at the top of the component with branded loading screen

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center border">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[#333] mb-2">Unable to Load Document</h1>
          <p className="text-[#666] mb-6">{error}</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  // Handle case where loading finished but no data (shouldn't happen, but safety check)
  if (!loading && !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center border">
          <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[#333] mb-2">Document Not Found</h1>
          <p className="text-[#666] mb-6">The signing link may be invalid or expired. Please check your email for a valid link or contact support.</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    // Show fireworks only for owner signers
    const isOwnerSigner = data?.signerType === 'owner' || data?.signerType === 'second_owner';
    
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4 font-signing">
        {/* Fireworks effect for owner signers */}
        <FireworksEffect show={isOwnerSigner} />
        
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center border relative z-10">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#333] mb-2">
            {isOwnerSigner ? "🎉 Congratulations!" : "Signing Complete!"}
          </h1>
          <p className="text-[#666] mb-6">
            {isOwnerSigner 
              ? `Thank you, ${data?.signerName}! Welcome to the PeachHaus family. Your signature has been recorded.`
              : `Thank you, ${data?.signerName}. Your signature has been recorded.`
            }
          </p>
          <div className="bg-[#f8f8f8] rounded p-4 text-left mb-4 border">
            <p className="text-xs text-[#888] mb-1">Document</p>
            <p className="font-medium text-[#333]">{data?.documentName}</p>
          </div>
          <p className="text-sm text-[#888]">
            A confirmation will be sent to {data?.signerEmail}
          </p>
          {isOwnerSigner && (
            <p className="text-sm text-green-600 mt-4 font-medium">
              Our team will begin your onboarding process shortly!
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e8e8e8] flex flex-col">
      {/* Header - Mobile optimized with larger touch targets */}
      <header className="bg-[#1a1a2e] text-white px-3 md:px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <img 
            src={LOGO_URL} 
            alt="PeachHaus" 
            className="h-8 md:h-10 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-medium text-xs md:text-sm truncate max-w-[120px] md:max-w-none">{data?.documentName}</h1>
            <p className="text-[10px] md:text-xs text-white/60 truncate">{data?.signerName}</p>
          </div>
        </div>
        
        {/* Mobile view toggle */}
        {isMobile && (
          <div className="flex items-center bg-[#2a2a3e] rounded-lg p-1 mr-2">
            <button
              onClick={() => setMobileViewMode("fields")}
              className={cn(
                "p-2 rounded-md transition-colors",
                mobileViewMode === "fields" ? "bg-[#fae052] text-[#1a1a2e]" : "text-white/60"
              )}
              aria-label="Field view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMobileViewMode("pdf")}
              className={cn(
                "p-2 rounded-md transition-colors",
                mobileViewMode === "pdf" ? "bg-[#fae052] text-[#1a1a2e]" : "text-white/60"
              )}
              aria-label="PDF view"
            >
              <FileText className="h-4 w-4" />
            </button>
          </div>
        )}
        
        <Button
          onClick={handleSubmitSignature}
          disabled={!canFinish || submitting}
          className={cn(
            "font-semibold px-4 md:px-6 h-10 md:h-11 text-sm transition-all duration-300",
            canFinish 
              ? "bg-[#4caf50] text-white hover:bg-[#43a047] shadow-lg shadow-green-500/30" 
              : "bg-[#fae052] text-[#1a1a2e] hover:bg-[#f5d93a] disabled:opacity-40"
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : canFinish ? "✓ FINISH" : "FINISH"}
        </Button>
      </header>

      {/* Progress Banner - Touch-friendly on mobile */}
      <div className="bg-[#fae052] px-3 md:px-4 py-2.5 md:py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 md:gap-4">
          {/* Progress bar for mobile */}
          {isMobile && (
            <div className="w-16 h-2 bg-[#1a1a2e]/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#1a1a2e] transition-all duration-300"
                style={{ width: `${totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0}%` }}
              />
            </div>
          )}
          <span className="font-semibold text-[#1a1a2e] text-xs md:text-sm">
            {totalCompleted}/{totalRequired} complete
          </span>
          {remainingCount > 0 && !isMobile && (
            <span className="text-[#1a1a2e]/70 text-xs">
              ({remainingCount} remaining)
            </span>
          )}
        </div>
        {!isMobile && (
          <Button
            onClick={() => setShowFieldList(!showFieldList)}
            size="sm"
            variant="ghost"
            className="text-[#1a1a2e] hover:bg-[#e8d044] h-8"
          >
            {showFieldList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Floating NEXT/START Button - Desktop only, positioned at document edge */}
      {!isMobile && (
        <div className="fixed z-40 hidden md:block" style={{ right: `calc(50% - ${(pageWidth * scale) / 2 + 70}px)`, top: '40%' }}>
          {remainingCount > 0 ? (
            <Button
              onClick={activeFieldId || showSignatureFor ? handleNext : handleStart}
              size="lg"
              className="bg-[#fae052] text-[#1a1a2e] hover:bg-[#f5d93a] font-bold shadow-2xl rounded-full px-6 py-6 gap-2 text-sm flex-col h-auto"
            >
              <span className="text-lg">{activeFieldId || showSignatureFor ? "NEXT" : "START"}</span>
              <span className="text-xs font-normal opacity-80">{remainingCount} left</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          ) : canFinish ? (
            <Button
              onClick={handleSubmitSignature}
              disabled={submitting}
              size="lg"
              className="bg-[#4caf50] text-white hover:bg-[#43a047] font-bold shadow-2xl rounded-full px-6 py-6 gap-2 text-sm flex-col h-auto animate-pulse"
            >
              <Check className="h-6 w-6" />
              <span className="text-lg">FINISH</span>
              <span className="text-xs font-normal opacity-80">& Submit</span>
            </Button>
          ) : null}
        </div>
      )}

      {/* Desktop Field List Dropdown */}
      {showFieldList && !isMobile && (
        <div className="bg-white border-b shadow-sm px-4 py-3 max-h-48 overflow-y-auto">
          <div className="grid gap-1">
            {signerFields.map((field) => {
              const isOwner2 = isOwner2Field(field);
              let isFieldComplete = false;
              
              if (field.type === "signature") {
                // Check correct signature data based on owner
                isFieldComplete = isOwner2 ? !!owner2SignatureData : !!signatureData;
              } else if (field.type === "radio" && field.group_name) {
                isFieldComplete = isRadioGroupComplete(field.group_name);
              } else {
                isFieldComplete = completedFields.has(field.api_id);
              }
              
              const isOptional = isOwner2 || (!field.required && field.type !== "radio");
              
              return (
                <button
                  key={field.api_id}
                  onClick={() => {
                    navigateToField(field);
                    setShowFieldList(false);
                  }}
                  className={cn(
                    "text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors",
                    isFieldComplete 
                      ? "bg-green-50 text-green-700" 
                      : isOptional
                        ? "bg-gray-50 text-gray-500 hover:bg-gray-100"
                        : "bg-[#fff8dc] text-[#8b7355] hover:bg-[#fff5cc]"
                  )}
                >
                  {isFieldComplete ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex-shrink-0",
                      isOptional ? "border-gray-300" : "border-[#fae052]"
                    )} />
                  )}
                  <span className="truncate">
                    {field.label}
                    {isOptional && <span className="text-xs ml-1">(optional)</span>}
                    {!isOptional && !isFieldComplete && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  <span className="text-xs text-[#999] ml-auto flex-shrink-0">Page {field.page}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Focus View - Field List Mode (like DocuSign/Adobe Sign) */}
      {isMobile && mobileViewMode === "fields" && (
        <main className="flex-1 overflow-auto bg-white">
          <div className="px-4 py-4 space-y-3">
            {/* Section Header */}
            <div className="border-b pb-3">
              <h2 className="text-lg font-semibold text-[#1a1a2e]">
                {isAdminSigner ? "Review & Sign" : "Complete Your Information"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isAdminSigner 
                  ? "Review the owner's information below, then sign to complete" 
                  : "Fill in each field below, then tap Finish"}
              </p>
            </div>
            
            {/* For admin: Show owner-filled fields as read-only summary */}
            {isAdminSigner && allGuestFields.length > 0 && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Owner Information (Completed)
                </h3>
                <div className="space-y-2">
                  {allGuestFields.filter(f => f.type !== "signature").map((field) => {
                    const value = fieldValues[field.api_id];
                    if (!value) return null;
                    
                    return (
                      <div key={field.api_id} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-xs text-gray-500">{field.label}</span>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {typeof value === "boolean" ? (value ? "Yes" : "No") : value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Mobile-optimized field list */}
            <div className="space-y-4">
              {sortedSignerFields.map((field, index) => {
                const isOwner2 = isOwner2Field(field);
                let isFieldComplete = false;
                
                if (field.type === "signature") {
                  // Check correct signature data based on owner
                  isFieldComplete = isOwner2 ? !!owner2SignatureData : !!signatureData;
                } else if (field.type === "radio" && field.group_name) {
                  isFieldComplete = isRadioGroupComplete(field.group_name);
                } else {
                  isFieldComplete = completedFields.has(field.api_id) || !!fieldValues[field.api_id];
                }
                
                const isOptional = isOwner2 || (!field.required && field.type !== "radio");
                const value = fieldValues[field.api_id];
                
                // Skip duplicate radio buttons in the same group (show group once)
                if (field.type === "radio" && field.group_name) {
                  const firstInGroup = sortedSignerFields.find(f => f.type === "radio" && f.group_name === field.group_name);
                  if (firstInGroup && firstInGroup.api_id !== field.api_id) return null;
                }
                
                return (
                  <div
                    key={field.api_id}
                    className={cn(
                      "rounded-xl border-2 p-4 transition-all",
                      isFieldComplete 
                        ? "border-green-300 bg-green-50/50" 
                        : isOptional
                          ? "border-gray-200 bg-gray-50/50"
                          : "border-[#fae052] bg-[#fffef5]"
                    )}
                  >
                    {/* Field Label */}
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-[#1a1a2e] flex items-center gap-2">
                        {isFieldComplete ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                            isOptional ? "border-gray-300 text-gray-400" : "border-[#fae052] text-[#1a1a2e]"
                          )}>
                            {index + 1}
                          </div>
                        )}
                        {field.type === "radio" && field.group_name 
                          ? field.group_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                          : field.label
                        }
                      </label>
                      {isOptional && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Optional</span>
                      )}
                      {!isOptional && !isFieldComplete && (
                        <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">Required</span>
                      )}
                    </div>
                    
                    {/* Field Input - Mobile optimized with large touch targets */}
                    <div className="relative">
                      {field.type === "signature" ? (() => {
                        // Use correct signature data based on owner
                        const sigData = isOwner2 ? owner2SignatureData : signatureData;
                        // Owner 2 field should only be interactive for Owner 2 signer
                        const isOwner2FieldBlocked = isOwner2 && !isOwner2Signer;
                        // Owner 1 field should not be interactive for Owner 2 signer
                        const isOwner1FieldBlocked = !isOwner2 && isOwner2Signer;
                        const isFieldBlocked = isOwner2FieldBlocked || isOwner1FieldBlocked;
                        
                        return (
                          <button
                            onClick={() => {
                              if (isOwner2FieldBlocked) {
                                toast.info("This signature field is for Owner 2");
                                return;
                              }
                              if (isOwner1FieldBlocked) {
                                toast.info("This signature field is for Owner 1");
                                return;
                              }
                              setShowSignatureFor(field.api_id);
                            }}
                            className={cn(
                              "w-full h-20 rounded-lg border-2 border-dashed flex items-center justify-center transition-all",
                              sigData 
                                ? "border-green-300 bg-white" 
                                : isFieldBlocked
                                  ? "border-gray-200 bg-gray-50"
                                  : "border-[#fae052] bg-[#fffef5] active:bg-[#fae052]/20"
                            )}
                          >
                            {sigData ? (
                              <img src={sigData} alt="Signature" className="max-h-16 max-w-full" />
                            ) : isOwner2FieldBlocked ? (
                              <span className="text-gray-400 text-sm">For Owner 2</span>
                            ) : isOwner1FieldBlocked ? (
                              <span className="text-gray-400 text-sm">For Owner 1</span>
                            ) : (
                              <span className="text-[#8b7355] font-medium">Tap to sign</span>
                            )}
                          </button>
                        );
                      })() : field.type === "radio" && field.group_name ? (
                        <div className="space-y-2">
                          {signerFields
                            .filter(f => f.type === "radio" && f.group_name === field.group_name)
                            .map(radioField => (
                              <button
                                key={radioField.api_id}
                                onClick={() => handleFieldChange(radioField.api_id, true, radioField)}
                                className={cn(
                                  "w-full p-4 rounded-lg border-2 text-left flex items-center gap-3 transition-all min-h-[56px]",
                                  fieldValues[radioField.api_id] === true
                                    ? "border-[#4caf50] bg-green-50 text-green-700"
                                    : "border-gray-200 bg-white active:border-[#fae052]"
                                )}
                              >
                                <div className={cn(
                                  "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                  fieldValues[radioField.api_id] === true
                                    ? "border-[#4caf50] bg-[#4caf50]"
                                    : "border-gray-300"
                                )}>
                                  {fieldValues[radioField.api_id] === true && (
                                    <Check className="h-4 w-4 text-white" />
                                  )}
                                </div>
                                <span className="text-sm font-medium">{radioField.label}</span>
                              </button>
                            ))
                          }
                        </div>
                      ) : field.type === "checkbox" ? (
                        <button
                          onClick={() => handleFieldChange(field.api_id, !fieldValues[field.api_id], field)}
                          className={cn(
                            "w-full p-4 rounded-lg border-2 flex items-center gap-3 transition-all min-h-[56px]",
                            fieldValues[field.api_id] === true
                              ? "border-[#4caf50] bg-green-50"
                              : "border-gray-200 bg-white active:border-[#fae052]"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0",
                            fieldValues[field.api_id] === true
                              ? "border-[#4caf50] bg-[#4caf50]"
                              : "border-gray-300"
                          )}>
                            {fieldValues[field.api_id] === true && (
                              <Check className="h-4 w-4 text-white" />
                            )}
                          </div>
                          <span className="text-sm">{field.label}</span>
                        </button>
                      ) : field.type === "date" ? (
                        <input
                          type="date"
                          value={typeof value === 'string' ? value : ''}
                          onChange={(e) => handleFieldChange(field.api_id, e.target.value, field)}
                          className="w-full h-14 px-4 rounded-lg border-2 border-gray-200 bg-white text-base focus:border-[#fae052] focus:outline-none focus:ring-2 focus:ring-[#fae052]/30"
                        />
                      ) : isAddressField(field) ? (
                        <GooglePlacesAutocomplete
                          value={typeof value === 'string' ? value : ''}
                          onChange={(val) => handleFieldChange(field.api_id, val, field)}
                          placeholder={field.label}
                          className="w-full h-14 px-4 rounded-lg border-2 border-gray-200 bg-white text-base focus:border-[#fae052] focus:outline-none focus:ring-2 focus:ring-[#fae052]/30 placeholder:text-gray-400"
                        />
                      ) : (
                        <input
                          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                          placeholder={field.label}
                          value={typeof value === 'string' ? value : ''}
                          onChange={(e) => handleFieldChange(field.api_id, e.target.value, field)}
                          onBlur={() => {
                            if (field.type === "email" && typeof value === "string" && value && !validateEmail(value)) {
                              toast.error("Please enter a valid email address");
                            }
                            if (field.type === "phone" && typeof value === "string" && value && !validatePhone(value)) {
                              toast.error("Please enter a valid phone number (10-11 digits)");
                            }
                          }}
                          className="w-full h-14 px-4 rounded-lg border-2 border-gray-200 bg-white text-base focus:border-[#fae052] focus:outline-none focus:ring-2 focus:ring-[#fae052]/30 placeholder:text-gray-400"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* View PDF button */}
            <button
              onClick={() => setMobileViewMode("pdf")}
              className="w-full flex items-center justify-center gap-2 py-3 text-[#1a1a2e]/70 text-sm"
            >
              <Eye className="h-4 w-4" />
              View full document
            </button>
          </div>
          
          {/* Signature Modal for Mobile */}
          {showSignatureFor && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
              <div className="bg-white w-full rounded-t-2xl p-4 pb-8 animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Add Your Signature</h3>
                  <button 
                    onClick={() => setShowSignatureFor(null)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    ✕
                  </button>
                </div>
                <InlineSignature
                  onAdopt={handleSignatureAdopt}
                  onCancel={() => setShowSignatureFor(null)}
                />
              </div>
            </div>
          )}
        </main>
      )}

      {/* PDF View Mode (both mobile and desktop) */}
      {(!isMobile || mobileViewMode === "pdf") && (
        <main ref={containerRef} className="flex-1 overflow-auto py-4">
          <div className="mx-auto" style={{ maxWidth: pageWidth + 32 }}>
            {data?.pdfUrl ? (
              <Document
                file={data.pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center h-96 bg-white rounded shadow">
                    <Loader2 className="h-8 w-8 animate-spin text-[#666]" />
                  </div>
                }
                error={
                  <div className="bg-white rounded shadow p-8 text-center">
                    <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                    <p className="text-[#666]">Could not load PDF</p>
                  </div>
                }
              >
                <div className="space-y-2">
                  {Array.from({ length: numPages }, (_, index) => {
                    const pageNum = index + 1;
                    const fieldsOnPage = getFieldsForPage(pageNum);
                    
                    return (
                      <div
                        key={pageNum}
                        ref={(el) => {
                          if (el) pageRefs.current.set(pageNum, el);
                        }}
                        className="relative bg-white shadow-lg mx-auto"
                        style={{ width: pageWidth * scale }}
                      >
                        <Page
                          pageNumber={pageNum}
                          width={pageWidth * scale}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          onLoadSuccess={(page) => onPageLoadSuccess(pageNum, page)}
                        />
                        
                        {/* Field Overlays */}
                        {fieldsOnPage.map((field) => {
                          const isActive = activeFieldId === field.api_id;
                          const isOwner2 = isOwner2Field(field);
                          // Check correct signature data based on owner
                          const isCompleted = completedFields.has(field.api_id) || 
                            (field.type === "signature" && (isOwner2 ? !!owner2SignatureData : !!signatureData));
                          // Field is read-only if:
                          // 1. Guest signer viewing admin fields
                          // 2. Admin signer viewing guest fields that already have saved values
                          const isReadOnly = isAdminSigner 
                            ? (field.filled_by === "guest" && data?.savedFieldValues?.[field.api_id] !== undefined)
                            : (field.filled_by === "admin");
                          const isShowingSignature = showSignatureFor === field.api_id;
                          const value = fieldValues[field.api_id];
                          
                          const getFieldStyle = () => {
                            if (field.type === "signature") {
                              return { height: "50px", minHeight: "50px" };
                            }
                            if (field.type === "checkbox" || field.type === "radio") {
                              return { height: "22px", width: "22px", minHeight: "22px" };
                            }
                            return { height: "24px", minHeight: "24px" };
                          };
                          
                          const fieldStyle = getFieldStyle();
                          
                          return (
                            <div
                              key={field.api_id}
                              className="absolute"
                              style={{
                                left: `${field.x}%`,
                                top: `${field.y}%`,
                                width: field.type === "checkbox" || field.type === "radio" ? fieldStyle.width : `${field.width}%`,
                                height: fieldStyle.height,
                                minHeight: fieldStyle.minHeight,
                                zIndex: isActive || isShowingSignature ? 100 : 10,
                              }}
                            >
                              {isShowingSignature ? (
                                <InlineSignature
                                  onAdopt={handleSignatureAdopt}
                                  onCancel={() => setShowSignatureFor(null)}
                                />
                              ) : (
                                <InlineField
                                  field={field}
                                  value={value}
                                  onChange={(val) => handleFieldChange(field.api_id, val, field)}
                                  isActive={isActive}
                                  isCompleted={isCompleted}
                                  isReadOnly={isReadOnly}
                                  signatureData={isOwner2Field(field) ? owner2SignatureData : (isManagerField(field) ? null : signatureData)}
                                  onFocus={() => {
                                    if (field.type === "signature" && !isReadOnly) {
                                      const isOwner2FieldBlocked = isOwner2Field(field) && !isOwner2Signer;
                                      const isOwner1FieldBlocked = !isOwner2Field(field) && isOwner2Signer;
                                      
                                      if (isOwner2FieldBlocked) {
                                        toast.info("This signature field is for Owner 2");
                                        return;
                                      }
                                      if (isOwner1FieldBlocked) {
                                        toast.info("This signature field is for Owner 1");
                                        return;
                                      }
                                      setShowSignatureFor(field.api_id);
                                    } else if (!isReadOnly) {
                                      setActiveFieldId(field.api_id);
                                    }
                                  }}
                                  onBlur={() => setActiveFieldId(null)}
                                  onSignatureClick={() => {
                                    if (isReadOnly) return;
                                    const isOwner2FieldBlocked = isOwner2Field(field) && !isOwner2Signer;
                                    const isOwner1FieldBlocked = !isOwner2Field(field) && isOwner2Signer;
                                    
                                    if (isOwner2FieldBlocked) {
                                      toast.info("This signature field is for Owner 2");
                                      return;
                                    }
                                    if (isOwner1FieldBlocked) {
                                      toast.info("This signature field is for Owner 1");
                                      return;
                                    }
                                    setShowSignatureFor(field.api_id);
                                  }}
                                  scale={scale}
                                />
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Page indicator */}
                        <div className="absolute bottom-2 right-2 text-xs text-[#999] bg-white/80 px-2 py-0.5 rounded">
                          {pageNum} / {numPages}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Document>
            ) : (
              <div className="bg-white rounded shadow p-8 text-center">
                <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
                <p className="text-[#666]">No PDF available</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Footer (Mobile optimized) */}
      <footer className="bg-white border-t px-3 md:px-4 py-3 flex items-center justify-between sticky bottom-0 z-50 safe-area-inset-bottom">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs md:text-sm text-[#666]">
            {data?.signerType === "manager" ? "Signing as: Manager" : `Signing as: ${data?.signerName}`}
          </span>
        </div>
        
        {/* Mobile: Show Next/Finish button in footer */}
        {isMobile && mobileViewMode === "fields" && (
          remainingCount > 0 ? (
            <Button
              onClick={handleNext}
              className="bg-[#fae052] text-[#1a1a2e] hover:bg-[#f5d93a] font-semibold h-10 px-4 ml-2"
            >
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : canFinish ? (
            <Button
              onClick={handleSubmitSignature}
              disabled={submitting}
              className="bg-[#4caf50] text-white hover:bg-[#43a047] font-semibold h-10 px-4 ml-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "✓ Finish"}
            </Button>
          ) : null
        )}
        
        {/* Desktop: Zoom controls */}
        {!isMobile && (
          <div className="flex items-center gap-2 text-xs text-[#999]">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
              className="px-2 py-1 rounded hover:bg-[#f0f0f0]"
            >
              −
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(s => Math.min(1.5, s + 0.1))}
              className="px-2 py-1 rounded hover:bg-[#f0f0f0]"
            >
              +
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};

export default SignDocument;

import { useState, useEffect } from "react";
import { FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ExpenseDocumentLinkProps {
  filePath: string;
}

export const ExpenseDocumentLink = ({ filePath }: ExpenseDocumentLinkProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSignedUrl = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('expense-documents')
          .createSignedUrl(filePath, 3600); // 1 hour expiry
        
        if (error) throw error;
        setSignedUrl(data.signedUrl);
      } catch (error: any) {
        if (import.meta.env.DEV) {
          console.error("Error generating signed URL:", error);
        }
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    getSignedUrl();
  }, [filePath]);

  if (loading) {
    return (
      <span className="text-sm text-muted-foreground">
        Loading document...
      </span>
    );
  }

  if (!signedUrl) {
    return (
      <span className="text-sm text-muted-foreground">
        Document unavailable
      </span>
    );
  }

  const isPdf = filePath.toLowerCase().endsWith('.pdf');

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-primary hover:underline flex items-center gap-1.5 mt-2"
    >
      {isPdf ? (
        <FileText className="w-3.5 h-3.5" />
      ) : (
        <ImageIcon className="w-3.5 h-3.5" />
      )}
      View Document
    </a>
  );
};

import { useState, useEffect } from "react";
import { FileText, Image as ImageIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExpenseDocumentLinkProps {
  filePath?: string;
  emailScreenshotPath?: string;
  size?: "sm" | "default";
}

export const ExpenseDocumentLink = ({ filePath, emailScreenshotPath, size = "default" }: ExpenseDocumentLinkProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [emailSignedUrl, setEmailSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activePath = filePath || emailScreenshotPath;

  useEffect(() => {
    const getSignedUrls = async () => {
      try {
        if (filePath) {
          const { data, error } = await supabase.storage
            .from('expense-documents')
            .createSignedUrl(filePath, 3600);
          
          if (!error && data) {
            setSignedUrl(data.signedUrl);
          }
        }

        if (emailScreenshotPath) {
          const { data, error } = await supabase.storage
            .from('expense-documents')
            .createSignedUrl(emailScreenshotPath, 3600);
          
          if (!error && data) {
            setEmailSignedUrl(data.signedUrl);
          }
        }
      } catch (error: any) {
        if (import.meta.env.DEV) {
          console.error("Error generating signed URL:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    if (activePath) {
      getSignedUrls();
    } else {
      setLoading(false);
    }
  }, [filePath, emailScreenshotPath, activePath]);

  if (!activePath) return null;

  if (loading) {
    return (
      <span className="text-sm text-muted-foreground">
        Loading...
      </span>
    );
  }

  const isPdf = filePath?.toLowerCase().endsWith('.pdf');
  const iconClass = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const textClass = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="flex gap-2 flex-wrap">
      {signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-primary hover:underline flex items-center gap-1.5",
            textClass
          )}
        >
          {isPdf ? (
            <FileText className={iconClass} />
          ) : (
            <ImageIcon className={iconClass} />
          )}
          Receipt
          <ExternalLink className={cn(iconClass, "opacity-60")} />
        </a>
      )}
      {emailSignedUrl && (
        <a
          href={emailSignedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-primary hover:underline flex items-center gap-1.5",
            textClass
          )}
        >
          <ImageIcon className={iconClass} />
          Email Screenshot
          <ExternalLink className={cn(iconClass, "opacity-60")} />
        </a>
      )}
    </div>
  );
};

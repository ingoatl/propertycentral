import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Globe, Mail, X, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface KnowledgeImportPanelProps {
  onClose: () => void;
}

export function KnowledgeImportPanel({ onClose }: KnowledgeImportPanelProps) {
  const [importProgress, setImportProgress] = useState(0);
  const queryClient = useQueryClient();

  const websiteImportMutation = useMutation({
    mutationFn: async () => {
      setImportProgress(10);
      
      const { data, error } = await supabase.functions.invoke("import-website-knowledge", {
        body: { url: "https://peachhausgroup.com" }
      });
      
      setImportProgress(100);
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["company-knowledge"] });
      toast.success(`Imported ${data?.count || 0} knowledge entries from website`);
      setImportProgress(0);
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
      setImportProgress(0);
    },
  });

  const emailAnalysisMutation = useMutation({
    mutationFn: async () => {
      setImportProgress(10);
      
      const { data, error } = await supabase.functions.invoke("analyze-emails-for-knowledge", {
        body: { limit: 100 }
      });
      
      setImportProgress(100);
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["company-knowledge"] });
      toast.success(`Analyzed ${data?.emailsProcessed || 0} emails, created ${data?.knowledgeCreated || 0} entries`);
      setImportProgress(0);
    },
    onError: (error) => {
      toast.error(`Analysis failed: ${error.message}`);
      setImportProgress(0);
    },
  });

  const isImporting = websiteImportMutation.isPending || emailAnalysisMutation.isPending;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Import Knowledge</CardTitle>
            <CardDescription>
              Automatically populate knowledge from your website or email history
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {importProgress > 0 && (
          <div className="space-y-2">
            <Progress value={importProgress} />
            <p className="text-sm text-muted-foreground text-center">
              Importing... {importProgress}%
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Card className="border">
            <CardContent className="pt-4">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">Import from Website</h4>
                  <p className="text-sm text-muted-foreground">
                    Scrape peachhausgroup.com for services, pricing, and FAQs
                  </p>
                </div>
                <Button
                  onClick={() => websiteImportMutation.mutate()}
                  disabled={isImporting}
                  className="w-full"
                >
                  {websiteImportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : websiteImportMutation.isSuccess ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Imported
                    </>
                  ) : (
                    "Import Website"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="pt-4">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">Analyze Sent Emails</h4>
                  <p className="text-sm text-muted-foreground">
                    Extract patterns from successful email responses
                  </p>
                </div>
                <Button
                  onClick={() => emailAnalysisMutation.mutate()}
                  disabled={isImporting}
                  variant="outline"
                  className="w-full"
                >
                  {emailAnalysisMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : emailAnalysisMutation.isSuccess ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Analyzed
                    </>
                  ) : (
                    "Analyze Emails"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Imported knowledge will be marked with its source and can be edited or deleted
        </p>
      </CardContent>
    </Card>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, FolderOpen } from "lucide-react";
import DocumentList from "@/components/documents/DocumentList";
import DocumentCreateWizard from "@/components/documents/DocumentCreateWizard";
import { DocumentTemplatesManager } from "@/components/documents/DocumentTemplatesManager";

const Documents = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Document Hub</h1>
        <p className="text-muted-foreground mt-1">
          Create, manage, and track document signatures
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Executed
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Send New Document
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <DocumentList />
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <DocumentCreateWizard />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <DocumentTemplatesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Documents;

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, FileText, Upload, Loader2, Sparkles, CheckCircle, AlertCircle, Home, HelpCircle, ClipboardList, Wrench, X, Eye, Table } from "lucide-react";
import { AnalysisResults } from "@/components/owner-conversations/AnalysisResults";
import { ConversationHistory } from "@/components/owner-conversations/ConversationHistory";

// Simple CSV parser function
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => 
    line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
  );
  
  return { headers, rows };
}

interface Property {
  id: string;
  name: string;
  address: string;
}

export default function OwnerConversations() {
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [clientDocs, setClientDocs] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Fetch properties
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-for-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address")
        .is("offboarded_at", null)
        .order("name");
      if (error) throw error;
      return data as Property[];
    },
  });

  // Fetch current conversation with actions
  const { data: currentConversation, isLoading: isLoadingConversation } = useQuery({
    queryKey: ["owner-conversation", currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return null;
      const { data, error } = await supabase
        .from("owner_conversations")
        .select(`
          *,
          owner_conversation_actions(*),
          owner_conversation_documents(*)
        `)
        .eq("id", currentConversationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentConversationId,
    refetchInterval: (query) => {
      // Poll while analyzing
      if (query.state.data?.status === "analyzing") return 2000;
      return false;
    },
  });

  // Create conversation and analyze
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPropertyId) throw new Error("Please select a property");
      if (!transcript && clientDocs.length === 0 && !transcriptFile) {
        throw new Error("Please provide a transcript or upload documents");
      }

      // Get property context
      const property = properties.find(p => p.id === selectedPropertyId);
      
      // Create the conversation record
      const { data: conversation, error: createError } = await supabase
        .from("owner_conversations")
        .insert({
          property_id: selectedPropertyId,
          title: title || `Conversation - ${new Date().toLocaleDateString()}`,
          transcript_text: transcript || null,
          status: "pending",
        })
        .select()
        .single();

      if (createError) throw createError;

      // Read transcript file if provided
      let finalTranscript = transcript;
      if (transcriptFile) {
        finalTranscript = await transcriptFile.text();
        
        // Upload transcript file to storage
        const transcriptPath = `${property?.address || 'unknown'}/conversations/${conversation.id}/transcript_${transcriptFile.name}`;
        await supabase.storage
          .from("onboarding-documents")
          .upload(transcriptPath, transcriptFile);
        
        // Update conversation with file path
        await supabase
          .from("owner_conversations")
          .update({ 
            transcript_file_path: transcriptPath,
            transcript_text: finalTranscript 
          })
          .eq("id", conversation.id);
      }

      // Process and upload client documents
      const documentContents: Array<{ fileName: string; content: string; isStructured?: boolean; structuredData?: any }> = [];
      
      for (const doc of clientDocs) {
        const docPath = `${property?.address || 'unknown'}/conversations/${conversation.id}/${doc.name}`;
        
        // Upload to storage
        await supabase.storage
          .from("onboarding-documents")
          .upload(docPath, doc);

        // Check if it's an Excel or CSV file
        const isExcel = doc.name.endsWith('.xlsx') || doc.name.endsWith('.xls');
        const isCsv = doc.name.endsWith('.csv');
        
        let extractedContent = "";
        let isStructured = false;
        let structuredData = null;
        
        if (isExcel || isCsv) {
          // For Excel/CSV, we'll parse it client-side and send structured data
          isStructured = true;
          try {
            if (isCsv) {
              const text = await doc.text();
              structuredData = parseCSV(text);
              extractedContent = `[Structured CSV Data: ${doc.name}] - ${Object.keys(structuredData).length} sheets/sections`;
            } else {
              // For Excel, read as text and send raw - the AI will interpret it
              const text = await doc.text();
              extractedContent = `[Excel Document: ${doc.name}] - Structured data file`;
              // We'll send the raw content and let AI interpret
              structuredData = { rawContent: text, fileName: doc.name };
            }
          } catch (e) {
            extractedContent = `[Excel/CSV Document: ${doc.name}] - Please process manually`;
            isStructured = false;
          }
        } else if (doc.type === "text/plain" || doc.name.endsWith(".txt") || doc.name.endsWith(".md")) {
          extractedContent = await doc.text();
        } else if (doc.type === "application/pdf") {
          extractedContent = `[PDF Document: ${doc.name}] - Content extraction pending`;
        } else {
          extractedContent = `[Document: ${doc.name}] - ${doc.type}`;
        }

        // Save document record
        await supabase
          .from("owner_conversation_documents")
          .insert({
            conversation_id: conversation.id,
            file_name: doc.name,
            file_path: docPath,
            file_type: doc.type,
            file_size: doc.size,
            ai_extracted_content: extractedContent,
          });

        documentContents.push({
          fileName: doc.name,
          content: extractedContent,
          isStructured,
          structuredData,
        });
      }

      // Call the analysis edge function
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        "analyze-owner-conversation",
        {
          body: {
            conversationId: conversation.id,
            transcript: finalTranscript,
            documentContents,
            propertyContext: property ? { id: property.id, name: property.name, address: property.address } : undefined,
          },
        }
      );

      if (analysisError) throw analysisError;

      return { conversation, analysisResult };
    },
    onSuccess: ({ conversation }) => {
      setCurrentConversationId(conversation.id);
      setActiveTab("results");
      toast.success("Analysis complete!");
      queryClient.invalidateQueries({ queryKey: ["owner-conversations"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "transcript" | "docs") => {
    const files = e.target.files;
    if (!files) return;

    if (type === "transcript") {
      setTranscriptFile(files[0]);
    } else {
      setClientDocs(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removeDoc = (index: number) => {
    setClientDocs(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setTitle("");
    setTranscript("");
    setTranscriptFile(null);
    setClientDocs([]);
    setCurrentConversationId(null);
    setActiveTab("upload");
  };

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Owner Conversations</h1>
          <p className="text-muted-foreground">
            Upload transcripts and documents to extract actionable insights
          </p>
        </div>
        {currentConversationId && (
          <Button variant="outline" onClick={resetForm}>
            <MessageSquare className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload & Analyze
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2" disabled={!currentConversationId}>
            <Sparkles className="h-4 w-4" />
            Analysis Results
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <FileText className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column - Upload Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Upload Content
                </CardTitle>
                <CardDescription>
                  Add a transcript of your owner conversation and/or upload property documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Property Selection */}
                <div className="space-y-2">
                  <Label>Property *</Label>
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a property..." />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name} - {property.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g., Initial Property Walkthrough"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Transcript Section */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Transcript
                  </Label>
                  <Textarea
                    placeholder="Paste the conversation transcript here..."
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">or</span>
                    <Label htmlFor="transcript-file" className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          <Upload className="h-3 w-3 mr-1" />
                          Upload file
                        </span>
                      </Button>
                    </Label>
                    <Input
                      id="transcript-file"
                      type="file"
                      accept=".txt,.md"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, "transcript")}
                    />
                    {transcriptFile && (
                      <Badge variant="secondary" className="gap-1">
                        {transcriptFile.name}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setTranscriptFile(null)}
                        />
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Client Documents Section */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Client Documents
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Upload cleaning manuals, house rules, property summaries, Excel files, etc.
                  </p>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    <Label htmlFor="client-docs" className="cursor-pointer block">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF, TXT, DOCX, Excel (.xlsx), CSV supported
                      </p>
                    </Label>
                    <Input
                      id="client-docs"
                      type="file"
                      accept=".pdf,.txt,.docx,.doc,.md,.xlsx,.xls,.csv"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, "docs")}
                    />
                  </div>
                  {clientDocs.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {clientDocs.map((doc, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          <FileText className="h-3 w-3" />
                          {doc.name}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                            onClick={() => removeDoc(index)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Analyze Button */}
                <Button
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending || !selectedPropertyId}
                  className="w-full"
                  size="lg"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze Content
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Right Column - What to Expect */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  What AI Will Extract
                </CardTitle>
                <CardDescription>
                  The AI analyzes your content and organizes it intelligently
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                    <Home className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Property Information</p>
                      <p className="text-sm text-muted-foreground">
                        Parking, cleaning procedures, checkout rules, pet policies, etc.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                    <HelpCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium">FAQ Entries</p>
                      <p className="text-sm text-muted-foreground">
                        Common guest questions with answers from your docs
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                    <ClipboardList className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Setup Notes</p>
                      <p className="text-sm text-muted-foreground">
                        Important operational details for your team
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                    <Wrench className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Action Items</p>
                      <p className="text-sm text-muted-foreground">
                        Only creates tasks for things that actually need doing
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>Smart Analysis:</strong> The AI distinguishes between informational
                    content (like cleaning procedures) and true action items (like "install
                    lockbox"). Documents become structured property info, not unnecessary tasks.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="results">
          {currentConversationId && currentConversation ? (
            <AnalysisResults
              conversation={currentConversation}
              property={selectedProperty}
              isLoading={isLoadingConversation}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Upload and analyze content to see results here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <ConversationHistory
            onViewConversation={(id) => {
              setCurrentConversationId(id);
              setActiveTab("results");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

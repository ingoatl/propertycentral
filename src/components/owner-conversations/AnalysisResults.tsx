import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, Home, HelpCircle, ClipboardList, Wrench, CheckCircle, XCircle, Sparkles, FileText, Key, Zap, Phone, Settings } from "lucide-react";

interface Action {
  id: string;
  action_type: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  content: any;
}

interface AnalysisResultsProps {
  conversation: {
    id: string;
    title: string;
    ai_summary: string;
    status: string;
    extracted_items: any;
    owner_conversation_actions: Action[];
    owner_conversation_documents: any[];
    property_id?: string;
  };
  property?: { id: string; name: string; address: string };
  isLoading: boolean;
}

const actionTypeConfig: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
  property_info: {
    icon: Home,
    label: "Property Info",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  faq: {
    icon: HelpCircle,
    label: "FAQ",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  setup_note: {
    icon: ClipboardList,
    label: "Setup Note",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  task: {
    icon: Wrench,
    label: "Task",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  credential: {
    icon: Key,
    label: "Credential",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  utility: {
    icon: Zap,
    label: "Utility Account",
    color: "text-yellow-600",
    bgColor: "bg-yellow-600/10",
  },
  appliance: {
    icon: Settings,
    label: "Appliance",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
  },
  contact: {
    icon: Phone,
    label: "Service Contact",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function AnalysisResults({ conversation, property, isLoading }: AnalysisResultsProps) {
  const queryClient = useQueryClient();
  const [selectedActions, setSelectedActions] = useState<Set<string>>(
    new Set(conversation.owner_conversation_actions?.filter(a => a.status === "suggested").map(a => a.id) || [])
  );

  const propertyId = property?.id || conversation.property_id;

  // Fetch the onboarding project for this property to create tasks
  const { data: onboardingProject } = useQuery({
    queryKey: ["onboarding-project-for-property", propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });

  const actions = conversation.owner_conversation_actions || [];
  const groupedActions: Record<string, Action[]> = {};
  
  // Group actions by type
  actions.forEach(action => {
    const type = action.action_type;
    if (!groupedActions[type]) {
      groupedActions[type] = [];
    }
    groupedActions[type].push(action);
  });

  const toggleAction = (id: string) => {
    setSelectedActions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = (type: string) => {
    const typeActions = groupedActions[type] || [];
    setSelectedActions(prev => {
      const next = new Set(prev);
      typeActions.forEach(a => {
        if (a.status === "suggested") next.add(a.id);
      });
      return next;
    });
  };

  const deselectAll = (type: string) => {
    const typeActions = groupedActions[type] || [];
    setSelectedActions(prev => {
      const next = new Set(prev);
      typeActions.forEach(a => next.delete(a.id));
      return next;
    });
  };

  // Create selected items mutation
  const createItemsMutation = useMutation({
    mutationFn: async () => {
      const selectedList = Array.from(selectedActions);
      const actionsToCreate = actions.filter(a => selectedList.includes(a.id));
      
      if (!propertyId) {
        throw new Error("No property ID available");
      }

      let createdCount = 0;

      for (const action of actionsToCreate) {
        try {
          // Handle each action type
          switch (action.action_type) {
            case "faq":
              await supabase.from("frequently_asked_questions").insert({
                property_id: propertyId,
                question: action.title,
                answer: action.description,
                category: action.category,
              });
              createdCount++;
              break;

            case "property_info":
            case "setup_note":
              await supabase.from("property_intel_items").insert({
                property_id: propertyId,
                source_type: "conversation",
                source_id: conversation.id,
                category: action.category || "Other",
                title: action.title,
                description: action.description,
                content: action.content,
              });
              createdCount++;
              break;

            case "credential":
              const credContent = action.content || {};
              await supabase.from("property_credentials").insert({
                property_id: propertyId,
                service_name: credContent.serviceName || action.title,
                username: credContent.username,
                password: credContent.password,
                url: credContent.url,
                notes: credContent.notes,
              });
              createdCount++;
              break;

            case "appliance":
              const appContent = action.content || {};
              await supabase.from("property_appliances").insert({
                property_id: propertyId,
                appliance_type: appContent.type || action.title,
                brand: appContent.brand,
                model: appContent.model,
                serial_number: appContent.serialNumber,
                year: appContent.year ? parseInt(appContent.year) : null,
                warranty_info: appContent.warranty,
                location: appContent.location,
              });
              createdCount++;
              break;

            case "utility":
            case "contact":
              // Store as property intel items
              await supabase.from("property_intel_items").insert({
                property_id: propertyId,
                source_type: "conversation",
                source_id: conversation.id,
                category: action.action_type === "utility" ? "Utilities" : "Contacts",
                title: action.title,
                description: action.description,
                content: action.content,
              });
              createdCount++;
              break;

            case "task":
              // Create an actual onboarding task if we have a project
              if (onboardingProject?.id) {
                const taskContent = action.content || {};
                await supabase.from("onboarding_tasks").insert({
                  project_id: onboardingProject.id,
                  title: action.title,
                  description: action.description,
                  phase_number: taskContent.phaseNumber || 2,
                  phase_title: taskContent.phaseTitle || "Property Setup",
                  field_type: "checkbox",
                  status: "pending",
                });
                createdCount++;
              } else {
                // If no project, store as intel item with task category
                await supabase.from("property_intel_items").insert({
                  property_id: propertyId,
                  source_type: "conversation",
                  source_id: conversation.id,
                  category: "Tasks",
                  title: action.title,
                  description: action.description,
                  content: { ...action.content, isActionItem: true },
                });
                createdCount++;
              }
              break;

            default:
              // Store anything else as intel item
              await supabase.from("property_intel_items").insert({
                property_id: propertyId,
                source_type: "conversation",
                source_id: conversation.id,
                category: action.category || "Other",
                title: action.title,
                description: action.description,
                content: action.content,
              });
              createdCount++;
          }

          // Update action status
          await supabase
            .from("owner_conversation_actions")
            .update({ status: "created" })
            .eq("id", action.id);
        } catch (error) {
          console.error(`Failed to create ${action.action_type}:`, error);
        }
      }

      // Update conversation status to completed if all suggested items are processed
      const remainingSuggested = actions.filter(
        a => a.status === "suggested" && !selectedList.includes(a.id)
      ).length;

      if (remainingSuggested === 0) {
        await supabase
          .from("owner_conversations")
          .update({ status: "completed" })
          .eq("id", conversation.id);
      }

      return createdCount;
    },
    onSuccess: (count) => {
      toast.success(`Created ${count} items successfully!`);
      queryClient.invalidateQueries({ queryKey: ["owner-conversation", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["property-intel-items"] });
      queryClient.invalidateQueries({ queryKey: ["property-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["property-appliances"] });
      setSelectedActions(new Set());
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Dismiss actions mutation
  const dismissMutation = useMutation({
    mutationFn: async (actionIds: string[]) => {
      for (const id of actionIds) {
        await supabase
          .from("owner_conversation_actions")
          .update({ status: "dismissed" })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      toast.success("Items dismissed");
      queryClient.invalidateQueries({ queryKey: ["owner-conversation", conversation.id] });
    },
  });

  if (isLoading || conversation.status === "analyzing") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-lg font-medium">Analyzing content...</p>
          <p className="text-sm text-muted-foreground">
            The AI is extracting insights from your conversation and documents
          </p>
        </CardContent>
      </Card>
    );
  }

  const suggestedCount = actions.filter(a => a.status === "suggested").length;
  const selectedCount = selectedActions.size;

  // Order of display
  const displayOrder = ["property_info", "credential", "utility", "appliance", "contact", "faq", "setup_note", "task"];

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {conversation.title}
          </CardTitle>
          {property && (
            <CardDescription>
              {property.name} - {property.address}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p className="text-muted-foreground whitespace-pre-wrap">
              {conversation.ai_summary}
            </p>
          </div>

          {/* Documents attached */}
          {conversation.owner_conversation_documents?.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Attached Documents:</p>
              <div className="flex flex-wrap gap-2">
                {conversation.owner_conversation_documents.map((doc: any) => (
                  <Badge key={doc.id} variant="secondary" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {doc.file_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Extracted Items</CardTitle>
            <CardDescription>
              {suggestedCount > 0 
                ? `Select items to create (${selectedCount} of ${suggestedCount} selected)`
                : "All items have been processed"}
            </CardDescription>
          </div>
          {selectedCount > 0 && (
            <Button onClick={() => createItemsMutation.mutate()} disabled={createItemsMutation.isPending}>
              {createItemsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Create {selectedCount} Items
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={displayOrder} className="space-y-2">
            {displayOrder.map((type) => {
              const typeActions = groupedActions[type];
              if (!typeActions || typeActions.length === 0) return null;
              
              const config = actionTypeConfig[type] || {
                icon: ClipboardList,
                label: type,
                color: "text-gray-500",
                bgColor: "bg-gray-500/10",
              };
              const Icon = config.icon;
              const suggestedInType = typeActions.filter(a => a.status === "suggested").length;
              const selectedInType = typeActions.filter(a => selectedActions.has(a.id)).length;

              return (
                <AccordionItem key={type} value={type} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <span className="font-medium">{config.label}</span>
                      <Badge variant="secondary">{typeActions.length}</Badge>
                      {suggestedInType > 0 && (
                        <Badge variant="outline" className="ml-2">
                          {selectedInType}/{suggestedInType} selected
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    {suggestedInType > 0 && (
                      <div className="flex gap-2 mb-3">
                        <Button variant="ghost" size="sm" onClick={() => selectAll(type)}>
                          Select all
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deselectAll(type)}>
                          Deselect all
                        </Button>
                      </div>
                    )}
                    <div className="space-y-3">
                      {typeActions.map((action) => (
                        <div
                          key={action.id}
                          className={`p-3 rounded-lg border ${
                            action.status === "created"
                              ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                              : action.status === "dismissed"
                              ? "bg-muted/50 opacity-50"
                              : selectedActions.has(action.id)
                              ? "bg-accent border-primary"
                              : "bg-card"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {action.status === "suggested" && (
                              <Checkbox
                                checked={selectedActions.has(action.id)}
                                onCheckedChange={() => toggleAction(action.id)}
                                className="mt-0.5"
                              />
                            )}
                            {action.status === "created" && (
                              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                            )}
                            {action.status === "dismissed" && (
                              <XCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{action.title}</span>
                                {action.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {action.category}
                                  </Badge>
                                )}
                                {action.priority && (
                                  <span
                                    className={`w-2 h-2 rounded-full ${priorityColors[action.priority] || "bg-gray-400"}`}
                                    title={`${action.priority} priority`}
                                  />
                                )}
                              </div>
                              {action.description && (
                                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                  {action.description}
                                </p>
                              )}
                            </div>
                            {action.status === "suggested" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => dismissMutation.mutate([action.id])}
                                className="shrink-0"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

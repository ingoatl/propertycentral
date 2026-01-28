import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  Sparkles, 
  ListTodo,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Mail,
  Phone,
  ExternalLink,
  Zap,
  Target,
  Building2,
  Clock
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTasks, CreateTaskInput } from "@/hooks/useUserTasks";
import { useOverdueOnboardingTasks, OverdueOnboardingTask } from "@/hooks/useOverdueOnboardingTasks";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { CallDialog } from "@/components/communications/CallDialog";
import { SendEmailDialog } from "@/components/communications/SendEmailDialog";


interface NinjaFocusItem {
  priority: "critical" | "high" | "medium";
  action: string;
  reason: string;
  source: string;
  link?: string;
  actionType?: "call" | "email" | "sms" | "view";
  contactId?: string;
  contactType?: "lead" | "owner" | "vendor" | "guest";
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface NinjaPlan {
  greeting: string;
  topPriorities: NinjaFocusItem[];
  quickWins: NinjaFocusItem[];
  proactiveSuggestions: string[];
}

const priorityIcons = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
};

function NinjaPriorityItem({ 
  item, 
  onAction 
}: { 
  item: NinjaFocusItem;
  onAction: (item: NinjaFocusItem) => void;
}) {
  return (
    <button
      onClick={() => onAction(item)}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm",
        item.priority === "critical" && "bg-destructive/5 border-destructive/20 hover:bg-destructive/10",
        item.priority === "high" && "bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10",
        item.priority === "medium" && "bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{priorityIcons[item.priority]}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{item.action}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.reason}</p>
          {item.contactName && (
            <p className="text-xs text-muted-foreground mt-1">
              Contact: {item.contactName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.actionType === "call" && (
            <Badge variant="outline" className="text-xs">
              <Phone className="w-3 h-3 mr-1" />
              call
            </Badge>
          )}
          {item.actionType === "email" && (
            <Badge variant="outline" className="text-xs">
              <Mail className="w-3 h-3 mr-1" />
              Email
            </Badge>
          )}
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}

function QuickWinItem({ task, onClick }: { task: OverdueOnboardingTask; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-all w-full text-left group"
    >
      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground truncate">{task.property_name}</p>
      </div>
      <Badge variant="outline" className="text-xs flex-shrink-0">
        {task.estimated_minutes} min
      </Badge>
    </button>
  );
}

export function UnifiedNinjaTasksPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"ninja" | "tasks" | "onboarding">("ninja");
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{
    name: string;
    phone?: string;
    email?: string;
    leadId?: string;
    ownerId?: string;
    contactType?: "lead" | "owner" | "vendor";
  } | null>(null);

  // Fetch Ninja Plan
  const { data: ninjaPlan, isLoading: ninjaLoading, refetch: refetchNinja, isFetching } = useQuery({
    queryKey: ["ninja-plan"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-ninja-plan");
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to generate plan");
      return data.plan as NinjaPlan;
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // Fetch overdue onboarding tasks
  const { data: overdueData, isLoading: overdueLoading } = useOverdueOnboardingTasks();

  // User tasks
  const { tasks, isLoading: tasksLoading } = useUserTasks();
  const pendingTasks = tasks.filter(t => t.status !== "completed");

  const handleNinjaAction = (item: NinjaFocusItem) => {
    if (item.actionType === "call" && item.contactPhone) {
      setSelectedContact({
        name: item.contactName || "Unknown",
        phone: item.contactPhone,
        email: item.contactEmail,
        leadId: item.contactType === "lead" ? item.contactId : undefined,
        ownerId: item.contactType === "owner" ? item.contactId : undefined,
        contactType: item.contactType as "lead" | "owner" | "vendor",
      });
      setShowCallDialog(true);
    } else if (item.actionType === "email" && item.contactEmail) {
      setSelectedContact({
        name: item.contactName || "Unknown",
        email: item.contactEmail,
        phone: item.contactPhone,
        leadId: item.contactType === "lead" ? item.contactId : undefined,
        ownerId: item.contactType === "owner" ? item.contactId : undefined,
        contactType: item.contactType as "lead" | "owner" | "vendor",
      });
      setShowEmailDialog(true);
    } else if (item.link) {
      navigate(item.link);
    } else {
      navigate("/communications");
    }
  };

  const handleOverdueTaskClick = (task: OverdueOnboardingTask) => {
    if (task.property_id) {
      navigate(`/properties?property=${task.property_id}&task=${task.id}`);
    } else {
      navigate(`/properties`);
    }
  };

  const totalItems = 
    (ninjaPlan?.topPriorities?.length || 0) + 
    pendingTasks.length + 
    (overdueData?.totalCount || 0);

  return (
    <>
      <Card className="col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Your Ninja Plan
              {totalItems > 0 && (
                <Badge variant="secondary">{totalItems}</Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchNinja()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            </Button>
          </div>
          {ninjaPlan?.greeting && (
            <p className="text-sm text-muted-foreground">{ninjaPlan.greeting}</p>
          )}
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="ninja" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Priorities
                {ninjaPlan?.topPriorities?.length ? (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {ninjaPlan.topPriorities.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1">
                <ListTodo className="w-3 h-3" />
                My Tasks
                {pendingTasks.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {pendingTasks.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="onboarding" className="gap-1">
                <Building2 className="w-3 h-3" />
                Onboarding
                {overdueData?.totalCount ? (
                  <Badge variant="destructive" className="ml-1 text-xs">
                    {overdueData.totalCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            {/* Ninja Priorities Tab */}
            <TabsContent value="ninja" className="space-y-4 mt-0">
              {ninjaLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : ninjaPlan?.topPriorities?.length ? (
                <>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      Top Priorities
                    </h4>
                    <div className="space-y-2">
                      {ninjaPlan.topPriorities.map((item, idx) => (
                        <NinjaPriorityItem 
                          key={idx} 
                          item={item} 
                          onAction={handleNinjaAction}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {ninjaPlan.quickWins?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Quick Wins
                      </h4>
                      <div className="space-y-2">
                        {ninjaPlan.quickWins.slice(0, 3).map((item, idx) => (
                          <NinjaPriorityItem 
                            key={idx} 
                            item={item} 
                            onAction={handleNinjaAction}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">All caught up!</p>
                  <p className="text-xs">No urgent priorities right now</p>
                </div>
              )}
            </TabsContent>

            {/* My Tasks Tab - inline render instead of embedded component */}
            <TabsContent value="tasks" className="mt-0">
              <div className="text-sm text-muted-foreground">
                {pendingTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No tasks yet</p>
                    <p className="text-xs">Add a task to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingTasks.slice(0, 10).map((task) => (
                      <div 
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50"
                      >
                        <div className={cn("w-2 h-2 rounded-full", 
                          task.priority === "urgent" ? "bg-destructive" : 
                          task.priority === "high" ? "bg-warning" : "bg-muted-foreground"
                        )} />
                        <span className="flex-1 text-sm truncate">{task.title}</span>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {task.due_date}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Onboarding Tab */}
            <TabsContent value="onboarding" className="space-y-4 mt-0">
              {overdueLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : overdueData?.totalCount ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {overdueData.totalCount} tasks across {overdueData.propertyCount} properties
                    </p>
                  </div>
                  
                  {overdueData.quickWins.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Target className="w-4 h-4 text-amber-500" />
                        Quick Wins (~{overdueData.quickWins.reduce((a, t) => a + t.estimated_minutes, 0)} min)
                      </h4>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {overdueData.quickWins.map((task) => (
                          <QuickWinItem 
                            key={task.id} 
                            task={task} 
                            onClick={() => handleOverdueTaskClick(task)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate("/properties")}
                  >
                    View all by property
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No overdue onboarding tasks!</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Call Dialog */}
      {selectedContact && showCallDialog && (
        <CallDialog
          open={showCallDialog}
          onOpenChange={setShowCallDialog}
          contactName={selectedContact.name}
          contactPhone={selectedContact.phone || ""}
          leadId={selectedContact.leadId}
          ownerId={selectedContact.ownerId}
          contactType={selectedContact.contactType}
        />
      )}

      {/* Email Dialog */}
      {selectedContact && showEmailDialog && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          contactEmail={selectedContact.email || ""}
          contactName={selectedContact.name}
          contactId={selectedContact.leadId || selectedContact.ownerId || ""}
          contactType={selectedContact.contactType === "vendor" ? "lead" : selectedContact.contactType || "lead"}
        />
      )}
    </>
  );
}

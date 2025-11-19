import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OnboardingTask } from "@/types/onboarding";
import { Loader2, MapPin, User, Lock, Phone, Link as LinkIcon, Mail, Home } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskFilePreview } from "./TaskFilePreview";

interface PropertyDetailsViewProps {
  projectId: string;
  propertyId?: string;
}

interface CategorizedData {
  [category: string]: { label: string; value: string; icon?: any; taskId?: string }[];
}

export function PropertyDetailsView({ projectId, propertyId }: PropertyDetailsViewProps) {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load ALL tasks (not just those with field_value)
      // This ensures attachments show even if no text value was entered
      const { data: tasksData, error: tasksError } = await supabase
        .from('onboarding_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('phase_number', { ascending: true });

      if (tasksError) throw tasksError;
      setTasks((tasksData || []) as OnboardingTask[]);
    } catch (error: any) {
      console.error('Error loading property details:', error);
      toast.error('Failed to load property information');
    } finally {
      setLoading(false);
    }
  };

  const organizeTasksByCategory = (): CategorizedData => {
    const categories: CategorizedData = {
      'Owner Information': [],
      'Access & Codes': [],
      'Property Details': [],
      'Listings & Links': [],
      'Service Providers': [],
      'Utilities & Accounts': [],
      'Emergency & Safety': [],
    };

    tasks.forEach(task => {
      // Show task if it has a field_value OR if it has attachments
      const hasValue = task.field_value && task.field_value.trim() !== '';
      const taskId = task.id;
      
      if (!hasValue && !taskId) return; // Skip if no value and no taskId for attachments
      
      const title = task.title.toLowerCase();
      const value = task.field_value || '(See attachments)';

      if (title.includes('owner') || title.includes('contact')) {
        if (title.includes('email')) {
          categories['Owner Information'].push({ label: task.title, value, icon: Mail, taskId });
        } else if (title.includes('phone')) {
          categories['Owner Information'].push({ label: task.title, value, icon: Phone, taskId });
        } else if (title.includes('name')) {
          categories['Owner Information'].push({ label: task.title, value, icon: User, taskId });
        } else {
          categories['Owner Information'].push({ label: task.title, value, taskId });
        }
      } else if (title.includes('code') || title.includes('password') || title.includes('wifi') || title.includes('lock') || title.includes('gate')) {
        categories['Access & Codes'].push({ label: task.title, value, icon: Lock, taskId });
      } else if (title.includes('address') || title.includes('bedroom') || title.includes('bathroom') || title.includes('parking')) {
        if (title.includes('address')) {
          categories['Property Details'].push({ label: task.title, value, icon: MapPin, taskId });
        } else {
          categories['Property Details'].push({ label: task.title, value, icon: Home, taskId });
        }
      } else if (title.includes('listing') || title.includes('airbnb') || title.includes('vrbo') || title.includes('link') || title.includes('url')) {
        categories['Listings & Links'].push({ label: task.title, value, icon: LinkIcon, taskId });
      } else if (title.includes('cleaner') || title.includes('maintenance') || title.includes('vendor') || title.includes('service')) {
        categories['Service Providers'].push({ label: task.title, value, taskId });
      } else if (title.includes('utility') || title.includes('electric') || title.includes('water') || title.includes('gas') || title.includes('account')) {
        categories['Utilities & Accounts'].push({ label: task.title, value, taskId });
      } else if (title.includes('emergency') || title.includes('safety') || title.includes('fire') || title.includes('alarm')) {
        categories['Emergency & Safety'].push({ label: task.title, value, taskId });
      }
    });

    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  };

  const categorizedData = useMemo(() => organizeTasksByCategory(), [tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        {Object.keys(categorizedData).length > 0 ? (
          <div className="grid gap-4">
            {Object.entries(categorizedData).map(([category, items]) => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                          <p className="text-xs font-medium text-muted-foreground">
                            {item.label}
                          </p>
                        </div>
                        <p className="text-sm ml-5 break-words">{item.value}</p>
                        {item.taskId && (
                          <div className="ml-5 mt-2">
                            <TaskFilePreview taskId={item.taskId} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No property information completed yet. Complete onboarding tasks to see details here.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

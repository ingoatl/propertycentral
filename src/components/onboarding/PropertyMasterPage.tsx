import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { OnboardingTask, FAQ } from "@/types/onboarding";
import { FAQSection } from "./FAQSection";
import { Loader2, MapPin, User, Lock, Phone, Link as LinkIcon, Mail, Home } from "lucide-react";
import { toast } from "sonner";

interface PropertyMasterPageProps {
  projectId: string;
  propertyId?: string;
  propertyName: string;
  propertyAddress: string;
}

interface CategorizedData {
  [category: string]: { label: string; value: string; icon?: any }[];
}

export function PropertyMasterPage({ 
  projectId, 
  propertyId,
  propertyName, 
  propertyAddress 
}: PropertyMasterPageProps) {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all tasks for the project
      const { data: tasksData, error: tasksError } = await supabase
        .from('onboarding_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('phase_number', { ascending: true });

      if (tasksError) throw tasksError;
      setTasks((tasksData || []) as OnboardingTask[]);

      // Load FAQs
      if (propertyId) {
        const { data: faqsData, error: faqsError } = await supabase
          .from('frequently_asked_questions')
          .select('*')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false });

        if (faqsError) throw faqsError;
        setFaqs(faqsData || []);
      }
    } catch (error: any) {
      console.error('Error loading master page data:', error);
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
      if (!task.field_value) return;

      const title = task.title.toLowerCase();
      const value = task.field_value;

      // Categorize based on task title keywords
      if (title.includes('owner') || title.includes('contact')) {
        if (title.includes('email')) {
          categories['Owner Information'].push({ label: task.title, value, icon: Mail });
        } else if (title.includes('phone')) {
          categories['Owner Information'].push({ label: task.title, value, icon: Phone });
        } else if (title.includes('name')) {
          categories['Owner Information'].push({ label: task.title, value, icon: User });
        } else {
          categories['Owner Information'].push({ label: task.title, value });
        }
      } else if (title.includes('code') || title.includes('password') || title.includes('wifi') || title.includes('lock') || title.includes('gate')) {
        categories['Access & Codes'].push({ label: task.title, value, icon: Lock });
      } else if (title.includes('address') || title.includes('bedroom') || title.includes('bathroom') || title.includes('parking')) {
        if (title.includes('address')) {
          categories['Property Details'].push({ label: task.title, value, icon: MapPin });
        } else {
          categories['Property Details'].push({ label: task.title, value, icon: Home });
        }
      } else if (title.includes('listing') || title.includes('airbnb') || title.includes('vrbo') || title.includes('link') || title.includes('url')) {
        categories['Listings & Links'].push({ label: task.title, value, icon: LinkIcon });
      } else if (title.includes('cleaner') || title.includes('maintenance') || title.includes('vendor') || title.includes('service')) {
        categories['Service Providers'].push({ label: task.title, value });
      } else if (title.includes('utility') || title.includes('electric') || title.includes('water') || title.includes('gas') || title.includes('account')) {
        categories['Utilities & Accounts'].push({ label: task.title, value });
      } else if (title.includes('emergency') || title.includes('safety') || title.includes('fire') || title.includes('alarm')) {
        categories['Emergency & Safety'].push({ label: task.title, value });
      }
    });

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const categorizedData = organizeTasksByCategory();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{propertyName}</h2>
        <p className="text-muted-foreground">{propertyAddress}</p>
      </div>

      <Separator />

      {/* Categorized Information */}
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(categorizedData).map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                      <p className="text-sm font-medium text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                    <p className="text-sm ml-6">{item.value}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ Section */}
      {propertyId && (
        <>
          <Separator />
          <FAQSection 
            propertyId={propertyId} 
            projectId={projectId}
            faqs={faqs}
            onUpdate={loadData}
          />
        </>
      )}

      {/* Empty State */}
      {Object.keys(categorizedData).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No property information has been completed yet. Complete onboarding tasks to see information here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

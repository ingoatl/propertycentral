import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OnboardingTask, FAQ } from "@/types/onboarding";
import { Loader2, Search, MapPin, User, Lock, Phone, Link as LinkIcon, Mail, Home, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface PropertyMasterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  propertyId?: string;
  propertyName: string;
  propertyAddress: string;
}

interface CategorizedData {
  [category: string]: { label: string; value: string; icon?: any }[];
}

export function PropertyMasterModal({ 
  open, 
  onOpenChange, 
  projectId, 
  propertyId,
  propertyName, 
  propertyAddress 
}: PropertyMasterModalProps) {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(`Copied ${fieldName}`);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all tasks for the project that have values
      const { data: tasksData, error: tasksError } = await supabase
        .from('onboarding_tasks')
        .select('*')
        .eq('project_id', projectId)
        .not('field_value', 'is', null)
        .neq('field_value', '')
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

    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  };

  const categorizedData = useMemo(() => organizeTasksByCategory(), [tasks]);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return categorizedData;

    const query = searchQuery.toLowerCase();
    const filtered: CategorizedData = {};

    Object.entries(categorizedData).forEach(([category, items]) => {
      const matchingItems = items.filter(item =>
        item.label.toLowerCase().includes(query) ||
        item.value.toLowerCase().includes(query)
      );

      if (matchingItems.length > 0) {
        filtered[category] = matchingItems;
      }
    });

    return filtered;
  }, [categorizedData, searchQuery]);

  // Filter FAQs based on search
  const filteredFaqs = useMemo(() => {
    if (!searchQuery) return faqs;

    const query = searchQuery.toLowerCase();
    return faqs.filter(faq =>
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query) ||
      (faq.category && faq.category.toLowerCase().includes(query))
    );
  }, [faqs, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col max-md:h-screen max-md:max-w-full max-md:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl max-md:text-2xl font-bold">{propertyName}</DialogTitle>
          <p className="text-sm text-muted-foreground max-md:text-lg mt-1">{propertyAddress}</p>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative flex-shrink-0 mt-2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground max-md:h-6 max-md:w-6 max-md:left-4" />
          <Input
            placeholder="Search all property information..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 max-md:h-14 max-md:text-lg max-md:pl-12"
          />
        </div>

        <Separator className="flex-shrink-0" />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary max-md:h-10 max-md:w-10" />
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-6 pr-4 max-md:pr-2 max-md:space-y-5">
              {/* Categorized Information */}
              {Object.keys(filteredData).length > 0 && (
                <div className="grid gap-6 md:grid-cols-2 max-md:grid-cols-1 max-md:gap-5">
                  {Object.entries(filteredData).map(([category, items]) => (
                    <Card key={category} className="max-md:shadow-md">
                      <CardHeader className="max-md:pb-4">
                        <CardTitle className="text-base max-md:text-xl font-semibold">{category}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 max-md:space-y-4">
                        {items.map((item, idx) => {
                          const Icon = item.icon;
                          const isMatch = searchQuery && (
                            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.value.toLowerCase().includes(searchQuery.toLowerCase())
                          );
                          return (
                            <div key={idx} className={`flex items-start justify-between gap-3 py-2 max-md:py-3 ${isMatch ? 'bg-primary/5 p-2 rounded-md max-md:p-3' : ''}`}>
                              <div className="flex-1 min-w-0 space-y-1 max-md:space-y-2">
                                <div className="flex items-center gap-2">
                                  {Icon && <Icon className="h-4 w-4 text-muted-foreground max-md:h-5 max-md:w-5 flex-shrink-0" />}
                                  <p className="text-sm font-medium text-muted-foreground max-md:text-base">
                                    {item.label}
                                  </p>
                                </div>
                                <p className="text-sm ml-6 break-words max-md:text-base max-md:ml-7">{item.value}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 max-md:h-12 max-md:w-12 shrink-0 flex"
                                onClick={() => copyToClipboard(item.value, item.label)}
                              >
                                {copiedField === item.label ? (
                                  <Check className="h-4 w-4 max-md:h-6 max-md:w-6 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4 max-md:h-6 max-md:w-6" />
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* FAQs */}
              {filteredFaqs.length > 0 && (
                <Card className="max-md:shadow-md">
                  <CardHeader className="max-md:pb-4">
                    <CardTitle className="text-base max-md:text-xl font-semibold">Frequently Asked Questions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 max-md:space-y-5">
                    {filteredFaqs.map((faq) => {
                      const isMatch = searchQuery && (
                        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                      return (
                        <div key={faq.id} className={`space-y-2 max-md:space-y-3 ${isMatch ? 'bg-primary/5 p-3 rounded-md max-md:p-4' : ''}`}>
                          <p className="text-sm font-semibold max-md:text-lg">{faq.question}</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap max-md:text-base leading-relaxed">{faq.answer}</p>
                          {faq.category && (
                            <span className="text-xs text-muted-foreground max-md:text-sm">
                              Category: {faq.category}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Empty State */}
              {Object.keys(filteredData).length === 0 && filteredFaqs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery 
                    ? `No results found for "${searchQuery}"`
                    : "No property information available yet."}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
